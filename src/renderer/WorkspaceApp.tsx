import React, { useState, useEffect } from 'react';
import type { WorkspaceItem } from '@common/types';

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

const WorkspaceApp: React.FC = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [backgroundTransparent, setBackgroundTransparent] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string>();
  const [editModalItem, setEditModalItem] = useState<WorkspaceItem | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterScope, setFilterScope] = useState<FilterScope>('all');

  const { items, groups, loadAllDataWithLoading } = useWorkspaceData();

  const actions = useWorkspaceActions(() => {
    loadAllDataWithLoading();
  });

  const { extractFilePaths, addItemsFromFilePaths, addUrlItem } = useFileOperations();
  useClipboardPaste(loadAllDataWithLoading, activeGroupId);
  const { collapsed, toggleSection, expandAll, collapseAll } = useCollapsibleSections({
    uncategorized: false,
  });
  const filterResult = useWorkspaceFilter(groups, items, filterText, filterScope);
  const { handleResize } = useWorkspaceResize();
  const { contentRef } = useWorkspaceAutoFit();
  const [deleteGroupDialog, setDeleteGroupDialog] = useState<{
    isOpen: boolean;
    groupId: string | null;
    itemCount: number;
    deleteItems: boolean;
  }>({
    isOpen: false,
    groupId: null,
    itemCount: 0,
    deleteItems: false,
  });
  const [archiveGroupDialog, setArchiveGroupDialog] = useState<{
    isOpen: boolean;
    groupId: string | null;
    itemCount: number;
  }>({
    isOpen: false,
    groupId: null,
    itemCount: 0,
  });

  useEffect(() => {
    window.electronAPI.workspaceAPI.getAlwaysOnTop().then(setIsPinned);
  }, []);

  useEffect(() => {
    const loadSetting = async () => {
      const settings = await window.electronAPI.getSettings();
      setBackgroundTransparent(settings.workspaceBackgroundTransparent || false);
    };
    loadSetting();

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
      const groupItems = items.filter((item) => item.groupId === groupId);
      if (groupItems.length > 0) {
        setDeleteGroupDialog({
          isOpen: true,
          groupId,
          itemCount: groupItems.length,
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
      setDeleteGroupDialog({ isOpen: false, groupId: null, itemCount: 0, deleteItems: false });
    } catch (error) {
      logError('Failed to delete workspace group:', error);
    }
  };

  const handleArchiveGroup = (groupId: string): void => {
    const itemCount = items.filter((item) => item.groupId === groupId).length;
    setArchiveGroupDialog({ isOpen: true, groupId, itemCount });
  };

  const handleConfirmArchiveGroup = async () => {
    const { groupId } = archiveGroupDialog;
    if (!groupId) return;
    try {
      await actions.handleArchiveGroup(groupId);
      setArchiveGroupDialog({ isOpen: false, groupId: null, itemCount: 0 });
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

  const handleExpandAll = async () => {
    const groupsToExpand = groups.filter((group) => group.collapsed);
    if (groupsToExpand.length > 0) {
      await Promise.all(
        groupsToExpand.map((group) =>
          window.electronAPI.workspaceAPI.updateGroup(group.id, { collapsed: false })
        )
      );
      await loadAllDataWithLoading();
    }
    expandAll();
  };

  const handleCollapseAll = async () => {
    const groupsToCollapse = groups.filter((group) => !group.collapsed);
    if (groupsToCollapse.length > 0) {
      await Promise.all(
        groupsToCollapse.map((group) =>
          window.electronAPI.workspaceAPI.updateGroup(group.id, { collapsed: true })
        )
      );
      await loadAllDataWithLoading();
    }
    collapseAll();
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

  return (
    <div className={`workspace-window ${backgroundTransparent ? 'background-transparent' : ''}`}>
      <WorkspaceHeader
        isFilterVisible={isFilterVisible}
        onToggleFilter={() => {
          if (isFilterVisible) {
            setFilterText('');
          }
          setIsFilterVisible(!isFilterVisible);
        }}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
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
        data={{
          groups,
          items,
        }}
        handlers={{
          onLaunch: actions.handleLaunch,
          onRemoveItem: actions.handleRemove,
          onReorderItems: actions.handleReorder,
          onUpdateDisplayName: (id: string, displayName: string) => {
            actions.handleUpdateDisplayName(id, displayName);
            setEditingId(null);
          },
          onEditItem: (item: WorkspaceItem) => setEditModalItem(item),
          onToggleGroup: (groupId: string) => actions.handleToggleGroup(groupId, groups),
          onUpdateGroup: actions.handleUpdateGroup,
          onDeleteGroup: handleDeleteGroup,
          onArchiveGroup: handleArchiveGroup,
          onMoveItemToGroup: actions.handleMoveItemToGroup,
          onReorderGroups: actions.handleReorderGroups,
          onNativeFileDrop: handleNativeFileDrop,
        }}
        ui={{
          editingItemId: editingId,
          setEditingItemId: setEditingId,
          uncategorizedCollapsed: collapsed.uncategorized || false,
          onToggleUncategorized: () => toggleSection('uncategorized'),
          activeGroupId: activeGroupId,
          setActiveGroupId: setActiveGroupId,
          visibleGroupIds: filterResult.visibleGroupIds,
          itemVisibility: filterResult.itemVisibility,
          showUncategorized: filterResult.showUncategorized,
        }}
      />
      <ConfirmDialog
        isOpen={deleteGroupDialog.isOpen}
        onClose={() =>
          setDeleteGroupDialog({
            isOpen: false,
            groupId: null,
            itemCount: 0,
            deleteItems: false,
          })
        }
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
        onClose={() =>
          setArchiveGroupDialog({
            isOpen: false,
            groupId: null,
            itemCount: 0,
          })
        }
        onConfirm={handleConfirmArchiveGroup}
        title="グループのアーカイブ"
        message={`「${groups.find((g) => g.id === archiveGroupDialog.groupId)?.displayName}」をアーカイブしてもよろしいですか？\n\nこのグループには${archiveGroupDialog.itemCount}個のアイテムが含まれています。\nアーカイブしたグループは後で復元できます。`}
        confirmText="アーカイブ"
        cancelText="キャンセル"
        danger={false}
      />
      <WorkspaceItemEditModal
        isOpen={editModalItem !== null}
        onClose={() => setEditModalItem(null)}
        editingItem={editModalItem}
        onSave={actions.handleUpdateItem}
      />
      {[
        'top-left',
        'top',
        'top-right',
        'right',
        'bottom-right',
        'bottom',
        'bottom-left',
        'left',
      ].map((direction) => (
        <div
          key={direction}
          className={`workspace-resize-handle ${direction}`}
          onMouseDown={handleResize(direction)}
        />
      ))}
    </div>
  );
};

export default WorkspaceApp;
