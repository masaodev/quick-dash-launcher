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
  const { groups, items, executionHistory } = data;
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
  const {
    editingItemId,
    setEditingItemId,
    uncategorizedCollapsed,
    onToggleUncategorized,
    historyCollapsed,
    onToggleHistory,
    setActiveGroupId,
    visibleGroupIds,
    itemVisibility,
    showUncategorized = true,
  } = ui;

  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [colorPickerGroupId, setColorPickerGroupId] = React.useState<string | null>(null);

  const { itemsByGroup, uncategorizedItems } = useWorkspaceItemGroups(items);

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
        /* eslint-disable no-irregular-whitespace */
        groupItems.forEach((item, index) => {
          text += `　■${item.displayName}\r\n`;
          text += `　　${item.path}\r\n`;
          if (index < groupItems.length - 1) {
            text += '\r\n';
          }
        });
        /* eslint-enable no-irregular-whitespace */
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

  const handleItemDragStart = (item: WorkspaceItem) => (e: React.DragEvent) => {
    setDraggedItemId(item.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', item.id);
    e.dataTransfer.setData('currentGroupId', item.groupId || '');
  };

  const handleItemDragEnd = () => {
    setDraggedItemId(null);
  };

  const handleItemDragOver = () => (e: React.DragEvent) => {
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
    const isCopyOperation =
      e.dataTransfer.types.includes('historyitem') || e.dataTransfer.types.includes('launcheritem');
    e.dataTransfer.dropEffect = isCopyOperation ? 'copy' : 'move';
  };

  /** LauncherItemをワークスペースに追加 */
  async function addLauncherItemToWorkspace(
    launcherItemData: string,
    groupId?: string
  ): Promise<void> {
    const launcherItem: LauncherItem = JSON.parse(launcherItemData);
    await window.electronAPI.workspaceAPI.addItem(launcherItem, groupId);
    await window.electronAPI.showToastWindow({
      displayName: launcherItem.displayName,
      itemType: 'workspaceAdd',
      path: launcherItem.path,
      icon: launcherItem.icon,
    });
  }

  /** 実行履歴アイテムをワークスペースに追加 */
  async function addHistoryItemToWorkspace(
    historyItemData: string,
    groupId?: string
  ): Promise<void> {
    const historyItem: ExecutionHistoryItem = JSON.parse(historyItemData);

    if (historyItem.itemType === 'windowOperation') {
      const windowOpItem = executionHistoryToWindowItem(historyItem);
      await window.electronAPI.workspaceAPI.addItem(windowOpItem, groupId);
    } else {
      const launcherItem = executionHistoryToLauncherItem(historyItem);
      await window.electronAPI.workspaceAPI.addItem(launcherItem as LauncherItem, groupId);
    }
  }

  const handleGroupDrop = (groupId?: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    const currentGroupId = e.dataTransfer.getData('currentGroupId');
    const historyItemData = e.dataTransfer.getData('historyItem');
    const launcherItemData = e.dataTransfer.getData('launcherItem');

    try {
      if (launcherItemData) {
        await addLauncherItemToWorkspace(launcherItemData, groupId);
      } else if (historyItemData) {
        await addHistoryItemToWorkspace(historyItemData, groupId);
      } else if (itemId && currentGroupId !== (groupId || '')) {
        onMoveItemToGroup(itemId, groupId);
      }
    } catch (error) {
      logError('ワークスペースへのアイテム追加に失敗:', error);
      await window.electronAPI.showToastWindow({
        displayName: 'ワークスペース',
        itemType: 'workspaceAdd',
        message: 'ワークスペースへの追加に失敗しました',
      });
    }

    setDraggedItemId(null);
  };

  const handleContextMenu = (item: WorkspaceItem) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI.showWorkspaceContextMenu(item, groups);
  };

  const handleGroupContextMenu = (group: WorkspaceGroup) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI.showWorkspaceGroupContextMenu(group);
  };

  const handleGroupToggle = (groupId: string) => {
    onToggleGroup(groupId);
    setActiveGroupId(groupId);
  };

  const handleUncategorizedToggle = () => {
    onToggleUncategorized();
    setActiveGroupId(undefined);
  };

  const handleGroupDragStart = (group: WorkspaceGroup) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('groupId', group.id);
  };

  const handleGroupDragOverForReorder = () => (e: React.DragEvent) => {
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
            <div
              key={group.id}
              className="workspace-group"
              onDragOver={handleGroupDragOver}
              onDrop={handleGroupDrop(group.id)}
            >
              <WorkspaceGroupHeader
                group={group}
                itemCount={groupItems.length}
                isEditing={editingGroupId === group.id}
                onToggle={handleGroupToggle}
                onUpdate={onUpdateGroup}
                onStartEdit={() => setEditingGroupId(editingGroupId === group.id ? null : group.id)}
                onGroupDragStart={handleGroupDragStart(group)}
                onGroupDragOverForReorder={handleGroupDragOverForReorder()}
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
                      onDragOver={handleItemDragOver()}
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
                    onDragOver={handleItemDragOver()}
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
