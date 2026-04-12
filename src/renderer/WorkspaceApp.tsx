import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { WorkspaceItem, WorkspaceGroup } from '@common/types';
import { getDescendantGroupIds } from '@common/utils/groupTreeUtils';

import ConfirmDialog from './components/ConfirmDialog';
import WorkspaceFilterBar from './components/WorkspaceFilterBar';
import WorkspaceGroupedList from './components/WorkspaceGroupedList';
import WorkspaceHeader from './components/WorkspaceHeader';
import WorkspaceItemEditModal from './components/WorkspaceItemEditModal';
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

type DeleteGroupDialog = {
  isOpen: boolean;
  groupId: string | null;
  itemCount: number;
  subgroupCount: number;
  deleteItems: boolean;
};

type ArchiveGroupDialog = {
  isOpen: boolean;
  groupId: string | null;
  itemCount: number;
  subgroupCount: number;
};

const INITIAL_DELETE_DIALOG: DeleteGroupDialog = {
  isOpen: false,
  groupId: null,
  itemCount: 0,
  subgroupCount: 0,
  deleteItems: false,
};

const INITIAL_ARCHIVE_DIALOG: ArchiveGroupDialog = {
  isOpen: false,
  groupId: null,
  itemCount: 0,
  subgroupCount: 0,
};

