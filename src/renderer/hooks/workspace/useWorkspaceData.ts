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

  // 折りたたみ状態の出どころ:
  // - メインのワークスペース画面: workspace-ui-state.json（loadGroups が返す collapsed）が真の状態
  // - 切り離しウィンドウ: ウィンドウごとに独立させるため、切り離し状態に保存した値でだけ上書きする
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const detachedCollapsedOverrides = useRef<Map<string, boolean>>(new Map());
  const detachedOverridesLoaded = useRef(false);

  function applyDetachedOverrides(loadedGroups: WorkspaceGroupView[]): WorkspaceGroupView[] {
    const overrides = detachedCollapsedOverrides.current;
    if (overrides.size === 0) return loadedGroups;
    return loadedGroups.map((g) =>
      overrides.has(g.id) ? { ...g, collapsed: overrides.get(g.id)! } : g
    );
  }

  function saveDetachedCollapsedStates(): void {
    if (!detachedGroupId) return;
    const states = Object.fromEntries(detachedCollapsedOverrides.current);
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
      // 切り離しウィンドウ: 保存済みの折りたたみ状態を初回だけ取り込む
      if (detachedGroupId && !detachedOverridesLoaded.current) {
        detachedOverridesLoaded.current = true;
        try {
          const saved = await window.electronAPI.workspaceAPI.loadDetachedState(detachedGroupId);
          for (const [id, collapsed] of Object.entries(saved?.collapsedStates ?? {})) {
            detachedCollapsedOverrides.current.set(id, collapsed);
          }
        } catch {
          // 保存データが無い場合は無視
        }
      }
      setGroups(applyDetachedOverrides(loadedGroups));
    } catch (error) {
      logError('Failed to load workspace groups:', error);
    }
  }

  /**
   * グループの collapsed 状態をトグルし、新しい collapsed 値を返す
   *
   * 画面には即時反映する。永続化は切り離しウィンドウならここで（切り離し状態へ）、
   * それ以外は呼び出し側が setGroupsCollapsed で行う
   */
  function toggleGroupCollapsed(groupId: string): boolean {
    const current =
      detachedCollapsedOverrides.current.get(groupId) ??
      groupsRef.current.find((g) => g.id === groupId)?.collapsed ??
      false;
    const newCollapsed = !current;
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, collapsed: newCollapsed } : g))
    );
    if (isDetached) {
      detachedCollapsedOverrides.current.set(groupId, newCollapsed);
      saveDetachedCollapsedStates();
    }
    return newCollapsed;
  }

  function setAllGroupsCollapsedLocal(collapsed: boolean): void {
    setGroups((prev) => prev.map((g) => ({ ...g, collapsed })));
    if (isDetached) {
      for (const g of groupsRef.current) {
        detachedCollapsedOverrides.current.set(g.id, collapsed);
      }
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
