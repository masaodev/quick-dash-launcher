import { useEffect, useRef, useState } from 'react';
import type { JsonItem, LauncherItem } from '@common/types';
import { isJsonLauncherItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { loadCustomIcons } from '../utils/customIcons';

/** path を持たない種別（クリップボード・セット）のカスタムアイコンを Map に入れるときのキー */
function customIconKey(fileName: string): string {
  return `custom-icon:${fileName}`;
}

/** path を持たず、カスタムアイコンだけを持てる種別のファイル名（無ければ undefined） */
function getCustomIconOnlyFileName(jsonItem: JsonItem): string | undefined {
  return jsonItem.type === 'clipboard' || jsonItem.type === 'set' ? jsonItem.customIcon : undefined;
}

/** 一覧の行に出すアイコンを useAdminItemIcons の結果から引く */
export function getAdminItemIcon(
  itemIcons: Map<string, string>,
  jsonItem: JsonItem
): string | undefined {
  if (jsonItem.type === 'item') return itemIcons.get(jsonItem.path || '');
  const fileName = getCustomIconOnlyFileName(jsonItem);
  return fileName ? itemIcons.get(customIconKey(fileName)) : undefined;
}

/**
 * アイテム管理の一覧に出すアイコン（ファビコン・自動取得・カスタム）を取得する
 *
 * 取得済みかつ未更新のアイテムはスキップし、差分だけを IPC で取る。
 * クリップボード・セットはカスタムアイコンをファイル名で読む（ファイル名はアイコンを変えると変わる）。
 *
 * @returns Map<パス（またはカスタムアイコンのキー）, base64 データ URL>。行から引くときは getAdminItemIcon
 */
export function useAdminItemIcons(items: EditableJsonItem[]): Map<string, string> {
  const [itemIcons, setItemIcons] = useState<Map<string, string>>(new Map());
  // 取得試行済みのパス→updatedAt。フィルタ・選択等で items の参照が変わるたびに
  // 全アイコンを再取得しないよう、未取得または内容が更新されたアイテムのみ取得する
  const fetchedVersionsRef = useRef<Map<string, number | undefined>>(new Map());
  // 読み込みを試したカスタムアイコンのファイル名
  const fetchedCustomIconsRef = useRef<Set<string>>(new Set());

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
              type: editableItem.meta.launcherType ?? detectItemTypeSync(jsonItem.path || ''),
              customIcon: jsonItem.customIcon,
            } as LauncherItem;
          }
          return null;
        })
        .filter((item): item is LauncherItem => item !== null);

      const customIconFileNames = [
        ...new Set(
          items
            .map((editableItem) => getCustomIconOnlyFileName(editableItem.item))
            .filter((name): name is string => !!name && !fetchedCustomIconsRef.current.has(name))
        ),
      ];

      if (launcherItems.length === 0 && customIconFileNames.length === 0) return;

      items.forEach((editableItem) => {
        const jsonItem = editableItem.item;
        if (jsonItem.type === 'item' && jsonItem.path) {
          fetched.set(jsonItem.path, jsonItem.updatedAt);
        }
      });
      customIconFileNames.forEach((name) => fetchedCustomIconsRef.current.add(name));

      // loadCachedIcons() でアイコンを一括取得（メイン画面と同じ API）
      const [iconCache, customIcons] = await Promise.all([
        launcherItems.length > 0
          ? window.electronAPI.loadCachedIcons(launcherItems)
          : Promise.resolve<Record<string, string>>({}),
        loadCustomIcons(customIconFileNames),
      ]);

      setItemIcons((prev) => {
        const next = new Map(prev);
        // 取り直した行は前のアイコンを捨てる（カスタムアイコンを外したときに残さない）
        launcherItems.forEach((item) => next.delete(item.path));
        Object.entries(iconCache).forEach(([path, iconData]) => {
          if (iconData) next.set(path, iconData);
        });
        Object.entries(customIcons).forEach(([fileName, iconData]) => {
          next.set(customIconKey(fileName), iconData);
        });
        return next;
      });
    };

    loadIcons();
  }, [items]);

  return itemIcons;
}
