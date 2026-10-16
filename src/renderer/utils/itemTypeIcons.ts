import type { WorkspaceItem } from '@common/types';

/** 種類ごとの絵文字（アイコン画像が取れていないときにメイン画面・セットの画面で出す） */
export const ITEM_TYPE_ICONS: Readonly<Record<string, string>> = {
  url: '🌐',
  folder: '📁',
  app: '⚙️',
  file: '📄',
  customUri: '🔗',
  windowSwitch: '🪟',
  window: '🪟',
  clipboard: '📋',
  set: '📦',
};

/**
 * アイテムに応じたデフォルトアイコン（絵文字）を返す
 * アイコン画像が取得できていないときのプレースホルダー
 */
export function getDefaultIconForItem(item: WorkspaceItem): string {
  if (item.type === 'item') return ITEM_TYPE_ICONS[item.launcherType] ?? ITEM_TYPE_ICONS.file;
  return ITEM_TYPE_ICONS[item.type];
}
