/**
 * 登録関連の型定義
 *
 * RegisterModal、フォルダ取込、ウィンドウ操作アイテムで使用される型定義と関数を提供します。
 */

import type { WindowConfig, LauncherItem } from './launcher';
import type { JsonDirOptions } from './json-data';

/**
 * ウィンドウ操作アイテムの設定オブジェクト型定義
 *
 * RegisterModalで使用されるウィンドウ操作アイテムの編集用型。
 * JsonWindowItem（JSON形式のデータ型）と同じフィールドを持つが、
 * 編集フローでの使用を目的としているため別の型として定義されています。
 *
 * @see JsonWindowItem - JSON形式のウィンドウ操作アイテム
 */
export interface WindowOperationConfig {
  displayName: string;
  windowTitle: string;
  processName?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  moveToActiveMonitorCenter?: boolean;
  virtualDesktopNumber?: number;
  activateWindow?: boolean;
  pinToAllDesktops?: boolean;
}

/**
 * フォルダ取込アイテムのオプション型定義
 * @deprecated JsonDirOptionsを使用してください
 */
export type DirOptions = JsonDirOptions;

/**
 * RegisterModalで使用されるアイテム型
 */
export interface RegisterItem {
  displayName: string;
  path: string;
  type: LauncherItem['type'];
  args?: string;
  targetTab: string;
  targetFile?: string;
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
  customIcon?: string;
  windowConfig?: WindowConfig;
  itemCategory: 'item' | 'dir' | 'group' | 'window';
  dirOptions?: DirOptions;
  groupItemNames?: string[];
  windowOperationConfig?: WindowOperationConfig;
}

/**
 * カンマ区切りのオプション文字列をJsonDirOptionsオブジェクトに変換する
 *
 * @param optionsStr - カンマ区切りのオプション文字列（例: "depth=2,filter=*.pdf,prefix=Doc: "）
 * @returns 解析されたJsonDirOptionsオブジェクト
 *
 * @example
 * const options = parseDirOptionsFromString("depth=2,filter=*.pdf,prefix=Doc: ");
 * // { depth: 2, types: 'both', filter: '*.pdf', prefix: 'Doc: ' }
 */
export function parseDirOptionsFromString(optionsStr: string): JsonDirOptions {
  const dirOptions: JsonDirOptions = {};

  if (!optionsStr) {
    return dirOptions;
  }

  const options = optionsStr.split(',');
  for (const option of options) {
    const [key, value] = option.split('=');
    if (key && value) {
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();

      switch (trimmedKey) {
        case 'depth':
          dirOptions.depth = parseInt(trimmedValue, 10) || 0;
          break;
        case 'types':
          if (trimmedValue === 'file' || trimmedValue === 'folder' || trimmedValue === 'both') {
            dirOptions.types = trimmedValue;
          }
          break;
        case 'filter':
          dirOptions.filter = trimmedValue;
          break;
        case 'exclude':
          dirOptions.exclude = trimmedValue;
          break;
        case 'prefix':
          dirOptions.prefix = trimmedValue;
          break;
        case 'suffix':
          dirOptions.suffix = trimmedValue;
          break;
      }
    }
  }

  return dirOptions;
}

/**
 * JsonDirOptionsオブジェクトをカンマ区切りのオプション文字列に変換する
 *
 * @param dirOptions - JsonDirOptionsオブジェクト
 * @returns カンマ区切りのオプション文字列
 *
 * @example
 * const optionsStr = formatDirOptionsToString({ depth: 2, types: 'file', filter: '*.pdf' });
 * // "depth=2,types=file,filter=*.pdf"
 */
export function formatDirOptionsToString(dirOptions: JsonDirOptions): string {
  const options: string[] = [];

  if (dirOptions.depth !== undefined && dirOptions.depth !== 0) {
    options.push(`depth=${dirOptions.depth}`);
  }
  if (dirOptions.types && dirOptions.types !== 'both') {
    options.push(`types=${dirOptions.types}`);
  }
  if (dirOptions.filter) {
    options.push(`filter=${dirOptions.filter}`);
  }
  if (dirOptions.exclude) {
    options.push(`exclude=${dirOptions.exclude}`);
  }
  if (dirOptions.prefix) {
    options.push(`prefix=${dirOptions.prefix}`);
  }
  if (dirOptions.suffix) {
    options.push(`suffix=${dirOptions.suffix}`);
  }

  return options.join(',');
}
