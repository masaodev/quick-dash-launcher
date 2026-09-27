/**
 * アイテム管理画面の一覧で使う、表示用の純粋な関数
 *
 * 種類の表示名・アイコン、セルで編集できる項目の判定、更新日の書式など。状態を持たない。
 */
import type {
  JsonItem,
  JsonLauncherItem,
  JsonGroupItem,
  JsonWindowItem,
  JsonLayoutItem,
  JsonClipboardItem,
} from '@common/types';
import {
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonGroupItem,
  isJsonWindowItem,
  isJsonClipboardItem,
  isJsonLayoutItem,
} from '@common/types';

/** 種類ごとのアイコンと表示名 */
export const ITEM_TYPE_INFO: Record<JsonItem['type'], { icon: string; name: string }> = {
  item: { icon: '📄', name: '単一アイテム' },
  group: { icon: '📦', name: 'グループ' },
  dir: { icon: '🗂️', name: 'フォルダ取込' },
  window: { icon: '🪟', name: 'ウィンドウ操作' },
  clipboard: { icon: '📋', name: 'クリップボード' },
  layout: { icon: '🖥️', name: 'ウィンドウ配置' },
};

export function getItemTypeIcon(jsonItem: JsonItem): string {
  return ITEM_TYPE_INFO[jsonItem.type]?.icon ?? '❓';
}

export function getItemTypeName(jsonItem: JsonItem): string {
  return ITEM_TYPE_INFO[jsonItem.type]?.name ?? '不明';
}

// displayNameを持つアイテム型
export type JsonItemWithDisplayName =
  JsonLauncherItem | JsonGroupItem | JsonWindowItem | JsonLayoutItem | JsonClipboardItem;

/** displayName を持つ種類か（フォルダ取込だけが持たない） */
export function hasDisplayName(jsonItem: JsonItem): jsonItem is JsonItemWithDisplayName {
  return (
    (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) ||
    (jsonItem.type === 'group' && isJsonGroupItem(jsonItem)) ||
    (jsonItem.type === 'window' && isJsonWindowItem(jsonItem)) ||
    (jsonItem.type === 'layout' && isJsonLayoutItem(jsonItem)) ||
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
  return new Date(updatedAt).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
