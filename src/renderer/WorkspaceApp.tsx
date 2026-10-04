/**
 * 画面: ワークスペースウィンドウ
 * 画面仕様: docs/screens/workspace-window.md
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { WorkspaceItem, WorkspaceGroupView } from '@common/types';
import { getDescendantGroupIds } from '@common/utils/groupTreeUtils';
import { DETACHED_WINDOW_NAME_PREFIX } from '@common/constants';

import WorkspaceFilterBar from './components/WorkspaceFilterBar';
import WorkspaceGroupedList from './components/WorkspaceGroupedList';
import WorkspaceHeader from './components/WorkspaceHeader';
import WorkspaceTabBar from './components/WorkspaceTabBar';
import { useClipboardPaste } from './hooks/useClipboardPaste';
import { useCollapsibleSections } from './hooks/useCollapsibleSections';
import { useFileOperations } from './hooks/useFileOperations';
import { useNativeDragDrop } from './hooks/useNativeDragDrop';
import { useWorkspaceFilter, type FilterScope } from './hooks/useWorkspaceFilter';
import {
  useWorkspaceActions,
  useWorkspaceAutoFit,
  useWorkspaceData,
  useWorkspaceResize,
} from './hooks/workspace';
import { logError } from './utils/debug';

const RESIZE_DIRECTIONS = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
] as const;

/** 切り離しウィンドウの groupId を window.name または URL クエリから取得する */
function getDetachedGroupIdFromWindow(): string | null {
  if (window.name.startsWith(DETACHED_WINDOW_NAME_PREFIX)) {
    const id = window.name.slice(DETACHED_WINDOW_NAME_PREFIX.length);
    if (id) return id;
  }
  return new URLSearchParams(window.location.search).get('groupId');
}

