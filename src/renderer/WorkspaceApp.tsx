import React, { useState, useEffect } from 'react';
import type { WorkspaceItem } from '@common/types';
import { getDescendantGroupIds } from '@common/utils/groupTreeUtils';

import ConfirmDialog from './components/ConfirmDialog';
import WorkspaceFilterBar from './components/WorkspaceFilterBar';
import WorkspaceGroupedList from './components/WorkspaceGroupedList';
import WorkspaceHeader from './components/WorkspaceHeader';
import WorkspaceItemEditModal from './components/WorkspaceItemEditModal';
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

const INITIAL_DELETE_DIALOG = {
  isOpen: false,
  groupId: null as string | null,
  itemCount: 0,
  deleteItems: false,
};

const INITIAL_ARCHIVE_DIALOG = {
  isOpen: false,
  groupId: null as string | null,
  itemCount: 0,
};

const WorkspaceApp: React.FC = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [backgroundTransparent, setBackgroundTransparent] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string>();
  const [editModalItem, setEditModalItem] = useState<WorkspaceItem | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterScope, setFilterScope] = useState<FilterScope>('all');
  const [detachedGroupId, setDetachedGroupId] = useState<string | null>(null);

  // URLクエリパラメータから groupId を読み取り（切り離しウィンドウモード判定）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const groupId = params.get('groupId');
    if (groupId) {
      setDetachedGroupId(groupId);
    }
  }, []);

  const { items, groups, setGroups, loadAllDataWithLoading } = useWorkspaceData();

  const actions = useWorkspaceActions(() => {
    loadAllDataWithLoading();
  });

  const { extractFilePaths, addItemsFromFilePaths, addUrlItem } = useFileOperations();
  useClipboardPaste(loadAllDataWithLoading, activeGroupId);
  const { collapsed, toggleSection, expandAll, collapseAll } = useCollapsibleSections({
    uncategorized: false,
  });
  const filterResult = useWorkspaceFilter(groups, items, filterText, filterScope);
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
    window.electronAPI.workspaceAPI.getAlwaysOnTop().then(setIsPinned);

    const loadTransparent = async () => {
      const settings = await window.electronAPI.getSettings();
      setBackgroundTransparent(settings.workspaceBackgroundTransparent || false);
    };
    loadTransparent();

    const cleanup = window.electronAPI.onSettingsChanged(async () => {
      const settings = await window.electronAPI.getSettings();
      setBackgroundTransparent(settings.workspaceBackgroundTransparent || false);
    });

    return () => cleanup?.();
  }, []);

  useEffect(() => {
    const isAnyModalOpen = deleteGroupDialog.isOpen || archiveGroupDialog.isOpen;
    if (isAnyModalOpen) {
      window.electronAPI.workspaceAPI.setModalMode(true, { width: 600, height: 400 });
    } else if (!editModalItem) {
      window.electronAPI.workspaceAPI.setModalMode(false);
    }
  }, [deleteGroupDialog.isOpen, archiveGroupDialog.isOpen, editModalItem]);

  const handleDeleteGroup = async (groupId: string) => {
    try {
      // サブグループのアイテムも含めた件数を算出
      const descendantIds = getDescendantGroupIds(groupId, groups);
      const allGroupIds = new Set([groupId, ...descendantIds]);
      const allGroupItems = items.filter((item) => item.groupId && allGroupIds.has(item.groupId));
      if (allGroupItems.length > 0) {
        setDeleteGroupDialog({
          isOpen: true,
          groupId,
          itemCount: allGroupItems.length,
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
    const descendantIds = getDescendantGroupIds(groupId, groups);
    const allGroupIds = new Set([groupId, ...descendantIds]);
    const itemCount = items.filter((item) => item.groupId && allGroupIds.has(item.groupId)).length;
    setArchiveGroupDialog({ isOpen: true, groupId, itemCount });
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

  const handleOpenArchive = async () => {
    await window.electronAPI.openEditWindowWithTab('archive');
  };

  const setAllGroupsCollapsed = async (collapsed: boolean) => {
    const targetGroups = groups.filter((g) => g.collapsed !== collapsed);
    if (targetGroups.length > 0) {
      setGroups(groups.map((g) => ({ ...g, collapsed })));
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
        await addItemsFromFilePaths(filePaths, loadAllDataWithLoading, groupId);
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
            await addUrlItem(url, () => {}, groupId);
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
  const commonHandlers = {
    onLaunch: actions.handleLaunch,
    onRemoveItem: actions.handleRemove,
    onUpdateDisplayName: (id: string, displayName: string) => {
      actions.handleUpdateDisplayName(id, displayName);
      setEditingId(null);
    },
    onEditItem: (item: WorkspaceItem) => setEditModalItem(item),
    onToggleGroup: (groupId: string) => actions.handleToggleGroup(groupId, groups, setGroups),
    onUpdateGroup: actions.handleUpdateGroup,
    onDeleteGroup: handleDeleteGroup,
    onArchiveGroup: handleArchiveGroup,
    onAddSubgroup: actions.handleAddSubgroup,
    onMoveItemToGroup: actions.handleMoveItemToGroup,
    onMoveGroupToParent: actions.handleMoveGroupToParent,
    onReorderMixed: actions.handleReorderMixed,
    onNativeFileDrop: handleNativeFileDrop,
  };

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
            visibleGroupIds: detachedVisibleGroupIds,
            showUncategorized: false,
            detachedRootGroupId: detachedGroupId,
            onCloseDetached: handleCloseDetached,
          }}
        />
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
        onAddGroup={() => actions.handleAddGroup(groups.length)}
        onOpenArchive={handleOpenArchive}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
        onClose={handleClose}
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
        />
      )}
      <WorkspaceGroupedList
        contentRef={contentRef}
        data={{ groups, items }}
        handlers={{
          ...commonHandlers,
          onDetachGroup: handleDetachGroup,
        }}
        ui={{
          ...commonUi,
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
        message={`「${groups.find((g) => g.id === deleteGroupDialog.groupId)?.displayName}」を削除してもよろしいですか？\n\nこのグループには${deleteGroupDialog.itemCount}個のアイテムが含まれています。`}
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
        message={`「${groups.find((g) => g.id === archiveGroupDialog.groupId)?.displayName}」をアーカイブしてもよろしいですか？\n\nこのグループには${archiveGroupDialog.itemCount}個のアイテムが含まれています。\nアーカイブしたグループは後で復元できます。`}
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
