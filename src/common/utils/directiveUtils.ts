/**
 * ディレクティブ解析ユーティリティ
 *
 * ウィンドウ操作ディレクティブの解析を行います。
 */

import type { WindowOperationConfig } from '../types/register.js';

import { parseDisplayTextFields } from './displayTextConverter';

/**
 * ウィンドウ操作アイテムのJSON設定を安全にパースする
 *
 * JSON形式の検証とパースを一元化し、エラーハンドリングを統一します。
 *
 * @param configString - パース対象のJSON文字列
 * @returns パースされた設定オブジェクト
 * @throws {Error} JSON形式でない場合、またはパースに失敗した場合
 *
 * @example
 * const config = parseWindowOperationConfig('{"displayName":"表示名","windowTitle":"Chrome"}');
 * // { displayName: '表示名', windowTitle: 'Chrome' }
 */
export function parseWindowOperationConfig(configString: string): WindowOperationConfig {
  if (!configString || !configString.trim().startsWith('{')) {
    throw new Error(
      'ウィンドウ操作アイテムはJSON形式で記述する必要があります。形式: {"displayName":"表示名","windowTitle":"ウィンドウタイトル",...}'
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
 * ウィンドウ操作ディレクティブ文字列を解析する
 *
 * JSON形式のみをサポートします。
 *
 * @param content - 解析対象のディレクティブ文字列（例: 'window,{"displayName":"表示名",...}'）
 * @returns ウィンドウ操作設定
 * @throws JSON形式でない場合、またはパースに失敗した場合はエラーをスロー
 */
export function parseWindowOperationDirectiveContent(content: string): WindowOperationConfig {
  const parts = parseDisplayTextFields(content);
  return parseWindowOperationConfig(parts[1] || '');
}
