import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Workspace,
  WorkspaceItem,
  WorkspaceLauncherItem,
  WorkspaceGroupView,
} from '@common/types';
import { isIconFetchTarget } from '@common/constants';

import { logError } from '../../utils/debug';
import { useGlobalLoading } from '../useGlobalLoading';

type IconCacheItem = {
  displayName: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  customIcon?: string;
  originalPath?: string;
};

/** アイコンをキャッシュから解決するのは通常アイテム（path を持つ）だけ */
function isLauncherItem(item: WorkspaceItem): item is WorkspaceLauncherItem {
  return item.type === 'item';
}

/** WorkspaceItem を loadCachedIcons / ensureIcons が受け取る形式へ変換する */
function toIconCacheItem(item: WorkspaceLauncherItem): IconCacheItem {
  return {
    displayName: item.displayName,
    path: item.path,
    type: item.launcherType,
    customIcon: item.customIcon,
    originalPath: item.originalPath,
  };
}

async function mergeIconsFromCache<T extends WorkspaceItem>(items: T[]): Promise<T[]> {
  const itemsNeedingIcons = items.filter(
    (item): item is T & WorkspaceLauncherItem => !item.icon && isLauncherItem(item)
  );
  if (itemsNeedingIcons.length === 0) return items;

  const iconCache = await window.electronAPI.loadCachedIcons(
    itemsNeedingIcons.map(toIconCacheItem)
  );

  return items.map((item) =>
    isLauncherItem(item) ? { ...item, icon: item.icon || iconCache[item.path] || undefined } : item
  );
}

export function useWorkspaceData(detachedGroupId?: string | null) {
  const isDetached = !!detachedGroupId;
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [groups, setGroups] = useState<WorkspaceGroupView[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string>(() => {
    // 無効な id は loadWorkspaces() で先頭のワークスペースにフォールバックする
    return localStorage.getItem('activeWorkspaceId') || '';
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

  function applyCollapsedOverrides(loadedGroups: WorkspaceGroupView[]): WorkspaceGroupView[] {
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
      const itemsWithIcons = await mergeIconsFromCache(loadedItems);
      setItems(itemsWithIcons);
      void fetchMissingIcons(itemsWithIcons);
    } catch (error) {
      logError('Failed to load workspace items:', error);
    }
  }

  /**
   * キャッシュに無かったアイコンを取得して反映する
   *
   * ワークスペースにしか存在しないアイテムはメインウィンドウの一括取得の対象外で
   * キャッシュが作られないため、ここで補う。表示を待たせないよう初回描画のあとに実行し、
   * 失敗しても画面には影響させない（取得できなかったアイテムはメイン側で記録され、
   * 次回以降の呼び出しではスキップされる）。
   */
  async function fetchMissingIcons(items: WorkspaceItem[]): Promise<void> {
    const missingItems = items.filter(
      (item): item is WorkspaceLauncherItem =>
        isLauncherItem(item) &&
        !item.icon &&
        isIconFetchTarget(item.launcherType) &&
        !item.customIcon
    );
    if (missingItems.length === 0) return;

    try {
      const fetched = await window.electronAPI.ensureIcons(missingItems.map(toIconCacheItem));
      if (Object.keys(fetched).length === 0) return;

      setItems((prev) =>
        prev.map((item) =>
          item.icon || !isLauncherItem(item)
            ? item
            : { ...item, icon: fetched[item.path] || undefined }
        )
      );
    } catch (error) {
      logError('Failed to fetch missing workspace icons:', error);
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
