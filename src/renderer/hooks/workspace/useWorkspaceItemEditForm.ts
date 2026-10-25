import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceItem, WorkspaceItemUpdate, RegisterItem } from '@common/types';
import {
  workspaceItemToRegisterItem,
  registerItemToWorkspaceItemUpdate,
} from '@common/utils/workspaceConverters';
import { detectItemType } from '@common/utils/itemTypeDetector';

import type { ItemEditFieldErrors, ItemFieldValue } from '../../components/ItemEditFields';
import { logError } from '../../utils/debug';
import { applyItemCategoryChange } from '../../utils/itemCategoryChange';
import {
  canFetchIcon,
  commitClipboardContent,
  discardClipboardSession as discardItemClipboardSession,
  fetchItemIcon,
  resolvePathChange,
  validateItemForm,
} from '../../utils/itemFormActions';
import { useToast } from '../useToast';

type FormErrors = ItemEditFieldErrors;

/** 新規（グループの右クリック「新しく入力して追加」）で開いたときの空のフォーム */
const EMPTY_ITEM: RegisterItem = {
  displayName: '',
  path: '',
  type: 'app',
  targetTab: '',
  itemCategory: 'item',
};

/** 新規で開いたときの追加の処理（保存の代わりに呼ぶ） */
export interface WorkspaceItemCreate {
  onAdd: (body: WorkspaceItemUpdate) => Promise<void>;
}

/**
 * ワークスペースアイテム編集フォームの状態管理フック
 *
 * create を渡すと新規の形になる（空のフォームで始め、保存の代わりに create.onAdd を呼ぶ）
 */
export function useWorkspaceItemEditForm(
  isOpen: boolean,
  editingItem: WorkspaceItem | null,
  loadCustomIconPreview: (index: number, customIconFileName: string) => Promise<void>,
  onClose: () => void,
  onSave: (id: string, updates: WorkspaceItemUpdate) => Promise<void>,
  create?: WorkspaceItemCreate
) {
  const isCreate = create !== undefined;
  const { t } = useTranslation();
  const [item, setItem] = useState<RegisterItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [iconFetchLoading, setIconFetchLoading] = useState(false);
  const { showError, showWarning } = useToast();

  const clearErrorField = (field: keyof FormErrors) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setItem(null);
      setErrors({});
      setLoading(false);
      return;
    }

    if (editingItem) {
      setLoading(true);
      const registerItem = workspaceItemToRegisterItem(editingItem);
      setItem(registerItem);

      if (registerItem.customIcon) {
        loadCustomIconPreview(0, registerItem.customIcon).catch((err) => {
          logError('Failed to load custom icon preview:', err);
        });
      }

      setLoading(false);
    } else if (isCreate) {
      setItem({ ...EMPTY_ITEM });
    }
  }, [isOpen, editingItem, isCreate, loadCustomIconPreview]);

  const handleFieldChange = useCallback(
    (field: keyof RegisterItem, value: ItemFieldValue) => {
      if (!item) return;

      const newItem: RegisterItem =
        field === 'itemCategory'
          ? applyItemCategoryChange(item, value as RegisterItem['itemCategory'])
          : { ...item, [field]: value };

      if (field === 'displayName' || field === 'path') {
        clearErrorField(field);
      }

      setItem(newItem);
    },
    [item]
  );

  /** パス欄を離れたとき（または「選択」で選んだとき。pickedPath は選んだパスで、まだ item に入っていない）に種別を決め直す */
  const handlePathBlur = useCallback(
    async (pickedPath?: string) => {
      if (!item) return;
      const apply = await resolvePathChange(item, pickedPath);
      if (!apply) return;
      setItem((prev) => (prev ? apply(prev) : null));
    },
    [item]
  );

  const validate = useCallback((): boolean => {
    if (!item) return false;

    const newErrors = validateItemForm(item, t);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [item, t]);

  // 失敗したときは画面を開いたままにして、直してもう一度保存できるようにする
  const handleSave = useCallback(async () => {
    if (!item || (!editingItem && !create)) return;

    if (!validate()) return;

    const committed = await commitClipboardContent(item, { showWarning, showError }, t);
    if (!committed) return;
    if (committed !== item) setItem(committed);

    try {
      const updates = registerItemToWorkspaceItemUpdate(committed);
      if (editingItem) {
        await onSave(editingItem.id, updates);
      } else {
        await create!.onAdd(updates);
      }
      onClose();
    } catch (error) {
      logError('Failed to save workspace item:', error);
      showError(t(editingItem ? 'workspace.edit.updateFailed' : 'workspace.edit.addFailed'));
    }
  }, [item, editingItem, create, validate, onSave, onClose, showWarning, showError, t]);

  const discardClipboardSession = useCallback(async () => {
    if (item) await discardItemClipboardSession(item);
  }, [item]);

  const handleCancel = useCallback(async () => {
    await discardClipboardSession();
    setItem(null);
    setErrors({});
    onClose();
  }, [discardClipboardSession, onClose]);

  const handleDelete = useCallback(async () => {
    if (!editingItem) return;
    try {
      const result = await window.electronAPI.workspaceAPI.removeItem(editingItem.id);
      if (!result.success) throw new Error('removeItem returned success: false');
      await discardClipboardSession();
      onClose();
    } catch (error) {
      logError('Failed to remove workspace item:', error);
      showError(t('workspace.edit.removeFailed'));
    }
  }, [editingItem, discardClipboardSession, onClose, showError, t]);

  const handleFetchIcon = useCallback(async () => {
    if (!item || !canFetchIcon(item)) return;

    setIconFetchLoading(true);
    // 取得したアイコンは icon-cache に入り、ワークスペースは読み直すときにそこから引く
    const icon = await fetchItemIcon(item, { showWarning, showError }, t);
    if (icon) setItem((prev) => (prev ? { ...prev, icon } : null));
    setIconFetchLoading(false);
  }, [item, showError, showWarning, t]);

  /** ドロップしたファイル・フォルダでパスを置き換える（通常のアイテムだけ。名前などはそのまま） */
  const replacePathFromDrop = useCallback(
    async (path: string) => {
      if (!item || item.itemCategory !== 'item') return;
      const type = await detectItemType(path);
      const cached = await window.electronAPI
        .loadCachedIcons([{ path, type, displayName: item.displayName }])
        .catch(() => ({}) as Record<string, string>);
      setItem((prev) => (prev ? { ...prev, path, type, icon: cached[path] } : null));
      clearErrorField('path');
    },
    [item]
  );

  const updateItem = useCallback((updatedFields: Partial<RegisterItem>) => {
    setItem((prev) => (prev ? { ...prev, ...updatedFields } : null));
    if (updatedFields.setEntries?.length) clearErrorField('setEntries');
  }, []);

  return {
    item,
    loading,
    errors,
    iconFetchLoading,
    handleFieldChange,
    handlePathBlur,
    handleSave,
    handleCancel,
    handleDelete,
    handleFetchIcon,
    replacePathFromDrop,
    updateItem,
  };
}
