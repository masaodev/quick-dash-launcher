/**
 * ディレクティブ解析ユーティリティ
 *
 * ウィンドウ操作ディレクティブの解析を行います。
 */

import type { RawDataLine } from '../types';
import type { WindowOperationConfig } from '../types/register.js';

import { parseCSVLine } from './displayTextConverter';

/**
 * ウィンドウ操作アイテムのJSON設定を安全にパースする
 *
 * JSON形式の検証とパースを一元化し、エラーハンドリングを統一します。
 * App.tsxやEditableRawItemList.tsxなど、複数箇所で使用されるJSON.parseロジックを共通化します。
 *
 * @param configString - パース対象のJSON文字列（CSV形式でエスケープされている場合はparseCSVLineで事前処理が必要）
 * @returns パースされた設定オブジェクト
 * @throws {Error} JSON形式でない場合、またはパースに失敗した場合
 *
 * @example
 * // CSV形式でエスケープされたJSON文字列をparseCSVLineで事前処理
 * const parts = parseCSVLine('window,"{""name"":""表示名"",""windowTitle"":""Chrome""}"');
 * const config = parseWindowOperationConfig(parts[1]);
 * // { name: '表示名', windowTitle: 'Chrome' }
 *
 * @example
 * // 不正なJSON形式の場合はエラーをスロー
 * parseWindowOperationConfig('{invalid}');
 * // Error: ウィンドウ操作アイテムのJSON形式が不正です: ...
 */
export function parseWindowOperationConfig(configString: string): WindowOperationConfig {
  if (!configString || !configString.trim().startsWith('{')) {
    throw new Error(
      'ウィンドウ操作アイテムはJSON形式で記述する必要があります。形式: {"name":"表示名","windowTitle":"ウィンドウタイトル",...}'
    );
  }

  try {
    const config = JSON.parse(configString);
    return {
      displayName: config.displayName || config.name || '',
      windowTitle: config.windowTitle || '',
      processName: config.processName,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      moveToActiveMonitorCenter: config.moveToActiveMonitorCenter,
      virtualDesktopNumber: config.virtualDesktopNumber,
      activateWindow: config.activateWindow,
      pinToAllDesktops: config.pinToAllDesktops,
    };
  } catch (error) {
    throw new Error(
      `ウィンドウ操作アイテムのJSON形式が不正です: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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
export function parseWindowOperationDirective(line: RawDataLine): WindowOperationConfig {
  const parts = parseCSVLine(line.content);
  // parseWindowOperationConfigヘルパーを使用してJSON形式を安全にパース
  return parseWindowOperationConfig(parts[1] || '');
}
