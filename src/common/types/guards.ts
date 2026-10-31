/**
 * 型ガード関数
 *
 * 型アサーションを安全に置き換えるための型ガード関数を提供します。
 */

import type { AppItem, LauncherItem, ClipboardItem, SetItem, WsGroupItem } from './launcher';
import type { WindowInfo } from './window';
import type { PinLevel } from './settings';

/** ピン留めの段階（0・1・2）か */
export function isPinLevel(value: unknown): value is PinLevel {
  return value === 0 || value === 1 || value === 2;
}

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
    item.type !== 'clipboard' &&
    item.type !== 'set' &&
    item.type !== 'wsgroup'
  );
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
 * SetItemかどうかを判定する型ガード
 *
 * @param item - 判定対象のAppItem
 * @returns SetItemの場合true
 */
export function isSetItem(item: AppItem): item is SetItem {
  return !isWindowInfo(item) && item.type === 'set';
}

/**
 * WsGroupItem（WSグループから展開したアイテム）かどうかを判定する型ガード
 *
 * @param item - 判定対象のAppItem
 * @returns WsGroupItemの場合true
 */
export function isWsGroupItem(item: AppItem): item is WsGroupItem {
  return !isWindowInfo(item) && item.type === 'wsgroup';
}
