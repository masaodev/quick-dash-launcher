import React from 'react';
import type {
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
  LauncherItem,
} from '@common/types';

import { useWorkspaceContextMenu, useWorkspaceItemGroups } from '../hooks/workspace';
import { logError } from '../utils/debug';

import WorkspaceGroupHeader from './WorkspaceGroupHeader';
import WorkspaceItemCard from './WorkspaceItemCard';
import WorkspaceExecutionHistoryCard from './WorkspaceExecutionHistoryCard';
import WorkspaceContextMenu from './WorkspaceContextMenu';
import WorkspaceGroupContextMenu from './WorkspaceGroupContextMenu';

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
  } = ui;
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [_draggedGroupId, setDraggedGroupId] = React.useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [groupContextMenu, setGroupContextMenu] = React.useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    group: WorkspaceGroup | null;
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    group: null,
  });

  // グループ化ロジック
  const { itemsByGroup, uncategorizedItems } = useWorkspaceItemGroups(items);

  // コンテキストメニュー
  const {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
    handleEditFromContextMenu,
    handleRemoveFromGroup,
    pathHandlers,
  } = useWorkspaceContextMenu(onMoveItemToGroup, setEditingItemId);

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
        const historyItem = JSON.parse(historyItemData);

        // ExecutionHistoryItemをLauncherItem形式に変換
        const launcherItem: Partial<LauncherItem> = {
          name: historyItem.itemName,
          path: historyItem.itemPath,
          type: historyItem.itemType,
          icon: historyItem.icon,
          args: historyItem.args,
        };

        // グループアイテムの場合はitemNamesも含める（型アサーションで一時的に対応）
        if (historyItem.itemType === 'group' && historyItem.itemNames) {
          (launcherItem as LauncherItem & { itemNames: string[] }).itemNames =
            historyItem.itemNames;
        }

        // windowConfig情報があれば含める
        if (
          historyItem.processName !== undefined ||
          historyItem.windowX !== undefined ||
          historyItem.windowY !== undefined ||
          historyItem.windowWidth !== undefined ||
          historyItem.windowHeight !== undefined ||
          historyItem.virtualDesktopNumber !== undefined ||
          historyItem.activateWindow !== undefined ||
          historyItem.moveToActiveMonitorCenter !== undefined
        ) {
          launcherItem.windowConfig = {
            title: '', // タイトルは不要（プロセス名で検索）
            processName: historyItem.processName,
            x: historyItem.windowX,
            y: historyItem.windowY,
            width: historyItem.windowWidth,
            height: historyItem.windowHeight,
            virtualDesktopNumber: historyItem.virtualDesktopNumber,
            activateWindow: historyItem.activateWindow,
            moveToActiveMonitorCenter: historyItem.moveToActiveMonitorCenter,
          };
        }

        // ワークスペースにアイテムを追加（groupIdも渡す）
        // name, path, typeは必ず設定されているため、LauncherItemとして扱える
        await window.electronAPI.workspaceAPI.addItem(launcherItem as LauncherItem, groupId);
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

  // グループコンテキストメニューハンドラー
  const handleGroupContextMenu = (group: WorkspaceGroup) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGroupContextMenu({
      isVisible: true,
      position: { x: e.clientX, y: e.clientY },
      group,
    });
  };

  const handleCloseGroupContextMenu = () => {
    setGroupContextMenu({
      isVisible: false,
      position: { x: 0, y: 0 },
      group: null,
    });
  };

  const handleRenameGroupFromContextMenu = (group: WorkspaceGroup) => {
    setEditingGroupId(group.id);
  };

  const handleChangeGroupColor = (groupId: string, color: string) => {
    onUpdateGroup(groupId, { color });
  };

  const handleCopyGroupAsText = (group: WorkspaceGroup) => {
    const groupItems = itemsByGroup[group.id] || [];

    // テキスト形式に整形（改行はCRLF）
    let text = `【${group.name}】\r\n`;

    groupItems.forEach((item, index) => {
      // eslint-disable-next-line no-irregular-whitespace
      text += `　■${item.displayName}\r\n`;
      // eslint-disable-next-line no-irregular-whitespace
      text += `　　${item.path}\r\n`;

      // 最後のアイテム以外は空行を追加
      if (index < groupItems.length - 1) {
        text += '\r\n';
      }
    });

    // クリップボードにコピー
    window.electronAPI.copyToClipboard(text);
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
      {/* グループを表示 */}
      {groups.map((group) => {
        const groupItems = itemsByGroup[group.id] || [];
        return (
          <div key={group.id} className="workspace-group">
            <WorkspaceGroupHeader
              group={group}
              itemCount={groupItems.length}
              isEditing={editingGroupId === group.id}
              onToggle={handleGroupToggle}
              onUpdate={onUpdateGroup}
              _onDelete={onDeleteGroup}
              _onArchive={onArchiveGroup}
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
      })}

      {/* 未分類セクション */}
      {uncategorizedItems.length > 0 && (
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
            未分類 ({uncategorizedItems.length})
          </div>
          {!uncategorizedCollapsed && (
            <div className="workspace-group-items">
              {uncategorizedItems.map((item) => (
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
      )}

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
                    // 実行履歴アイテムを外部で起動
                    if (item.itemType === 'url' || item.itemType === 'customUri') {
                      window.electronAPI.openExternalUrl(item.itemPath);
                    } else if (
                      item.itemType === 'file' ||
                      item.itemType === 'folder' ||
                      item.itemType === 'app'
                    ) {
                      // LauncherItem形式に変換して起動
                      const launcherItem: Partial<LauncherItem> = {
                        name: item.itemName,
                        path: item.itemPath,
                        type: item.itemType,
                        icon: item.icon,
                        args: item.args,
                      };

                      // windowConfig情報があれば含める
                      if (
                        item.processName !== undefined ||
                        item.windowX !== undefined ||
                        item.windowY !== undefined ||
                        item.windowWidth !== undefined ||
                        item.windowHeight !== undefined ||
                        item.virtualDesktopNumber !== undefined ||
                        item.activateWindow !== undefined ||
                        item.moveToActiveMonitorCenter !== undefined
                      ) {
                        launcherItem.windowConfig = {
                          title: '', // タイトルは不要（プロセス名で検索）
                          processName: item.processName,
                          x: item.windowX,
                          y: item.windowY,
                          width: item.windowWidth,
                          height: item.windowHeight,
                          virtualDesktopNumber: item.virtualDesktopNumber,
                          activateWindow: item.activateWindow,
                          moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
                        };
                      }

                      // name, path, typeは必ず設定されているため、LauncherItemとして扱える
                      window.electronAPI.openItem(launcherItem as LauncherItem);
                    } else if (item.itemType === 'windowOperation') {
                      // [ウィンドウ操作: タイトル] から タイトル を抽出
                      const match = item.itemPath.match(/^\[ウィンドウ操作: (.+)\]$/);
                      const windowTitle = match ? match[1] : item.itemPath;
                      window.electronAPI.executeWindowOperation({
                        type: 'windowOperation',
                        name: item.itemName,
                        windowTitle: windowTitle,
                        processName: item.processName,
                        x: item.windowX,
                        y: item.windowY,
                        width: item.windowWidth,
                        height: item.windowHeight,
                        virtualDesktopNumber: item.virtualDesktopNumber,
                        activateWindow: item.activateWindow,
                      });
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

      {/* アイテムコンテキストメニュー */}
      <WorkspaceContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        item={contextMenu.item}
        onClose={handleCloseContextMenu}
        onEdit={handleEditFromContextMenu}
        onLaunch={onLaunch}
        onRemove={onRemoveItem}
        onRemoveFromGroup={handleRemoveFromGroup}
        onCopyPath={pathHandlers.handleCopyPath}
        onCopyParentPath={pathHandlers.handleCopyParentPath}
        onOpenParentFolder={pathHandlers.handleOpenParentFolder}
        onCopyShortcutPath={pathHandlers.handleCopyShortcutPath}
        onCopyShortcutParentPath={pathHandlers.handleCopyShortcutParentPath}
        onOpenShortcutParentFolder={pathHandlers.handleOpenShortcutParentFolder}
      />

      {/* グループコンテキストメニュー */}
      <WorkspaceGroupContextMenu
        isVisible={groupContextMenu.isVisible}
        position={groupContextMenu.position}
        group={groupContextMenu.group}
        onClose={handleCloseGroupContextMenu}
        onRename={handleRenameGroupFromContextMenu}
        onChangeColor={handleChangeGroupColor}
        onArchive={onArchiveGroup}
        onDelete={onDeleteGroup}
        onCopyAsText={handleCopyGroupAsText}
      />
    </div>
  );
};

export default WorkspaceGroupedList;