const WorkspaceApp: React.FC = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [detachedPinMode, setDetachedPinMode] = useState(0);
  const [backgroundTransparent, setBackgroundTransparent] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string>();
  const [editModalItem, setEditModalItem] = useState<WorkspaceItem | null>(null);
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [archivedGroups, setArchivedGroups] = useState<WorkspaceGroup[]>([]);
  const [archivedItems, setArchivedItems] = useState<WorkspaceItem[]>([]);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterScope, setFilterScope] = useState<FilterScope>('all');
  const [focusTrigger, setFocusTrigger] = useState(0);
  // URLクエリパラメータから groupId を読み取り（切り離しウィンドウモード判定）
  const [detachedGroupId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('groupId')
  );

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
      setArchivedGroups(groups);
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
  // workspaceIdをクリアして全ワークスペースをコンテキストメニューの移動先候補にする
  const displayGroups = isArchiveMode
    ? archivedGroups.map((g) => ({ ...g, workspaceId: undefined }))
    : filteredGroups;
  const displayItems = isArchiveMode
    ? archivedItems.map((i) => ({ ...i, workspaceId: undefined }))
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
  const [deleteGroupDialog, setDeleteGroupDialog] = useState(INITIAL_DELETE_DIALOG);
  const [archiveGroupDialog, setArchiveGroupDialog] = useState(INITIAL_ARCHIVE_DIALOG);

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

  useEffect(() => {
    const isAnyModalOpen = deleteGroupDialog.isOpen || archiveGroupDialog.isOpen;
    if (isAnyModalOpen) {
      window.electronAPI.workspaceAPI.setModalMode(true, { width: 600, height: 400 });
    } else if (!editModalItem) {
      window.electronAPI.workspaceAPI.setModalMode(false);
    }
  }, [deleteGroupDialog.isOpen, archiveGroupDialog.isOpen, editModalItem]);

  /** グループとそのサブグループに含まれるアイテム数・サブグループ数を算出 */
  const getGroupStats = (groupId: string): { itemCount: number; subgroupCount: number } => {
    const descendantIds = getDescendantGroupIds(groupId, displayGroups);
    const allGroupIds = new Set([groupId, ...descendantIds]);
    const itemCount = displayItems.filter(
      (item) => item.groupId && allGroupIds.has(item.groupId)
    ).length;
    return { itemCount, subgroupCount: descendantIds.length };
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const { itemCount, subgroupCount } = getGroupStats(groupId);
      if (itemCount > 0 || subgroupCount > 0) {
        setDeleteGroupDialog({
          isOpen: true,
          groupId,
          itemCount,
          subgroupCount,
          deleteItems: false,
        });
      } else {
        await actions.handleDeleteGroup(groupId, false);
      }
    } catch (error) {
      logError('Failed to delete workspace group:', error);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    const { groupId, deleteItems } = deleteGroupDialog;
    if (!groupId) return;
    try {
      await actions.handleDeleteGroup(groupId, deleteItems);
      setDeleteGroupDialog(INITIAL_DELETE_DIALOG);
    } catch (error) {
      logError('Failed to delete workspace group:', error);
    }
  };

  const handleArchiveGroup = (groupId: string): void => {
    const { itemCount, subgroupCount } = getGroupStats(groupId);
    setArchiveGroupDialog({
      isOpen: true,
      groupId,
      itemCount,
      subgroupCount,
    });
  };

  const handleConfirmArchiveGroup = async () => {
    const { groupId } = archiveGroupDialog;
    if (!groupId) return;
    try {
      await actions.handleArchiveGroup(groupId);
      setArchiveGroupDialog(INITIAL_ARCHIVE_DIALOG);
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
    onEditItem: (item: WorkspaceItem) => setEditModalItem(item),
    onToggleGroup: async (groupId: string) => {
      const newCollapsed = toggleGroupCollapsed(groupId);
      if (newCollapsed !== undefined && !isDetached) {
        try {
          await window.electronAPI.workspaceAPI.updateGroup(groupId, {
            collapsed: newCollapsed,
          });
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
    onDeleteGroup: noopAsync,
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

  const editModal = (
    <WorkspaceItemEditModal
      isOpen={editModalItem !== null}
      onClose={() => setEditModalItem(null)}
      editingItem={editModalItem}
      onSave={actions.handleUpdateItem}
    />
  );

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
        {editModal}
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
          activeWorkspaceId,
          visibleGroupIds: filterResult.visibleGroupIds,
          itemVisibility: filterResult.itemVisibility,
          showUncategorized: filterResult.showUncategorized,
        }}
      />
      <ConfirmDialog
        isOpen={deleteGroupDialog.isOpen}
        onClose={() => setDeleteGroupDialog(INITIAL_DELETE_DIALOG)}
        onConfirm={handleConfirmDeleteGroup}
        title="グループの削除"
        message={`「${displayGroups.find((g) => g.id === deleteGroupDialog.groupId)?.displayName || groups.find((g) => g.id === deleteGroupDialog.groupId)?.displayName}」を削除してもよろしいですか？\n\nこのグループには${deleteGroupDialog.subgroupCount > 0 ? `サブグループ${deleteGroupDialog.subgroupCount}個と、` : ''}${deleteGroupDialog.itemCount}個のアイテムが含まれています。`}
        confirmText="削除"
        cancelText="キャンセル"
        danger={true}
        showCheckbox={true}
        checkboxLabel="グループ内のアイテムも削除する"
        checkboxChecked={deleteGroupDialog.deleteItems}
        onCheckboxChange={(checked) =>
          setDeleteGroupDialog({
            ...deleteGroupDialog,
            deleteItems: checked,
          })
        }
      />
      <ConfirmDialog
        isOpen={archiveGroupDialog.isOpen}
        onClose={() => setArchiveGroupDialog(INITIAL_ARCHIVE_DIALOG)}
        onConfirm={handleConfirmArchiveGroup}
        title="グループのアーカイブ"
        message={`「${displayGroups.find((g) => g.id === archiveGroupDialog.groupId)?.displayName || groups.find((g) => g.id === archiveGroupDialog.groupId)?.displayName}」をアーカイブしてもよろしいですか？\n\nこのグループには${archiveGroupDialog.subgroupCount > 0 ? `サブグループ${archiveGroupDialog.subgroupCount}個と、` : ''}${archiveGroupDialog.itemCount}個のアイテムが含まれています。\nアーカイブしたグループは後で復元できます。`}
        confirmText="アーカイブ"
        cancelText="キャンセル"
        danger={false}
      />
      {editModal}
      {resizeHandles}
    </div>
  );
};

export default WorkspaceApp;
