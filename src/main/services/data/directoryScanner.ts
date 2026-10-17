import * as path from 'path';
import * as fs from 'fs';

import { shell } from 'electron';
import { minimatch } from 'minimatch';
import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import type { DirOptionsForProcessing, JsonDirOptions } from '@common/types/json-data';
import { DIR_OPTIONS_DEFAULTS } from '@common/types/json-data';
import { detectFileItemTypeSync, detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { LauncherItem } from '@common/types';

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

/**
 * 指定されたディレクトリを再帰的にスキャンし、指定されたオプションに基づいてファイル/フォルダを抽出する
 */
export async function scanDirectory(
  dirPath: string,
  options: DirOptionsForProcessing,
  sourceFile: string,
  rootDirPath?: string,
  expandedOptions?: DirOptionsForProcessing,
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
                expandedOptions,
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
            expandedOptions,
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
