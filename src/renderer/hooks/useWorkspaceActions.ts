import type { WorkspaceItem, WorkspaceGroup } from '@common/types';

/**
 * ワークスペースのアクションハンドラーを統合管理するカスタムフック
 *
 * アイテムとグループに関する全ての操作（起動、削除、並び替え、更新など）を
 * 一箇所にまとめ、WorkspaceAppコンポーネントの肥大化を防ぎます。
 *
 * @param onDataChanged データ変更時のコールバック（再読み込み用）
 * @returns アクションハンドラー関数群
 *
 * @example
 * ```tsx
 * const actions = useWorkspaceActions(() => {
 *   loadItems();
 *   loadGroups();
 * });
 *
 * // アイテムを起動
 * await actions.handleLaunch(item);
 *
 * // アイテムを削除
 * await actions.handleRemove(item.id);
 * ```
 */
export function useWorkspaceActions(onDataChanged: () => void) {
  /**
   * ワークスペースアイテムを起動
   */
  const handleLaunch = async (item: WorkspaceItem) => {
    try {
      await window.electronAPI.workspaceAPI.launchItem(item);
    } catch (error) {
      console.error('Failed to launch workspace item:', error);
    }
  };

  /**
   * ワークスペースアイテムを削除
   */
  const handleRemove = async (id: string) => {
    try {
      await window.electronAPI.workspaceAPI.removeItem(id);
      onDataChanged();
    } catch (error) {
      console.error('Failed to remove workspace item:', error);
    }
  };

  /**
   * ワークスペースアイテムの並び順を変更
   */
  const handleReorder = async (itemIds: string[]) => {
    try {
      await window.electronAPI.workspaceAPI.reorderItems(itemIds);
      onDataChanged();
    } catch (error) {
      console.error('Failed to reorder workspace items:', error);
    }
  };

  /**
   * ワークスペースアイテムの表示名を更新
   */
  const handleUpdateDisplayName = async (id: string, displayName: string) => {
    try {
      await window.electronAPI.workspaceAPI.updateDisplayName(id, displayName);
      onDataChanged();
    } catch (error) {
      console.error('Failed to update workspace item display name:', error);
    }
  };

  /**
   * グループの折りたたみ状態を切り替え
   */
  const handleToggleGroup = async (groupId: string, groups: WorkspaceGroup[]) => {
    try {
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        await window.electronAPI.workspaceAPI.updateGroup(groupId, {
          collapsed: !group.collapsed,
        });
        onDataChanged();
      }
    } catch (error) {
      console.error('Failed to toggle workspace group:', error);
    }
  };

  /**
   * グループ情報を更新
   */
  const handleUpdateGroup = async (groupId: string, updates: Partial<WorkspaceGroup>) => {
    try {
      await window.electronAPI.workspaceAPI.updateGroup(groupId, updates);
      onDataChanged();
    } catch (error) {
      console.error('Failed to update workspace group:', error);
    }
  };

  /**
   * グループを削除
   * @param groupId グループID
   * @param deleteItems グループ内のアイテムも削除するか
   */
  const handleDeleteGroup = async (groupId: string, deleteItems: boolean) => {
    try {
      await window.electronAPI.workspaceAPI.deleteGroup(groupId, deleteItems);
      onDataChanged();
    } catch (error) {
      console.error('Failed to delete workspace group:', error);
    }
  };

  /**
   * 新しいグループを追加
   */
  const handleAddGroup = async (groupCount: number) => {
    try {
      await window.electronAPI.workspaceAPI.createGroup(`グループ ${groupCount + 1}`);
      onDataChanged();
    } catch (error) {
      console.error('Failed to create workspace group:', error);
    }
  };

  /**
   * アイテムをグループに移動
   */
  const handleMoveItemToGroup = async (itemId: string, groupId?: string) => {
    try {
      await window.electronAPI.workspaceAPI.moveItemToGroup(itemId, groupId);
      onDataChanged();
    } catch (error) {
      console.error('Failed to move item to group:', error);
    }
  };

  /**
   * グループの並び順を変更
   */
  const handleReorderGroups = async (groupIds: string[]) => {
    try {
      await window.electronAPI.workspaceAPI.reorderGroups(groupIds);
      onDataChanged();
    } catch (error) {
      console.error('Failed to reorder workspace groups:', error);
    }
  };

  return {
    handleLaunch,
    handleRemove,
    handleReorder,
    handleUpdateDisplayName,
    handleToggleGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    handleAddGroup,
    handleMoveItemToGroup,
    handleReorderGroups,
  };
}
