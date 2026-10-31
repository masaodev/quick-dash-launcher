import * as path from 'path';
import * as fs from 'fs';

import { shell } from 'electron';
import { matchesDirPattern } from '@common/utils/dirExclude';
import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import type { DirOptionsForProcessing, JsonDirOptions } from '@common/types/json-data';
import { DIR_OPTIONS_DEFAULTS, DIR_PREVIEW_TIMEOUT_MS } from '@common/types/json-data';
import { detectFileItemTypeSync, detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { LauncherItem } from '@common/types';
import type { DirPreviewItem, DirPreviewResult, DirPreviewStatus } from '@common/types';

/** 表示名の前後に、入力したとおりの文字を付ける（区切りや括弧は足さない） */
export function applyPrefixSuffix(name: string, prefix?: string, suffix?: string): string {
  return `${prefix ?? ''}${name}${suffix ?? ''}`;
}

function processItem(
  itemPath: string,
  itemType: 'file' | 'folder',
  sourceFile: string,
  lineNumber?: number,
  prefix?: string,
  suffix?: string,
  expandedFrom?: string,
  expandedOptions?: DirOptionsForProcessing,
  expandedFromId?: string
): LauncherItem {
  return {
    displayName: applyPrefixSuffix(path.basename(itemPath), prefix, suffix),
    path: itemPath,
    // ディスクでファイルと分かっているので、拡張子が無くてもフォルダにしない
    type: itemType === 'folder' ? 'folder' : detectFileItemTypeSync(itemPath),
    sourceFile,
    lineNumber,
    isDirExpanded: !!expandedFrom,
    expandedFrom,
    expandedOptions,
    expandedFromId,
    isEdited: false,
  };
}

/**
 * ショートカットファイル（.lnk）を解析してLauncherItemに変換する
 */
export function processShortcut(
  filePath: string,
  sourceFile: string,
  lineNumber?: number,
  displayName?: string,
  prefix?: string,
  suffix?: string,
  expandedFrom?: string,
  expandedOptions?: DirOptionsForProcessing,
  expandedFromId?: string
): LauncherItem | null {
  try {
    const shortcutDetails = shell.readShortcutLink(filePath);

    if (shortcutDetails?.target) {
      const name = applyPrefixSuffix(
        displayName || path.basename(filePath, '.lnk'),
        prefix,
        suffix
      );

      // リンク先が実在すればディスクの種類に従う（拡張子の無いファイルをフォルダにしない）
      const targetExists = FileUtils.exists(shortcutDetails.target);
      const targetType: LauncherItem['type'] = !targetExists
        ? detectItemTypeSync(shortcutDetails.target)
        : FileUtils.isDirectory(shortcutDetails.target)
          ? 'folder'
          : detectFileItemTypeSync(shortcutDetails.target);

      return {
        displayName: name,
        path: filePath,
        type: targetType,
        args: shortcutDetails.args?.trim() || undefined,
        originalPath: shortcutDetails.target,
        sourceFile,
        lineNumber,
        isDirExpanded: !!expandedFrom,
        expandedFrom,
        expandedOptions,
        expandedFromId,
        isEdited: false,
      };
    }
  } catch (error) {
    dataLogger.error({ filePath, error }, 'ショートカットの読み込みに失敗');
  }

  return null;
}

/** 走査を途中で打ち切るための指定（登録画面のプレビューで使う。メイン画面の読み込みでは渡さない） */
export interface ScanLimits {
  /** 中止・時間切れ。立ったらその場で走査をやめ、そこまでの結果を返す */
  signal?: AbortSignal;
  /** これだけ見つけたら走査をやめる */
  maxItems?: number;
}

/**
 * 指定されたディレクトリを再帰的にスキャンし、指定されたオプションに基づいてファイル/フォルダを抽出する
 *
 * 応答の遅いネットワークのフォルダでもメインプロセスを止めないよう、ファイルシステムは非同期で読む
 */
async function scanDirectory(
  dirPath: string,
  options: DirOptionsForProcessing,
  sourceFile: string,
  rootDirPath?: string,
  expandedOptions?: DirOptionsForProcessing,
  lineNumber?: number,
  expandedFromId?: string,
  limits?: ScanLimits
): Promise<LauncherItem[]> {
  const results: LauncherItem[] = [];
  const shouldStop = () =>
    !!limits?.signal?.aborted ||
    (limits?.maxItems !== undefined && results.length >= limits.maxItems);

  const walk = async (currentDir: string, currentDepth: number): Promise<void> => {
    if (options.depth !== -1 && currentDepth > options.depth) return;

    let items: string[];
    try {
      items = await fs.promises.readdir(currentDir);
    } catch (error) {
      dataLogger.error({ dirPath: currentDir, error }, 'ディレクトリのスキャンに失敗');
      return;
    }

    for (const item of items) {
      if (shouldStop()) return;
      const itemPath = path.join(currentDir, item);

      let stat;
      try {
        stat = await fs.promises.stat(itemPath);
      } catch (error) {
        dataLogger.warn({ itemPath, error }, 'アイテムにアクセスできません');
        continue;
      }

      const isDirectory = stat.isDirectory();
      const itemName = path.basename(itemPath);

      if (options.exclude && matchesDirPattern(itemName, options.exclude)) {
        continue;
      }

      if (options.filter && !matchesDirPattern(itemName, options.filter)) {
        if (!isDirectory) {
          continue;
        }
      }

      if (isDirectory) {
        if (options.types === 'folder' || options.types === 'both') {
          if (!options.filter || matchesDirPattern(itemName, options.filter)) {
            results.push(
              processItem(
                itemPath,
                'folder',
                sourceFile,
                lineNumber,
                options.prefix,
                options.suffix,
                rootDirPath,
                expandedOptions,
                expandedFromId
              )
            );
          }
        }

        if (currentDepth < options.depth || options.depth === -1) {
          await walk(itemPath, currentDepth + 1);
        }
      } else if (options.types === 'file' || options.types === 'both') {
        if (path.extname(itemPath).toLowerCase() === '.lnk') {
          const processedShortcut = processShortcut(
            itemPath,
            sourceFile,
            lineNumber,
            undefined,
            options.prefix,
            options.suffix,
            rootDirPath,
            expandedOptions,
            expandedFromId
          );
          if (processedShortcut) {
            results.push(processedShortcut);
          }
        } else {
          results.push(
            processItem(
              itemPath,
              'file',
              sourceFile,
              lineNumber,
              options.prefix,
              options.suffix,
              rootDirPath,
              expandedOptions,
              expandedFromId
            )
          );
        }
      }
    }
  };

  await walk(dirPath, 0);
  return limits?.maxItems !== undefined ? results.slice(0, limits.maxItems) : results;
}

/** 保存形式のオプション（省略あり）を、走査に使う形（既定を埋めたもの）にする */
function toProcessOptions(options: JsonDirOptions | undefined): DirOptionsForProcessing {
  return {
    depth: options?.depth ?? DIR_OPTIONS_DEFAULTS.depth,
    types: options?.types ?? DIR_OPTIONS_DEFAULTS.types,
    filter: options?.filter,
    exclude: options?.exclude,
    prefix: options?.prefix,
    suffix: options?.suffix,
  };
}

/**
 * フォルダ取込アイテムを処理する
 * @param dirPath - ディレクトリパス
 * @param options - フォルダ取込オプション（undefinedの場合はデフォルト値を使用）
 * @param sourceFile - データファイル名
 * @param lineNumber - 行番号
 * @returns LauncherItem配列
 */
export async function processDirectoryItem(
  dirPath: string,
  options: JsonDirOptions | undefined,
  sourceFile: string,
  lineNumber: number,
  dirItemId?: string
): Promise<LauncherItem[]> {
  const normalizedPath = path.normalize(path.resolve(dirPath));

  if (normalizedPath.includes('..')) {
    dataLogger.warn({ dirPath, normalizedPath }, '不正なパス: ディレクトリトラバーサルの可能性');
    return [];
  }

  if (!FileUtils.exists(normalizedPath) || !FileUtils.isDirectory(normalizedPath)) {
    return [];
  }

  try {
    const processOptions = toProcessOptions(options);
    return await scanDirectory(
      normalizedPath,
      processOptions,
      sourceFile,
      normalizedPath,
      processOptions,
      lineNumber,
      dirItemId
    );
  } catch (error) {
    dataLogger.error({ dirPath: normalizedPath, error }, 'ディレクトリのスキャンに失敗');
    return [];
  }
}

/** プレビューで探す件数の上限（これを超えたら走査をやめ、「〜件以上」と出す） */
const DIR_PREVIEW_MAX_ITEMS = 1000;

/**
 * 登録・編集画面のフォルダ取込のプレビュー。登録したときと同じ走査（scanDirectory）で、何が並ぶかを返す
 *
 * signal で中止でき、時間切れ・件数の上限で打ち切る。応答しないフォルダで readdir が返ってこなくても、
 * 中止・時間切れの時点で結果を返す（走査そのものは裏で終わるのを待たずに捨てる）
 */
export async function previewDirectoryItems(
  dirPath: string,
  options: JsonDirOptions | undefined,
  signal?: AbortSignal,
  { timeoutMs = DIR_PREVIEW_TIMEOUT_MS, maxItems = DIR_PREVIEW_MAX_ITEMS } = {}
): Promise<DirPreviewResult> {
  const empty = (status: DirPreviewStatus): DirPreviewResult => ({
    status,
    items: [],
    truncated: false,
  });
  if (!dirPath.trim()) return empty('notFound');
  const normalizedPath = path.normalize(path.resolve(dirPath));
  if (normalizedPath.includes('..')) return empty('notFound');

  // 中止（画面から）と時間切れを 1 つの signal にまとめる
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onAbort);
  const stopped = new Promise<'stopped'>((resolve) => {
    if (controller.signal.aborted) resolve('stopped');
    controller.signal.addEventListener('abort', () => resolve('stopped'));
  });
  const stoppedStatus = (): DirPreviewStatus => (timedOut ? 'timeout' : 'cancelled');

  try {
    const stat = await Promise.race([fs.promises.stat(normalizedPath).catch(() => null), stopped]);
    if (stat === 'stopped') return empty(stoppedStatus());
    if (!stat) return empty('notFound');
    if (!stat.isDirectory()) return empty('notFolder');

    const processOptions = toProcessOptions(options);
    // 上限を 1 件超えて探し、まだあるかを見分ける
    const scanned = await Promise.race([
      scanDirectory(
        normalizedPath,
        processOptions,
        '',
        normalizedPath,
        processOptions,
        undefined,
        undefined,
        { signal: controller.signal, maxItems: maxItems + 1 }
      ),
      stopped,
    ]);
    if (scanned === 'stopped' || controller.signal.aborted) return empty(stoppedStatus());

    const items = scanned.slice(0, maxItems).map((item): DirPreviewItem => {
      const name = path.basename(item.path);
      const baseName = item.originalPath ? path.basename(item.path, '.lnk') : name;
      const location = path.relative(normalizedPath, path.dirname(item.path));
      return {
        displayName: item.displayName,
        baseName,
        isFolder: item.type === 'folder' && !item.originalPath,
        location,
        ...(item.originalPath && { shortcutTarget: item.originalPath }),
      };
    });
    return { status: 'ok', items, truncated: scanned.length > maxItems };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
