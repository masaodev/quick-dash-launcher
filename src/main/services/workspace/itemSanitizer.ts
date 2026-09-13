/**
 * ワークスペースアイテムの保存前正規化
 *
 * アイコン（base64データURL）はicon-cacheフォルダから実行時に解決する方式のため、
 * workspace.json / workspace-archive.json には保存しない。
 * 保存すると設定ファイルが肥大化し、読み込み・IPC転送のコストが上がる。
 *
 * items の書き込み口が複数のマネージャーに分散しているため、除去漏れを防ぐ目的で
 * ストアへの書き込みは必ず setStoredItems() を経由させる。
 */
import type { WorkspaceItem } from '@common/types';
import logger from '@common/logger';
import { stripIconFromLayoutEntries } from '@common/utils/dataConverters';

/** items を読み書きするストア（workspace / workspace-archive の双方を受け付ける） */
type WorkspaceItemsStore<T extends WorkspaceItem> = {
  get(key: 'items'): T[];
  set(key: 'items', value: T[]): void;
};

/** アイテムがランタイムアイコンを保持しているか */
function hasRuntimeIcon(item: WorkspaceItem): boolean {
  return (
    item.icon !== undefined || (item.layoutEntries?.some((e) => e.icon !== undefined) ?? false)
  );
}

/** アイテム1件からランタイムアイコンを除去する */
function stripRuntimeIcon<T extends WorkspaceItem>(item: T): T {
  const { icon: _icon, layoutEntries, ...rest } = item;
  return {
    ...rest,
    ...(layoutEntries ? { layoutEntries: stripIconFromLayoutEntries(layoutEntries) } : {}),
  } as T;
}

/**
 * アイテム配列からランタイムアイコンを除去する
 * 除去対象がない場合は元の配列をそのまま返す
 */
export function stripRuntimeIcons<T extends WorkspaceItem>(items: T[]): T[] {
  if (!items.some(hasRuntimeIcon)) return items;
  return items.map((item) => (hasRuntimeIcon(item) ? stripRuntimeIcon(item) : item));
}

/** アイテム配列をランタイムアイコン除去のうえストアへ保存する */
export function setStoredItems<T extends WorkspaceItem>(
  store: WorkspaceItemsStore<T>,
  items: T[]
): void {
  store.set('items', stripRuntimeIcons(items));
}

/**
 * ストアに保存済みのランタイムアイコンを一括除去する（冪等）
 *
 * 旧仕様でbase64アイコンを埋め込んでいた頃のデータが残っているため、
 * 起動時に一度だけ書き戻して設定ファイルを縮小する。
 */
export function purgeStoredItemIcons<T extends WorkspaceItem>(
  store: WorkspaceItemsStore<T>,
  storeName: string
): void {
  const items = store.get('items') || [];
  const purgedCount = items.filter(hasRuntimeIcon).length;
  if (purgedCount === 0) return;

  store.set('items', stripRuntimeIcons(items));
  logger.info({ storeName, purgedCount }, 'Purged stored runtime icons from workspace store');
}
