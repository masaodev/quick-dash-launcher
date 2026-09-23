import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DuplicateHandlingOption,
  RegisterItem,
  ScannedAppItem,
  SimpleBookmarkItem,
} from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { validateEditableItem } from '@common/types/editableItem';
import { jsonItemToDisplayText } from '@common/utils/displayTextConverter';
import { convertRegisterItemToJsonItem } from '@common/utils/dataConverters';

import { logError } from '../utils/debug';
import {
  buildItemsForSave,
  createBlankItem,
  duplicateItems as duplicateItemRows,
  getItemKey,
  importApps as importAppRows,
  importBookmarks as importBookmarkRows,
  removeItems,
  reorderItemNumbers,
} from '../utils/editableItemOperations';

/**
 * アイテム管理画面の編集状態
 *
 * - workingItems: 行の追加・削除・複製・取り込みを反映した一覧
 * - editedItems: セルの直接編集・詳細編集による差分（保存時に workingItems へ反映）
 * - selectedItems: 選択中の行のキー
 *
 * 親から渡される editableItems（ディスクの内容）が変わると、編集状態は破棄される。
 */
export function useAdminItemEditing(
  editableItems: EditableJsonItem[],
  onEditableItemsSave: (items: EditableJsonItem[]) => void
) {
  const [workingItems, setWorkingItems] = useState<EditableJsonItem[]>(editableItems);
  const [editedItems, setEditedItems] = useState<Map<string, EditableJsonItem>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // editableItemsが変更されたらworkingItemsも更新
  useEffect(() => {
    setWorkingItems(editableItems);
    setEditedItems(new Map());
    setHasUnsavedChanges(false);
  }, [editableItems]);

  // 毎レンダーの全件再生成は、参照変化がAdminItemManagerListのアイコン取得effect等を
  // 連鎖発火させるためuseMemoで抑制する
  const mergedItems = useMemo(
    () => workingItems.map((item) => editedItems.get(getItemKey(item)) || item),
    [workingItems, editedItems]
  );

  /** 行の構成（追加・削除・複製・取り込み）を変更する */
  const replaceWorkingItems = (items: EditableJsonItem[]) => {
    setWorkingItems(items);
    setHasUnsavedChanges(true);
  };

  /** 1 行分の編集内容を差分として記録する */
  const recordEdit = (editableItem: EditableJsonItem) => {
    setEditedItems((prev) => new Map(prev).set(getItemKey(editableItem), editableItem));
    setHasUnsavedChanges(true);
  };

  /** 詳細編集モーダルの結果を、元の行（ID を保持）への編集として記録する */
  const applyRegisterUpdate = (editingItem: EditableJsonItem, items: RegisterItem[]) => {
    if (items.length === 0) return;

    const updatedJsonItem = convertRegisterItemToJsonItem(items[0], editingItem.item.id);
    const validation = validateEditableItem(updatedJsonItem);
    const updatedEditableItem: EditableJsonItem = {
      item: updatedJsonItem,
      displayText: jsonItemToDisplayText(updatedJsonItem),
      meta: {
        ...editingItem.meta,
        isValid: validation.isValid,
        validationError: validation.error,
      },
    };

    // 変更内容が異なる場合のみ編集として記録
    if (updatedEditableItem.displayText !== editingItem.displayText) {
      recordEdit(updatedEditableItem);
    }
  };

  // AdminItemManagerList側のIPCリスナー登録effectが依存するため、
  // 毎レンダーの再登録を防ぐ目的でuseCallback化している（複製も同様）
  const deleteItems = useCallback(
    (itemsToDelete: EditableJsonItem[]) => {
      setWorkingItems(removeItems(workingItems, itemsToDelete));
      setSelectedItems(new Set());
      setHasUnsavedChanges(true);
    },
    [workingItems]
  );

  const duplicateItems = useCallback(
    (itemsToDuplicate: EditableJsonItem[]) => {
      const updated = duplicateItemRows(workingItems, itemsToDuplicate);
      if (!updated) {
        logError('挿入位置の特定に失敗しました');
        return;
      }
      setWorkingItems(updated);
      setHasUnsavedChanges(true);
      setSelectedItems(new Set());
    },
    [workingItems]
  );

  /** 空の行を先頭に追加する */
  const addBlankItem = (sourceFile: string) => {
    replaceWorkingItems(reorderItemNumbers([createBlankItem(sourceFile), ...workingItems]));
  };

  const importBookmarks = (
    bookmarks: SimpleBookmarkItem[],
    duplicateHandling: DuplicateHandlingOption,
    sourceFile: string
  ) => {
    replaceWorkingItems(importBookmarkRows(workingItems, bookmarks, duplicateHandling, sourceFile));
  };

  const importApps = (
    apps: ScannedAppItem[],
    duplicateHandling: DuplicateHandlingOption,
    sourceFile: string
  ) => {
    replaceWorkingItems(importAppRows(workingItems, apps, duplicateHandling, sourceFile));
  };

  /** 編集差分を反映して全件を書き戻す */
  const saveChanges = (options: { sortAndDedupe: boolean; sourceFile: string }) => {
    const itemsToSave = buildItemsForSave(workingItems, editedItems, options);
    onEditableItemsSave(itemsToSave);
    setEditedItems(new Map());
    setHasUnsavedChanges(false);
    setWorkingItems(itemsToSave);
  };

  /** 未保存の編集差分を捨てる（タブ・ファイルの切り替え時） */
  const discardEdits = () => {
    setHasUnsavedChanges(false);
    setEditedItems(new Map());
  };

  const selectItem = (editableItem: EditableJsonItem, selected: boolean) => {
    const key = getItemKey(editableItem);
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const selectAll = (visibleItems: EditableJsonItem[], selected: boolean) => {
    setSelectedItems(selected ? new Set(visibleItems.map(getItemKey)) : new Set());
  };

  /** 表示されていない行の選択を外す */
  const retainVisibleSelection = (visibleItems: EditableJsonItem[]) => {
    const visibleKeys = new Set(visibleItems.map(getItemKey));
    setSelectedItems((prev) => {
      const next = new Set([...prev].filter((key) => visibleKeys.has(key)));
      // 変更があった場合のみ新しいSetを返す
      return next.size !== prev.size ? next : prev;
    });
  };

  return {
    workingItems,
    mergedItems,
    hasUnsavedChanges,
    selectedItems,
    recordEdit,
    applyRegisterUpdate,
    deleteItems,
    duplicateItems,
    addBlankItem,
    importBookmarks,
    importApps,
    saveChanges,
    discardEdits,
    selectItem,
    selectAll,
    retainVisibleSelection,
  };
}
