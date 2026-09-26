import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  isJsonLauncherItem,
  type DuplicateHandlingOption,
  type RegisterItem,
  type ScannedAppItem,
  type SimpleBookmarkItem,
} from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { convertRegisterItemToJsonItem } from '@common/utils/dataConverters';

import {
  buildItemsForSave,
  createBlankItem,
  dedupeFileItems,
  diffItems,
  duplicateItems as duplicateItemRows,
  findDuplicateIds,
  importApps as importAppRows,
  importBookmarks as importBookmarkRows,
  rebaseWorkingItems,
  refreshEditableItem,
  removeItems,
  replaceItem,
  reorderItemNumbers,
  type RebaseConflict,
} from '../utils/editableItemOperations';

/** ディスクの内容が外部で変わり、未保存の変更を載せ直したときの結果 */
export interface RebaseNotice {
  applied: number;
  conflicts: RebaseConflict[];
}

interface EditingState {
  /** ディスクの内容（最後に読み込んだ、または保存した一覧） */
  baseItems: EditableJsonItem[];
  /** 作業中の一覧（追加・削除・編集を反映済み） */
  workingItems: EditableJsonItem[];
  /** 選択中のアイテム id */
  selectedIds: Set<string>;
  rebaseNotice: RebaseNotice | null;
}

type EditingAction =
  | { type: 'baseChanged'; items: EditableJsonItem[] }
  | { type: 'updateWorking'; update: (working: EditableJsonItem[]) => EditableJsonItem[] }
  | { type: 'saved'; items: EditableJsonItem[] }
  | { type: 'discard' }
  | { type: 'setSelection'; ids: Set<string> }
  | { type: 'clearNotice' };

function retainExisting(selected: Set<string>, items: EditableJsonItem[]): Set<string> {
  const existing = new Set(items.map((item) => item.item.id));
  const next = new Set([...selected].filter((id) => existing.has(id)));
  return next.size === selected.size ? selected : next;
}

export function editingReducer(state: EditingState, action: EditingAction): EditingState {
  switch (action.type) {
    case 'baseChanged': {
      // 未保存の変更が無ければそのまま採用。あれば新しい内容の上に載せ直す
      if (!diffItems(state.baseItems, state.workingItems).hasChanges) {
        return {
          ...state,
          baseItems: action.items,
          workingItems: action.items,
          selectedIds: retainExisting(state.selectedIds, action.items),
        };
      }
      const rebased = rebaseWorkingItems(state.baseItems, state.workingItems, action.items);
      const notice =
        rebased.applied > 0 || rebased.conflicts.length > 0
          ? { applied: rebased.applied, conflicts: rebased.conflicts }
          : null;
      return {
        baseItems: action.items,
        workingItems: rebased.items,
        selectedIds: retainExisting(state.selectedIds, rebased.items),
        rebaseNotice: notice,
      };
    }
    case 'updateWorking': {
      const workingItems = action.update(state.workingItems);
      return {
        ...state,
        workingItems,
        selectedIds: retainExisting(state.selectedIds, workingItems),
      };
    }
    case 'saved':
      return { ...state, baseItems: action.items, workingItems: action.items };
    case 'discard':
      return {
        ...state,
        workingItems: state.baseItems,
        selectedIds: retainExisting(state.selectedIds, state.baseItems),
      };
    case 'setSelection':
      return { ...state, selectedIds: action.ids };
    case 'clearNotice':
      return state.rebaseNotice ? { ...state, rebaseNotice: null } : state;
    default:
      return state;
  }
}

/**
 * アイテム管理画面の編集状態
 *
 * アイテムの同一性は item.id で扱う。行番号は表示用で、操作のたびに振り直す。
 * 親から渡される editableItems（ディスクの内容）が変わったとき、未保存の変更は
 * 新しい内容の上に載せ直す（rebaseWorkingItems）。保存は onSave の結果を待ってから確定する。
 */
