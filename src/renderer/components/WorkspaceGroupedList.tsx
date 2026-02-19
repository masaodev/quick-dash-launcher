import React from 'react';
import type { AppItem, WorkspaceItem, WorkspaceGroup } from '@common/types';
import { PathUtils } from '@common/utils/pathUtils';
import { canCreateSubgroup, type GroupTreeNode } from '@common/utils/groupTreeUtils';

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

/**
 * アイコン選択モーダル（emoji入力）
 */
const IconPickerModal: React.FC<{
  currentIcon?: string;
  onSelectIcon: (icon: string) => void;
  onClearIcon: () => void;
  onClose: () => void;
}> = ({ currentIcon, onSelectIcon, onClearIcon, onClose }) => {
  const [inputValue, setInputValue] = React.useState(currentIcon || '');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSelectIcon(inputValue.trim());
    }
    onClose();
  };

  return (
    <div className="modal-overlay-base" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="icon-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="icon-picker-header">アイコンを変更</div>
        <div className="icon-picker-content">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            className="icon-picker-input"
            placeholder="絵文字を入力..."
            maxLength={2}
          />
          <div className="icon-picker-preview">
            {inputValue && <span className="icon-picker-preview-emoji">{inputValue}</span>}
          </div>
        </div>
        <div className="icon-picker-actions">
          {currentIcon && (
            <button
              className="icon-picker-clear-btn"
              onClick={() => {
                onClearIcon();
                onClose();
              }}
            >
              クリア
            </button>
          )}
          <button className="icon-picker-cancel-btn" onClick={onClose}>
            キャンセル
          </button>
          <button className="icon-picker-ok-btn" onClick={handleSubmit}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

interface WorkspaceGroupedListProps {
  contentRef?: React.Ref<HTMLDivElement>;
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
    onAddSubgroup: (parentGroupId: string, subgroupCount: number) => void;
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

const WorkspaceGroupedList: React.FC<WorkspaceGroupedListProps> = ({
  contentRef,
  data,
  handlers,
  ui,
}) => {
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
    onAddSubgroup,
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
  const [iconPickerGroupId, setIconPickerGroupId] = React.useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = React.useState<string | null>(null);
  const dragOverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { itemsByGroup, uncategorizedItems, groupTree } = useWorkspaceItemGroups(items, groups);

  const itemsMap = React.useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const groupsMap = React.useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups]
  );

  const filteredUncategorizedItems = React.useMemo(
    () =>
      uncategorizedItems.filter((item) => !itemVisibility || itemVisibility.get(item.id) !== false),
    [uncategorizedItems, itemVisibility]
  );

  const handlePathOperation = React.useCallback(
    async (
      item: WorkspaceItem,
      operation: 'copy' | 'open',
      pathType: 'item' | 'parent',
      useOriginalPath: boolean = false
    ) => {
      const basePath = useOriginalPath ? item.originalPath : item.path;
      if (!basePath) return;

      const targetPath = pathType === 'parent' ? PathUtils.getParentPath(basePath) : basePath;

      if (operation === 'copy') {
        window.electronAPI.copyToClipboard(targetPath);
      } else {
        await window.electronAPI.openExternalUrl(`file:///${targetPath}`);
      }
    },
    []
  );

  React.useEffect(() => {
    const withItem = (fn: (item: WorkspaceItem) => void) => (itemId: string) => {
      const item = itemsMap.get(itemId);
      if (item) fn(item);
    };

    const cleanups = [
      window.electronAPI.onWorkspaceMenuRenameItem((itemId) => setEditingItemId(itemId)),
      window.electronAPI.onWorkspaceMenuEditItem(withItem(onEditItem)),
      window.electronAPI.onWorkspaceMenuLaunchItem(withItem(onLaunch)),
      window.electronAPI.onWorkspaceMenuCopyPath(
        withItem((item) => handlePathOperation(item, 'copy', 'item', false))
      ),
      window.electronAPI.onWorkspaceMenuCopyParentPath(
        withItem((item) => handlePathOperation(item, 'copy', 'parent', false))
      ),
      window.electronAPI.onWorkspaceMenuOpenParentFolder(
        withItem((item) => handlePathOperation(item, 'open', 'parent', false))
      ),
      window.electronAPI.onWorkspaceMenuCopyShortcutPath(
        withItem((item) => handlePathOperation(item, 'copy', 'item', true))
      ),
      window.electronAPI.onWorkspaceMenuCopyShortcutParentPath(
        withItem((item) => handlePathOperation(item, 'copy', 'parent', true))
      ),
      window.electronAPI.onWorkspaceMenuOpenShortcutParentFolder(
        withItem((item) => handlePathOperation(item, 'open', 'parent', true))
      ),
      window.electronAPI.onWorkspaceMenuRemoveFromGroup((itemId) => {
        const item = itemsMap.get(itemId);
        if (item && item.groupId) {
          onMoveItemToGroup(itemId, undefined);
        }
      }),
      window.electronAPI.onWorkspaceMenuRemoveItem((itemId) => onRemoveItem(itemId)),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
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
    const cleanups = [
      window.electronAPI.onWorkspaceGroupMenuRename((groupId) => setEditingGroupId(groupId)),
      window.electronAPI.onWorkspaceGroupMenuShowColorPicker((groupId) =>
        setColorPickerGroupId(groupId)
      ),
      window.electronAPI.onWorkspaceGroupMenuChangeColor((groupId, color) =>
        onUpdateGroup(groupId, { color })
      ),
      window.electronAPI.onWorkspaceGroupMenuCopyAsText((groupId) => {
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
      }),
      window.electronAPI.onWorkspaceGroupMenuArchive((groupId) => onArchiveGroup(groupId)),
      window.electronAPI.onWorkspaceGroupMenuDelete((groupId) => onDeleteGroup(groupId)),
      window.electronAPI.onWorkspaceGroupMenuAddSubgroup((parentGroupId) => {
        const childCount = groups.filter((g) => g.parentGroupId === parentGroupId).length;
        onAddSubgroup(parentGroupId, childCount);
      }),
      window.electronAPI.onWorkspaceGroupMenuChangeIcon((groupId) => setIconPickerGroupId(groupId)),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    groupsMap,
    groups,
    itemsByGroup,
    onUpdateGroup,
    onArchiveGroup,
    onDeleteGroup,
    onAddSubgroup,
  ]);

  const handleItemDragStart = (item: WorkspaceItem) => (e: React.DragEvent) => {
    setDraggedItemId(item.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', item.id);
    e.dataTransfer.setData('currentGroupId', item.groupId || '');
  };

  const handleItemDragEnd = () => {
    setDraggedItemId(null);
  };

  const handleItemDragOver = (e: React.DragEvent) => {
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
    const canAdd = canCreateSubgroup(group.id, groups);
    window.electronAPI.showWorkspaceGroupContextMenu(group, canAdd);
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

  const handleGroupDragOverForReorder = (e: React.DragEvent) => {
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
      // 同一親グループ内での並び替えのみ許可
      const draggedGroup = groups.find((g) => g.id === draggedId);
      if (!draggedGroup || draggedGroup.parentGroupId !== targetGroup.parentGroupId) {
        return;
      }

      // 同一親のグループのみ対象にして並び替え
      const siblingGroups = groups
        .filter((g) => g.parentGroupId === targetGroup.parentGroupId)
        .sort((a, b) => a.order - b.order);

      const draggedIndex = siblingGroups.findIndex((g) => g.id === draggedId);
      const targetIndex = siblingGroups.findIndex((g) => g.id === targetGroup.id);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newSiblings = [...siblingGroups];
        const [draggedGrp] = newSiblings.splice(draggedIndex, 1);
        newSiblings.splice(targetIndex, 0, draggedGrp);

        const newGroupIds = newSiblings.map((g) => g.id);
        onReorderGroups(newGroupIds);
      }
    }
  };

  /** 再帰的にグループツリーノードをレンダリング */
  const renderGroupNode = (node: GroupTreeNode): React.ReactNode => {
    if (visibleGroupIds && !visibleGroupIds.has(node.group.id)) {
      return null;
    }

    const groupItems = (itemsByGroup[node.group.id] || []).filter(
      (item) => !itemVisibility || itemVisibility.get(item.id) !== false
    );
    if (itemVisibility && groupItems.length === 0 && node.children.length === 0) {
      // フィルタ時、アイテムもサブグループもなければ非表示
      const hasVisibleDescendant = node.children.some(
        (child) => visibleGroupIds && visibleGroupIds.has(child.group.id)
      );
      if (!hasVisibleDescendant) return null;
    }

    return (
      <div
        key={node.group.id}
        className={`workspace-group workspace-group-depth-${node.depth}${dragOverGroupId === node.group.id ? ' drag-over' : ''}`}
        onDragOver={handleGroupDragOver(node.group.id)}
        onDrop={handleGroupDrop(node.group.id)}
      >
        <WorkspaceGroupHeader
          group={node.group}
          itemCount={groupItems.length}
          isEditing={editingGroupId === node.group.id}
          depth={node.depth}
          onToggle={handleGroupToggle}
          onUpdate={onUpdateGroup}
          onStartEdit={() =>
            setEditingGroupId(editingGroupId === node.group.id ? null : node.group.id)
          }
          onGroupDragStart={handleGroupDragStart(node.group)}
          onGroupDragOverForReorder={handleGroupDragOverForReorder}
          onGroupDropForReorder={handleGroupDropForReorder(node.group)}
          onContextMenu={handleGroupContextMenu(node.group)}
        />
        {!node.group.collapsed && (
          <>
            {/* サブグループを再帰レンダリング */}
            {node.children.length > 0 && (
              <div className="workspace-subgroups">
                {node.children.map((child) => renderGroupNode(child))}
              </div>
            )}
            {/* グループ直属のアイテム */}
            <div className="workspace-group-items">
              {groupItems.map((item) => (
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
                  onDragOver={handleItemDragOver}
                  onDrop={handleItemDrop(item)}
                  onContextMenu={handleContextMenu(item)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
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
      <div ref={contentRef}>
        {/* ツリー構造でグループをレンダリング */}
        {groupTree.map((node) => renderGroupNode(node))}

        {filteredUncategorizedItems.length > 0 && (showUncategorized || !itemVisibility) && (
          <div
            className={`workspace-uncategorized-section${dragOverGroupId === '__uncategorized__' ? ' drag-over' : ''}`}
            onDragOver={handleGroupDragOver(undefined)}
            onDrop={handleGroupDrop(undefined)}
          >
            <div
              className="workspace-group-header"
              onClick={handleUncategorizedToggle}
              style={{ '--group-color': 'var(--color-secondary)' } as React.CSSProperties}
            >
              <span
                className={`workspace-group-collapse-icon${uncategorizedCollapsed ? ' collapsed' : ''}`}
              >
                ▼
              </span>
              <span className="workspace-group-name">未分類</span>
              <span className="workspace-group-badge">{filteredUncategorizedItems.length}</span>
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
                    onDragOver={handleItemDragOver}
                    onDrop={handleItemDrop(item)}
                    onContextMenu={handleContextMenu(item)}
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

        {/* アイコンピッカー */}
        {iconPickerGroupId && (
          <IconPickerModal
            currentIcon={groupsMap.get(iconPickerGroupId)?.customIcon}
            onSelectIcon={(icon) => {
              onUpdateGroup(iconPickerGroupId, { customIcon: icon });
            }}
            onClearIcon={() => {
              onUpdateGroup(iconPickerGroupId, { customIcon: undefined });
            }}
            onClose={() => setIconPickerGroupId(null)}
          />
        )}
      </div>
    </div>
  );
};

export default WorkspaceGroupedList;
