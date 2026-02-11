import { useState, useEffect } from 'react';
import type { WorkspaceItem, WorkspaceGroup } from '@common/types';

import { logError } from '../../utils/debug';
import { useGlobalLoading } from '../useGlobalLoading';

type IconCacheItem = {
  displayName: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  customIcon?: string;
  originalPath?: string;
};

type ItemType = 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'windowOperation' | 'group';

function needsIconFromCache(type: ItemType): boolean {
  return type !== 'windowOperation' && type !== 'group';
}

async function mergeIconsFromCache<T extends { icon?: string }>(
  items: T[],
  getPath: (item: T) => string,
  toLauncherStyle: (item: T) => IconCacheItem,
  getType: (item: T) => ItemType
): Promise<T[]> {
  const itemsNeedingIcons = items.filter((item) => !item.icon && needsIconFromCache(getType(item)));
  if (itemsNeedingIcons.length === 0) return items;

  const launcherStyleItems = itemsNeedingIcons.map(toLauncherStyle);
  const iconCache = await window.electronAPI.loadCachedIcons(launcherStyleItems);

  return items.map((item) => ({
    ...item,
    icon: item.icon || iconCache[getPath(item)] || undefined,
  }));
}

export function useWorkspaceData() {
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const { withLoading } = useGlobalLoading();

  async function loadItems(): Promise<void> {
    try {
      const loadedItems = await window.electronAPI.workspaceAPI.loadItems();
      const itemsWithIcons = await mergeIconsFromCache(
        loadedItems,
        (item) => item.path,
        (item) => ({
          displayName: item.displayName,
          path: item.path,
          type: item.type as IconCacheItem['type'],
          customIcon: item.customIcon,
          originalPath: item.originalPath,
        }),
        (item) => item.type as ItemType
      );
      setItems(itemsWithIcons);
    } catch (error) {
      logError('Failed to load workspace items:', error);
    }
  }

  async function loadGroups(): Promise<void> {
    try {
      const loadedGroups = await window.electronAPI.workspaceAPI.loadGroups();
      setGroups(loadedGroups);
    } catch (error) {
      logError('Failed to load workspace groups:', error);
    }
  }

  async function loadAllData(): Promise<void> {
    await Promise.all([loadItems(), loadGroups()]);
  }

  async function loadAllDataWithLoading(): Promise<void> {
    await withLoading('データ読込中', loadAllData);
  }

  useEffect(() => {
    loadAllData();
    const unsubscribe = window.electronAPI.onWorkspaceChanged(loadAllDataWithLoading);
    return unsubscribe;
  }, []);

  return {
    items,
    groups,
    loadAllDataWithLoading,
  };
}
