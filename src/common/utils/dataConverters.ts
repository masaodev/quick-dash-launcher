/**
 * データ変換ユーティリティ
 *
 * RawDataLine（編集画面用）とLauncherItem間の変換ロジックを提供します。
 */

import type { RawDataLine, LauncherItem, DataFileTab } from '../types';
import type { RegisterItem } from '../types/register.js';
import { parseDirOptionsFromString } from '../types/register.js';

import { parseCSVLine, escapeCSV } from './displayTextConverter';
import { parseWindowConfig, serializeWindowConfig } from './windowConfigUtils';
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
  const defaultTab = line.sourceFile || (tabs.length > 0 ? tabs[0].files[0] : 'data.json');

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
      displayName: name,
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
        displayName: windowOp.displayName,
        path: '',
        type: 'app',
        targetTab: defaultTab,
        targetFile: line.sourceFile,
        itemCategory: 'window',
        windowOperationConfig: {
          displayName: windowOp.displayName,
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
        displayName: groupName,
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
        displayName: path,
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
      displayName: line.content || '',
      path: line.content || '',
      type: 'file',
      targetTab: defaultTab,
      targetFile: line.sourceFile,
      itemCategory: 'item',
    };
  }
}

/**
 * LauncherItemをRawDataLineに変換する
 *
 * @param item - 変換元のLauncherItem
 * @returns 変換されたRawDataLine
 */
export function convertLauncherItemToRawDataLine(item: LauncherItem): RawDataLine {
  // フォルダ取込から展開されたアイテムの場合
  if (item.isDirExpanded && item.expandedFrom) {
    let content = `dir,${escapeCSV(item.expandedFrom)}`;
    if (item.expandedOptions) {
      content += `,${item.expandedOptions}`;
    }

    return {
      lineNumber: item.lineNumber || 1,
      content: content,
      type: 'directive',
      sourceFile: item.sourceFile || 'data.json',
      customIcon: undefined,
    };
  }

  // 通常のアイテムの場合：名前,パス,引数,カスタムアイコン,ウィンドウ設定 の形式
  const args = item.args || '';
  const customIcon = item.customIcon || '';
  const windowConfigStr = item.windowConfig ? serializeWindowConfig(item.windowConfig) : '';

  // 基本フィールド
  let content = `${escapeCSV(item.displayName)},${escapeCSV(item.path)}`;

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
    sourceFile: item.sourceFile || 'data.json',
    customIcon: item.customIcon,
  };
}
