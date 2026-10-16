/**
 * JsonItemをdisplayText（表示用テキスト）に変換するユーティリティ
 *
 * displayTextはカンマ区切りのテキスト形式で、アイテム管理画面での表示・編集に使用される。
 * データファイル（data.json等）はJSON形式で保存され、CSV形式は使用していない。
 */

import type { JsonItem } from '@common/types';

import { pickItemWindowSwitch } from './itemWindowConversion';

/**
 * displayTextのフィールドをエスケープする
 *
 * ダブルクォートまたはカンマを含む場合、内部のダブルクォートを倍増し全体をダブルクォートで囲む。
 *
 * @example
 * escapeDisplayTextField('App, Name') // => '"App, Name"'
 * escapeDisplayTextField('My "App"') // => '"My ""App"""'
 */
export function escapeDisplayTextField(value: string): string {
  if (value.includes('"') || value.includes(',')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * JsonItemをdisplayText（表示用テキスト）に変換する
 */
export function jsonItemToDisplayText(item: JsonItem): string {
  switch (item.type) {
    case 'item': {
      const parts = [item.displayName, item.path];
      const windowSwitch = pickItemWindowSwitch(item);
      const hasWindowConfig = Object.keys(windowSwitch).length > 0;
      const hasCustomIcon = item.customIcon !== undefined;

      if (item.args || hasCustomIcon || hasWindowConfig) {
        parts.push(item.args ?? '');
      }
      if (hasCustomIcon || hasWindowConfig) {
        parts.push(item.customIcon ?? '');
      }
      if (hasWindowConfig) {
        parts.push(JSON.stringify(windowSwitch));
      }
      return parts.map(escapeDisplayTextField).join(',');
    }

    case 'dir': {
      const parts = ['dir', item.path];
      if (item.options) {
        const optionKeys = ['depth', 'types', 'filter', 'exclude', 'prefix', 'suffix'] as const;
        const opts = optionKeys
          .filter((key) => item.options![key] !== undefined)
          .map((key) => `${key}=${item.options![key]}`);
        if (opts.length > 0) {
          parts.push(opts.join(','));
        }
      }
      return parts.join(',');
    }

    case 'clipboard': {
      const parts = ['clipboard', item.displayName, item.dataFileRef, item.formats.join(';')];
      if (item.preview) {
        parts.push(item.preview);
      }
      return parts.map(escapeDisplayTextField).join(',');
    }

    case 'set': {
      return `set,${escapeDisplayTextField(item.displayName)},${escapeDisplayTextField(JSON.stringify(item.entries))}`;
    }

    default:
      throw new Error(`Unknown item type: ${(item as JsonItem).type}`);
  }
}

/**
 * JsonItem を displayText に変換する。不正なアイテム（type 不明など）でも落ちず、JSON 文字列を返す
 */
export function safeJsonItemToDisplayText(item: JsonItem): string {
  try {
    return jsonItemToDisplayText(item);
  } catch {
    return JSON.stringify(item);
  }
}
