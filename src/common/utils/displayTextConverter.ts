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
        const opts: string[] = [];
        if (item.options.depth !== undefined) opts.push(`depth=${item.options.depth}`);
        if (item.options.types) opts.push(`types=${item.options.types}`);
        if (item.options.filter) opts.push(`filter=${item.options.filter}`);
        if (item.options.exclude) opts.push(`exclude=${item.options.exclude}`);
        if (item.options.prefix) opts.push(`prefix=${item.options.prefix}`);
        if (item.options.suffix) opts.push(`suffix=${item.options.suffix}`);
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
      const optParts = optionsStr.split(',');
      for (const opt of optParts) {
        const [key, value] = opt.split('=');
        if (key === 'depth') options.depth = parseInt(value, 10);
        else if (key === 'types') options.types = value as 'file' | 'folder' | 'both';
        else if (key === 'filter') options.filter = value;
        else if (key === 'exclude') options.exclude = value;
        else if (key === 'prefix') options.prefix = value;
        else if (key === 'suffix') options.suffix = value;
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

  // 通常アイテム行
  const parts = parseDisplayTextFields(text);
  const displayName = parts[0] || '';
  const path = parts[1] || '';
  const args = parts[2] && parts[2].trim() ? parts[2] : undefined;
  const customIcon = parts[3] && parts[3].trim() ? parts[3] : undefined;
  const windowConfigStr = parts[4] && parts[4].trim() ? parts[4] : undefined;

  const item: JsonItem = {
    id: itemId,
    type: 'item',
    displayName,
    path,
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
