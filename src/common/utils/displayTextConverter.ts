/**
 * JsonItemとdisplayText（表示用テキスト）の相互変換ユーティリティ
 *
 * displayTextはカンマ区切りのテキスト形式で、アイテム管理画面での表示・編集に使用される。
 * データファイル（data.json等）はJSON形式で保存され、CSV形式は使用していない。
 */

import type { JsonItem, JsonDirOptions, ClipboardFormat } from '@common/types';
import { generateId } from '@common/utils/jsonParser';

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
 * displayTextのフィールドをパースする
 *
 * カンマをフィールド区切りとして扱い、ダブルクォートで囲まれた部分内のカンマは区切りとして扱わない。
 * ダブルクォートの連続（""）はエスケープされた1つのダブルクォートとして扱う。
 *
 * @example
 * parseDisplayTextFields('"App, Name",path') // => ['App, Name', 'path']
 */
export function parseDisplayTextFields(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
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

/**
 * displayText（表示用テキスト）をJsonItemに変換する
 */
export function displayTextToJsonItem(text: string, existingId?: string): JsonItem {
  const trimmed = text.trim();
  const itemId = existingId || generateId();

  // dir行
  if (trimmed.startsWith('dir,')) {
    const parts = parseDisplayTextFields(trimmed);
    const dirPath = parts[1] || '';
    const optionsStr = parts.slice(2).join(',');

    const options: JsonDirOptions = {};
    if (optionsStr) {
      for (const opt of optionsStr.split(',')) {
        const [key, value] = opt.split('=');
        switch (key) {
          case 'depth':
            options.depth = parseInt(value, 10);
            break;
          case 'types':
            options.types = value as 'file' | 'folder' | 'both';
            break;
          case 'filter':
            options.filter = value;
            break;
          case 'exclude':
            options.exclude = value;
            break;
          case 'prefix':
            options.prefix = value;
            break;
          case 'suffix':
            options.suffix = value;
            break;
        }
      }
    }

    return {
      id: itemId,
      type: 'dir',
      path: dirPath,
      options: Object.keys(options).length > 0 ? options : undefined,
    };
  }

  // group行
  if (trimmed.startsWith('group,')) {
    const parts = parseDisplayTextFields(trimmed.substring(6)); // 'group,'を除去
    const displayName = parts[0] || '';
    const itemNames = parts.slice(1).filter((name) => name.trim());

    return {
      id: itemId,
      type: 'group',
      displayName,
      itemNames,
    };
  }

  // window行
  if (trimmed.startsWith('window,')) {
    const parts = parseDisplayTextFields(trimmed);
    const configStr = parts[1] || '{}';
    const config = JSON.parse(configStr) as Record<string, unknown>;

    return {
      id: itemId,
      type: 'window',
      displayName: '',
      windowTitle: '',
      ...config,
    } as JsonItem;
  }

  // clipboard行
  if (trimmed.startsWith('clipboard,')) {
    const parts = parseDisplayTextFields(trimmed);
    const displayName = parts[1] || '';
    const dataFileRef = parts[2] || '';
    const formatsStr = parts[3] || '';
    const preview = parts[4] || undefined;

    const formats = formatsStr.split(';').filter((f) => f.trim()) as ClipboardFormat[];

    return {
      id: itemId,
      type: 'clipboard',
      displayName,
      dataFileRef,
      savedAt: Date.now(),
      formats,
      preview,
    };
  }

  // layout行
  if (trimmed.startsWith('layout,')) {
    const parts = parseDisplayTextFields(trimmed);
    const displayName = parts[1] || '';
    const entriesStr = parts[2] || '[]';
    const entries = JSON.parse(entriesStr);

    return {
      id: itemId,
      type: 'layout',
      displayName,
      entries,
    };
  }

  // 通常アイテム行
  const parts = parseDisplayTextFields(text);
  const displayName = parts[0] || '';
  const itemPath = parts[1] || '';
  const args = parts[2]?.trim() || undefined;
  const customIcon = parts[3]?.trim() || undefined;
  const windowConfigStr = parts[4]?.trim() || undefined;

  const item: JsonItem = {
    id: itemId,
    type: 'item',
    displayName,
    path: itemPath,
  };

  if (args) item.args = args;
  if (customIcon) item.customIcon = customIcon;
  if (windowConfigStr) {
    try {
      item.windowConfig = JSON.parse(windowConfigStr);
    } catch {
      // パースエラーの場合は無視
    }
  }

  return item;
}
