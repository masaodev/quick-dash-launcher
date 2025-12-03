/**
 * ディレクティブ判定・解析ユーティリティ
 *
 * data.txtファイル内のディレクティブ行（group, dir）の判定と解析を行います。
 */

import type { RawDataLine } from '../types';

import { parseDirOptionsFromString, type DirOptions } from './dataConverters';

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
  const parts = line.content.split(',');
  const groupName = parts[1]?.trim() || '';
  const itemNames = parts
    .slice(2)
    .map((name) => name.trim())
    .filter((name) => name);

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
  const parts = line.content.split(',');
  const dirPath = parts[1]?.trim() || '';
  const optionsStr = parts.slice(2).join(',').trim();

  const options = parseDirOptionsFromString(optionsStr);

  return { dirPath, options };
}
