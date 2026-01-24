/**
 * 実行履歴アイテムの変換ユーティリティ
 *
 * ExecutionHistoryItemからLauncherItem/WindowOperationItemへの変換ロジックを共通化
 */
import type {
  ExecutionHistoryItem,
  LauncherItem,
  WindowOperationItem,
  WindowConfig,
} from '../types';

/**
 * windowConfig関連のプロパティ名リスト
 */
const WINDOW_CONFIG_PROPERTIES = [
  'processName',
  'windowX',
  'windowY',
  'windowWidth',
  'windowHeight',
  'virtualDesktopNumber',
  'activateWindow',
  'moveToActiveMonitorCenter',
  'pinToAllDesktops',
] as const;

/**
 * ExecutionHistoryItemにwindowConfig関連の情報が含まれているか判定
 */
export function hasWindowConfig(item: ExecutionHistoryItem): boolean {
  return WINDOW_CONFIG_PROPERTIES.some(
    (prop) => item[prop as keyof ExecutionHistoryItem] !== undefined
  );
}

/**
 * ExecutionHistoryItemからWindowConfigを抽出
 */
export function extractWindowConfig(item: ExecutionHistoryItem): WindowConfig | undefined {
  if (!hasWindowConfig(item)) {
    return undefined;
  }

  return {
    title: '', // タイトルは不要（プロセス名で検索）
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

/**
 * ExecutionHistoryItemをLauncherItem形式に変換
 *
 * @param historyItem - 実行履歴アイテム
 * @returns LauncherItem形式のオブジェクト（グループの場合はitemNamesを含む）
 */
export function executionHistoryToLauncherItem(
  historyItem: ExecutionHistoryItem
): LauncherItem & { itemNames?: string[] } {
  const launcherItem: LauncherItem & { itemNames?: string[] } = {
    displayName: historyItem.itemName,
    path: historyItem.itemPath,
    type: historyItem.itemType as LauncherItem['type'],
    icon: historyItem.icon,
    args: historyItem.args,
  };

  // グループアイテムの場合はitemNamesも含める
  if (historyItem.itemType === 'group' && historyItem.itemNames) {
    launcherItem.itemNames = historyItem.itemNames;
  }

  // windowConfig情報があれば含める
  const windowConfig = extractWindowConfig(historyItem);
  if (windowConfig) {
    launcherItem.windowConfig = windowConfig;
  }

  return launcherItem;
}

/**
 * ExecutionHistoryItemをWindowOperationItem形式に変換
 *
 * @param historyItem - 実行履歴アイテム
 * @returns WindowOperationItem形式のオブジェクト
 */
export function executionHistoryToWindowOperation(
  historyItem: ExecutionHistoryItem
): WindowOperationItem {
  // [ウィンドウ操作: タイトル] から タイトル を抽出
  const match = historyItem.itemPath.match(/^\[ウィンドウ操作: (.+)\]$/);
  const windowTitle = match ? match[1] : historyItem.itemPath;

  return {
    type: 'windowOperation',
    displayName: historyItem.itemName,
    windowTitle: windowTitle,
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

/**
 * itemTypeがURL系かどうかを判定
 */
export function isExternalUrlType(itemType: string): boolean {
  return itemType === 'url' || itemType === 'customUri';
}

/**
 * itemTypeがファイルシステム系かどうかを判定
 */
export function isFileSystemType(itemType: string): boolean {
  return itemType === 'file' || itemType === 'folder' || itemType === 'app';
}
