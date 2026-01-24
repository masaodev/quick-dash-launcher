/**
 * WindowConfig のパース・シリアライズユーティリティ
 * 文字列形式とJSON形式の両方をサポート
 */
import type { WindowConfig } from '../types/index.js';

/**
 * 文字列またはJSON形式からWindowConfigをパース
 * 後方互換性のため、文字列の場合は { title: "文字列" } として扱う
 *
 * @param value - パースする値（文字列またはJSON文字列）
 * @returns パースされたWindowConfig、または null（パース失敗時）
 *
 * @example
 * // 文字列形式（後方互換）
 * parseWindowConfig('Google Chrome')
 * // => { title: 'Google Chrome' }
 *
 * @example
 * // JSON形式
 * parseWindowConfig('{"title":"Chrome","x":100,"y":100,"width":1920,"height":1080}')
 * // => { title: 'Chrome', x: 100, y: 100, width: 1920, height: 1080 }
 */
export function parseWindowConfig(value: string | undefined): WindowConfig | null {
  if (!value || value.trim() === '') {
    return null;
  }

  const trimmed = value.trim();

  // JSON形式の判定: '{' で始まる場合
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;

      // title フィールドの処理（空文字列も許可）
      if (typeof parsed.title !== 'string') {
        console.warn(
          '[parseWindowConfig] JSON形式のWindowConfigにtitleが含まれていません:',
          trimmed
        );
        return null;
      }

      const config: WindowConfig = {
        title: parsed.title,
      };

      // オプションフィールドのパース
      if (typeof parsed.processName === 'string') config.processName = parsed.processName;
      if (typeof parsed.x === 'number') config.x = parsed.x;
      if (typeof parsed.y === 'number') config.y = parsed.y;
      if (typeof parsed.width === 'number') config.width = parsed.width;
      if (typeof parsed.height === 'number') config.height = parsed.height;
      if (typeof parsed.moveToActiveMonitorCenter === 'boolean')
        config.moveToActiveMonitorCenter = parsed.moveToActiveMonitorCenter;
      if (typeof parsed.virtualDesktopNumber === 'number')
        config.virtualDesktopNumber = parsed.virtualDesktopNumber;
      if (typeof parsed.activateWindow === 'boolean') config.activateWindow = parsed.activateWindow;
      if (typeof parsed.pinToAllDesktops === 'boolean')
        config.pinToAllDesktops = parsed.pinToAllDesktops;

      return config;
    } catch (error) {
      console.error('[parseWindowConfig] JSON形式のパースに失敗しました:', trimmed, error);
      return null;
    }
  }

  // 文字列形式（後方互換）: そのままタイトルとして扱う
  return { title: trimmed };
}

/**
 * WindowConfigを文字列形式にシリアライズ
 * 位置・サイズ情報が含まれる場合はJSON形式、タイトルのみの場合は文字列形式
 *
 * @param config - シリアライズするWindowConfig
 * @returns シリアライズされた文字列（CSV保存用）
 *
 * @example
 * // タイトルのみ（文字列形式）
 * serializeWindowConfig({ title: 'Google Chrome' })
 * // => 'Google Chrome'
 *
 * @example
 * // 位置・サイズあり（JSON形式）
 * serializeWindowConfig({ title: 'Chrome', x: 100, y: 100, width: 1920, height: 1080 })
 * // => '{"title":"Chrome","x":100,"y":100,"width":1920,"height":1080}'
 */
export function serializeWindowConfig(config: WindowConfig | undefined): string {
  if (!config) {
    return '';
  }

  // 位置・サイズ・仮想デスクトップ・アクティブ化・プロセス名・ピン止め情報がない場合は、文字列形式（後方互換）
  if (
    config.processName === undefined &&
    config.x === undefined &&
    config.y === undefined &&
    config.width === undefined &&
    config.height === undefined &&
    config.moveToActiveMonitorCenter === undefined &&
    config.virtualDesktopNumber === undefined &&
    config.activateWindow === undefined &&
    config.pinToAllDesktops === undefined
  ) {
    return config.title;
  }

  // 位置・サイズ・仮想デスクトップ・アクティブ化情報がある場合は、JSON形式
  return JSON.stringify(config);
}

/**
 * ウィンドウ操作設定オブジェクト型
 */
interface WindowOperationSource {
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
 * ウィンドウ操作設定をJSON形式で保存するためのオブジェクトに変換
 *
 * @param source - ウィンドウ操作設定ソース
 * @returns JSON.stringifyに渡すためのオブジェクト（undefinedフィールドは除外済み）
 *
 * @example
 * const config = buildWindowOperationConfig({
 *   name: 'Chrome',
 *   windowTitle: 'Google Chrome',
 *   x: 100,
 *   y: 100
 * });
 * const json = JSON.stringify(config);
 * // => '{"name":"Chrome","windowTitle":"Google Chrome","x":100,"y":100}'
 */
export function buildWindowOperationConfig(
  source: WindowOperationSource
): Record<string, string | number | boolean> {
  const config: Record<string, string | number | boolean> = {
    displayName: source.displayName,
    windowTitle: source.windowTitle,
  };

  // オプションフィールドは値がある場合のみ追加
  if (source.processName !== undefined) config.processName = source.processName;
  if (source.x !== undefined) config.x = source.x;
  if (source.y !== undefined) config.y = source.y;
  if (source.width !== undefined) config.width = source.width;
  if (source.height !== undefined) config.height = source.height;
  if (source.moveToActiveMonitorCenter !== undefined)
    config.moveToActiveMonitorCenter = source.moveToActiveMonitorCenter;
  if (source.virtualDesktopNumber !== undefined)
    config.virtualDesktopNumber = source.virtualDesktopNumber;
  if (source.activateWindow !== undefined) config.activateWindow = source.activateWindow;
  if (source.pinToAllDesktops !== undefined) config.pinToAllDesktops = source.pinToAllDesktops;

  return config;
}
