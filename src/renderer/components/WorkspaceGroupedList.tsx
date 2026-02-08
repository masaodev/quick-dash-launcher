import React from 'react';
import type { AppItem, WorkspaceItem, WorkspaceGroup } from '@common/types';
import { PathUtils } from '@common/utils/pathUtils';

import { useWorkspaceItemGroups } from '../hooks/workspace';
import { logError } from '../utils/debug';

import WorkspaceGroupHeader from './WorkspaceGroupHeader';
import WorkspaceItemCard from './WorkspaceItemCard';
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
    onNativeFileDrop?: (e: React.DragEvent, groupId?: string) => Promise<void>;
  };
  ui: {
    editingItemId: string | null;
    setEditingItemId: (id: string | null) => void;
    uncategorizedCollapsed: boolean;
    onToggleUncategorized: () => void;
    activeGroupId?: string;
    setActiveGroupId: (id: string | undefined) => void;
    visibleGroupIds?: Set<string> | null;
    itemVisibility?: Map<string, boolean> | null;
    showUncategorized?: boolean;
  };
}

const WorkspaceGroupedList: React.FC<WorkspaceGroupedListProps> = ({ data, handlers, ui }) => {
  const { groups, items } = data;
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
    onNativeFileDrop,
  } = handlers;
  const {
    editingItemId,
    setEditingItemId,
    uncategorizedCollapsed,
    onToggleUncategorized,
    setActiveGroupId,
    visibleGroupIds,
    itemVisibility,
    showUncategorized = true,
  } = ui;

  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [colorPickerGroupId, setColorPickerGroupId] = React.useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = React.useState<string | null>(null);
  const dragOverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /** ネイティブファイル/URLドラッグかどうかを判定 */
  const isNativeFileDrag = (e: React.DragEvent): boolean => {
    const types = e.dataTransfer.types;
    return (
      types.includes('Files') ||
      (types.includes('text/uri-list') && !types.includes('itemid')) ||
      (types.includes('text/plain') && !types.includes('itemid') && !types.includes('launcheritem'))
    );
  };

  const handleGroupDragOver = (groupId?: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const isNative = isNativeFileDrag(e);
    const isCopyOperation = e.dataTransfer.types.includes('launcheritem');

    if (isNative) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = isCopyOperation ? 'copy' : 'move';
    }

    // ワークスペース内アイテム並び替え以外はハイライト表示
    if (isNative || isCopyOperation) {
      const id = groupId ?? '__uncategorized__';
      setDragOverGroupId(id);
      // dragoverは継続発火するため、タイマーでリセット
      if (dragOverTimerRef.current) {
        clearTimeout(dragOverTimerRef.current);
      }
      dragOverTimerRef.current = setTimeout(() => {
        setDragOverGroupId(null);
      }, 150);
    }
  };

  /** AppItem（LauncherItem/GroupItem/WindowItem/ClipboardItem）をワークスペースに追加 */
  async function addAppItemToWorkspace(appItemData: string, groupId?: string): Promise<void> {
    const item: AppItem = JSON.parse(appItemData);
    await window.electronAPI.workspaceAPI.addItem(item, groupId);
    // WindowInfoはドラッグ不可のため実際には来ないが、型安全のためinチェックを使用
    await window.electronAPI.showToastWindow({
      displayName: 'displayName' in item ? item.displayName : '',
      itemType: 'workspaceAdd',
      path: 'path' in item ? item.path : undefined,
      icon: 'icon' in item ? item.icon : undefined,
    });
  }

  const handleGroupDrop = (groupId?: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverGroupId(null);

    // ネイティブファイル/URLドロップの処理
    if (isNativeFileDrag(e) && onNativeFileDrop) {
      // documentレベルのハンドラーに処理済みフラグを設定
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e.nativeEvent as any).__handledByGroup = true;
      await onNativeFileDrop(e, groupId);
      setDraggedItemId(null);
      return;
    }

    const itemId = e.dataTransfer.getData('itemId');
    const currentGroupId = e.dataTransfer.getData('currentGroupId');
    const launcherItemData = e.dataTransfer.getData('launcherItem');

    try {
      if (launcherItemData) {
        await addAppItemToWorkspace(launcherItemData, groupId);
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
              className={`workspace-group${dragOverGroupId === group.id ? ' drag-over' : ''}`}
              onDragOver={handleGroupDragOver(group.id)}
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
            className={`workspace-uncategorized-section${dragOverGroupId === '__uncategorized__' ? ' drag-over' : ''}`}
            onDragOver={handleGroupDragOver(undefined)}
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
