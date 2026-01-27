/**
 * JsonItemとdisplayText（表示用テキスト）の相互変換ユーティリティ
 *
 * 目的:
 * - JsonItemをアイテム管理画面で編集可能なテキスト形式（displayText）に変換する
 * - displayTextからJsonItemに逆変換する
 *
 * displayText形式:
 * - フィールド区切りにカンマを使用したテキスト表現（人間が読みやすく編集しやすい）
 * - 例: "アプリ名,C:\path\to\app.exe,引数,custom-icon.png"
 *
 * 重要な注意:
 * - escapeDisplayTextField(), parseDisplayTextFields() は、displayText専用のパース/エスケープ処理です
 * - データファイル（data.json等）はJSON形式で保存され、CSV形式は使用していません
 * - これらの関数は、UI上の表示・編集用テキストのフォーマット処理のみに使用されます
 */

import type { JsonItem, JsonDirOptions } from '@common/types';
import { generateId } from '@common/utils/jsonParser';

/**
 * displayTextのフィールドをエスケープする
 *
 * displayText（アイテム管理画面での表示用テキスト）はカンマ区切りフォーマットを使用しているため、
 * カンマやダブルクォートを含む値を適切にエスケープする必要があります。
 *
 * エスケープルール:
 * - ダブルクォートまたはカンマを含む場合、内部のダブルクォートを倍増し、
 *   全体をダブルクォートで囲む
 * - それ以外はそのまま返す
 *
 * @param value - エスケープ対象の値
 * @returns エスケープされた値
 *
 * @example
 * escapeDisplayTextField('アプリ名') // => 'アプリ名'
 * escapeDisplayTextField('App, Name') // => '"App, Name"'
 * escapeDisplayTextField('My "App"') // => '"My ""App"""'
 */