const WorkspaceApp: React.FC = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [detachedPinMode, setDetachedPinMode] = useState(0);
  const [backgroundTransparent, setBackgroundTransparent] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string>();
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [archivedGroups, setArchivedGroups] = useState<WorkspaceGroupView[]>([]);
  const [archivedItems, setArchivedItems] = useState<WorkspaceItem[]>([]);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterScope, setFilterScope] = useState<FilterScope>('all');
  const [focusTrigger, setFocusTrigger] = useState(0);
  // 切り離しウィンドウモード判定
  // 通常は window.name（ワークスペースから window.open で開かれた場合）、
  // メインプロセスが直接生成したフォールバック時は URL クエリから groupId を読み取る
  const [detachedGroupId] = useState<string | null>(() => getDetachedGroupIdFromWindow());

  const {
    items,
    groups,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loadAllDataWithLoading,
    toggleGroupCollapsed,
    setAllGroupsCollapsedLocal,
  } = useWorkspaceData(detachedGroupId);

  // アクティブワークスペースでフィルタリング
  const filteredItems = useMemo(
    () => items.filter((i) => i.workspaceId === activeWorkspaceId),
    [items, activeWorkspaceId]
  );
  const filteredGroups = useMemo(
    () => groups.filter((g) => g.workspaceId === activeWorkspaceId),
    [groups, activeWorkspaceId]
  );

  const actions = useWorkspaceActions(() => {
    loadAllDataWithLoading();
  });

  const { extractFilePaths, addItemsFromFilePaths, addUrlItem } = useFileOperations();
  useClipboardPaste(loadAllDataWithLoading, activeGroupId, activeWorkspaceId);
  const { collapsed, toggleSection, expandAll, collapseAll } = useCollapsibleSections({
    uncategorized: false,
  });
  const loadArchiveData = useCallback(async () => {
    try {
      const [groups, items] = await Promise.all([
        window.electronAPI.workspaceAPI.loadArchivedGroups(),
        window.electronAPI.workspaceAPI.loadArchivedItems(),
      ]);
      // アーカイブ画面の折りたたみはローカル状態だけで持つ（永続化しない）
      setArchivedGroups(groups.map((g) => ({ ...g, collapsed: false })));
      setArchivedItems(items);
    } catch (error) {
      logError('Failed to load archive data:', error);
    }
  }, []);

  useEffect(() => {
    if (!isArchiveMode) return;
    loadArchiveData();
    const cleanup = window.electronAPI.onWorkspaceChanged(() => {
      loadArchiveData();
    });
    return cleanup;
  }, [isArchiveMode, loadArchiveData]);

  // 表示用データ: アーカイブモード時はアーカイブデータを使用
  // workspaceId を空にして、全ワークスペースをコンテキストメニューの移動先候補にする
  // （メイン側は「自分の workspaceId 以外」を候補にするため）
  const displayGroups = isArchiveMode
    ? archivedGroups.map((g) => ({ ...g, workspaceId: '' }))
    : filteredGroups;
  const displayItems = isArchiveMode
    ? archivedItems.map((i) => ({ ...i, workspaceId: '' }))
    : filteredItems;

  const filterResult = useWorkspaceFilter(displayGroups, displayItems, filterText, filterScope);
  const isDetached = detachedGroupId !== null;
  const { handleResize } = useWorkspaceResize(
    isDetached
      ? {
          setBoundsFn: (x, y, w, h) => window.electronAPI.workspaceAPI.setCallerBounds(x, y, w, h),
          minWidth: 100,
          minHeight: 40,
        }
      : undefined
  );
  const { contentRef } = useWorkspaceAutoFit(
    isDetached
      ? (width, height) => window.electronAPI.workspaceAPI.resizeCallerWindow(width, height)
      : undefined,
    isDetached ? 0 : undefined
  );

  useEffect(() => {
    if (isDetached) {
      window.electronAPI.workspaceAPI.getCallerPinMode().then(setDetachedPinMode);
    } else {
      window.electronAPI.workspaceAPI.getAlwaysOnTop().then(setIsPinned);
    }

    const syncBackgroundTransparent = async () => {
      const settings = await window.electronAPI.getSettings();
      setBackgroundTransparent(settings.workspaceBackgroundTransparent || false);
    };
    syncBackgroundTransparent();

    const cleanup = window.electronAPI.onSettingsChanged(syncBackgroundTransparent);

    return () => cleanup?.();
  }, []);

  // 切り離しウィンドウのタイトルにグループ名を反映する（タスクバー・Alt+Tabでの識別用）
  // グループ名の変更にも追従する
  useEffect(() => {
    if (!isDetached) return;
    const groupName = groups.find((g) => g.id === detachedGroupId)?.displayName;
    if (groupName) document.title = `${groupName} - QuickDashLauncher`;
  }, [isDetached, detachedGroupId, groups]);

  useEffect(() => {
    if (isDetached) return;
    const handleCtrlF = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setIsFilterVisible(true);
        setFocusTrigger((prev) => prev + 1);
      }
    };
    document.addEventListener('keydown', handleCtrlF);
    return () => document.removeEventListener('keydown', handleCtrlF);
  }, [isDetached]);

  /** グループとそのサブグループに含まれるアイテム数・サブグループ数を算出 */
  const getGroupStats = (groupId: string): { itemCount: number; subgroupCount: number } => {
    const descendantIds = getDescendantGroupIds(groupId, displayGroups);
    const allGroupIds = new Set([groupId, ...descendantIds]);
    const itemCount = displayItems.filter(
      (item) => item.groupId && allGroupIds.has(item.groupId)
    ).length;
    return { itemCount, subgroupCount: descendantIds.length };
  };

  const getGroupName = (groupId: string): string =>
    displayGroups.find((g) => g.id === groupId)?.displayName ||
    groups.find((g) => g.id === groupId)?.displayName ||
    '';

  /** 含まれるものの説明（確認の文面用） */
  const describeContents = (itemCount: number, subgroupCount: number): string =>
    `このグループには${subgroupCount > 0 ? `サブグループ${subgroupCount}個と、` : ''}${itemCount}個のアイテムが含まれています。`;

  // 確認は独立した子ウィンドウで行う（このウィンドウは動かさない。閉じるまで操作できない）
  const handleDeleteGroup = async (groupId: string) => {
    try {
      const { itemCount, subgroupCount } = getGroupStats(groupId);
      // アーカイブからの削除は元に戻せないので、空でも必ず確認する
      if (!isArchiveMode && itemCount === 0 && subgroupCount === 0) {
        await actions.handleDeleteGroup(groupId, false);
        return;
      }
      const name = getGroupName(groupId);
      const result = await window.electronAPI.workspaceAPI.openConfirm({
        title: isArchiveMode ? 'アーカイブから削除' : 'グループの削除',
        message: `「${name}」を${isArchiveMode ? 'アーカイブから完全に削除' : '削除'}してもよろしいですか？\n\n${describeContents(itemCount, subgroupCount)}${isArchiveMode ? '\nアイテムごと削除され、元に戻せません。' : ''}`,
        confirmText: '削除',
        cancelText: 'キャンセル',
        danger: true,
        checkbox: isArchiveMode
          ? undefined
          : { label: 'グループ内のアイテムも削除する', checked: false },
      });
      if (!result) return;
      if (isArchiveMode) {
        await window.electronAPI.workspaceAPI.deleteArchivedGroup(groupId);
        await loadArchiveData();
      } else {
        await actions.handleDeleteGroup(groupId, result.checkboxChecked);
      }
    } catch (error) {
      logError('Failed to delete workspace group:', error);
    }
  };

  const handleArchiveGroup = async (groupId: string): Promise<void> => {
    try {
      const { itemCount, subgroupCount } = getGroupStats(groupId);
      const result = await window.electronAPI.workspaceAPI.openConfirm({
        title: 'グループのアーカイブ',
        message: `「${getGroupName(groupId)}」をアーカイブしてもよろしいですか？\n\n${describeContents(itemCount, subgroupCount)}\nアーカイブしたグループは後で復元できます。`,
        confirmText: 'アーカイブ',
        cancelText: 'キャンセル',
        danger: false,
      });
      if (!result) return;
      await actions.handleArchiveGroup(groupId);
    } catch (error) {
      logError('Failed to archive workspace group:', error);
    }
  };

  const handleTogglePin = async () => {
    setIsPinned(await window.electronAPI.workspaceAPI.toggleAlwaysOnTop());
  };

  const handleClose = () => {
    window.electronAPI.workspaceAPI.hideWindow();
  };

  const setAllGroupsCollapsed = async (collapsed: boolean) => {
    const targetGroups = displayGroups.filter((g) => g.collapsed !== collapsed);
    if (targetGroups.length > 0) {
      // setAllGroupsCollapsedLocal 内で detached 時は専用 API に保存される
      setAllGroupsCollapsedLocal(collapsed);
      if (!isDetached) {
        try {
          await window.electronAPI.workspaceAPI.setGroupsCollapsed(
            targetGroups.map((g) => g.id),
            collapsed
          );
        } catch (error) {
          logError(`Failed to ${collapsed ? 'collapse' : 'expand'} all groups:`, error);
          loadAllDataWithLoading();
        }
      }
    }
    if (collapsed) {
      collapseAll();
    } else {
      expandAll();
    }
  };

  const handleNativeFileDrop = async (e: React.DragEvent, groupId?: string) => {
    try {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const filePaths = await extractFilePaths(e.dataTransfer.files);
        await addItemsFromFilePaths(filePaths, loadAllDataWithLoading, groupId, activeWorkspaceId);
        for (const filePath of filePaths) {
          const fileName = filePath.split(/[/\\]/).pop() || filePath;
          await window.electronAPI.showToastWindow({
            displayName: fileName,
            itemType: 'workspaceAdd',
            path: filePath,
          });
        }
      } else if (e.dataTransfer) {
        const urlData =
          e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (urlData) {
          const urls = urlData
            .split('\n')
            .map((url) => url.trim())
            .filter((url) => url && url.startsWith('http'));
          for (const url of urls) {
            await addUrlItem(url, () => {}, groupId, activeWorkspaceId);
            await window.electronAPI.showToastWindow({
              displayName: url,
              itemType: 'workspaceAdd',
              path: url,
            });
          }
          if (urls.length > 0) {
            loadAllDataWithLoading();
          }
        }
      }
    } catch (error) {
      logError('Failed to add native files to group:', error);
    }
  };

  // グループレベルで処理されなかったドロップのフォールバック（グループ未指定）
  useNativeDragDrop(handleNativeFileDrop);

  const handleDetachGroup = (groupId: string, screenX: number, screenY: number) => {
    window.electronAPI.workspaceAPI.detachGroup(groupId, screenX, screenY);
  };

  const handleCloseDetached = () => {
    if (detachedGroupId) {
      window.electronAPI.workspaceAPI.closeDetachedGroup(detachedGroupId);
    }
  };

  // handlers と ui の共通部分（通常モード・切り離しモードで共用）
  const normalHandlers = {
    onLaunch: actions.handleLaunch,
    onRemoveItem: actions.handleRemove,
    onUpdateDisplayName: (id: string, displayName: string) => {
      actions.handleUpdateDisplayName(id, displayName);
      setEditingId(null);
    },
    // 編集は独立した子ウィンドウで開く（このウィンドウのサイズ・位置は変えない）
    onEditItem: (item: WorkspaceItem) => {
      window.electronAPI.workspaceAPI.openItemEditor(item.id).catch((error) => {
        logError('編集ウィンドウを開けませんでした:', error);
      });
    },
    onToggleGroup: async (groupId: string) => {
      const newCollapsed = toggleGroupCollapsed(groupId);
      if (!isDetached) {
        try {
          // 折りたたみは UI 状態（workspace-ui-state.json）として保存する
          await window.electronAPI.workspaceAPI.setGroupsCollapsed([groupId], newCollapsed);
        } catch (error) {
          logError('Failed to persist group collapsed state:', error);
        }
      }
      // detached モードの場合は useWorkspaceData 内で自動保存される
    },
    onUpdateGroup: actions.handleUpdateGroup,
    onDeleteGroup: handleDeleteGroup,
    onArchiveGroup: handleArchiveGroup,
    onAddSubgroup: actions.handleAddSubgroup,
    onDuplicateItem: actions.handleDuplicateItem,
    onMoveItemToGroup: actions.handleMoveItemToGroup,
    onMoveGroupToParent: actions.handleMoveGroupToParent,
    onReorderMixed: actions.handleReorderMixed,
    onNativeFileDrop: handleNativeFileDrop,
  };

  // noop ハンドラ（アーカイブモードで変更操作を無効化）
  const noop = () => {};
  const noopAsync = async () => {};

  // アーカイブモード用ハンドラ: 起動と折りたたみのみ有効
  const archiveHandlers = {
    onLaunch: actions.handleLaunch,
    onRemoveItem: noop,
    onUpdateDisplayName: noop,
    onEditItem: noop,
    onToggleGroup: (groupId: string) => {
      setArchivedGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g))
      );
    },
    onUpdateGroup: noopAsync,
    onDeleteGroup: handleDeleteGroup,
    onArchiveGroup: noop,
    onAddSubgroup: noopAsync,
    onDuplicateItem: noop,
    onMoveItemToGroup: noopAsync,
    onMoveGroupToParent: noopAsync,
    onReorderMixed: noopAsync,
  };

  const commonHandlers = isArchiveMode ? archiveHandlers : normalHandlers;

  const commonUi = {
    editingItemId: editingId,
    setEditingItemId: setEditingId,
    uncategorizedCollapsed: collapsed.uncategorized || false,
    onToggleUncategorized: () => toggleSection('uncategorized'),
    activeGroupId,
    setActiveGroupId,
  };

  const resizeHandles = RESIZE_DIRECTIONS.map((direction) => (
    <div
      key={direction}
      className={`workspace-resize-handle ${direction}`}
      onMouseDown={handleResize(direction)}
    />
  ));

  const handleCycleDetachedPin = async () => {
    setDetachedPinMode(await window.electronAPI.workspaceAPI.cycleCallerPinMode());
  };

  /** ピンモードに応じたラベルを返す */
  function getPinLabel(mode: number): string {
    switch (mode) {
      case 1:
        return '最前面に固定';
      case 2:
        return 'ピン留め解除';
      default:
        return '表示固定';
    }
  }

  /** ピンモードに応じたCSSクラスを返す */
  function getPinClassName(mode: number): string {
    switch (mode) {
      case 1:
        return 'workspace-pin-btn stay-visible';
      case 2:
        return 'workspace-pin-btn pinned';
      default:
        return 'workspace-pin-btn';
    }
  }

  // 切り離しウィンドウモード: 対象グループとその子孫のみ表示
  if (detachedGroupId) {
    const descendantIds = getDescendantGroupIds(detachedGroupId, groups);
    const detachedVisibleGroupIds = new Set([detachedGroupId, ...descendantIds]);

    return (
      <div
        className={`workspace-window detached-group-window ${backgroundTransparent ? 'background-transparent' : ''}`}
      >
        <WorkspaceGroupedList
          contentRef={contentRef}
          data={{ groups, items }}
          handlers={commonHandlers}
          ui={{
            ...commonUi,
            activeWorkspaceId,
            visibleGroupIds: detachedVisibleGroupIds,
            showUncategorized: false,
          }}
        />
        <div className="detached-window-controls">
          <button
            className={getPinClassName(detachedPinMode)}
            onClick={handleCycleDetachedPin}
            title={getPinLabel(detachedPinMode)}
            aria-label={getPinLabel(detachedPinMode)}
          >
            📌
          </button>
          <button
            className="workspace-close-btn"
            onClick={handleCloseDetached}
            title="閉じる"
            aria-label="切り離しウィンドウを閉じる"
          >
            ×
          </button>
        </div>
        {resizeHandles}
      </div>
    );
  }

  return (
    <div className={`workspace-window ${backgroundTransparent ? 'background-transparent' : ''}`}>
      <WorkspaceHeader
        isFilterVisible={isFilterVisible}
        onToggleFilter={() => {
          if (isFilterVisible) setFilterText('');
          setIsFilterVisible((prev) => !prev);
        }}
        onExpandAll={() => setAllGroupsCollapsed(false)}
        onCollapseAll={() => setAllGroupsCollapsed(true)}
        onAddGroup={() =>
          actions.handleAddGroup(displayGroups.length, undefined, activeWorkspaceId)
        }
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
        onClose={handleClose}
      />
      <WorkspaceTabBar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onTabClick={(id) => {
          setActiveWorkspaceId(id);
          setIsArchiveMode(false);
        }}
        onCreateWorkspace={actions.handleCreateWorkspace}
        onRenameWorkspace={actions.handleRenameWorkspace}
        onDeleteWorkspace={actions.handleDeleteWorkspace}
        onReorderWorkspaces={actions.handleReorderWorkspaces}
        isArchiveActive={isArchiveMode}
        onArchiveClick={() => setIsArchiveMode(true)}
      />
      {isFilterVisible && (
        <WorkspaceFilterBar
          filterText={filterText}
          onFilterTextChange={setFilterText}
          filterScope={filterScope}
          onFilterScopeChange={setFilterScope}
          onClose={() => {
            setIsFilterVisible(false);
            setFilterText('');
          }}
          focusTrigger={focusTrigger}
        />
      )}
      <WorkspaceGroupedList
        contentRef={contentRef}
        workspaces={workspaces}
        data={{ groups: displayGroups, items: displayItems }}
        handlers={{
          ...commonHandlers,
          onDetachGroup: isArchiveMode ? undefined : handleDetachGroup,
        }}
        ui={{
          ...commonUi,
          isArchiveMode,
          activeWorkspaceId,
          visibleGroupIds: filterResult.visibleGroupIds,
          itemVisibility: filterResult.itemVisibility,
          showUncategorized: filterResult.showUncategorized,
        }}
      />
      {resizeHandles}
    </div>
  );
};

export default WorkspaceApp;
