/**
 * 編集用アイテムの型定義
 *
 * RegisterModalで編集中のアイテムを表す型定義。
 * RawDataLine（CSV形式）を廃止し、AppItemベースで直接扱う。
 */

import type { LauncherItem, GroupItem, WindowOperationItem } from './launcher';

/**
 * 編集可能なアイテムの共通メタデータ
 */
export interface EditingItemMeta {
  /** 元のデータファイル名 */
  sourceFile: string;
  /** データファイル内の行番号（1から開始） */
  lineNumber: number;
  /** JSONファイルのアイテムID（ID保持用） */
  jsonItemId?: string;
}

/**
 * 編集用LauncherItem
 */
export interface EditingLauncherItem extends LauncherItem, EditingItemMeta {
  /** フォルダ取込から展開されたアイテムかどうか */
  isDirExpanded?: boolean;
  /** フォルダ取込の元パス */
  expandedFrom?: string;
  /** フォルダ取込のオプション文字列 */
  expandedOptions?: string;
}

/**
 * 編集用GroupItem
 */
export interface EditingGroupItem extends GroupItem, EditingItemMeta {}

/**
 * 編集用WindowOperationItem
 */
export interface EditingWindowOperationItem extends WindowOperationItem, EditingItemMeta {}

/**
 * 編集用アイテムの統合型
 *
 * RegisterModal、useRegisterModal、useRegisterFormで使用される。
 * LauncherItem/GroupItem/WindowOperationItemのいずれかに、
 * 編集に必要なメタデータ（sourceFile, lineNumber, jsonItemId）を付加したもの。
 */
export type EditingAppItem = EditingLauncherItem | EditingGroupItem | EditingWindowOperationItem;

/**
 * EditingLauncherItemかどうかを判定
 */
export function isEditingLauncherItem(item: EditingAppItem): item is EditingLauncherItem {
  return item.type !== 'group' && item.type !== 'windowOperation';
}

/**
 * EditingGroupItemかどうかを判定
 */
export function isEditingGroupItem(item: EditingAppItem): item is EditingGroupItem {
  return item.type === 'group';
}

/**
 * EditingWindowOperationItemかどうかを判定
 */
export function isEditingWindowOperationItem(item: EditingAppItem): item is EditingWindowOperationItem {
  return item.type === 'windowOperation';
}
