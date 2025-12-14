import React, { useState, useEffect } from 'react';
import type { WorkspaceItem, WorkspaceGroup, ExecutionHistoryItem } from '@common/types';

import WorkspaceGroupedList from './components/WorkspaceGroupedList';
import ConfirmDialog from './components/ConfirmDialog';

const WorkspaceApp: React.FC = () => {
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [uncategorizedCollapsed, setUncategorizedCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
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

  useEffect(() => {
    loadItems();
    loadGroups();
    loadExecutionHistory();

    // ピン状態の初期化
    const loadPinState = async () => {
      const pinned = await window.electronAPI.workspaceAPI.getAlwaysOnTop();
      setIsPinned(pinned);
    };
    loadPinState();

    // ワークスペース変更イベントをリッスン
    const unsubscribe = window.electronAPI.onWorkspaceChanged(() => {
      loadItems();
      loadGroups();
      loadExecutionHistory();
    });

    // ネイティブのドラッグ&ドロップイベントを設定
    const handleNativeDragOver = (e: DragEvent) => {
      // ファイルまたはURLがドラッグされている場合に反応
      if (e.dataTransfer?.types) {
        const hasFiles = e.dataTransfer.types.includes('Files');
        const hasUrl =
          e.dataTransfer.types.includes('text/uri-list') ||
          e.dataTransfer.types.includes('text/plain');

        if (hasFiles || hasUrl) {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(true);
        }
      }
    };

    const handleNativeDragLeave = (e: DragEvent) => {
      // ファイルまたはURLがドラッグされている場合に反応
      if (e.dataTransfer?.types) {
        const hasFiles = e.dataTransfer.types.includes('Files');
        const hasUrl =
          e.dataTransfer.types.includes('text/uri-list') ||
          e.dataTransfer.types.includes('text/plain');

        if (hasFiles || hasUrl) {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
        }
      }
    };

    const handleNativeDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      // ファイルのドロップを処理
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const filePaths: string[] = [];

        // メイン画面と同じ方法でファイルパスを取得
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          try {
            const filePath = window.electronAPI.getPathForFile(file);
            if (filePath) {
              filePaths.push(filePath);
            }
          } catch (error) {
            console.error(`Error getting path for ${file.name}:`, error);
          }
        }

        if (filePaths.length > 0) {
          try {
            await window.electronAPI.workspaceAPI.addItemsFromPaths(filePaths);
            await loadItems();
          } catch (error) {
            console.error('Failed to add items from drag & drop:', error);
          }
        }
      }
      // URLのドロップを処理
      else if (e.dataTransfer) {
        const urlData =
          e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');

        if (urlData) {
          // 複数のURLが改行で区切られている場合に対応
          const urls = urlData
            .split('\n')
            .map((url) => url.trim())
            .filter((url) => url && url.startsWith('http'));

          if (urls.length > 0) {
            try {
              // URLごとにファビコンを取得してアイテムを追加
              for (const url of urls) {
                // ファビコンを取得
                let icon: string | undefined;
                try {
                  const fetchedIcon = await window.electronAPI.fetchFavicon(url);
                  icon = fetchedIcon || undefined;
                } catch (error) {
                  console.warn('Failed to fetch favicon for URL:', url, error);
                }

                const item = {
                  name: url,
                  path: url,
                  type: 'url' as const,
                  icon,
                };
                await window.electronAPI.workspaceAPI.addItem(item);
              }

              await loadItems();
            } catch (error) {
              console.error('Failed to add URLs from drag & drop:', error);
            }
          }
        }
      }
    };

    // ネイティブイベントリスナーを追加
    document.addEventListener('dragover', handleNativeDragOver);
    document.addEventListener('dragleave', handleNativeDragLeave);
    document.addEventListener('drop', handleNativeDrop);

    return () => {
      unsubscribe();
      document.removeEventListener('dragover', handleNativeDragOver);
      document.removeEventListener('dragleave', handleNativeDragLeave);
      document.removeEventListener('drop', handleNativeDrop);
    };
  }, []);

  // グループ削除ダイアログのモーダルモード設定
  useEffect(() => {
    if (deleteGroupDialog.isOpen) {
      window.electronAPI.workspaceAPI.setModalMode(true, { width: 600, height: 400 });
    } else {
      window.electronAPI.workspaceAPI.setModalMode(false);
    }
  }, [deleteGroupDialog.isOpen]);

  const loadItems = async () => {
    try {
      const loadedItems = await window.electronAPI.workspaceAPI.loadItems();
      setItems(loadedItems);
    } catch (error) {
      console.error('Failed to load workspace items:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const loadedGroups = await window.electronAPI.workspaceAPI.loadGroups();
      setGroups(loadedGroups);
    } catch (error) {
      console.error('Failed to load workspace groups:', error);
    }
  };

  const loadExecutionHistory = async () => {
    try {
      const history = await window.electronAPI.workspaceAPI.loadExecutionHistory();
      setExecutionHistory(history);
    } catch (error) {
      console.error('Failed to load execution history:', error);
    }
  };

  const handleLaunch = async (item: WorkspaceItem) => {
    try {
      await window.electronAPI.workspaceAPI.launchItem(item);
    } catch (error) {
      console.error('Failed to launch workspace item:', error);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await window.electronAPI.workspaceAPI.removeItem(id);
      await loadItems();
    } catch (error) {
      console.error('Failed to remove workspace item:', error);
    }
  };

  const handleReorder = async (itemIds: string[]) => {
    try {
      await window.electronAPI.workspaceAPI.reorderItems(itemIds);
      await loadItems();
    } catch (error) {
      console.error('Failed to reorder workspace items:', error);
    }
  };

  const handleUpdateDisplayName = async (id: string, displayName: string) => {
    try {
      await window.electronAPI.workspaceAPI.updateDisplayName(id, displayName);
      await loadItems();
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update workspace item display name:', error);
    }
  };

  // グループ関連ハンドラー
  const handleToggleGroup = async (groupId: string) => {
    try {
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        await window.electronAPI.workspaceAPI.updateGroup(groupId, {
          collapsed: !group.collapsed,
        });
        await loadGroups();
      }
    } catch (error) {
      console.error('Failed to toggle workspace group:', error);
    }
  };

  const handleUpdateGroup = async (groupId: string, updates: Partial<WorkspaceGroup>) => {
    try {
      await window.electronAPI.workspaceAPI.updateGroup(groupId, updates);
      await loadGroups();
    } catch (error) {
      console.error('Failed to update workspace group:', error);
    }
  };

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
        await window.electronAPI.workspaceAPI.deleteGroup(groupId, false);
        await loadGroups();
        await loadItems();
      }
    } catch (error) {
      console.error('Failed to delete workspace group:', error);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    const { groupId, deleteItems } = deleteGroupDialog;
    if (!groupId) return;

    try {
      await window.electronAPI.workspaceAPI.deleteGroup(groupId, deleteItems);

      // ダイアログを閉じる
      setDeleteGroupDialog({
        isOpen: false,
        groupId: null,
        itemCount: 0,
        deleteItems: false,
      });

      // データ再読み込み
      await loadGroups();
      await loadItems();
    } catch (error) {
      console.error('Failed to delete workspace group:', error);
    }
  };

  const handleAddGroup = async () => {
    try {
      const groupNumber = groups.length + 1;
      await window.electronAPI.workspaceAPI.createGroup(`グループ ${groupNumber}`);
      await loadGroups();
    } catch (error) {
      console.error('Failed to create workspace group:', error);
    }
  };

  const handleMoveItemToGroup = async (itemId: string, groupId?: string) => {
    try {
      await window.electronAPI.workspaceAPI.moveItemToGroup(itemId, groupId);
      await loadItems();
    } catch (error) {
      console.error('Failed to move item to group:', error);
    }
  };

  const handleReorderGroups = async (groupIds: string[]) => {
    try {
      await window.electronAPI.workspaceAPI.reorderGroups(groupIds);
      await loadGroups();
    } catch (error) {
      console.error('Failed to reorder workspace groups:', error);
    }
  };

  const handleTogglePin = async () => {
    const newState = await window.electronAPI.workspaceAPI.toggleAlwaysOnTop();
    setIsPinned(newState);
  };

  const handleExpandAll = async () => {
    // 全てのグループを展開
    for (const group of groups) {
      if (group.collapsed) {
        await window.electronAPI.workspaceAPI.updateGroup(group.id, { collapsed: false });
      }
    }
    await loadGroups();
    // 未分類と実行履歴も展開
    setUncategorizedCollapsed(false);
    setHistoryCollapsed(false);
  };

  const handleCollapseAll = async () => {
    // 全てのグループを閉じる
    for (const group of groups) {
      if (!group.collapsed) {
        await window.electronAPI.workspaceAPI.updateGroup(group.id, { collapsed: true });
      }
    }
    await loadGroups();
    // 未分類と実行履歴も閉じる
    setUncategorizedCollapsed(true);
    setHistoryCollapsed(true);
  };

  return (
    <div className={`workspace-window ${isDraggingOver ? 'dragging-over' : ''}`}>
      <div className="workspace-header">
        <h1>Workspace</h1>
        <div className="workspace-header-controls">
          <button className="workspace-control-btn" onClick={handleExpandAll} title="全て展開">
            🔽
          </button>
          <button className="workspace-control-btn" onClick={handleCollapseAll} title="全て閉じる">
            🔼
          </button>
          <button className="workspace-control-btn" onClick={handleAddGroup} title="グループを追加">
            ➕
          </button>
          <button
            className={`workspace-pin-btn ${isPinned ? 'pinned' : ''}`}
            onClick={handleTogglePin}
            title={isPinned ? 'ピン留めを解除' : 'ピン留めして最前面に固定'}
          >
            📌
          </button>
        </div>
      </div>
      <WorkspaceGroupedList
        groups={groups}
        items={items}
        executionHistory={executionHistory}
        onLaunch={handleLaunch}
        onRemoveItem={handleRemove}
        onReorderItems={handleReorder}
        onUpdateDisplayName={handleUpdateDisplayName}
        onToggleGroup={handleToggleGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        onMoveItemToGroup={handleMoveItemToGroup}
        onReorderGroups={handleReorderGroups}
        editingItemId={editingId}
        setEditingItemId={setEditingId}
        uncategorizedCollapsed={uncategorizedCollapsed}
        onToggleUncategorized={() => setUncategorizedCollapsed(!uncategorizedCollapsed)}
        historyCollapsed={historyCollapsed}
        onToggleHistory={() => setHistoryCollapsed(!historyCollapsed)}
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
