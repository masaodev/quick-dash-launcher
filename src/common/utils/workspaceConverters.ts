/**
 * WorkspaceItemとRegisterItem間の相互変換ユーティリティ
 */

import type { WorkspaceItem, WindowConfig } from '../types';
import type { RegisterItem, WindowOperationConfig } from '../types/register';

function getItemCategoryFromWorkspaceItem(
  item: WorkspaceItem
): 'item' | 'group' | 'window' | 'clipboard' {
  switch (item.type) {
    case 'windowOperation':
      return 'window';
    case 'group':
      return 'group';
    case 'clipboard':
      return 'clipboard';
    default:
      return 'item';
  }
}

/**
 * WorkspaceItemをRegisterItemに変換（編集モーダル用）
 */
export function convertWorkspaceItemToRegisterItem(item: WorkspaceItem): RegisterItem {
  const itemCategory = getItemCategoryFromWorkspaceItem(item);

  if (itemCategory === 'window') {
    const match = item.path.match(/^\[ウィンドウ操作: (.+)\]$/);
    const windowTitle = match ? match[1] : item.path;

    const windowOperationConfig: WindowOperationConfig = {
      displayName: item.displayName,
      windowTitle: windowTitle,
      processName: item.processName,
      x: item.windowX,
      y: item.windowY,
      width: item.windowWidth,
      height: item.windowHeight,
      moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
      virtualDesktopNumber: item.virtualDesktopNumber,
      activateWindow: item.activateWindow,
      pinToAllDesktops: item.pinToAllDesktops,
    };

    return {
      displayName: item.displayName,
      path: '',
      type: 'app',
      targetTab: '',
      itemCategory: 'window',
      windowOperationConfig,
      memo: item.memo,
    };
  }

  if (itemCategory === 'group') {
    return {
      displayName: item.displayName,
      path: '',
      type: 'app',
      targetTab: '',
      itemCategory: 'group',
      groupItemNames: item.itemNames ? [...item.itemNames] : [],
      memo: item.memo,
    };
  }

  if (itemCategory === 'clipboard') {
    return {
      displayName: item.displayName,
      path: '',
      type: 'clipboard',
      targetTab: '',
      itemCategory: 'clipboard',
      clipboardDataRef: item.clipboardDataRef,
      clipboardFormats: item.clipboardFormats,
      clipboardSavedAt: item.clipboardSavedAt,
      customIcon: item.customIcon,
      memo: item.memo,
    };
  }

  return {
    displayName: item.displayName,
    path: item.path,
    type: item.type as 'url' | 'file' | 'folder' | 'app' | 'customUri',
    args: item.args,
    targetTab: '',
    customIcon: item.customIcon,
    windowConfig: item.windowConfig,
    itemCategory: 'item',
    memo: item.memo,
  };
}

/** 他の種別のフィールドをクリアするための共通値 */
const CLEAR_WINDOW_FIELDS = {
  processName: undefined,
  windowX: undefined,
  windowY: undefined,
  windowWidth: undefined,
  windowHeight: undefined,
  virtualDesktopNumber: undefined,
  activateWindow: undefined,
  moveToActiveMonitorCenter: undefined,
  pinToAllDesktops: undefined,
} as const;

/**
 * RegisterItemからWorkspaceItem更新用データを生成
 */
export function convertRegisterItemToWorkspaceItemUpdate(
  registerItem: RegisterItem
): Partial<WorkspaceItem> {
  const base = { memo: registerItem.memo };

  if (registerItem.itemCategory === 'window') {
    const config = registerItem.windowOperationConfig;
    const windowTitle = config?.windowTitle || '';

    return {
      ...base,
      displayName: config?.displayName || registerItem.displayName,
      path: `[ウィンドウ操作: ${windowTitle}]`,
      type: 'windowOperation',
      processName: config?.processName,
      windowX: config?.x,
      windowY: config?.y,
      windowWidth: config?.width,
      windowHeight: config?.height,
      virtualDesktopNumber: config?.virtualDesktopNumber,
      activateWindow: config?.activateWindow,
      moveToActiveMonitorCenter: config?.moveToActiveMonitorCenter,
      pinToAllDesktops: config?.pinToAllDesktops,
      args: undefined,
      customIcon: undefined,
      windowConfig: undefined,
      itemNames: undefined,
    };
  }

  if (registerItem.itemCategory === 'group') {
    const itemNames = registerItem.groupItemNames || [];

    return {
      ...base,
      ...CLEAR_WINDOW_FIELDS,
      displayName: registerItem.displayName,
      path: `[グループ: ${itemNames.length}件]`,
      type: 'group',
      itemNames: itemNames,
      args: undefined,
      customIcon: undefined,
      windowConfig: undefined,
    };
  }

  if (registerItem.itemCategory === 'clipboard') {
    return {
      ...base,
      ...CLEAR_WINDOW_FIELDS,
      displayName: registerItem.displayName,
      path: `[クリップボード]`,
      type: 'clipboard',
      clipboardDataRef: registerItem.clipboardDataRef,
      clipboardFormats: registerItem.clipboardFormats,
      clipboardSavedAt: registerItem.clipboardSavedAt,
      customIcon: registerItem.customIcon,
      args: undefined,
      windowConfig: undefined,
      itemNames: undefined,
    };
  }

  return {
    ...base,
    ...CLEAR_WINDOW_FIELDS,
    displayName: registerItem.displayName,
    path: registerItem.path,
    type: registerItem.type as WorkspaceItem['type'],
    args: registerItem.args,
    customIcon: registerItem.customIcon,
    windowConfig: registerItem.windowConfig as WindowConfig | undefined,
    itemNames: undefined,
  };
}
