/**
 * データ変換ユーティリティ
 *
 * RawDataLine、RegisterItem、LauncherItem間の変換ロジックを提供します。
 * これらの変換ロジックは以前、複数のコンポーネントに重複していました。
 */

import type { RawDataLine, LauncherItem, DataFileTab } from '../types';
import type { RegisterItem } from '../types/register.js';
import { parseDirOptionsFromString, formatDirOptionsToString } from '../types/register.js';

import { parseCSVLine, escapeCSV } from './csvParser';
import {
  parseWindowConfig,
  serializeWindowConfig,
  buildWindowOperationConfig,
} from './windowConfigUtils';
import { parseWindowOperationDirective } from './directiveUtils';

/**
 * RawDataLineをRegisterItemに変換する
 *
 * @param line - 変換元のRawDataLine
 * @param tabs - 利用可能なデータファイルタブのリスト
 * @param detectItemType - アイテムタイプを検出する関数
 * @returns 変換されたRegisterItem
 */
export async function convertRawDataLineToRegisterItem(
  line: RawDataLine,
  tabs: DataFileTab[],
  detectItemType: (path: string) => Promise<LauncherItem['type']>
): Promise<RegisterItem> {
  const defaultTab = line.sourceFile || (tabs.length > 0 ? tabs[0].files[0] : 'data.txt');

  if (line.type === 'item') {
    // アイテム行の場合：名前,パス,引数,カスタムアイコン,ウィンドウ設定
    const parts = parseCSVLine(line.content);
    const name = parts[0] || '';
    const path = parts[1] || '';
    const args = parts[2] || '';
    const customIcon = parts[3] || '';
    const windowConfigField = parts[4] || '';

    // ウィンドウ設定をパース
    const windowConfig = windowConfigField ? parseWindowConfig(windowConfigField) : undefined;

    const itemType = await detectItemType(path);

    return {
      name,
      path,
      type: itemType,
      args: args || undefined,
      targetTab: defaultTab,
      targetFile: line.sourceFile,
      folderProcessing: itemType === 'folder' ? 'folder' : undefined,
      customIcon: customIcon || line.customIcon,
      windowConfig: windowConfig ?? undefined,
      itemCategory: 'item',
    };
  } else if (line.type === 'directive') {
    // ディレクティブの種類を判定
    const trimmedContent = line.content.trim();

    if (trimmedContent.startsWith('window,')) {
      // ウィンドウ操作アイテム行の場合：window,{JSON形式の設定} または 古い形式: window,表示名,ウィンドウタイトル,x,y,width,height,virtualDesktopNumber,activateWindow
      const windowOp = parseWindowOperationDirective(line);

      return {
        name: windowOp.name,
        path: '',
        type: 'app',
        targetTab: defaultTab,
        targetFile: line.sourceFile,
        itemCategory: 'window',
        windowOperationConfig: {
          name: windowOp.name,
          windowTitle: windowOp.windowTitle,
          processName: windowOp.processName,
          x: windowOp.x,
          y: windowOp.y,
          width: windowOp.width,
          height: windowOp.height,
          moveToActiveMonitorCenter: windowOp.moveToActiveMonitorCenter,
          virtualDesktopNumber: windowOp.virtualDesktopNumber,
          activateWindow: windowOp.activateWindow,
          pinToAllDesktops: windowOp.pinToAllDesktops,
        },
      };
    } else if (trimmedContent.startsWith('group,')) {
      // グループアイテム行の場合：group,グループ名,アイテム1,アイテム2,...
      const parts = parseCSVLine(line.content);
      const groupName = parts[1] || '';
      const itemNames = parts.slice(2).filter((name) => name);

      return {
        name: groupName,
        path: '',
        type: 'app',
        targetTab: defaultTab,
        targetFile: line.sourceFile,
        itemCategory: 'group',
        groupItemNames: itemNames,
      };
    } else {
      // フォルダ取込アイテム行の場合：dir,パス,オプション
      const parts = parseCSVLine(line.content);
      const path = parts[1] || '';
      const optionsStr = parts.slice(2).join(',');

      const dirOptions = parseDirOptionsFromString(optionsStr);

      return {
        name: path,
        path,
        type: 'folder',
        targetTab: defaultTab,
        targetFile: line.sourceFile,
        folderProcessing: 'expand',
        dirOptions,
        itemCategory: 'dir',
      };
    }
  } else {
    // その他の場合（コメント、空行など）
    return {
      name: line.content || '',
      path: line.content || '',
      type: 'file',
      targetTab: defaultTab,
      targetFile: line.sourceFile,
      itemCategory: 'item',
    };
  }
}

/**
 * RegisterItemをRawDataLineに変換する
 *
 * @param item - 変換元のRegisterItem
 * @param originalLine - 元のRawDataLine（行番号などのメタ情報を保持）
 * @returns 変換されたRawDataLine
 */
