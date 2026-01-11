import React, { useState, useEffect } from 'react';

import ConfirmDialog from './components/ConfirmDialog';
import WorkspaceGroupedList from './components/WorkspaceGroupedList';
import WorkspaceHeader from './components/WorkspaceHeader';
import { useClipboardPaste } from './hooks/useClipboardPaste';
import { useCollapsibleSections } from './hooks/useCollapsibleSections';
import { useNativeDragDrop } from './hooks/useNativeDragDrop';
import { useWorkspaceActions, useWorkspaceData, useWorkspaceResize } from './hooks/workspace';
import { logError } from './utils/debug';

const WorkspaceApp: React.FC = () => {
  // ローカル状態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [backgroundTransparent, setBackgroundTransparent] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | undefined>(undefined);

  // データ管理フック
  const { items, groups, executionHistory, loadItems, loadGroups, loadExecutionHistory } =
    useWorkspaceData();

  // アクション統合フック
  const actions = useWorkspaceActions(() => {
    loadItems();
    loadGroups();
    loadExecutionHistory();
  });

  // ネイティブドラッグ&ドロップフック
  const { isDraggingOver } = useNativeDragDrop(loadItems);

  // クリップボードペースト処理フック（アクティブグループに追加）
  useClipboardPaste(loadItems, activeGroupId);

  // 折りたたみ状態管理フック
  const { collapsed, toggleSection, expandAll, collapseAll } = useCollapsibleSections({
    uncategorized: false,
    history: false,
  });

  // サイズ変更フック
  const { handleResize } = useWorkspaceResize();
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

  // ピン状態の初期化
  useEffect(() => {
    const loadPinState = async () => {
      const pinned = await window.electronAPI.workspaceAPI.getAlwaysOnTop();
      setIsPinned(pinned);
    };
    loadPinState();
  }, []);

  // 背景透過設定の初期化と監視
  useEffect(() => {
    const loadBackgroundSetting = async () => {
      const settings = await window.electronAPI.getSettings();
      setBackgroundTransparent(settings.workspaceBackgroundTransparent || false);
    };
    loadBackgroundSetting();

    // 設定変更を監視
    const handleSettingsChanged = async () => {
      const settings = await window.electronAPI.getSettings();
      setBackgroundTransparent(settings.workspaceBackgroundTransparent || false);
    };

    const cleanup = window.electronAPI.onSettingsChanged(handleSettingsChanged);

    // クリーンアップ関数を返す
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // モーダルダイアログのモーダルモード設定（統合管理）
  useEffect(() => {
    const isAnyModalOpen = deleteGroupDialog.isOpen || archiveGroupDialog.isOpen;

    if (isAnyModalOpen) {
      window.electronAPI.workspaceAPI.setModalMode(true, { width: 600, height: 400 });
    } else {
      window.electronAPI.workspaceAPI.setModalMode(false);
    }
  }, [deleteGroupDialog.isOpen, archiveGroupDialog.isOpen]);

  /**
   * グループ削除ハンドラー（確認ダイアログ表示）
   */
  const handleDeleteGroup = async (groupId: string) => {
    try {
      // グループ内のアイテム数を確認
      const groupItems = items.filter((item) => item.groupId === groupId);
      const hasItems = groupItems.length > 0;

      if (hasItems) {
        // 確認ダイアログを表示
        setDeleteGroupDialog({
          isOpen: true,
          groupId: groupId,
          itemCount: groupItems.length,
          deleteItems: false,
        });
      } else {
        // アイテムがない場合は即削除
        await actions.handleDeleteGroup(groupId, false);
      }
    } catch (error) {
      logError('Failed to delete workspace group:', error);
    }
  };

  /**
   * グループ削除の確定ハンドラー
   */
  const handleConfirmDeleteGroup = async () => {
    const { groupId, deleteItems } = deleteGroupDialog;
    if (!groupId) return;

    try {
      await actions.handleDeleteGroup(groupId, deleteItems);

      // ダイアログを閉じる
      setDeleteGroupDialog({
        isOpen: false,
        groupId: null,
        itemCount: 0,
        deleteItems: false,
      });
    } catch (error) {
      logError('Failed to delete workspace group:', error);
    }
  };

  /**
   * グループアーカイブハンドラー（確認ダイアログ表示）
   */
  const handleArchiveGroup = async (groupId: string) => {
    try {
      // グループ内のアイテム数を確認
      const groupItems = items.filter((item) => item.groupId === groupId);
      const itemCount = groupItems.length;

      // 確認ダイアログを表示
      setArchiveGroupDialog({
        isOpen: true,
        groupId: groupId,
        itemCount: itemCount,
      });
    } catch (error) {
      logError('Failed to archive workspace group:', error);
    }
  };

  /**
   * グループアーカイブの確定ハンドラー
   */
  const handleConfirmArchiveGroup = async () => {
    const { groupId } = archiveGroupDialog;
    if (!groupId) return;

    try {
      await actions.handleArchiveGroup(groupId);

      // ダイアログを閉じる
      setArchiveGroupDialog({
        isOpen: false,
        groupId: null,
        itemCount: 0,
      });
    } catch (error) {
      logError('Failed to archive workspace group:', error);
    }
  };

  /**
   * ピン留めトグルハンドラー
   */
  const handleTogglePin = async () => {
    const newState = await window.electronAPI.workspaceAPI.toggleAlwaysOnTop();
    setIsPinned(newState);
  };

  /**
   * ウィンドウを閉じるハンドラー
   */
  const handleClose = () => {
    window.electronAPI.workspaceAPI.hideWindow();
  };

  /**
   * アーカイブタブを開くハンドラー
   */
  const handleOpenArchive = async () => {
    await window.electronAPI.openEditWindowWithTab('archive');
  };

  /**
   * 全展開ハンドラー
   */
  const handleExpandAll = async () => {
    // 全てのグループを展開
    for (const group of groups) {
      if (group.collapsed) {
        await window.electronAPI.workspaceAPI.updateGroup(group.id, { collapsed: false });
      }
    }
    await loadGroups();
    // 未分類と実行履歴も展開
    expandAll();
  };

  /**
   * 全閉じハンドラー
   */
  const handleCollapseAll = async () => {
    // 全てのグループを閉じる
    for (const group of groups) {
      if (!group.collapsed) {
        await window.electronAPI.workspaceAPI.updateGroup(group.id, { collapsed: true });
      }
    }
    await loadGroups();
    // 未分類と実行履歴も閉じる
    collapseAll();
  };

  return (
    <div
      className={`workspace-window ${isDraggingOver ? 'dragging-over' : ''} ${backgroundTransparent ? 'background-transparent' : ''}`}
    >
      <WorkspaceHeader
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onAddGroup={() => actions.handleAddGroup(groups.length)}
        onOpenArchive={handleOpenArchive}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
        onClose={handleClose}
      />
      <WorkspaceGroupedList
        data={{
          groups,
          items,
          executionHistory,
        }}
        handlers={{
          onLaunch: actions.handleLaunch,
          onRemoveItem: actions.handleRemove,
          onReorderItems: actions.handleReorder,
          onUpdateDisplayName: (id: string, displayName: string) => {
            actions.handleUpdateDisplayName(id, displayName);
            setEditingId(null);
          },
          onToggleGroup: (groupId: string) => actions.handleToggleGroup(groupId, groups),
          onUpdateGroup: actions.handleUpdateGroup,
          onDeleteGroup: handleDeleteGroup,
          onArchiveGroup: handleArchiveGroup,
          onMoveItemToGroup: actions.handleMoveItemToGroup,
          onReorderGroups: actions.handleReorderGroups,
        }}
        ui={{
          editingItemId: editingId,
          setEditingItemId: setEditingId,
          uncategorizedCollapsed: collapsed.uncategorized || false,
          onToggleUncategorized: () => toggleSection('uncategorized'),
          historyCollapsed: collapsed.history || false,
          onToggleHistory: () => toggleSection('history'),
          activeGroupId: activeGroupId,
          setActiveGroupId: setActiveGroupId,
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
        message={`「${groups.find((g) => g.id === deleteGroupDialog.groupId)?.name}」を削除してもよろしいですか？\n\nこのグループには${deleteGroupDialog.itemCount}個のアイテムが含まれています。`}
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
        message={`「${groups.find((g) => g.id === archiveGroupDialog.groupId)?.name}」をアーカイブしてもよろしいですか？\n\nこのグループには${archiveGroupDialog.itemCount}個のアイテムが含まれています。\nアーカイブしたグループは後で復元できます。`}
        confirmText="アーカイブ"
        cancelText="キャンセル"
        danger={false}
      />
      {/* サイズ変更ハンドル */}
      <div className="workspace-resize-handle top-left" onMouseDown={handleResize('top-left')} />
      <div className="workspace-resize-handle top" onMouseDown={handleResize('top')} />
      <div className="workspace-resize-handle top-right" onMouseDown={handleResize('top-right')} />
      <div className="workspace-resize-handle right" onMouseDown={handleResize('right')} />
      <div
        className="workspace-resize-handle bottom-right"
        onMouseDown={handleResize('bottom-right')}
      />
      <div className="workspace-resize-handle bottom" onMouseDown={handleResize('bottom')} />
      <div
        className="workspace-resize-handle bottom-left"
        onMouseDown={handleResize('bottom-left')}
      />
      <div className="workspace-resize-handle left" onMouseDown={handleResize('left')} />
    </div>
  );
};

export default WorkspaceApp;
