import { useState, useEffect, useRef, useCallback } from 'react';
import type { Workspace, WorkspaceItem, WorkspaceGroup } from '@common/types';

import { logError } from '../../utils/debug';
import { useGlobalLoading } from '../useGlobalLoading';

type IconCacheItem = {
  displayName: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  customIcon?: string;
  originalPath?: string;
};

/** アイコンキャッシュ対象のタイプ（IconCacheItem['type']と一致） */
const ICON_CACHEABLE_TYPES: ReadonlySet<string> = new Set<IconCacheItem['type']>([
  'url',
  'file',
  'folder',
  'app',
  'customUri',
]);

function needsIconFromCache(type: WorkspaceItem['type']): boolean {
  return ICON_CACHEABLE_TYPES.has(type);
}

async function mergeIconsFromCache<T extends { icon?: string }>(
  items: T[],
  getPath: (item: T) => string,
  toLauncherStyle: (item: T) => IconCacheItem,
  getType: (item: T) => WorkspaceItem['type']
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

export function useWorkspaceData(detachedGroupId?: string | null) {
  const isDetached = !!detachedGroupId;
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string>(() => {
    return localStorage.getItem('activeWorkspaceId') || 'default';
  });
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
  activeWorkspaceIdRef.current = activeWorkspaceId;
  const { withLoading } = useGlobalLoading();

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    localStorage.setItem('activeWorkspaceId', id);
  }, []);

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

  function saveDetachedCollapsedStates(): void {
    if (!detachedGroupId) return;
    const states = Object.fromEntries(collapsedOverrides.current);
    window.electronAPI.workspaceAPI.saveDetachedCollapsed(detachedGroupId, states).catch(() => {});
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
        (item) => item.type as WorkspaceItem['type']
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
        // 切り離しウィンドウの場合: 保存済みの collapsed 状態を上書き適用
        if (detachedGroupId) {
          try {
            const saved = await window.electronAPI.workspaceAPI.loadDetachedState(detachedGroupId);
            if (saved?.collapsedStates) {
              for (const [id, collapsed] of Object.entries(saved.collapsedStates)) {
                collapsedOverrides.current.set(id, collapsed);
              }
            }
          } catch {
            // 保存データが無い場合は無視
          }
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
    if (isDetached) {
      saveDetachedCollapsedStates();
    }
    return newCollapsed;
  }

  function setAllGroupsCollapsedLocal(collapsed: boolean): void {
    setGroups((prev) => {
      for (const g of prev) {
        collapsedOverrides.current.set(g.id, collapsed);
      }
      return prev.map((g) => ({ ...g, collapsed }));
    });
    if (isDetached) {
      saveDetachedCollapsedStates();
    }
  }

  async function loadWorkspaces(): Promise<void> {
    try {
      const loaded = await window.electronAPI.workspaceAPI.loadWorkspaces();
      setWorkspaces(loaded);

      // アクティブWSが削除されていた場合、最初のWSにフォールバック
      if (loaded.length > 0 && !loaded.some((w) => w.id === activeWorkspaceIdRef.current)) {
        const firstWs = [...loaded].sort((a, b) => a.order - b.order)[0];
        setActiveWorkspaceId(firstWs.id);
      }
    } catch (error) {
      logError('Failed to load workspaces:', error);
    }
  }

  async function loadAllData(): Promise<void> {
    await Promise.all([loadItems(), loadGroups(), loadWorkspaces()]);
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
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loadAllDataWithLoading,
    toggleGroupCollapsed,
    setAllGroupsCollapsedLocal,
  };
}
