import React from 'react';
import type {
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
  LauncherItem,
} from '@common/types';
import {
  executionHistoryToLauncherItem,
  executionHistoryToWindowItem,
  isExternalUrlType,
  isFileSystemType,
} from '@common/utils/historyConverters';
import { PathUtils } from '@common/utils/pathUtils';

import { useWorkspaceItemGroups } from '../hooks/workspace';
import { logError } from '../utils/debug';

import WorkspaceGroupHeader from './WorkspaceGroupHeader';
import WorkspaceItemCard from './WorkspaceItemCard';
import WorkspaceExecutionHistoryCard from './WorkspaceExecutionHistoryCard';
import ColorPicker from './ColorPicker';

/**
 * カラーピッカーモーダル専用コンポーネント
 * モーダルオーバーレイとESCキー処理を担当
 */
const ColorPickerModal: React.FC<{
  currentColor?: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}> = ({ currentColor, onSelectColor, onClose }) => {
  // ESCキー処理
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay-base" onClick={onClose} style={{ zIndex: 10000 }}>
      <div onClick={(e) => e.stopPropagation()}>
        <ColorPicker
          currentColor={currentColor}
          onSelectColor={onSelectColor}
          onClose={onClose}
          disableEventListeners={true}
        />
      </div>
    </div>
  );
};

interface WorkspaceGroupedListProps {
  data: {
    groups: WorkspaceGroup[];
    items: WorkspaceItem[];
    executionHistory: ExecutionHistoryItem[];
  };
  handlers: {
    onLaunch: (item: WorkspaceItem) => void;
    onRemoveItem: (id: string) => void;
    onReorderItems: (itemIds: string[]) => void;
    onUpdateDisplayName: (id: string, displayName: string) => void;
    onEditItem: (item: WorkspaceItem) => void;
    onToggleGroup: (groupId: string) => void;
    onUpdateGroup: (groupId: string, updates: Partial<WorkspaceGroup>) => void;
    onDeleteGroup: (groupId: string) => void;
    onArchiveGroup: (groupId: string) => void;
    onMoveItemToGroup: (itemId: string, groupId?: string) => void;
    onReorderGroups: (groupIds: string[]) => void;
  };
  ui: {
    editingItemId: string | null;
    setEditingItemId: (id: string | null) => void;
    uncategorizedCollapsed: boolean;
    onToggleUncategorized: () => void;
    historyCollapsed: boolean;
    onToggleHistory: () => void;
    activeGroupId?: string;
    setActiveGroupId: (id: string | undefined) => void;
    visibleGroupIds?: Set<string> | null;
    itemVisibility?: Map<string, boolean> | null;
    showUncategorized?: boolean;
  };
}

