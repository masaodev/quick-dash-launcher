import { useState, useEffect, useRef } from 'react';
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

  // ウィンドウごとに独立した collapsed 状態を管理
  const collapsedOverrides = useRef<Map<string, boolean>>(new Map());
  const overridesInitialized = useRef(false);

  function applyCollapsedOverrides(loadedGroups: WorkspaceGroup[]): WorkspaceGroup[] {
    const overrides = collapsedOverrides.current;
    if (overrides.size === 0) return loadedGroups;
    return loadedGroups.map((g) =>
      overrides.has(g.id) ? { ...g, collapsed: overrides.get(g.id)! } : g
    );
  }

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
      // 初回ロード: バックエンドの collapsed 値をスナップショットとして保存
      if (!overridesInitialized.current) {
        for (const g of loadedGroups) {
          collapsedOverrides.current.set(g.id, g.collapsed);
        }
        overridesInitialized.current = true;
      }
      // ローカルオーバーライドを適用（初回はバックエンド値と同一）
      setGroups(applyCollapsedOverrides(loadedGroups));
    } catch (error) {
      logError('Failed to load workspace groups:', error);
    }
  }

  /** グループの collapsed 状態をトグルし、新しい collapsed 値を返す */
  function toggleGroupCollapsed(groupId: string): boolean | undefined {
    const current = collapsedOverrides.current.get(groupId);
    if (current === undefined) return undefined;
    const newCollapsed = !current;
    collapsedOverrides.current.set(groupId, newCollapsed);
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, collapsed: newCollapsed } : g))
    );
    return newCollapsed;
  }

  function setAllGroupsCollapsedLocal(collapsed: boolean): void {
    setGroups((prev) => {
      for (const g of prev) {
        collapsedOverrides.current.set(g.id, collapsed);
      }
      return prev.map((g) => ({ ...g, collapsed }));
    });
  }

  async function loadAllData(): Promise<void> {
    await Promise.all([loadItems(), loadGroups()]);
  }

  async function loadAllDataWithLoading(): Promise<void> {
    await withLoading('データ読込中', loadAllData);
  }

  useEffect(() => {
    loadAllData();
    const unsubscribe = window.electronAPI.onWorkspaceChanged(loadAllData);
    return unsubscribe;
  }, []);

  return {
    items,
    groups,
    loadAllDataWithLoading,
    toggleGroupCollapsed,
    setAllGroupsCollapsedLocal,
  };
}