export function useAdminItemEditing(
  editableItems: EditableJsonItem[],
  onSave: (items: EditableJsonItem[]) => Promise<boolean>
) {
  const [state, dispatch] = useReducer(editingReducer, editableItems, (items) => ({
    baseItems: items,
    workingItems: items,
    selectedIds: new Set<string>(),
    rebaseNotice: null,
  }));

  // コールバックから最新の状態を読むための参照（クロージャの古い状態を使わないため）
  const stateRef = useRef(state);
  stateRef.current = state;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    dispatch({ type: 'baseChanged', items: editableItems });
  }, [editableItems]);

  const { baseItems, workingItems, selectedIds, rebaseNotice } = state;

  const diff = useMemo(() => diffItems(baseItems, workingItems), [baseItems, workingItems]);
  const invalidCount = useMemo(
    () => workingItems.filter((item) => !item.meta.isValid).length,
    [workingItems]
  );

  const updateWorking = useCallback(
    (update: (working: EditableJsonItem[]) => EditableJsonItem[]) =>
      dispatch({ type: 'updateWorking', update }),
    []
  );

  /** セル編集の結果を反映する（表示テキスト・検証は作り直す） */
  const recordEdit = useCallback(
    (editableItem: EditableJsonItem) => {
      updateWorking((working) =>
        replaceItem(working, refreshEditableItem(editableItem, editableItem.item))
      );
    },
    [updateWorking]
  );

  /**
   * 詳細編集モーダルの結果を、元のアイテム（id を保持）への変更として反映する
   *
   * @returns 保存先ファイルが変わった場合はその移動先。変わらなければ null
   */
  const applyRegisterUpdate = useCallback(
    (editingItem: EditableJsonItem, items: RegisterItem[]): string | null => {
      if (items.length === 0) return null;
      const registerItem = items[0];
      const original = editingItem.item;

      let updated = convertRegisterItemToJsonItem(registerItem, original.id);
      // 自動取込との紐づけは RegisterItem を経由すると失われるので引き継ぐ
      if (isJsonLauncherItem(original) && updated.type === 'item' && original.autoImportRuleId) {
        updated = { ...updated, autoImportRuleId: original.autoImportRuleId };
      }

      const targetFile = registerItem.targetFile || editingItem.meta.sourceFile;
      updateWorking((working) =>
        replaceItem(working, refreshEditableItem(editingItem, updated, targetFile))
      );
      return targetFile !== editingItem.meta.sourceFile ? targetFile : null;
    },
    [updateWorking]
  );

  const deleteItems = useCallback(
    (itemsToDelete: EditableJsonItem[]) => {
      const ids = itemsToDelete.map((item) => item.item.id);
      updateWorking((working) => removeItems(working, ids));
    },
    [updateWorking]
  );

  const duplicateItems = useCallback(
    (itemsToDuplicate: EditableJsonItem[]) => {
      const ids = itemsToDuplicate.map((item) => item.item.id);
      updateWorking((working) => duplicateItemRows(working, ids) ?? working);
    },
    [updateWorking]
  );

  /** 空のアイテムを先頭に追加し、その id を返す */
  const addBlankItem = useCallback(
    (sourceFile: string): string => {
      const blank = createBlankItem(sourceFile);
      updateWorking((working) => reorderItemNumbers([blank, ...working]));
      return blank.item.id;
    },
    [updateWorking]
  );

  const importBookmarks = useCallback(
    (
      bookmarks: SimpleBookmarkItem[],
      duplicateHandling: DuplicateHandlingOption,
      sourceFile: string
    ) => {
      updateWorking((working) =>
        importBookmarkRows(working, bookmarks, duplicateHandling, sourceFile)
      );
    },
    [updateWorking]
  );

  const importApps = useCallback(
    (apps: ScannedAppItem[], duplicateHandling: DuplicateHandlingOption, sourceFile: string) => {
      updateWorking((working) => importAppRows(working, apps, duplicateHandling, sourceFile));
    },
    [updateWorking]
  );

  /** 指定データファイル内の重複件数（ファイル順で 2 件目以降） */
  const countDuplicates = useCallback(
    (sourceFile: string): number =>
      findDuplicateIds(stateRef.current.workingItems, sourceFile).length,
    []
  );

  /** 指定データファイル内の重複を除き、除いた件数を返す */
  const dedupeFile = useCallback(
    (sourceFile: string): number => {
      const { removed } = dedupeFileItems(stateRef.current.workingItems, sourceFile);
      if (removed > 0) {
        updateWorking((working) => dedupeFileItems(working, sourceFile).items);
      }
      return removed;
    },
    [updateWorking]
  );

  /**
   * 変更を保存する。onSave が成功したときだけ編集状態を確定する
   *
   * @returns 保存できたら true。変更が無い、または保存に失敗したら false
   */
  const saveChanges = useCallback(async (): Promise<boolean> => {
    const current = stateRef.current;
    const currentDiff = diffItems(current.baseItems, current.workingItems);
    if (!currentDiff.hasChanges) return false;

    const itemsToSave = buildItemsForSave(current.workingItems, currentDiff.changedIds);
    const ok = await onSaveRef.current(itemsToSave);
    if (ok) {
      dispatch({ type: 'saved', items: itemsToSave });
    }
    return ok;
  }, []);

  /** 未保存の変更（追加・削除・編集すべて）を捨てて、ディスクの内容に戻す */
  const discardChanges = useCallback(() => dispatch({ type: 'discard' }), []);

  const clearRebaseNotice = useCallback(() => dispatch({ type: 'clearNotice' }), []);

  const selectItem = useCallback((editableItem: EditableJsonItem, selected: boolean) => {
    const next = new Set(stateRef.current.selectedIds);
    if (selected) {
      next.add(editableItem.item.id);
    } else {
      next.delete(editableItem.item.id);
    }
    dispatch({ type: 'setSelection', ids: next });
  }, []);

  const selectAll = useCallback((visibleItems: EditableJsonItem[], selected: boolean) => {
    dispatch({
      type: 'setSelection',
      ids: selected ? new Set(visibleItems.map((item) => item.item.id)) : new Set(),
    });
  }, []);

  /** 表示されていないアイテムの選択を外す */
  const retainVisibleSelection = useCallback((visibleItems: EditableJsonItem[]) => {
    const next = retainExisting(stateRef.current.selectedIds, visibleItems);
    if (next !== stateRef.current.selectedIds) {
      dispatch({ type: 'setSelection', ids: next });
    }
  }, []);

  return {
    workingItems,
    /** 内容が変わった、または追加されたアイテムの id */
    changedIds: diff.changedIds,
    deletedCount: diff.deletedIds.size,
    hasUnsavedChanges: diff.hasChanges,
    invalidCount,
    selectedItems: selectedIds,
    rebaseNotice,
    clearRebaseNotice,
    recordEdit,
    applyRegisterUpdate,
    deleteItems,
    duplicateItems,
    addBlankItem,
    importBookmarks,
    importApps,
    countDuplicates,
    dedupeFile,
    saveChanges,
    discardChanges,
    selectItem,
    selectAll,
    retainVisibleSelection,
  };
}

export type AdminItemEditing = ReturnType<typeof useAdminItemEditing>;