export function escapeDisplayTextField(value: string): string {
  // ダブルクォートまたはカンマを含む場合のみエスケープ
  if (value.includes('"') || value.includes(',')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * displayTextのフィールドをパースする
 *
 * displayText（アイテム管理画面での表示用テキスト）をカンマ区切りフォーマットとしてパースし、
 * フィールドの配列を返します。
 *
 * パースルール:
 * - カンマをフィールドの区切りとして扱う
 * - ダブルクォートで囲まれたフィールド内のカンマは区切りとして扱わない
 * - ダブルクォートの連続（""）はエスケープされた1つのダブルクォートとして扱う
 *
 * @param line - パース対象のdisplayText（カンマ区切りフォーマットの文字列）
 * @returns フィールドの配列
 *
 * @example
 * parseDisplayTextFields('アプリ名,C:\\path\\app.exe') // => ['アプリ名', 'C:\\path\\app.exe']
 * parseDisplayTextFields('"App, Name",path') // => ['App, Name', 'path']
 * parseDisplayTextFields('"My ""App""",path') // => ['My "App"', 'path']
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
        // エスケープされたダブルクォート（""）
        current += '"';
        i++; // 次の文字をスキップ
      } else {
        // クォートの開始または終了
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // フィールドの区切り
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // 最後のフィールドを追加
  fields.push(current);
  return fields;
}

/**
 * JsonItemをdisplayText（表示用テキスト）に変換する
 *
 * @param item - 変換元のJsonItem
 * @returns 表示用テキスト文字列（CSV風フォーマット）
 *
 * @example
 * ```typescript
 * // 通常アイテム
 * jsonItemToDisplayText({ type: 'item', displayName: 'Chrome', path: 'C:\\Chrome\\chrome.exe' })
 * // => 'Chrome,C:\\Chrome\\chrome.exe'
 *
 * // dirアイテム
 * jsonItemToDisplayText({ type: 'dir', path: 'C:\\Docs', options: { depth: 2 } })
 * // => 'dir,C:\\Docs,depth=2'
 *
 * // groupアイテム
 * jsonItemToDisplayText({ type: 'group', displayName: 'Work', itemNames: ['Gmail', 'Slack'] })
 * // => 'group,Work,Gmail,Slack'
 *
 * // windowアイテム
 * jsonItemToDisplayText({ type: 'window', displayName: 'MyWindow', windowTitle: 'Title', ... })
 * // => 'window,{"displayName":"MyWindow","windowTitle":"Title",...}'
 * ```
 */
export function jsonItemToDisplayText(item: JsonItem): string {
  switch (item.type) {
    case 'item': {
      const parts = [item.displayName, item.path];
      if (item.args) {
        parts.push(item.args);
      } else if (item.customIcon || item.windowConfig) {
        parts.push('');
      }
      if (item.customIcon) {
        parts.push(item.customIcon);
      } else if (item.windowConfig) {
        parts.push('');
      }
      if (item.windowConfig) {
        parts.push(JSON.stringify(item.windowConfig));
      }
      // displayTextフィールドエスケープを適用
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
      const config: Record<string, unknown> = {
        displayName: item.displayName,
        windowTitle: item.windowTitle,
      };
      if (item.processName !== undefined) config.processName = item.processName;
      if (item.x !== undefined) config.x = item.x;
      if (item.y !== undefined) config.y = item.y;
      if (item.width !== undefined) config.width = item.width;
      if (item.height !== undefined) config.height = item.height;
      if (item.moveToActiveMonitorCenter !== undefined)
        config.moveToActiveMonitorCenter = item.moveToActiveMonitorCenter;
      if (item.virtualDesktopNumber !== undefined)
        config.virtualDesktopNumber = item.virtualDesktopNumber;
      if (item.activateWindow !== undefined) config.activateWindow = item.activateWindow;
      if (item.pinToAllDesktops !== undefined) config.pinToAllDesktops = item.pinToAllDesktops;

      const jsonStr = JSON.stringify(config);
      // displayTextフィールドエスケープ（カンマを含むためダブルクォートで囲む）
      const escapedJson = escapeDisplayTextField(jsonStr);
      return `window,${escapedJson}`;
    }

    default:
      throw new Error(`Unknown item type: ${(item as JsonItem).type}`);
  }
}

/**
 * displayText（表示用テキスト）をJsonItemに変換する
 *
 * @param text - 変換元のテキスト（CSV風フォーマット）
 * @param existingId - 既存のアイテムID（省略時は新規生成）
 * @returns JsonItem
 * @throws Error - パースエラーの場合
 *
 * @example
 * ```typescript
 * // 通常アイテム
 * displayTextToJsonItem('Chrome,C:\\Chrome\\chrome.exe')
 * // => { id: '...', type: 'item', displayName: 'Chrome', path: 'C:\\Chrome\\chrome.exe' }
 *
 * // dirアイテム
 * displayTextToJsonItem('dir,C:\\Docs,depth=2')
 * // => { id: '...', type: 'dir', path: 'C:\\Docs', options: { depth: 2 } }
 *
 * // groupアイテム
 * displayTextToJsonItem('group,Work,Gmail,Slack')
 * // => { id: '...', type: 'group', displayName: 'Work', itemNames: ['Gmail', 'Slack'] }
 *
 * // windowアイテム
 * displayTextToJsonItem('window,{"displayName":"MyWindow","windowTitle":"Title"}')
 * // => { id: '...', type: 'window', displayName: 'MyWindow', windowTitle: 'Title', ... }
 * ```
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
      displayName: (config.displayName as string) || '',
      windowTitle: (config.windowTitle as string) || '',
      processName: config.processName as string | undefined,
      x: config.x as number | undefined,
      y: config.y as number | undefined,
      width: config.width as number | undefined,
      height: config.height as number | undefined,
      moveToActiveMonitorCenter: config.moveToActiveMonitorCenter as boolean | undefined,
      virtualDesktopNumber: config.virtualDesktopNumber as number | undefined,
      activateWindow: config.activateWindow as boolean | undefined,
      pinToAllDesktops: config.pinToAllDesktops as boolean | undefined,
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
