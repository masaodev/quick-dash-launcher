import React, { useState, useEffect } from 'react';

import ConfirmDialog from './components/ConfirmDialog';
import WorkspaceGroupedList from './components/WorkspaceGroupedList';
import WorkspaceHeader from './components/WorkspaceHeader';
import { useCollapsibleSections } from './hooks/useCollapsibleSections';
import { useNativeDragDrop } from './hooks/useNativeDragDrop';
import { useWorkspaceActions } from './hooks/useWorkspaceActions';
import { useWorkspaceData } from './hooks/useWorkspaceData';

const WorkspaceApp: React.FC = () => {
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

  // 折りたたみ状態管理フック
  const { collapsed, toggleSection, expandAll, collapseAll } = useCollapsibleSections({
    uncategorized: false,
    history: false,
  });

  // ローカル状態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
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

  // ピン状態の初期化
  useEffect(() => {
    const loadPinState = async () => {
      const pinned = await window.electronAPI.workspaceAPI.getAlwaysOnTop();
      setIsPinned(pinned);
    };
    loadPinState();
  }, []);

  // グループ削除ダイアログのモーダルモード設定
  useEffect(() => {
    if (deleteGroupDialog.isOpen) {
      window.electronAPI.workspaceAPI.setModalMode(true, { width: 600, height: 400 });
    } else {
      window.electronAPI.workspaceAPI.setModalMode(false);
    }
  }, [deleteGroupDialog.isOpen]);

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
      console.error('Failed to delete workspace group:', error);
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
      console.error('Failed to delete workspace group:', error);
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
    <div className={`workspace-window ${isDraggingOver ? 'dragging-over' : ''}`}>
      <WorkspaceHeader
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onAddGroup={() => actions.handleAddGroup(groups.length)}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
      />
      <WorkspaceGroupedList
        groups={groups}
        items={items}
        executionHistory={executionHistory}
        onLaunch={actions.handleLaunch}
        onRemoveItem={actions.handleRemove}
        onReorderItems={actions.handleReorder}
        onUpdateDisplayName={(id: string, displayName: string) => {
          actions.handleUpdateDisplayName(id, displayName);
          setEditingId(null);
        }}
        onToggleGroup={(groupId: string) => actions.handleToggleGroup(groupId, groups)}
        onUpdateGroup={actions.handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        onMoveItemToGroup={actions.handleMoveItemToGroup}
        onReorderGroups={actions.handleReorderGroups}
        editingItemId={editingId}
        setEditingItemId={setEditingId}
        uncategorizedCollapsed={collapsed.uncategorized || false}
        onToggleUncategorized={() => toggleSection('uncategorized')}
        historyCollapsed={collapsed.history || false}
        onToggleHistory={() => toggleSection('history')}
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
    </div>
  );
};

export default WorkspaceApp;
