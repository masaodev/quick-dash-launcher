/**
 * 編集用アイテムの型定義
 *
 * RegisterModalで編集中のアイテムを表す型定義。
 * RawDataLine（CSV形式）を廃止し、AppItemベースで直接扱う。
 */

import type { LauncherItem, WindowItem, ClipboardItem, SetItem } from './launcher';
import type { DirOptionsForProcessing } from './json-data';
import type { EditableJsonItem } from './editableItem';

/**
 * 編集可能なアイテムの共通メタデータ
 */
export interface EditingItemMeta {
  /** 元のデータファイル名（編集用では必須） */
  sourceFile: string;
  /** JSONファイルのアイテムID（編集・削除の識別子として使用） */
  jsonItemId?: string;
}

/**
 * 編集用LauncherItem
 * sourceFileを必須にするため、Omitで除外してから再定義
 */
export interface EditingLauncherItem extends Omit<LauncherItem, 'sourceFile'>, EditingItemMeta {
  /** フォルダ取込から展開されたアイテムかどうか */
  isDirExpanded?: boolean;
  /** フォルダ取込の元パス */
  expandedFrom?: string;
  /** フォルダ取込の設定 */
  expandedOptions?: DirOptionsForProcessing;
}

/**
 * 編集用WindowItem
 * sourceFileを必須にするため、Omitで除外してから再定義
 */
export interface EditingWindowItem extends Omit<WindowItem, 'sourceFile'>, EditingItemMeta {}

/**
 * 編集用ClipboardItem
 * sourceFileを必須にするため、Omitで除外してから再定義
 */
export interface EditingClipboardItem extends Omit<ClipboardItem, 'sourceFile'>, EditingItemMeta {}

/**
 * 編集用SetItem
 * sourceFileを必須にするため、Omitで除外してから再定義
 */
export interface EditingSetItem extends Omit<SetItem, 'sourceFile'>, EditingItemMeta {}

/**
 * 編集用アイテムの統合型
 *
 * RegisterModal、useRegisterWindow、useRegisterFormで使用される。
 * LauncherItem/WindowItem/ClipboardItem/SetItemのいずれかに、
 * 編集に必要なメタデータ（sourceFile, jsonItemId）を付加したもの。
 */
export type EditingAppItem =
  EditingLauncherItem | EditingWindowItem | EditingClipboardItem | EditingSetItem;

/**
 * EditingLauncherItemかどうかを判定
 */
export function isEditingLauncherItem(item: EditingAppItem): item is EditingLauncherItem {
  const specialTypes = ['window', 'clipboard', 'set'] as const;
  return !specialTypes.includes(item.type as (typeof specialTypes)[number]);
}

/**
 * EditingWindowItemかどうかを判定
 */
export function isEditingWindowItem(item: EditingAppItem): item is EditingWindowItem {
  return item.type === 'window';
}

/**
 * EditingClipboardItemかどうかを判定
 */
export function isEditingClipboardItem(item: EditingAppItem): item is EditingClipboardItem {
  return item.type === 'clipboard';
}

/**
 * EditingSetItemかどうかを判定
 */
export function isEditingSetItem(item: EditingAppItem): item is EditingSetItem {
  return item.type === 'set';
}

/**
 * 管理画面から渡された編集対象（EditableJsonItem）か。メイン画面からは EditingAppItem が渡される
 */
export function isEditableJsonItem(
  item: EditingAppItem | EditableJsonItem
): item is EditableJsonItem {
  return 'item' in item && 'meta' in item;
}
