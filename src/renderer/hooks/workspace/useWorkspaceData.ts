import { useState, useEffect } from 'react';
import type { WorkspaceItem, WorkspaceGroup, ExecutionHistoryItem } from '@common/types';

import { logError } from '../../utils/debug';

/** アイコンキャッシュ取得用の最小限の型 */
type IconCacheItem = {
  displayName: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  customIcon?: string;
  originalPath?: string;
};

/**
 * アイコンキャッシュを読み込んでアイテムにマージする
 */
async function mergeIconsFromCache<T extends { icon?: string }>(
  items: T[],
  getPath: (item: T) => string,
  toLauncherStyle: (item: T) => IconCacheItem,
  needsIcon: (item: T) => boolean
): Promise<T[]> {
  const itemsNeedingIcons = items.filter(needsIcon);
  if (itemsNeedingIcons.length === 0) return items;

  const launcherStyleItems = itemsNeedingIcons.map(toLauncherStyle);
  const iconCache = await window.electronAPI.loadCachedIcons(launcherStyleItems);

  return items.map((item) => ({
    ...item,
    icon: item.icon || iconCache[getPath(item)] || undefined,
  }));
}

/**
 * ワークスペースのデータ管理フック
 */
export function useWorkspaceData() {
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryItem[]>([]);

  const loadItems = async () => {
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
        (item) => !item.icon && item.type !== 'windowOperation' && item.type !== 'group'
      );
      setItems(itemsWithIcons);
    } catch (error) {
      logError('Failed to load workspace items:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const loadedGroups = await window.electronAPI.workspaceAPI.loadGroups();
      setGroups(loadedGroups);
    } catch (error) {
      logError('Failed to load workspace groups:', error);
    }
  };

  const loadExecutionHistory = async () => {
    try {
      const history = await window.electronAPI.workspaceAPI.loadExecutionHistory();
      const historyWithIcons = await mergeIconsFromCache(
        history,
        (item) => item.itemPath,
        (item) => ({
          displayName: item.itemName,
          path: item.itemPath,
          type: item.itemType as IconCacheItem['type'],
          customIcon: item.customIcon,
        }),
        (item) => !item.icon && item.itemType !== 'windowOperation' && item.itemType !== 'group'
      );
      setExecutionHistory(historyWithIcons);
    } catch (error) {
      logError('Failed to load execution history:', error);
    }
  };

  // 初期データ読み込みと変更イベントリスニング
  useEffect(() => {
    loadItems();
    loadGroups();
    loadExecutionHistory();

    // ワークスペース変更イベントをリッスン
    const unsubscribe = window.electronAPI.onWorkspaceChanged(() => {
      loadItems();
      loadGroups();
      loadExecutionHistory();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    items,
    groups,
    executionHistory,
    loadItems,
    loadGroups,
    loadExecutionHistory,
  };
}