export function convertRegisterItemToRawDataLine(
  item: RegisterItem,
  originalLine: RawDataLine
): RawDataLine {
  let newContent = '';
  let newType: RawDataLine['type'] = originalLine.type;

  if (item.itemCategory === 'dir') {
    // フォルダ取込アイテムの場合
    newType = 'directive';
    if (item.dirOptions) {
      const optionsStr = formatDirOptionsToString(item.dirOptions);
      newContent = optionsStr
        ? `dir,${escapeCSV(item.path)},${optionsStr}`
        : `dir,${escapeCSV(item.path)}`;
    } else {
      newContent = `dir,${escapeCSV(item.path)}`;
    }
  } else if (item.itemCategory === 'group') {
    // グループアイテムの場合：group,グループ名,アイテム1,アイテム2,...
    newType = 'directive';
    const itemNames = item.groupItemNames || [];
    const escapedItemNames = itemNames.map((name) => escapeCSV(name));
    newContent = `group,${escapeCSV(item.name)},${escapedItemNames.join(',')}`;
  } else if (item.itemCategory === 'window') {
    // ウィンドウ操作アイテムの場合：window,{JSON形式の設定}
    newType = 'directive';
    const cfg = item.windowOperationConfig;
    if (!cfg) throw new Error('windowOperationConfig is required for window items');

    // 共通ヘルパーを使用してJSON設定を構築
    const config = buildWindowOperationConfig({
      name: item.name,
      windowTitle: cfg.windowTitle,
      processName: cfg.processName,
      x: cfg.x,
      y: cfg.y,
      width: cfg.width,
      height: cfg.height,
      moveToActiveMonitorCenter: cfg.moveToActiveMonitorCenter,
      virtualDesktopNumber: cfg.virtualDesktopNumber,
      activateWindow: cfg.activateWindow,
      pinToAllDesktops: cfg.pinToAllDesktops,
    });

    newContent = `window,${escapeCSV(JSON.stringify(config))}`;
  } else {
    // アイテム行の場合：名前,パス,引数,カスタムアイコン,ウィンドウ設定 の形式
    // CSVエスケープを適用
    newType = 'item';
    const args = item.args || '';
    const customIcon = item.customIcon || '';
    const windowConfigStr = item.windowConfig ? serializeWindowConfig(item.windowConfig) : '';

    // 基本フィールド
    newContent = `${escapeCSV(item.name)},${escapeCSV(item.path)}`;

    // 引数フィールド
    newContent += `,${escapeCSV(args)}`;

    // カスタムアイコンフィールド
    if (customIcon || windowConfigStr) {
      newContent += `,${escapeCSV(customIcon)}`;
    }

    // ウィンドウ設定フィールド
    if (windowConfigStr) {
      newContent += `,${escapeCSV(windowConfigStr)}`;
    }
  }

  return {
    ...originalLine,
    content: newContent,
    type: newType,
  };
}

/**
 * LauncherItemをRawDataLineに変換する
 *
 * @param item - 変換元のLauncherItem
 * @param loadRawDataFiles - データファイルをロードする関数
 * @returns 変換されたRawDataLine
 */
export async function convertLauncherItemToRawDataLine(
  item: LauncherItem,
  loadRawDataFiles: () => Promise<RawDataLine[]>
): Promise<RawDataLine> {
  // フォルダ取込から展開されたアイテムの場合
  if (item.isDirExpanded && item.expandedFrom && item.lineNumber && item.sourceFile) {
    try {
      const rawLines = await loadRawDataFiles();
      const originalLine = rawLines.find(
        (line) => line.sourceFile === item.sourceFile && line.lineNumber === item.lineNumber
      );

      if (originalLine) {
        return originalLine;
      }
    } catch (err) {
      console.error('元のディレクティブ行の読み込みに失敗しました:', err);
    }

    // フォールバック: expandedOptionsを使用
    let content = `dir,${item.expandedFrom}`;
    if (item.expandedOptions) {
      content += `,${item.expandedOptions}`;
    }

    return {
      lineNumber: item.lineNumber || 1,
      content: content,
      type: 'directive',
      sourceFile: item.sourceFile || 'data.txt',
      customIcon: undefined,
    };
  }

  // 通常のアイテムの場合：名前,パス,引数,カスタムアイコン,ウィンドウ設定 の形式
  const args = item.args || '';
  const customIcon = item.customIcon || '';
  const windowConfigStr = item.windowConfig ? serializeWindowConfig(item.windowConfig) : '';

  // 基本フィールド
  let content = `${escapeCSV(item.name)},${escapeCSV(item.path)}`;

  // 引数フィールド
  content += `,${escapeCSV(args)}`;

  // カスタムアイコンフィールド
  if (customIcon || windowConfigStr) {
    content += `,${escapeCSV(customIcon)}`;
  }

  // ウィンドウ設定フィールド
  if (windowConfigStr) {
    content += `,${escapeCSV(windowConfigStr)}`;
  }

  return {
    lineNumber: item.lineNumber || 1,
    content: content,
    type: 'item',
    sourceFile: item.sourceFile || 'data.txt',
    customIcon: item.customIcon,
  };
}
