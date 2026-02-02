/**
 * 型ガード関数
 *
 * 型アサーションを安全に置き換えるための型ガード関数を提供します。
 */

import type { AppItem, GroupItem, LauncherItem, WindowItem, ClipboardItem } from './launcher';
import type { WindowInfo } from './window';
import type { WorkspaceItem, DragItemData } from './workspace';

/**
 * WindowInfoかどうかを判定する型ガード
 *
 * @param item - 判定対象のAppItem
 * @returns WindowInfoの場合true
 *
 * @example
 * const item: AppItem = getItem();
 * if (isWindowInfo(item)) {
 *   // ここではitemはWindowInfo型として扱われる
 *   console.log(item.hwnd);
 * }
 */
export function isWindowInfo(item: AppItem): item is WindowInfo {
  return 'hwnd' in item;
}

/**
 * LauncherItemかどうかを判定する型ガード
 *
 * @param item - 判定対象のAppItem
 * @returns LauncherItemの場合true
 *
 * @example
 * const item: AppItem = getItem();
 * if (isLauncherItem(item)) {
 *   // ここではitemはLauncherItem型として扱われる
 *   console.log(item.path);
 * }
 */
export function isLauncherItem(item: AppItem): item is LauncherItem {
  return (
    !isWindowInfo(item) &&
    item.type !== 'group' &&
    item.type !== 'window' &&
    item.type !== 'clipboard'
  );
}

/**
 * GroupItemかどうかを判定する型ガード
 *
 * @param item - 判定対象のAppItem
 * @returns GroupItemの場合true
 *
 * @example
 * const item: AppItem = getItem();
 * if (isGroupItem(item)) {
 *   // ここではitemはGroupItem型として扱われる
 *   console.log(item.itemNames);
 * }
 */
export function isGroupItem(item: AppItem): item is GroupItem {
  return !isWindowInfo(item) && item.type === 'group';
}

/**
 * WindowItemかどうかを判定する型ガード
 *
 * @param item - 判定対象のAppItem
 * @returns WindowItemの場合true
 *
 * @example
 * const item: AppItem = getItem();
 * if (isWindowItem(item)) {
 *   // ここではitemはWindowItem型として扱われる
 *   console.log(item.windowTitle);
 * }
 */
export function isWindowItem(item: AppItem): item is WindowItem {
  return !isWindowInfo(item) && item.type === 'window';
}

/**
 * ClipboardItemかどうかを判定する型ガード
 *
 * @param item - 判定対象のAppItem
 * @returns ClipboardItemの場合true
 *
 * @example
 * const item: AppItem = getItem();
 * if (isClipboardItem(item)) {
 *   // ここではitemはClipboardItem型として扱われる
 *   console.log(item.clipboardDataRef);
 * }
 */
export function isClipboardItem(item: AppItem): item is ClipboardItem {
  return !isWindowInfo(item) && item.type === 'clipboard';
}

/**
 * WorkspaceItem かどうかを判定する型ガード
 *
 * @param item - 判定対象
 * @returns WorkspaceItem型の場合true
 *
 * @example
 * const item = unknownData;
 * if (isWorkspaceItem(item)) {
 *   // ここではitemはWorkspaceItem型として扱われる
 *   console.log(item.displayName);
 * }
 */
export function isWorkspaceItem(item: unknown): item is WorkspaceItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'displayName' in item &&
    'path' in item &&
    'type' in item
  );
}

/**
 * DragItemData かどうかを判定する型ガード
 *
 * @param data - 判定対象
 * @returns DragItemData型の場合true
 *
 * @example
 * const dragData = getDragData(event);
 * if (isDragItemData(dragData)) {
 *   // ここではdragDataはDragItemData型として扱われる
 *   if (dragData.type === 'workspace-item') {
 *     console.log(dragData.itemId);
 *   }
 * }
 */
export function isDragItemData(data: unknown): data is DragItemData {
  if (typeof data !== 'object' || data === null || !('type' in data)) {
    return false;
  }

  const record = data as Record<string, unknown>;

  switch (record.type) {
    case 'workspace-item':
      return typeof record.itemId === 'string';
    case 'history-item':
      return typeof record.historyItem === 'object';
    case 'group':
      return typeof record.groupId === 'string';
    default:
      return false;
  }
}
