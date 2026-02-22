/**
 * ExecutionHistoryItemからLauncherItem/WindowItemへの変換ユーティリティ
 */
import type {
  ExecutionHistoryItem,
  LauncherItem,
  WindowItem,
  WindowConfig,
  ClipboardFormat,
} from '../types';

const WINDOW_CONFIG_KEYS: (keyof ExecutionHistoryItem)[] = [
  'processName',
  'windowX',
  'windowY',
  'windowWidth',
  'windowHeight',
  'virtualDesktopNumber',
  'activateWindow',
  'moveToActiveMonitorCenter',
  'pinToAllDesktops',
];

function extractWindowConfig(item: ExecutionHistoryItem): WindowConfig | undefined {
  if (WINDOW_CONFIG_KEYS.every((key) => item[key] === undefined)) {
    return undefined;
  }

  return {
    title: '',
    processName: item.processName,
    x: item.windowX,
    y: item.windowY,
    width: item.windowWidth,
    height: item.windowHeight,
    virtualDesktopNumber: item.virtualDesktopNumber,
    activateWindow: item.activateWindow,
    moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
    pinToAllDesktops: item.pinToAllDesktops,
  };
}

type LauncherItemWithExtras = LauncherItem & {
  itemNames?: string[];
  clipboardDataRef?: string;
  clipboardFormats?: ClipboardFormat[];
};

/** ExecutionHistoryItemをLauncherItem形式に変換 */
export function executionHistoryToLauncherItem(
  historyItem: ExecutionHistoryItem
): LauncherItemWithExtras {
  const launcherItem: LauncherItemWithExtras = {
    displayName: historyItem.itemName,
    path: historyItem.itemPath,
    type: historyItem.itemType as LauncherItem['type'],
    icon: historyItem.icon,
    args: historyItem.args,
  };

  if (historyItem.itemType === 'group' && historyItem.itemNames) {
    launcherItem.itemNames = historyItem.itemNames;
  }

  if (historyItem.itemType === 'clipboard') {
    launcherItem.clipboardDataRef = historyItem.clipboardDataRef;
    launcherItem.clipboardFormats = historyItem.clipboardFormats;
  }

  const windowConfig = extractWindowConfig(historyItem);
  if (windowConfig) {
    launcherItem.windowConfig = windowConfig;
  }

  return launcherItem;
}

/** ExecutionHistoryItemをWindowItem形式に変換 */
export function executionHistoryToWindowItem(historyItem: ExecutionHistoryItem): WindowItem {
  const match = historyItem.itemPath.match(/^\[ウィンドウ操作: (.+)\]$/);

  return {
    type: 'window',
    displayName: historyItem.itemName,
    windowTitle: match ? match[1] : historyItem.itemPath,
    processName: historyItem.processName,
    x: historyItem.windowX,
    y: historyItem.windowY,
    width: historyItem.windowWidth,
    height: historyItem.windowHeight,
    moveToActiveMonitorCenter: historyItem.moveToActiveMonitorCenter,
    virtualDesktopNumber: historyItem.virtualDesktopNumber,
    activateWindow: historyItem.activateWindow,
    pinToAllDesktops: historyItem.pinToAllDesktops,
  };
}

/** itemTypeがURL系かどうかを判定 */
export function isExternalUrlType(itemType: string): boolean {
  return itemType === 'url' || itemType === 'customUri';
}

/** itemTypeがファイルシステム系かどうかを判定 */
export function isFileSystemType(itemType: string): boolean {
  return itemType === 'file' || itemType === 'folder' || itemType === 'app';
}
