import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceItem, WorkspaceItemUpdate, RegisterItem } from '@common/types';
import {
  workspaceItemToRegisterItem,
  registerItemToWorkspaceItemUpdate,
} from '@common/utils/workspaceConverters';
import { detectItemType } from '@common/utils/itemTypeDetector';

import type { ItemFieldValue } from '../../components/ItemEditFields';
import { logError } from '../../utils/debug';
import { useToast } from '../useToast';

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
  onSave: (id: string, updates: WorkspaceItemUpdate) => Promise<void>
) {
  const { t } = useTranslation();
  const [item, setItem] = useState<RegisterItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [selectorModalOpen, setSelectorModalOpen] = useState(false);
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

    let cancelled = false;

    if (editingItem) {
      setLoading(true);
      const registerItem = workspaceItemToRegisterItem(editingItem);
      setItem(registerItem);

      if (registerItem.customIcon) {
        loadCustomIconPreview(0, registerItem.customIcon).catch((err) => {
          logError('Failed to load custom icon preview:', err);
        });
      }

      // JSON保存時にアイコンが除去されるため、executablePathから再取得する
      const entries = registerItem.layoutEntries;
      if (registerItem.itemCategory === 'layout' && entries?.length) {
        const enrichLayoutIcons = async () => {
          const pathsToResolve = [
            ...new Set(
              entries.filter((e) => e.executablePath && !e.icon).map((e) => e.executablePath!)
            ),
          ];

          const iconMap = new Map<string, string | null>();
          await Promise.all(
            pathsToResolve.map(async (path) => {
              try {
                iconMap.set(path, await window.electronAPI.extractIcon(path));
              } catch {
                iconMap.set(path, null);
              }
            })
          );

          if (cancelled) return;
          const enrichedEntries = entries.map((entry) => {
            if (entry.executablePath && !entry.icon) {
              const icon = iconMap.get(entry.executablePath);
              return icon ? { ...entry, icon } : entry;
            }
            return entry;
          });
          setItem((prev) => (prev ? { ...prev, layoutEntries: enrichedEntries } : null));
        };
        enrichLayoutIcons().catch((err) => {
          logError('Failed to enrich layout entry icons:', err);
        });
      }

      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, editingItem, loadCustomIconPreview]);

  const handleFieldChange = useCallback(
    (field: keyof RegisterItem, value: ItemFieldValue) => {
      if (!item) return;

      let newItem: RegisterItem;

      if (field === 'groupItemNames') {
        const itemNames = (value as string)
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name);
        newItem = { ...item, groupItemNames: itemNames };
      } else {
        newItem = { ...item, [field]: value };
      }

      if (field === 'displayName' || field === 'path' || field === 'windowOperationConfig') {
        clearErrorField(field === 'windowOperationConfig' ? 'displayName' : field);
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
          ? t('register.errors.groupNameRequired')
          : t('register.errors.displayNameRequired');
    }

    if (
      item.itemCategory !== 'group' &&
      item.itemCategory !== 'window' &&
      item.itemCategory !== 'clipboard' &&
      item.itemCategory !== 'layout' &&
      !item.path?.trim()
    ) {
      newErrors.path = t('register.errors.pathRequired');
    }

    if (item.itemCategory === 'group') {
      const itemNames = item.groupItemNames || [];
      if (itemNames.length === 0) {
        newErrors.groupItemNames = t('register.errors.groupItemsRequired');
      }
    }

    if (item.itemCategory === 'window') {
      const hasWindowTitle = item.windowOperationConfig?.windowTitle?.trim();
      const hasProcessName = item.windowOperationConfig?.processName?.trim();
      if (!hasWindowTitle && !hasProcessName) {
        newErrors.displayName = t('register.errors.windowRequired');
      }
    }

    if (item.itemCategory === 'clipboard' && !item.clipboardSessionId && !item.clipboardDataRef) {
      newErrors.path = t('register.errors.clipboardRequired');
    }

    // 登録画面と同じく、ウィンドウが 1 つも無いレイアウトは保存させない
    if (item.itemCategory === 'layout' && !item.layoutEntries?.length) {
      newErrors.path = t('register.errors.layoutRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [item, t]);

  /** クリップボードを取り直していたら、取り込んだ中身をファイルに確定する。失敗したら null */
  const commitClipboardSession = useCallback(
    async (target: RegisterItem): Promise<RegisterItem | null> => {
      if (target.itemCategory !== 'clipboard' || !target.clipboardSessionId) return target;
      try {
        const result = await window.electronAPI.clipboardAPI.commitSession(
          target.clipboardSessionId
        );
        if (result.success && result.dataFileRef) {
          return {
            ...target,
            clipboardDataRef: result.dataFileRef,
            clipboardSavedAt: result.savedAt || target.clipboardSavedAt,
            clipboardSessionId: undefined,
          };
        }
        showError(result.error || t('register.errors.clipboardSaveFailed'));
      } catch (error) {
        logError('Failed to commit clipboard session:', error);
        showError(t('register.errors.clipboardSaveFailed'));
      }
      return null;
    },
    [showError, t]
  );

  // 失敗したときは画面を開いたままにして、直してもう一度保存できるようにする
  const handleSave = useCallback(async () => {
    if (!item || !editingItem) return;

    if (!validate()) return;

    const committed = await commitClipboardSession(item);
    if (!committed) return;
    if (committed !== item) setItem(committed);

    try {
      const updates = registerItemToWorkspaceItemUpdate(committed);
      await onSave(editingItem.id, updates);
      onClose();
    } catch (error) {
      logError('Failed to save workspace item:', error);
      showError(t('workspace.edit.updateFailed'));
    }
  }, [item, editingItem, validate, commitClipboardSession, onSave, onClose, showError, t]);

  const discardClipboardSession = useCallback(async () => {
    if (!item?.clipboardSessionId) return;
    try {
      await window.electronAPI.clipboardAPI.discardSession(item.clipboardSessionId);
    } catch (error) {
      logError('Failed to discard clipboard session:', error);
    }
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
    if (!item || !item.path?.trim() || item.type === 'folder' || item.type === 'clipboard') return;

    setIconFetchLoading(true);
    try {
      // 取得したアイコンは icon-cache に入り、ワークスペースは読み直すときにそこから引く
      const icon = await window.electronAPI.getIconForItem(item.path, item.type);
      if (icon) {
        setItem((prev) => (prev ? { ...prev, icon } : null));
      } else {
        showWarning(t('register.errors.iconNotFound'));
      }
    } catch (error) {
      logError('Failed to fetch icon:', error);
      showError(t('register.errors.iconFetchError'));
    } finally {
      setIconFetchLoading(false);
    }
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

      clearErrorField('groupItemNames');
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
    iconFetchLoading,
    handleFieldChange,
    handlePathBlur,
    handleSave,
    handleCancel,
    handleDelete,
    handleFetchIcon,
    replacePathFromDrop,
    handleAddGroupItem,
    handleSelectGroupItem,
    handleRemoveGroupItem,
    updateItem,
    setSelectorModalOpen,
  };
}
