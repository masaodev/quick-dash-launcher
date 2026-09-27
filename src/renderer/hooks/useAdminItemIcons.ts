import { useEffect, useRef, useState } from 'react';
import type { LauncherItem } from '@common/types';
import { isJsonLauncherItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

/**
 * アイテム管理の一覧に出すアイコン（ファビコン・自動取得・カスタム）を取得する
 *
 * 取得済みかつ未更新のアイテムはスキップし、差分だけを IPC で取る。
 *
 * @returns Map<パス, base64 データ URL>
 */
export function useAdminItemIcons(items: EditableJsonItem[]): Map<string, string> {
  const [itemIcons, setItemIcons] = useState<Map<string, string>>(new Map());
  // 取得試行済みのパス→updatedAt。フィルタ・選択等で items の参照が変わるたびに
  // 全アイコンを再取得しないよう、未取得または内容が更新されたアイテムのみ取得する
  const fetchedVersionsRef = useRef<Map<string, number | undefined>>(new Map());

  useEffect(() => {
    const loadIcons = async () => {
      const fetched = fetchedVersionsRef.current;
      const launcherItems = items
        .filter((editableItem) => {
          const jsonItem = editableItem.item;
          if (jsonItem.type !== 'item' || !jsonItem.path) return false;
          return !fetched.has(jsonItem.path) || fetched.get(jsonItem.path) !== jsonItem.updatedAt;
        })
        .map((editableItem) => {
          const jsonItem = editableItem.item;
          if (isJsonLauncherItem(jsonItem)) {
            return {
              displayName: jsonItem.displayName || '',
              path: jsonItem.path || '',
              type: detectItemTypeSync(jsonItem.path || ''),
            } as LauncherItem;
          }
          return null;
        })
        .filter((item): item is LauncherItem => item !== null);

      if (launcherItems.length === 0) return;

      items.forEach((editableItem) => {
        const jsonItem = editableItem.item;
        if (jsonItem.type === 'item' && jsonItem.path) {
          fetched.set(jsonItem.path, jsonItem.updatedAt);
        }
      });

      // loadCachedIcons() でアイコンを一括取得（メイン画面と同じ API）
      const iconCache = await window.electronAPI.loadCachedIcons(launcherItems);

      setItemIcons((prev) => {
        const next = new Map(prev);
        Object.entries(iconCache).forEach(([path, iconData]) => {
          if (iconData) next.set(path, iconData);
        });
        return next;
      });
    };

    loadIcons();
  }, [items]);

  return itemIcons;
}
