/**
 * 型ガード関数
 *
 * 型アサーションを安全に置き換えるための型ガード関数を提供します。
 */

import type {
  AppItem,
  GroupItem,
  LauncherItem,
  WindowItem,
  ClipboardItem,
  LayoutItem,
  SetItem,
} from './launcher';
import type { WindowInfo } from './window';

/** 配列でないオブジェクト（JSON の読み込みで、キーを持つ値か確かめる） */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
    item.type !== 'clipboard' &&
    item.type !== 'layout' &&
    item.type !== 'set'
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
 * LayoutItemかどうかを判定する型ガード
 *
 * @param item - 判定対象のAppItem
 * @returns LayoutItemの場合true
 */
export function isLayoutItem(item: AppItem): item is LayoutItem {
  return !isWindowInfo(item) && item.type === 'layout';
}

/**
 * SetItemかどうかを判定する型ガード
 *
 * @param item - 判定対象のAppItem
 * @returns SetItemの場合true
 */
export function isSetItem(item: AppItem): item is SetItem {
  return !isWindowInfo(item) && item.type === 'set';
}
