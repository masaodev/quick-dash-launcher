import * as path from 'path';
import * as fs from 'fs';

import { shell } from 'electron';
import { minimatch } from 'minimatch';
import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import type { DirOptionsForProcessing, JsonDirOptions } from '@common/types/json-data';
import { DIR_OPTIONS_DEFAULTS } from '@common/types/json-data';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { LauncherItem } from '@common/types';

/**
 * DirOptionsForProcessingを人間が読める形式の文字列に変換する
 *
 * @param options - DirOptionsForProcessingオブジェクト
 * @returns 人間が読める形式の文字列（例：「深さ:2, タイプ:ファイルのみ, フィルター:*.pdf」）
 */
export function formatDirOptions(options: DirOptionsForProcessing): string {
  const parts: string[] = [];

  // 深さ
  if (options.depth === -1) {
    parts.push('深さ:無制限');
  } else {
    parts.push(`深さ:${options.depth}`);
  }

  // タイプ
  const typeLabels: Record<typeof options.types, string> = {
    file: 'ファイルのみ',
    folder: 'フォルダのみ',
    both: 'ファイルとフォルダ',
  };
  parts.push(`タイプ:${typeLabels[options.types]}`);

  // フィルター
  if (options.filter) {
    parts.push(`フィルター:${options.filter}`);
  }

  // 除外
  if (options.exclude) {
    parts.push(`除外:${options.exclude}`);
  }

  // プレフィックス
  if (options.prefix) {
    parts.push(`接頭辞:${options.prefix}`);
  }

  // サフィックス
  if (options.suffix) {
    parts.push(`接尾辞:${options.suffix}`);
  }

  return parts.join(', ');
}

/**
 * ファイル/フォルダーをLauncherItemに変換する
 */
function processItem(
  itemPath: string,
  itemType: 'file' | 'folder',
  sourceFile: string,
  lineNumber?: number,
  prefix?: string,
  suffix?: string,
  expandedFrom?: string,
  expandedOptions?: string,
  expandedFromId?: string
): LauncherItem {
  let displayName = path.basename(itemPath);

  if (prefix) {
    displayName = `${prefix}: ${displayName}`;
  }

  if (suffix) {
    displayName = `${displayName} (${suffix})`;
  }

  return {
    displayName,
    path: itemPath,
    type: itemType === 'folder' ? 'folder' : detectItemTypeSync(itemPath),
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
  expandedOptions?: string,
  expandedFromId?: string
): LauncherItem | null {
  try {
    const shortcutDetails = shell.readShortcutLink(filePath);

    if (shortcutDetails?.target) {
      let name = displayName || path.basename(filePath, '.lnk');

      if (prefix) {
        name = `${prefix}: ${name}`;
      }

      if (suffix) {
        name = `${name} (${suffix})`;
      }

      const targetType: LauncherItem['type'] =
        FileUtils.exists(shortcutDetails.target) && FileUtils.isDirectory(shortcutDetails.target)
          ? 'folder'
          : detectItemTypeSync(shortcutDetails.target);

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

/**
 * 指定されたディレクトリを再帰的にスキャンし、指定されたオプションに基づいてファイル/フォルダを抽出する
 */
export async function scanDirectory(
  dirPath: string,
  options: DirOptionsForProcessing,
  sourceFile: string,
  rootDirPath?: string,
  optionsText?: string,
  lineNumber?: number,
  expandedFromId?: string,
  currentDepth = 0
): Promise<LauncherItem[]> {
  const results: LauncherItem[] = [];

  if (options.depth !== -1 && currentDepth > options.depth) {
    return results;
  }

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);

      let stat;
      try {
        stat = fs.statSync(itemPath);
      } catch (error) {
        dataLogger.warn({ itemPath, error }, 'アイテムにアクセスできません');
        continue;
      }

      const isDirectory = stat.isDirectory();
      const itemName = path.basename(itemPath);

      if (options.exclude && minimatch(itemName, options.exclude)) {
        continue;
      }

      if (options.filter && !minimatch(itemName, options.filter)) {
        if (!isDirectory) {
          continue;
        }
      }

      if (isDirectory) {
        if (options.types === 'folder' || options.types === 'both') {
          if (!options.filter || minimatch(itemName, options.filter)) {
            results.push(
              processItem(
                itemPath,
                'folder',
                sourceFile,
                lineNumber,
                options.prefix,
                options.suffix,
                rootDirPath,
                optionsText,
                expandedFromId
              )
            );
          }
        }

        if (currentDepth < options.depth || options.depth === -1) {
          const subResults = await scanDirectory(
            itemPath,
            options,
            sourceFile,
            rootDirPath,
            optionsText,
            lineNumber,
            expandedFromId,
            currentDepth + 1
          );
          results.push(...subResults);
        }
      } else {
        if (options.types === 'file' || options.types === 'both') {
          if (path.extname(itemPath).toLowerCase() === '.lnk') {
            const processedShortcut = processShortcut(
              itemPath,
              sourceFile,
              lineNumber,
              undefined,
              options.prefix,
              options.suffix,
              rootDirPath,
              optionsText,
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
                optionsText,
                expandedFromId
              )
            );
          }
        }
      }
    }
  } catch (error) {
    dataLogger.error({ dirPath, error }, 'ディレクトリのスキャンに失敗');
  }

  return results;
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
    const processOptions: DirOptionsForProcessing = {
      depth: options?.depth ?? DIR_OPTIONS_DEFAULTS.depth,
      types: options?.types ?? DIR_OPTIONS_DEFAULTS.types,
      filter: options?.filter,
      exclude: options?.exclude,
      prefix: options?.prefix,
      suffix: options?.suffix,
    };
    const optionsText = formatDirOptions(processOptions);
    return await scanDirectory(
      normalizedPath,
      processOptions,
      sourceFile,
      normalizedPath,
      optionsText,
      lineNumber,
      dirItemId
    );
  } catch (error) {
    dataLogger.error({ dirPath: normalizedPath, error }, 'ディレクトリのスキャンに失敗');
    return [];
  }
}
