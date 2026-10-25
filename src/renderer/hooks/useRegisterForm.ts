import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import type {
  RegisterItem,
  EditingAppItem,
  EditableJsonItem,
  DataFileTab,
  WindowConfig,
  ClipboardFormat,
  SetEntry,
} from '@common/types';

import { debugInfo } from '../utils/debug';
import { applyItemCategoryChange } from '../utils/itemCategoryChange';
import {
  canFetchIcon,
  commitClipboardContent,
  discardClipboardSession,
  fetchItemIcon,
  loadCachedIconsForItems,
  resolvePathChange,
  validateItemForm,
} from '../utils/itemFormActions';

import { useModalInitializer } from './useModalInitializer';
import { useToast } from './useToast';

export function useRegisterForm(
  isOpen: boolean,
  editingItem: EditingAppItem | EditableJsonItem | null | undefined,
  droppedPaths: string[],
  currentTab: string | undefined,
  loadCustomIconPreview: (index: number, customIconFileName: string) => Promise<void>,
  onClose: () => void,
  onRegister: (items: RegisterItem[]) => void
) {
  const { t } = useTranslation();
  const [items, setItems] = useState<RegisterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableTabs, setAvailableTabs] = useState<DataFileTab[]>([]);
  const [dataFileLabels, setDataFileLabels] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<{
    [index: number]: { displayName?: string; path?: string; setEntries?: string };
  }>({});
  const [iconFetchLoading, setIconFetchLoading] = useState<boolean[]>([]);
  const { showWarning, showError } = useToast();

  const { initializeFromEditingItem, initializeFromDroppedPaths, createEmptyTemplateItem } =
    useModalInitializer();

  const clearErrorField = (index: number, field: string) => {
    setErrors((prev) => {
      if (!prev[index]) return prev;
      const updatedError = { ...prev[index] };
      delete updatedError[field as keyof typeof updatedError];
      return { ...prev, [index]: updatedError };
    });
  };

  /** クリップボードの中身を確定する。1 件でも失敗したら null */
  const commitClipboardSessions = async (
    itemsToCommit: RegisterItem[]
  ): Promise<RegisterItem[] | null> => {
    const results = await Promise.all(
      itemsToCommit.map((item) => commitClipboardContent(item, { showWarning, showError }, t))
    );
    return results.every((item): item is RegisterItem => item !== null) ? results : null;
  };

  useEffect(() => {
    if (!isOpen) {
      setItems([]);
      setErrors({});
      setLoading(false);
      setIconFetchLoading([]);
      return;
    }

    const loadAvailableTabsAndInitialize = async () => {
      const settings = await window.electronAPI.getSettings();
      setAvailableTabs(settings.dataFileTabs);
      setDataFileLabels(settings.dataFileLabels || {});
      setItems([]);
      setErrors({});

      let newItems: RegisterItem[] = [];

      if (editingItem) {
        debugInfo('RegisterModal opened in edit mode:', editingItem);
        setLoading(true);
        newItems = await initializeFromEditingItem(
          editingItem,
          settings.dataFileTabs,
          loadCustomIconPreview
        );
      } else if (droppedPaths && droppedPaths.length > 0) {
        debugInfo('RegisterModal opened with paths:', droppedPaths);
        setLoading(true);
        newItems = await initializeFromDroppedPaths(
          droppedPaths,
          currentTab,
          settings.dataFileTabs
        );
      } else {
        debugInfo('RegisterModal opened manually: creating empty template');
        newItems = createEmptyTemplateItem(currentTab, settings.dataFileTabs);
      }

      const cachedIcons = await loadCachedIconsForItems(newItems);
      const itemsWithIcons = newItems.map((item) =>
        cachedIcons[item.path] ? { ...item, icon: cachedIcons[item.path] } : item
      );

      setItems(itemsWithIcons);
      setIconFetchLoading(newItems.map(() => false));
      setLoading(false);
    };
    loadAvailableTabsAndInitialize();
  }, [isOpen, droppedPaths, editingItem, currentTab]);

  const handleItemChange = async (
    index: number,
    field: keyof RegisterItem,
    value:
      | string
      | boolean
      | number
      | RegisterItem['dirOptions']
      | WindowConfig
      | ClipboardFormat[]
      | SetEntry[]
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'displayName' || field === 'path') {
      clearErrorField(index, field);
    }

    if (field === 'itemCategory') {
      newItems[index] = applyItemCategoryChange(
        newItems[index],
        value as RegisterItem['itemCategory']
      );
    }

    setItems(newItems);
  };

  /** パス欄を離れたとき（または「選択」で選んだとき。pickedPath は選んだパスで、まだ items に入っていない）に種別を決め直す */
  const handlePathBlur = async (index: number, pickedPath?: string) => {
    const apply = await resolvePathChange(items[index], pickedPath);
    if (!apply) return;
    setItems((prev) => prev.map((item, i) => (i === index ? apply(item) : item)));
  };

  const validateAndRegister = async () => {
    const newErrors: typeof errors = {};

    items.forEach((item, i) => {
      newErrors[i] = validateItemForm(item, t);
    });

    setErrors(newErrors);
    const hasErrors = Object.values(newErrors).some((e) => Object.keys(e).length > 0);
    if (hasErrors) {
      return;
    }

    const finalItems = await commitClipboardSessions(items);
    if (!finalItems) {
      return;
    }

    // 保存に失敗して画面が残ったとき、保存し直しで同じクリップボードを二重に確定しないよう、
    // 確定した後の中身（データの参照）にしておく（RM7）
    setItems(finalItems);
    onRegister(finalItems);
    onClose();
  };

  const handleCancel = async () => {
    await Promise.all(items.map(discardClipboardSession));
    setItems([]);
    onClose();
  };

  const updateItem = (index: number, updatedFields: Partial<RegisterItem>) => {
    setItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], ...updatedFields };
      return newItems;
    });
    if (updatedFields.setEntries && updatedFields.setEntries.length > 0) {
      clearErrorField(index, 'setEntries');
    }
  };

  const handleTargetTabChange = (index: number, targetTab: string) => {
    const selectedTab = availableTabs.find((tab) => tab.files.includes(targetTab));
    const targetFile =
      selectedTab && selectedTab.files.length > 0 ? selectedTab.files[0] : items[index].targetFile;
    updateItem(index, { targetTab, targetFile });
  };

  const handleFetchIcon = async (index: number) => {
    const item = items[index];
    if (!canFetchIcon(item)) return;

    const setLoadingAt = (idx: number, value: boolean) =>
      setIconFetchLoading((prev) => prev.map((v, i) => (i === idx ? value : v)));

    setLoadingAt(index, true);
    const icon = await fetchItemIcon(item, { showWarning, showError }, t);
    if (icon) updateItem(index, { icon });
    setLoadingAt(index, false);
  };

  const createItemsFromPaths = async (paths: string[]): Promise<RegisterItem[]> => {
    const newItems = await initializeFromDroppedPaths(paths, currentTab, availableTabs);
    const cachedIcons = await loadCachedIconsForItems(newItems);
    return newItems.map((item) =>
      cachedIcons[item.path] ? { ...item, icon: cachedIcons[item.path] } : item
    );
  };

  const replaceFirstItemFromPath = async (path: string) => {
    setLoading(true);
    try {
      const itemsWithIcons = await createItemsFromPaths([path]);
      if (itemsWithIcons.length === 0) return;

      setItems((prevItems) => {
        const updated = [...prevItems];
        updated[0] = itemsWithIcons[0];
        return updated;
      });
      setErrors({});
    } catch (error) {
      debugInfo('ファイル置き換えエラー:', error);
      showError(t('register.errors.readFileError'));
    } finally {
      setLoading(false);
    }
  };

  return {
    items,
    loading,
    errors,
    availableTabs,
    dataFileLabels,
    iconFetchLoading,
    handleItemChange,
    handlePathBlur,
    validateAndRegister,
    handleCancel,
    updateItem,
    handleTargetTabChange,
    handleFetchIcon,
    replaceFirstItemFromPath,
  };
}
