/**
 * JSONデータをRawDataLine形式に変換するユーティリティ
 *
 * JSON形式のデータファイル（data.json）を、編集画面で使用するRawDataLine形式に変換する
 */

import type { RawDataLine } from '@common/types';
import type { JsonDataFile, JsonItem, JsonDirOptions } from '@common/types';
import { parseCSVLine } from '@common/utils/csvParser';
import { generateId } from '@common/utils/jsonParser';

/**
 * JsonItemをCSV形式の行に変換する
 *
 * @param item - 変換元のJsonItem
 * @returns CSV形式の行文字列
 */
export function convertJsonItemToCsvLine(item: JsonItem): string {
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
      // CSVエスケープを適用
      return parts
        .map((p) => (p.includes(',') || p.includes('"') ? `"${p.replace(/"/g, '""')}"` : p))
        .join(',');
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
      // CSVエスケープ（カンマを含むためダブルクォートで囲む）
      const escapedJson = `"${jsonStr.replace(/"/g, '""')}"`;
      return `window,${escapedJson}`;
    }
    default:
      throw new Error(`Unknown item type: ${(item as JsonItem).type}`);
  }
}

/**
 * CSV形式の行からRawDataLineの種別を判定する
 */
function detectLineTypeFromCsv(line: string): RawDataLine['type'] {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return 'empty';
  }

  if (trimmedLine.startsWith('//')) {
    return 'comment';
  }

  if (
    trimmedLine.startsWith('dir,') ||
    trimmedLine.startsWith('group,') ||
    trimmedLine.startsWith('window,')
  ) {
    return 'directive';
  }

  return 'item';
}

/**
 * JsonDataFileをRawDataLine配列に変換する
 *
 * @param jsonData - 変換元のJsonDataFile
 * @param sourceFile - ソースファイル名
 * @returns RawDataLine配列
 */
export function convertJsonDataFileToRawDataLines(
  jsonData: JsonDataFile,
  sourceFile: string
): RawDataLine[] {
  const rawLines: RawDataLine[] = [];

  for (let i = 0; i < jsonData.items.length; i++) {
    const item = jsonData.items[i];
    const csvLine = convertJsonItemToCsvLine(item);
    const lineType = detectLineTypeFromCsv(csvLine);

    let customIcon: string | undefined = undefined;
    if (item.type === 'item' && item.customIcon) {
      customIcon = item.customIcon;
    }

    rawLines.push({
      lineNumber: i + 1,
      content: csvLine,
      type: lineType,
      sourceFile,
      customIcon,
      jsonItemId: item.id, // JSONアイテムのIDを保持
    });
  }

  return rawLines;
}

/**
 * CSV形式の行をJsonItemに変換する（RawDataLine → JsonItem）
 *
 * @param line - RawDataLine
 * @returns JsonItem
 */
export function convertRawDataLineToJsonItem(line: RawDataLine): JsonItem {
  const content = line.content;
  const trimmed = content.trim();
  // 保持されたIDがあればそれを使用、なければ新規生成
  const itemId = line.jsonItemId || generateId();

  // dir行
  if (trimmed.startsWith('dir,')) {
    const parts = parseCSVLine(trimmed);
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
    const parts = parseCSVLine(trimmed.substring(6)); // 'group,'を除去
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
    const parts = parseCSVLine(trimmed);
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
  const parts = parseCSVLine(content);
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

/**
 * RawDataLine配列をJsonDataFileに変換する
 *
 * @param rawLines - RawDataLine配列（単一ファイル分）
 * @returns JsonDataFile
 */
export function convertRawDataLinesToJsonDataFile(rawLines: RawDataLine[]): JsonDataFile {
  const items: JsonItem[] = [];

  for (const line of rawLines) {
    // 空行とコメント行はスキップ
    if (line.type === 'empty' || line.type === 'comment') {
      continue;
    }

    try {
      const jsonItem = convertRawDataLineToJsonItem(line);
      items.push(jsonItem);
    } catch {
      // 変換エラーの場合はスキップ
    }
  }

  return {
    version: '1.0',
    items,
  };
}
