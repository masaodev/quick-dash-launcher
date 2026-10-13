/**
 * JsonItemをdisplayText（表示用テキスト）に変換するユーティリティ
 *
 * displayTextはカンマ区切りのテキスト形式で、アイテム管理画面での表示・編集に使用される。
 * データファイル（data.json等）はJSON形式で保存され、CSV形式は使用していない。
 */

import type { JsonItem } from '@common/types';

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
      const hasWindowConfig = item.windowConfig !== undefined;
      const hasCustomIcon = item.customIcon !== undefined;

      if (item.args || hasCustomIcon || hasWindowConfig) {
        parts.push(item.args ?? '');
      }
      if (hasCustomIcon || hasWindowConfig) {
        parts.push(item.customIcon ?? '');
      }
      if (hasWindowConfig) {
        parts.push(JSON.stringify(item.windowConfig));
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

    case 'group': {
      return `group,${item.displayName},${item.itemNames.join(',')}`;
    }

    case 'window': {
      const { id: _id, type: _type, ...config } = item;
      return `window,${escapeDisplayTextField(JSON.stringify(config))}`;
    }

    case 'clipboard': {
      const parts = ['clipboard', item.displayName, item.dataFileRef, item.formats.join(';')];
      if (item.preview) {
        parts.push(item.preview);
      }
      return parts.map(escapeDisplayTextField).join(',');
    }

    case 'layout': {
      return `layout,${escapeDisplayTextField(item.displayName)},${escapeDisplayTextField(JSON.stringify(item.entries))}`;
    }

    default:
      throw new Error(`Unknown item type: ${(item as JsonItem).type}`);
  }
}
