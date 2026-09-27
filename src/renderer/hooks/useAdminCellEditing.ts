import { useCallback, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EditableJsonItem } from '@common/types/editableItem';

import { getItemKey } from '../utils/editableItemOperations';
import {
  getEditablePath,
  hasDisplayName,
  isPathEditable,
  withEditedPath,
} from '../utils/adminItemDisplay';

/** 編集中のセル。名前列とパス列のどちらか */
export interface EditingCell {
  itemId: string;
  column: 'name' | 'path';
}

/**
 * アイテム管理の一覧のセル編集（名前・パス）
 *
 * - 編集中のセルは 1 つだけ。確定は Enter / Tab / フォーカス移動
 * - 名前セルで Enter / Tab を押すと、同じ行のパスセルの編集へ進む（追加直後の入力の流れ）
 * - Enter で次のセルへ移った直後に前の入力欄の blur が遅れて届いても、別のセルの値で
 *   上書きしないよう、確定処理は「今もそのセルを編集中か」を ref で確かめる
 * - すべてのハンドラは参照が変わらない（行コンポーネントの memo を効かせるため）
 */
export function useAdminCellEditing(onItemEdit: (item: EditableJsonItem) => void) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const editingCellRef = useRef<EditingCell | null>(null);
  editingCellRef.current = editingCell;
  const editingValueRef = useRef('');
  editingValueRef.current = editingValue;
  const onItemEditRef = useRef(onItemEdit);
  onItemEditRef.current = onItemEdit;

  const isEditing = (item: EditableJsonItem, column: EditingCell['column']) => {
    const current = editingCellRef.current;
    return current !== null && current.itemId === getItemKey(item) && current.column === column;
  };

  const stop = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const startNameEdit = useCallback((item: EditableJsonItem) => {
    if (!hasDisplayName(item.item)) return;
    setEditingCell({ itemId: getItemKey(item), column: 'name' });
    setEditingValue(item.item.displayName || '');
  }, []);

  const startPathEdit = useCallback((item: EditableJsonItem) => {
    if (!isPathEditable(item.item)) return;
    setEditingCell({ itemId: getItemKey(item), column: 'path' });
    setEditingValue(getEditablePath(item.item));
  }, []);

  /** 名前セルの入力を確定する。別のセルへ移った後の遅い blur は無視する */
  const commitNameEdit = useCallback((item: EditableJsonItem) => {
    if (!isEditing(item, 'name')) return;
    const newName = editingValueRef.current.trim();
    const jsonItem = item.item;
    if (hasDisplayName(jsonItem) && newName !== (jsonItem.displayName || '')) {
      onItemEditRef.current({ ...item, item: { ...jsonItem, displayName: newName } });
    }
    stop();
  }, []);

  /** パスセルの入力を確定する */
  const commitPathEdit = useCallback((item: EditableJsonItem) => {
    if (!isEditing(item, 'path')) return;
    const newPath = editingValueRef.current.trim();
    if (newPath !== getEditablePath(item.item)) {
      // 表示テキスト・検証は onItemEdit 側（useAdminItemEditing.recordEdit）で作り直す
      onItemEditRef.current({ ...item, item: withEditedPath(item.item, newPath) });
    }
    stop();
  }, []);

  const cancelEdit = useCallback(() => stop(), []);

  const handleNameKeyDown = useCallback(
    (e: ReactKeyboardEvent, item: EditableJsonItem) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commitNameEdit(item);
        // 確定後の値でパス編集を始める（名前の変更は onItemEdit で反映済み）
        startPathEdit(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        stop();
      }
    },
    [commitNameEdit, startPathEdit]
  );

  const handlePathKeyDown = useCallback(
    (e: ReactKeyboardEvent, item: EditableJsonItem) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commitPathEdit(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        stop();
      }
    },
    [commitPathEdit]
  );

  /** 追加直後のアイテムの名前セルを、空の値で編集状態にする */
  const beginNameEditFor = useCallback((itemId: string) => {
    setEditingCell({ itemId, column: 'name' });
    setEditingValue('');
  }, []);

  return {
    editingCell,
    editingValue,
    setEditingValue,
    startNameEdit,
    startPathEdit,
    commitNameEdit,
    commitPathEdit,
    cancelEdit,
    handleNameKeyDown,
    handlePathKeyDown,
    beginNameEditFor,
  };
}

export type AdminCellEditing = ReturnType<typeof useAdminCellEditing>;