const WorkspaceGroupedList: React.FC<WorkspaceGroupedListProps> = ({ data, handlers, ui }) => {
  // データの展開
  const { groups, items, executionHistory } = data;

  // ハンドラーの展開
  const {
    onLaunch,
    onRemoveItem,
    onReorderItems,
    onUpdateDisplayName,
    onEditItem,
    onToggleGroup,
    onUpdateGroup,
    onDeleteGroup,
    onArchiveGroup,
    onMoveItemToGroup,
    onReorderGroups,
  } = handlers;

  // UI状態の展開
  const {
    editingItemId,
    setEditingItemId,
    uncategorizedCollapsed,
    onToggleUncategorized,
    historyCollapsed,
    onToggleHistory,
    activeGroupId: _activeGroupId,
    setActiveGroupId,
    visibleGroupIds,
    itemVisibility,
    showUncategorized = true,
  } = ui;
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [_draggedGroupId, setDraggedGroupId] = React.useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [colorPickerGroupId, setColorPickerGroupId] = React.useState<string | null>(null);
  const contextMenuItemRef = React.useRef<WorkspaceItem | null>(null);
  const contextMenuGroupRef = React.useRef<WorkspaceGroup | null>(null);

  // グループ化ロジック
  const { itemsByGroup, uncategorizedItems } = useWorkspaceItemGroups(items);

  // パフォーマンス最適化: IDからアイテム/グループへの高速ルックアップマップ
  const itemsMap = React.useMemo(() => {
    const map = new Map<string, WorkspaceItem>();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);

  const groupsMap = React.useMemo(() => {
    const map = new Map<string, WorkspaceGroup>();
    groups.forEach((group) => map.set(group.id, group));
    return map;
  }, [groups]);

  // パス操作ヘルパー関数
  const handlePathOperation = React.useCallback(
    async (
      item: WorkspaceItem,
      operation: 'copy' | 'open',
      pathType: 'item' | 'parent',
      useOriginalPath: boolean = false
    ) => {
      let basePath: string;
      if (useOriginalPath) {
        if (!item.originalPath) return;
        basePath = item.originalPath;
      } else {
        basePath = item.path;
      }

      const targetPath = pathType === 'parent' ? PathUtils.getParentPath(basePath) : basePath;

      if (operation === 'copy') {
        window.electronAPI.copyToClipboard(targetPath);
      } else if (operation === 'open') {
        await window.electronAPI.openExternalUrl(`file:///${targetPath}`);
      }
    },
    []
  );

  // WorkspaceContextMenuイベントリスナー登録
  React.useEffect(() => {
    const cleanupRenameItem = window.electronAPI.onWorkspaceMenuRenameItem((itemId) => {
      setEditingItemId(itemId);
    });

    const cleanupEditItem = window.electronAPI.onWorkspaceMenuEditItem((itemId) => {
      const item = itemsMap.get(itemId);
      if (item) {
        onEditItem(item);
      }
    });

    const cleanupLaunchItem = window.electronAPI.onWorkspaceMenuLaunchItem((itemId) => {
      const item = itemsMap.get(itemId);
      if (item) {
        onLaunch(item);
      }
    });

    const cleanupCopyPath = window.electronAPI.onWorkspaceMenuCopyPath((itemId) => {
      const item = itemsMap.get(itemId);
      if (item) {
        handlePathOperation(item, 'copy', 'item', false);
      }
    });

    const cleanupCopyParentPath = window.electronAPI.onWorkspaceMenuCopyParentPath((itemId) => {
      const item = itemsMap.get(itemId);
      if (item) {
        handlePathOperation(item, 'copy', 'parent', false);
      }
    });

    const cleanupOpenParentFolder = window.electronAPI.onWorkspaceMenuOpenParentFolder((itemId) => {
      const item = itemsMap.get(itemId);
      if (item) {
        handlePathOperation(item, 'open', 'parent', false);
      }
    });

    const cleanupCopyShortcutPath = window.electronAPI.onWorkspaceMenuCopyShortcutPath((itemId) => {
      const item = itemsMap.get(itemId);
      if (item) {
        handlePathOperation(item, 'copy', 'item', true);
      }
    });

    const cleanupCopyShortcutParentPath = window.electronAPI.onWorkspaceMenuCopyShortcutParentPath(
      (itemId) => {
        const item = itemsMap.get(itemId);
        if (item) {
          handlePathOperation(item, 'copy', 'parent', true);
        }
      }
    );

    const cleanupOpenShortcutParentFolder =
      window.electronAPI.onWorkspaceMenuOpenShortcutParentFolder((itemId) => {
        const item = itemsMap.get(itemId);
        if (item) {
          handlePathOperation(item, 'open', 'parent', true);
        }
      });

    const cleanupRemoveFromGroup = window.electronAPI.onWorkspaceMenuRemoveFromGroup((itemId) => {
      const item = itemsMap.get(itemId);
      if (item && item.groupId) {
        onMoveItemToGroup(itemId, undefined);
      }
    });

    const cleanupRemoveItem = window.electronAPI.onWorkspaceMenuRemoveItem((itemId) => {
      onRemoveItem(itemId);
    });

    return () => {
      cleanupRenameItem();
      cleanupEditItem();
      cleanupLaunchItem();
      cleanupCopyPath();
      cleanupCopyParentPath();
      cleanupOpenParentFolder();
      cleanupCopyShortcutPath();
      cleanupCopyShortcutParentPath();
      cleanupOpenShortcutParentFolder();
      cleanupRemoveFromGroup();
      cleanupRemoveItem();
    };
  }, [
    itemsMap,
    handlePathOperation,
    setEditingItemId,
    onLaunch,
    onMoveItemToGroup,
    onRemoveItem,
    onEditItem,
  ]);

  // WorkspaceGroupContextMenuイベントリスナー登録
  React.useEffect(() => {
    const cleanupRename = window.electronAPI.onWorkspaceGroupMenuRename((groupId) => {
      setEditingGroupId(groupId);
    });

    const cleanupShowColorPicker = window.electronAPI.onWorkspaceGroupMenuShowColorPicker(
      (groupId) => {
        setColorPickerGroupId(groupId);
      }
    );

    const cleanupChangeColor = window.electronAPI.onWorkspaceGroupMenuChangeColor(
      (groupId, color) => {
        onUpdateGroup(groupId, { color });
      }
    );

    const cleanupCopyAsText = window.electronAPI.onWorkspaceGroupMenuCopyAsText((groupId) => {
      const group = groupsMap.get(groupId);
      if (group) {
        const groupItems = itemsByGroup[groupId] || [];
        let text = `【${group.displayName}】\r\n`;
        groupItems.forEach((item, index) => {
          // eslint-disable-next-line no-irregular-whitespace
          text += `　■${item.displayName}\r\n`;
          // eslint-disable-next-line no-irregular-whitespace
          text += `　　${item.path}\r\n`;
          if (index < groupItems.length - 1) {
            text += '\r\n';
          }
        });
        window.electronAPI.copyToClipboard(text);
      }
    });

    const cleanupArchive = window.electronAPI.onWorkspaceGroupMenuArchive((groupId) => {
      onArchiveGroup(groupId);
    });

    const cleanupDelete = window.electronAPI.onWorkspaceGroupMenuDelete((groupId) => {
      onDeleteGroup(groupId);
    });

    return () => {
      cleanupRename();
      cleanupShowColorPicker();
      cleanupChangeColor();
      cleanupCopyAsText();
      cleanupArchive();
      cleanupDelete();
    };
  }, [groupsMap, itemsByGroup, onUpdateGroup, onArchiveGroup, onDeleteGroup]);

  // ドラッグ&ドロップハンドラー
  const handleItemDragStart = (item: WorkspaceItem) => (e: React.DragEvent) => {
    setDraggedItemId(item.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', item.id);
    e.dataTransfer.setData('currentGroupId', item.groupId || '');
  };

  const handleItemDragEnd = () => {
    setDraggedItemId(null);
  };

  const handleItemDragOver = (_item: WorkspaceItem) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItemId) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleItemDrop = (targetItem: WorkspaceItem) => (e: React.DragEvent) => {
    e.preventDefault();

    if (!draggedItemId || draggedItemId === targetItem.id) {
      setDraggedItemId(null);
      return;
    }

    // ドラッグ元のアイテムを取得
    const draggedItem = items.find((i) => i.id === draggedItemId);
    if (!draggedItem) {
      setDraggedItemId(null);
      return;
    }

    // 同じグループ内でのみ並び替えを許可
    const draggedGroupId = draggedItem.groupId || 'uncategorized';
    const targetGroupId = targetItem.groupId || 'uncategorized';

    if (draggedGroupId !== targetGroupId) {
      // 異なるグループ間の並び替えは禁止（グループ移動として扱う）
      setDraggedItemId(null);
      return;
    }

    // アイテムの並び替え
    const draggedIndex = items.findIndex((i) => i.id === draggedItemId);
    const targetIndex = items.findIndex((i) => i.id === targetItem.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItemId(null);
      return;
    }

    const newItems = [...items];
    const [movedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, movedItem);

    // 新しい順序でIDリストを作成
    const newItemIds = newItems.map((i) => i.id);
    onReorderItems(newItemIds);

    setDraggedItemId(null);
  };

  const handleGroupDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // 実行履歴からのドラッグの場合はcopy、それ以外はmove
    const hasHistoryItem = e.dataTransfer.types.includes('historyitem');
    e.dataTransfer.dropEffect = hasHistoryItem ? 'copy' : 'move';
  };

  const handleGroupDrop = (groupId?: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    const currentGroupId = e.dataTransfer.getData('currentGroupId');
    const historyItemData = e.dataTransfer.getData('historyItem');

    // 実行履歴アイテムからのドロップの場合
    if (historyItemData) {
      try {
        const historyItem: ExecutionHistoryItem = JSON.parse(historyItemData);

        // WindowOperationItemの場合は専用の変換を使用
        if (historyItem.itemType === 'windowOperation') {
          const windowOpItem = executionHistoryToWindowItem(historyItem);
          await window.electronAPI.workspaceAPI.addItem(windowOpItem, groupId);
        } else {
          // その他のアイテムはLauncherItem形式に変換
          const launcherItem = executionHistoryToLauncherItem(historyItem);
          await window.electronAPI.workspaceAPI.addItem(launcherItem as LauncherItem, groupId);
        }
      } catch (error) {
        logError('実行履歴からのアイテム追加に失敗:', error);
      }
    }
    // 既存のワークスペースアイテムの移動
    else if (itemId && currentGroupId !== (groupId || '')) {
      onMoveItemToGroup(itemId, groupId);
    }
    setDraggedItemId(null);
  };

  // コンテキストメニューハンドラー
  const handleContextMenu = (item: WorkspaceItem) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Store item in ref for event listeners
    contextMenuItemRef.current = item;

    // Show native context menu
    window.electronAPI.showWorkspaceContextMenu(item, groups);
  };

  const handleGroupContextMenu = (group: WorkspaceGroup) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Store group in ref for event listeners
    contextMenuGroupRef.current = group;

    // Show native context menu
    window.electronAPI.showWorkspaceGroupContextMenu(group);
  };

  // グループのトグル処理（折りたたみ/展開とアクティブ化）
  const handleGroupToggle = (groupId: string) => {
    onToggleGroup(groupId);
    setActiveGroupId(groupId);
  };

  // 無分類セクションのトグル処理（アクティブグループをクリア）
  const handleUncategorizedToggle = () => {
    onToggleUncategorized();
    setActiveGroupId(undefined);
  };

  // グループの並び替えハンドラー
  const handleGroupDragStart = (group: WorkspaceGroup) => (e: React.DragEvent) => {
    setDraggedGroupId(group.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('groupId', group.id);
  };

  const handleGroupDragEnd = () => {
    setDraggedGroupId(null);
  };

  const handleGroupDragOverForReorder = (_group: WorkspaceGroup) => (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('groupId');
    if (draggedId) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleGroupDropForReorder = (targetGroup: WorkspaceGroup) => (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('groupId');

    if (draggedId && draggedId !== targetGroup.id) {
      // 新しい順序を計算
      const draggedIndex = groups.findIndex((g) => g.id === draggedId);
      const targetIndex = groups.findIndex((g) => g.id === targetGroup.id);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newGroups = [...groups];
        const [draggedGroup] = newGroups.splice(draggedIndex, 1);
        newGroups.splice(targetIndex, 0, draggedGroup);

        // 新しい順序でIDリストを作成
        const newGroupIds = newGroups.map((g) => g.id);
        onReorderGroups(newGroupIds);
      }
    }
    setDraggedGroupId(null);
  };

  // アイテムが1つもない場合
  if (items.length === 0 && groups.length === 0) {
    return (
      <div className="workspace-empty">
        <p>ワークスペースは空です</p>
        <p className="workspace-empty-hint">
          メイン画面のアイテムを右クリックして
          <br />
          「ワークスペースに追加」を選択してください
        </p>
      </div>
    );
  }

  return (
    <div className="workspace-item-list">
      {groups
        .filter((group) => !visibleGroupIds || visibleGroupIds.has(group.id))
        .map((group) => {
          const groupItems = (itemsByGroup[group.id] || []).filter(
            (item) => !itemVisibility || itemVisibility.get(item.id) !== false
          );
          if (itemVisibility && groupItems.length === 0) {
            return null;
          }
          return (
            <div key={group.id} className="workspace-group">
              <WorkspaceGroupHeader
                group={group}
                itemCount={groupItems.length}
                isEditing={editingGroupId === group.id}
                onToggle={handleGroupToggle}
                onUpdate={onUpdateGroup}
                onStartEdit={() => setEditingGroupId(editingGroupId === group.id ? null : group.id)}
                onDragOver={handleGroupDragOver}
                onDrop={handleGroupDrop(group.id)}
                onGroupDragStart={handleGroupDragStart(group)}
                onGroupDragEnd={handleGroupDragEnd}
                onGroupDragOverForReorder={handleGroupDragOverForReorder(group)}
                onGroupDropForReorder={handleGroupDropForReorder(group)}
                onContextMenu={handleGroupContextMenu(group)}
              />
              {!group.collapsed && (
                <div className="workspace-group-items">
                  {groupItems.map((item) => (
                    <WorkspaceItemCard
                      key={item.id}
                      item={item}
                      isEditing={editingItemId === item.id}
                      onLaunch={onLaunch}
                      onRemove={onRemoveItem}
                      onUpdateDisplayName={onUpdateDisplayName}
                      onStartEdit={() =>
                        setEditingItemId(editingItemId === item.id ? null : item.id)
                      }
                      onDragStart={handleItemDragStart(item)}
                      onDragEnd={handleItemDragEnd}
                      onDragOver={handleItemDragOver(item)}
                      onDrop={handleItemDrop(item)}
                      onContextMenu={handleContextMenu(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

      {(() => {
        const filteredUncategorizedItems = uncategorizedItems.filter(
          (item) => !itemVisibility || itemVisibility.get(item.id) !== false
        );
        if ((!showUncategorized && itemVisibility) || filteredUncategorizedItems.length === 0) {
          return null;
        }
        return (
          <div
            className="workspace-uncategorized-section"
            onDragOver={handleGroupDragOver}
            onDrop={handleGroupDrop(undefined)}
          >
            <div
              className="workspace-uncategorized-header"
              onClick={handleUncategorizedToggle}
              style={{ cursor: 'pointer' }}
            >
              <span className="workspace-collapse-icon">{uncategorizedCollapsed ? '▶' : '▼'}</span>
              未分類 ({filteredUncategorizedItems.length})
            </div>
            {!uncategorizedCollapsed && (
              <div className="workspace-group-items">
                {filteredUncategorizedItems.map((item) => (
                  <WorkspaceItemCard
                    key={item.id}
                    item={item}
                    isEditing={editingItemId === item.id}
                    onLaunch={onLaunch}
                    onRemove={onRemoveItem}
                    onUpdateDisplayName={onUpdateDisplayName}
                    onStartEdit={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                    onDragStart={handleItemDragStart(item)}
                    onDragEnd={handleItemDragEnd}
                    onDragOver={handleItemDragOver(item)}
                    onDrop={handleItemDrop(item)}
                    onContextMenu={handleContextMenu(item)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* 実行履歴セクション */}
      {executionHistory.length > 0 && (
        <div className="workspace-execution-history-section">
          <div
            className="workspace-uncategorized-header"
            onClick={onToggleHistory}
            style={{ cursor: 'pointer' }}
          >
            <span className="workspace-collapse-icon">{historyCollapsed ? '▶' : '▼'}</span>
            実行履歴 ({executionHistory.length})
          </div>
          {!historyCollapsed && (
            <div className="workspace-group-items">
              {executionHistory.map((historyItem) => (
                <WorkspaceExecutionHistoryCard
                  key={historyItem.id}
                  item={historyItem}
                  onLaunch={(item) => {
                    // 実行履歴アイテムを外部で起動（共通ユーティリティ使用）
                    if (isExternalUrlType(item.itemType)) {
                      window.electronAPI.openExternalUrl(item.itemPath);
                    } else if (isFileSystemType(item.itemType)) {
                      // LauncherItem形式に変換して起動
                      const launcherItem = executionHistoryToLauncherItem(item);
                      window.electronAPI.openItem(launcherItem as LauncherItem);
                    } else if (item.itemType === 'windowOperation') {
                      // WindowOperationItem形式に変換して実行
                      const windowOp = executionHistoryToWindowItem(item);
                      window.electronAPI.executeWindowOperation(windowOp);
                    } else if (item.itemType === 'group') {
                      // グループは再実行しない（履歴としてのみ表示）
                    }
                  }}
                  onDragStart={(e) => {
                    // 実行履歴アイテムをワークスペースにコピーできるようにする
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('historyItemId', historyItem.id);

                    // 実行履歴アイテムのデータをそのまま渡す（ExecutionHistoryItem形式）
                    e.dataTransfer.setData('historyItem', JSON.stringify(historyItem));
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* カラーピッカー */}
      {colorPickerGroupId && (
        <ColorPickerModal
          currentColor={groupsMap.get(colorPickerGroupId)?.color}
          onSelectColor={(color) => {
            onUpdateGroup(colorPickerGroupId, { color });
            setColorPickerGroupId(null);
          }}
          onClose={() => setColorPickerGroupId(null)}
        />
      )}
    </div>
  );
};

export default WorkspaceGroupedList;
