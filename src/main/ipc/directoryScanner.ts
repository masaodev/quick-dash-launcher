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
 *
 * @param itemPath - アイテムのパス
 * @param itemType - アイテムタイプ（'file' | 'folder'）
 * @param sourceFile - データファイル名
 * @param lineNumber - 行番号（オプション）
 * @param prefix - 表示名に追加するプレフィックス（オプション）
 * @param suffix - 表示名に追加するサフィックス（オプション）
 * @param expandedFrom - フォルダ取込の元となるディレクトリパス（オプション）
 * @param expandedOptions - フォルダ取込オプション情報（人間が読める形式、オプション）
 * @param expandedFromId - フォルダ取込アイテムから展開された場合の元のdirディレクティブID（オプション）
 * @returns LauncherItemオブジェクト
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

  // プレフィックスが指定されている場合は追加
  if (prefix) {
    displayName = `${prefix}: ${displayName}`;
  }

  // サフィックスが指定されている場合は追加
  if (suffix) {
    displayName = `${displayName} (${suffix})`;
  }

  return {
    displayName: displayName,
    path: itemPath,
    type: itemType === 'folder' ? 'folder' : detectItemTypeSync(itemPath),
    sourceFile,
    lineNumber,
    isDirExpanded: expandedFrom ? true : false,
    expandedFrom,
    expandedOptions,
    expandedFromId,
    isEdited: false,
  };
}

/**
 * ショートカットファイル（.lnk）を解析してLauncherItemに変換する
 * Electronのネイティブ機能を使用してショートカットの詳細を読み取り、
 * LauncherItemオブジェクトを生成する
 *
 * @param filePath - 解析対象のショートカットファイルのパス
 * @param sourceFile - データファイル名
 * @param lineNumber - 行番号（オプション）
 * @param displayName - 表示名（オプション、未指定の場合はファイル名から自動生成）
 * @param prefix - 表示名に追加するプレフィックス（オプション）
 * @param suffix - 表示名に追加するサフィックス（オプション）
 * @param expandedFrom - フォルダ取込の元となるディレクトリパス（オプション）
 * @param expandedOptions - フォルダ取込オプション情報（人間が読める形式、オプション）
 * @param expandedFromId - フォルダ取込アイテムから展開された場合の元のdirディレクティブID（オプション）
 * @returns LauncherItemオブジェクト。解析に失敗した場合はnull
 * @throws Error ショートカットファイルの読み込みに失敗した場合（ログに記録され、nullを返す）
 *
 * @example
 * ```typescript
 * const item = processShortcut('C:\\Users\\Desktop\\MyApp.lnk', 'data.txt', 10, 'マイアプリ', 'デスクトップ');
 * // { name: 'デスクトップ: マイアプリ', path: 'C:\\Program Files\\MyApp\\app.exe', type: 'app', ... }
 * ```
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
    // Electron のネイティブ機能を使用してショートカットを読み取り
    const shortcutDetails = shell.readShortcutLink(filePath);

    if (shortcutDetails && shortcutDetails.target) {
      // 表示名が指定されていない場合はファイル名から自動生成
      let name = displayName || path.basename(filePath, '.lnk');

      // プレフィックスが指定されている場合は追加
      if (prefix) {
        name = `${prefix}: ${name}`;
      }

      // サフィックスが指定されている場合は追加
      if (suffix) {
        name = `${name} (${suffix})`;
      }

      // ターゲットパスの存在確認とディレクトリ判定
      let targetType: LauncherItem['type'];
      if (
        FileUtils.exists(shortcutDetails.target) &&
        FileUtils.isDirectory(shortcutDetails.target)
      ) {
        targetType = 'folder';
      } else {
        targetType = detectItemTypeSync(shortcutDetails.target);
      }

      return {
        displayName: name,
        path: filePath,
        type: targetType,
        args:
          shortcutDetails.args && shortcutDetails.args.trim() ? shortcutDetails.args : undefined,
        originalPath: shortcutDetails.target,
        sourceFile,
        lineNumber,
        isDirExpanded: expandedFrom ? true : false,
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
 * フォルダ取込アイテムで使用される主要な機能で、深度制限、タイプフィルター、パターンマッチングに対応
 *
 * @param dirPath - スキャン対象のディレクトリパス
 * @param options - スキャンオプション（深度、タイプ、フィルター等）
 * @param sourceFile - データファイル名
 * @param rootDirPath - フォルダ取込の元となるルートディレクトリパス（オプション）
 * @param optionsText - フォルダ取込オプション情報（人間が読める形式、オプション）
 * @param lineNumber - データファイル内の行番号（オプション）
 * @param expandedFromId - フォルダ取込アイテムから展開された場合の元のdirディレクティブID（オプション）
 * @param currentDepth - 現在の再帰深度（内部使用、初期値は0）
 * @returns LauncherItem配列
 * @throws ディレクトリアクセス権限エラー、ファイルシステムエラー
 *
 * @example
 * const items = await scanDirectory('/home/user/documents', {
 *   depth: 2,
 *   types: 'file',
 *   filter: '*.pdf',
 *   prefix: 'Doc: '
 * }, 'data.txt', '/home/user/documents', '深さ:2, タイプ:ファイルのみ', 15, 'abc12345');
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

  // 深さ制限チェック
  if (options.depth !== -1 && currentDepth > options.depth) {
    return results;
  }

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);

      // エラーハンドリング: アクセスできないファイル/フォルダーをスキップ
      let stat;
      try {
        stat = fs.statSync(itemPath);
      } catch (error) {
        dataLogger.warn({ itemPath, error }, 'アイテムにアクセスできません');
        continue;
      }

      const isDirectory = stat.isDirectory();
      const itemName = path.basename(itemPath);

      // 除外パターンチェック
      if (options.exclude && minimatch(itemName, options.exclude)) {
        continue;
      }

      // フィルターパターンチェック
      if (options.filter && !minimatch(itemName, options.filter)) {
        // サブディレクトリの場合は、中身をスキャンする可能性があるのでスキップしない
        if (!isDirectory) {
          continue;
        }
      }

      // タイプによる処理
      if (isDirectory) {
        // フォルダーを結果に含める
        if (options.types === 'folder' || options.types === 'both') {
          // フィルターがない、またはフィルターにマッチする場合のみ追加
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

        // サブディレクトリをスキャン
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
        // ファイルを結果に含める
        if (options.types === 'file' || options.types === 'both') {
          // .lnkファイルの場合は特別処理
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
  // パスを正規化して絶対パスに変換
  const normalizedPath = path.normalize(path.resolve(dirPath));

  // パストラバーサル攻撃対策: 正規化後のパスが元のパスと大きく異なる場合は拒否
  // ただし、相対パスから絶対パスへの変換は許可
  if (normalizedPath.includes('..')) {
    dataLogger.warn({ dirPath, normalizedPath }, '不正なパス: ディレクトリトラバーサルの可能性');
    return [];
  }

  if (!FileUtils.exists(normalizedPath) || !FileUtils.isDirectory(normalizedPath)) {
    return [];
  }

  try {
    // デフォルト値とマージして処理用オプションを作成
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
      dirItemId // 元のフォルダ取込アイテムのID
    );
  } catch (error) {
    dataLogger.error({ dirPath: normalizedPath, error }, 'ディレクトリのスキャンに失敗');
    return [];
  }
}
