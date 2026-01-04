/**
 * ディレクティブ判定・解析ユーティリティ
 *
 * data.txtファイル内のディレクティブ行（group, dir）の判定と解析を行います。
 */

import type { RawDataLine } from '../types';

import { parseDirOptionsFromString, type DirOptions } from './dataConverters';
import { parseCSVLine } from './csvParser';

/**
 * グループディレクティブかどうかを判定する
 *
 * @param line - 判定対象のRawDataLine
 * @returns グループディレクティブの場合true
 *
 * @example
 * const line = { type: 'directive', content: 'group,開発ツール,VSCode,Git' };
 * isGroupDirective(line); // true
 */
export function isGroupDirective(line: RawDataLine): boolean {
  return line.type === 'directive' && line.content.trim().startsWith('group,');
}

/**
 * フォルダ取込ディレクティブかどうかを判定する
 *
 * @param line - 判定対象のRawDataLine
 * @returns フォルダ取込ディレクティブの場合true
 *
 * @example
 * const line = { type: 'directive', content: 'dir,C:\\docs,depth=2,filter=*.pdf' };
 * isDirDirective(line); // true
 */
export function isDirDirective(line: RawDataLine): boolean {
  return line.type === 'directive' && line.content.trim().startsWith('dir,');
}

/**
 * グループディレクティブを解析する
 *
 * @param line - 解析対象のRawDataLine
 * @returns グループ名とアイテム名のリスト
 *
 * @example
 * const line = { type: 'directive', content: 'group,開発ツール,VSCode,Git,Docker' };
 * parseGroupDirective(line);
 * // { groupName: '開発ツール', itemNames: ['VSCode', 'Git', 'Docker'] }
 */
export function parseGroupDirective(line: RawDataLine): {
  groupName: string;
  itemNames: string[];
} {
  const parts = parseCSVLine(line.content);
  const groupName = parts[1] || '';
  const itemNames = parts.slice(2).filter((name) => name);

  return { groupName, itemNames };
}

/**
 * フォルダ取込ディレクティブを解析する
 *
 * @param line - 解析対象のRawDataLine
 * @returns ディレクトリパスとオプション
 *
 * @example
 * const line = { type: 'directive', content: 'dir,C:\\docs,depth=2,filter=*.pdf,prefix=Doc: ' };
 * parseDirDirective(line);
 * // {
 * //   dirPath: 'C:\\docs',
 * //   options: { depth: 2, types: 'both', filter: '*.pdf', prefix: 'Doc: ' }
 * // }
 */
export function parseDirDirective(line: RawDataLine): {
  dirPath: string;
  options: DirOptions;
} {
  const parts = parseCSVLine(line.content);
  const dirPath = parts[1] || '';
  const optionsStr = parts.slice(2).join(',').trim();

  const options = parseDirOptionsFromString(optionsStr);

  return { dirPath, options };
}

/**
 * ウィンドウ操作ディレクティブかどうかを判定する
 *
 * @param line - 判定対象のRawDataLine
 * @returns ウィンドウ操作ディレクティブの場合true
 *
 * @example
 * const line = { type: 'directive', content: 'window,Chrome,100,100,1920,1080' };
 * isWindowOperationDirective(line); // true
 */
export function isWindowOperationDirective(line: RawDataLine): boolean {
  return line.type === 'directive' && line.content.trim().startsWith('window,');
}

/**
 * ウィンドウ操作ディレクティブを解析する
 *
 * JSON形式のみをサポートします。
 *
 * @param line - 解析対象のRawDataLine
 * @returns ウィンドウタイトルと位置・サイズ情報
 * @throws JSON形式でない場合、またはパースに失敗した場合はエラーをスロー
 *
 * @example
 * // JSON形式
 * const line = { type: 'directive', content: 'window,{"name":"表示名","windowTitle":"Chrome","x":100,"y":100}' };
 * parseWindowOperationDirective(line);
 * // { name: '表示名', windowTitle: 'Chrome', x: 100, y: 100 }
 */
export function parseWindowOperationDirective(line: RawDataLine): {
  name: string;
  windowTitle: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  virtualDesktopNumber?: number;
  activateWindow?: boolean;
} {
  const parts = parseCSVLine(line.content);

  // JSON形式のみサポート
  if (!parts[1] || !parts[1].trim().startsWith('{')) {
    throw new Error(
      `ウィンドウ操作アイテムはJSON形式で記述する必要があります。形式: window,{"name":"表示名","windowTitle":"ウィンドウタイトル",...}`
    );
  }

  try {
    const config = JSON.parse(parts[1]);
    return {
      name: config.name || '',
      windowTitle: config.windowTitle || '',
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      virtualDesktopNumber: config.virtualDesktopNumber,
      activateWindow: config.activateWindow,
    };
  } catch (error) {
    throw new Error(
      `ウィンドウ操作アイテムのJSON形式が不正です: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
