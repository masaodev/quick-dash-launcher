import { useState, useEffect, useCallback } from 'react';
import type { WorkspaceItem, WindowConfig, RegisterItem } from '@common/types';
import {
  convertWorkspaceItemToRegisterItem,
  convertRegisterItemToWorkspaceItemUpdate,
} from '@common/utils/workspaceConverters';
import { detectItemType } from '@common/utils/itemTypeDetector';

import { logError } from '../../utils/debug';

interface FormErrors {
  displayName?: string;
  path?: string;
  groupItemNames?: string;
}

/**
 * ワークスペースアイテム編集フォームの状態管理フック
 */
export function useWorkspaceItemEditForm(
  isOpen: boolean,
  editingItem: WorkspaceItem | null,
  loadCustomIconPreview: (index: number, customIconFileName: string) => Promise<void>,
  onClose: () => void,
  onSave: (id: string, updates: Partial<WorkspaceItem>) => Promise<void>
) {
  const [item, setItem] = useState<RegisterItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [selectorModalOpen, setSelectorModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setItem(null);
      setErrors({});
      setLoading(false);
      return;
    }

    if (editingItem) {
      setLoading(true);
      const registerItem = convertWorkspaceItemToRegisterItem(editingItem);
      setItem(registerItem);

      if (editingItem.customIcon) {
        loadCustomIconPreview(0, editingItem.customIcon).catch((err) => {
          logError('Failed to load custom icon preview:', err);
        });
      }

      setLoading(false);
    }
  }, [isOpen, editingItem, loadCustomIconPreview]);

  const handleFieldChange = useCallback(
    (
      field: keyof RegisterItem,
      value:
        | string
        | boolean
        | RegisterItem['dirOptions']
        | WindowConfig
        | RegisterItem['windowOperationConfig']
    ) => {
      if (!item) return;

      const newItem = { ...item };

      if (field === 'windowConfig') {
        newItem.windowConfig = value as WindowConfig;
      } else if (field === 'windowOperationConfig') {
        newItem.windowOperationConfig = value as RegisterItem['windowOperationConfig'];
      } else if (field === 'groupItemNames') {
        const itemNames = (value as string)
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name);
        newItem.groupItemNames = itemNames;
      } else {
        (newItem as Record<string, unknown>)[field] = value;
      }

      if (field === 'displayName' || field === 'path' || field === 'windowOperationConfig') {
        setErrors((prev) => {
          const newErrors = { ...prev };
          if (field === 'windowOperationConfig') {
            delete newErrors.displayName;
          } else {
            delete newErrors[field as keyof FormErrors];
          }
          return newErrors;
        });
      }

      setItem(newItem);
    },
    [item]
  );

  const handlePathBlur = useCallback(async () => {
    // クリップボードアイテムはpathを持たない
    if (!item || item.itemCategory === 'clipboard' || !item.path?.trim()) return;

    const newType = await detectItemType(item.path);
    setItem((prev) => (prev ? { ...prev, type: newType } : null));
  }, [item]);

  const validate = useCallback((): boolean => {
    if (!item) return false;

    const newErrors: FormErrors = {};

    if (!item.displayName.trim()) {
      newErrors.displayName =
        item.itemCategory === 'group'
          ? 'グループ名を入力してください'
          : 'アイテム表示名を入力してください';
    }

    if (
      item.itemCategory !== 'group' &&
      item.itemCategory !== 'window' &&
      item.itemCategory !== 'clipboard' &&
      !item.path?.trim()
    ) {
      newErrors.path = 'パスを入力してください';
    }

    if (item.itemCategory === 'group') {
      const itemNames = item.groupItemNames || [];
      if (itemNames.length === 0) {
        newErrors.groupItemNames = 'グループアイテムを追加してください';
      }
    }

    if (item.itemCategory === 'window') {
      const hasWindowTitle = item.windowOperationConfig?.windowTitle?.trim();
      const hasProcessName = item.windowOperationConfig?.processName?.trim();
      if (!hasWindowTitle && !hasProcessName) {
        newErrors.displayName = 'ウィンドウタイトルまたはプロセス名を入力してください';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [item]);

  const handleSave = useCallback(async () => {
    if (!item || !editingItem) return;

    if (!validate()) return;

    try {
      const updates = convertRegisterItemToWorkspaceItemUpdate(item);
      await onSave(editingItem.id, updates);
      onClose();
    } catch (error) {
      logError('Failed to save workspace item:', error);
    }
  }, [item, editingItem, validate, onSave, onClose]);

  const handleCancel = useCallback(() => {
    setItem(null);
    setErrors({});
    onClose();
  }, [onClose]);

  const handleAddGroupItem = useCallback(() => {
    setSelectorModalOpen(true);
  }, []);

  const handleSelectGroupItem = useCallback(
    (itemName: string) => {
      if (!item) return;

      const currentGroupItemNames = item.groupItemNames || [];
      setItem({
        ...item,
        groupItemNames: [...currentGroupItemNames, itemName],
      });

      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.groupItemNames;
        return newErrors;
      });
    },
    [item]
  );

  const handleRemoveGroupItem = useCallback(
    (groupItemNameIndex: number) => {
      if (!item) return;

      const currentGroupItemNames = item.groupItemNames || [];
      const updatedGroupItemNames = currentGroupItemNames.filter(
        (_, i) => i !== groupItemNameIndex
      );
      setItem({
        ...item,
        groupItemNames: updatedGroupItemNames,
      });
    },
    [item]
  );

  const updateItem = useCallback((updatedFields: Partial<RegisterItem>) => {
    setItem((prev) => (prev ? { ...prev, ...updatedFields } : null));
  }, []);

  return {
    item,
    loading,
    errors,
    selectorModalOpen,
    handleFieldChange,
    handlePathBlur,
    handleSave,
    handleCancel,
    handleAddGroupItem,
    handleSelectGroupItem,
    handleRemoveGroupItem,
    updateItem,
    setSelectorModalOpen,
  };
}
