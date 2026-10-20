/**
 * アイテム管理画面の一覧で使う、表示用の純粋な関数
 *
 * 種類の表示名・アイコン、セルで編集できる項目の判定、更新日の書式など。状態を持たない。
 */
import i18next from 'i18next';
import type { JsonItem, JsonLauncherItem, JsonSetItem, JsonClipboardItem } from '@common/types';
import {
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonClipboardItem,
  isJsonSetItem,
} from '@common/types';

/** 種類ごとのアイコン（表示名は辞書の itemManager.types） */
export const ITEM_TYPE_INFO: Record<JsonItem['type'], { icon: string }> = {
  item: { icon: '📄' },
  dir: { icon: '🗂️' },
  clipboard: { icon: '📋' },
  set: { icon: '📦' },
};

/** 種類の表示名（今の表示言語で） */
export function getItemTypeLabel(type: JsonItem['type']): string {
  return type in ITEM_TYPE_INFO
    ? i18next.t(`itemManager.types.${type}`)
    : i18next.t('itemManager.types.unknown');
}

export function getItemTypeIcon(jsonItem: JsonItem): string {
  return ITEM_TYPE_INFO[jsonItem.type]?.icon ?? '❓';
}

export function getItemTypeName(jsonItem: JsonItem): string {
  return getItemTypeLabel(jsonItem.type);
}

// displayNameを持つアイテム型
export type JsonItemWithDisplayName = JsonLauncherItem | JsonSetItem | JsonClipboardItem;

/** displayName を持つ種類か（フォルダ取込だけが持たない） */
export function hasDisplayName(jsonItem: JsonItem): jsonItem is JsonItemWithDisplayName {
  return (
    (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) ||
    (jsonItem.type === 'set' && isJsonSetItem(jsonItem)) ||
    (jsonItem.type === 'clipboard' && isJsonClipboardItem(jsonItem))
  );
}

/** パス列をセルで直接編集できる種類（それ以外は ✏️ の詳細編集から） */
export function isPathEditable(jsonItem: JsonItem): boolean {
  return jsonItem.type === 'item' || jsonItem.type === 'dir';
}

/** セルで編集するパスの現在値（編集できない種類は空文字） */
export function getEditablePath(jsonItem: JsonItem): string {
  if (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) {
    return jsonItem.path || '';
  }
  if (jsonItem.type === 'dir' && isJsonDirItem(jsonItem)) {
    return jsonItem.path || '';
  }
  return '';
}

/**
 * メモの入力値をアイテムに入れる（改行は LF にそろえ、末尾の空白・改行は除き、空ならメモの項目ごと消す）
 *
 * CSV から取り込んだメモはセルの中の改行が CRLF のことがあるので、ここでそろえる
 */
export function withEditedMemo<T extends { memo?: string }>(item: T, value: string): T {
  const memo = value.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  if (memo) return { ...item, memo };
  const { memo: _removed, ...rest } = item;
  return rest as T;
}

/** パスを差し替えた JsonItem（編集できない種類はそのまま返す） */
export function withEditedPath(jsonItem: JsonItem, path: string): JsonItem {
  if (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) {
    return { ...jsonItem, path };
  }
  if (jsonItem.type === 'dir' && isJsonDirItem(jsonItem)) {
    return { ...jsonItem, path };
  }
  return jsonItem;
}

export function formatUpdatedAt(updatedAt?: number): string {
  if (!updatedAt) return '-';
  return new Date(updatedAt).toLocaleString(i18next.language, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
