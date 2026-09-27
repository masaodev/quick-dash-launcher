import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import type { EditableJsonItem } from '@common/types/editableItem';

import { getItemKey } from '../utils/editableItemOperations';

interface ContextMenuHandlers {
  onDuplicateItems: (items: EditableJsonItem[]) => void;
  onEditClick: (item: EditableJsonItem) => void;
  onRequestDelete: (items: EditableJsonItem[]) => void;
}

/**
 * アイテム管理の一覧の右クリックメニュー（ネイティブメニュー）
 *
 * 右クリックしたアイテムが選択されていれば選択中の全アイテムを、そうでなければそのアイテムだけを対象にする。
 * メニューの選択結果はメインプロセスからイベントで届くので、対象は ref に控えておく。
 */
export function useAdminContextMenu({
  onDuplicateItems,
  onEditClick,
  onRequestDelete,
}: ContextMenuHandlers) {
  const targetItemsRef = useRef<EditableJsonItem[]>([]);

  useEffect(() => {
    const cleanupDuplicate = window.electronAPI.onAdminMenuDuplicateItems(() => {
      const targets = targetItemsRef.current;
      if (targets.length > 0) onDuplicateItems(targets);
    });
    const cleanupEdit = window.electronAPI.onAdminMenuEditItem(() => {
      const targets = targetItemsRef.current;
      if (targets.length === 1) onEditClick(targets[0]);
    });
    // 削除の確認は呼び出し側で出す
    const cleanupDelete = window.electronAPI.onAdminMenuDeleteItems(() => {
      const targets = targetItemsRef.current;
      if (targets.length > 0) onRequestDelete(targets);
    });
    return () => {
      cleanupDuplicate();
      cleanupEdit();
      cleanupDelete();
    };
  }, [onDuplicateItems, onEditClick, onRequestDelete]);

  const openContextMenu = useCallback(
    (
      event: ReactMouseEvent,
      item: EditableJsonItem,
      visibleItems: EditableJsonItem[],
      selectedIds: Set<string>
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const targets = selectedIds.has(getItemKey(item))
        ? visibleItems.filter((i) => selectedIds.has(getItemKey(i)))
        : [item];
      targetItemsRef.current = targets;

      window.electronAPI.showAdminItemContextMenu(targets.length, targets.length === 1);
    },
    []
  );

  return { openContextMenu };
}
