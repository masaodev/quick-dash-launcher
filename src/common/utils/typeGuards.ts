/**
 * 型ガード関数
 *
 * 型アサーションを安全に置き換えるための型ガード関数を提供します。
 */

import type { AppItem, GroupItem, LauncherItem } from '../types';

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
  return item.type !== 'group';
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
  return item.type === 'group';
}
