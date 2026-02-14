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

      const stringFields = ['processName'] as const;
      const numberFields = ['x', 'y', 'width', 'height', 'virtualDesktopNumber'] as const;
      const booleanFields = [
        'moveToActiveMonitorCenter',
        'activateWindow',
        'pinToAllDesktops',
      ] as const;

      for (const f of stringFields) {
        if (typeof parsed[f] === 'string') config[f] = parsed[f] as string;
      }
      for (const f of numberFields) {
        if (typeof parsed[f] === 'number') config[f] = parsed[f] as number;
      }
      for (const f of booleanFields) {
        if (typeof parsed[f] === 'boolean') config[f] = parsed[f] as boolean;
      }

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

  // title以外のプロパティがない場合は文字列形式（後方互換）
  const hasExtraFields = Object.keys(config).some((key) => key !== 'title');
  if (!hasExtraFields) {
    return config.title;
  }

  return JSON.stringify(config);
}
