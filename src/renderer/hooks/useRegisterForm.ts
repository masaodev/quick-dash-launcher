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
import { detectItemType } from '@common/utils/itemTypeDetector';
import { DIR_OPTIONS_DEFAULTS } from '@common/types';

import { debugInfo } from '../utils/debug';

import { useModalInitializer } from './useModalInitializer';
import { useToast } from './useToast';

async function loadCachedIconsForItems(items: RegisterItem[]): Promise<Record<string, string>> {
  const itemsNeedingIcons = items.filter(
    (item) => !item.icon && item.path?.trim() && item.type !== 'folder' && item.type !== 'clipboard'
  );
  if (itemsNeedingIcons.length === 0) {
    return {};
  }
  const launcherItems = itemsNeedingIcons.map((item) => ({
    path: item.path,
    type: item.type,
    displayName: item.displayName,
  }));
  return window.electronAPI.loadCachedIcons(launcherItems);
}

function needsClipboardCommit(item: RegisterItem): boolean {
  return item.itemCategory === 'clipboard' && !!item.clipboardSessionId;
}

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

  const commitClipboardSessions = async (
    itemsToCommit: RegisterItem[]
  ): Promise<RegisterItem[] | null> => {
    const results = await Promise.all(
      itemsToCommit.map(async (item) => {
        if (!needsClipboardCommit(item)) {
          return item;
        }

        try {
          const result = await window.electronAPI.clipboardAPI.commitSession(
            item.clipboardSessionId!
          );
          if (result.success && result.dataFileRef) {
            return {
              ...item,
              clipboardDataRef: result.dataFileRef,
              clipboardSavedAt: result.savedAt || item.clipboardSavedAt,
              clipboardSessionId: undefined,
            };
          }
          showError(result.error || t('register.errors.clipboardSaveFailed'));
          return item;
        } catch (error) {
          debugInfo('クリップボードセッションのコミットに失敗:', error);
          showError(t('register.errors.clipboardSaveFailed'));
          return item;
        }
      })
    );

    const hasCommitError = results.some(
      (item) => needsClipboardCommit(item) && !item.clipboardDataRef
    );
    return hasCommitError ? null : results;
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
      | RegisterItem['windowOperationConfig']
      | ClipboardFormat[]
      | SetEntry[]
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'displayName' || field === 'path' || field === 'windowOperationConfig') {
      clearErrorField(index, field === 'windowOperationConfig' ? 'displayName' : field);
    }

    if (field === 'itemCategory') {
      const item = newItems[index];
      const clearCommonFields = () => {
        delete item.folderProcessing;
        delete item.dirOptions;
        delete item.windowOperationConfig;
      };
      const clearClipboardFields = () => {
        // 未確定のキャプチャは使われなくなるので、メインプロセス側の保持も捨てる
        if (item.clipboardSessionId) {
          window.electronAPI.clipboardAPI
            .discardSession(item.clipboardSessionId)
            .catch((error) => debugInfo('クリップボードセッションの破棄に失敗:', error));
        }
        delete item.clipboardDataRef;
        delete item.clipboardFormats;
        delete item.clipboardSavedAt;
        delete item.clipboardPreview;
        delete item.clipboardSessionId;
      };

      switch (value) {
        case 'dir':
          item.folderProcessing = 'expand';
          item.dirOptions ??= { ...DIR_OPTIONS_DEFAULTS };
          clearClipboardFields();
          break;
        case 'set':
          clearCommonFields();
          clearClipboardFields();
          item.setEntries ??= [];
          break;
        case 'window':
          clearCommonFields();
          item.windowOperationConfig ??= { displayName: '', windowTitle: '' };
          clearClipboardFields();
          break;
        case 'clipboard':
          clearCommonFields();
          item.path = '';
          item.type = 'clipboard';
          break;
        default:
          clearCommonFields();
          clearClipboardFields();
          break;
      }
    }

    setItems(newItems);
  };

  const handlePathBlur = async (index: number) => {
    const item = items[index];
    if (item.itemCategory === 'clipboard' || !item.path?.trim()) {
      return;
    }

    const newType = await detectItemType(item.path);
    const newItems = [...items];
    newItems[index].type = newType;

    if (newType === 'folder') {
      newItems[index].folderProcessing ??= 'folder';
      newItems[index].dirOptions ??= { ...DIR_OPTIONS_DEFAULTS };
    } else {
      delete newItems[index].folderProcessing;
      delete newItems[index].dirOptions;

      const cachedIcons = await loadCachedIconsForItems([newItems[index]]);
      if (cachedIcons[item.path]) {
        newItems[index].icon = cachedIcons[item.path];
      }
    }

    setItems(newItems);
  };

  const validateAndRegister = async () => {
    const newErrors: typeof errors = {};

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      newErrors[i] = {};

      if (item.itemCategory !== 'dir' && !item.displayName.trim()) {
        newErrors[i].displayName = t('register.errors.displayNameRequired');
      }

      if (
        item.itemCategory !== 'set' &&
        item.itemCategory !== 'window' &&
        item.itemCategory !== 'clipboard' &&
        !item.path.trim()
      ) {
        newErrors[i].path = t('register.errors.pathRequired');
      }

      if (item.itemCategory === 'set' && (item.setEntries ?? []).length === 0) {
        newErrors[i].setEntries = t('set.editor.entriesRequired');
      }

      if (item.itemCategory === 'window') {
        const hasWindowTitle = item.windowOperationConfig?.windowTitle?.trim();
        const hasProcessName = item.windowOperationConfig?.processName?.trim();
        if (!hasWindowTitle && !hasProcessName) {
          newErrors[i].displayName = t('register.errors.windowRequired');
        }
      }

      if (item.itemCategory === 'clipboard') {
        if (!item.clipboardSessionId && !item.clipboardDataRef) {
          newErrors[i].path = t('register.errors.clipboardRequired');
        }
      }
    }

    setErrors(newErrors);
    const hasErrors = Object.values(newErrors).some((e) => Object.keys(e).length > 0);
    if (hasErrors) {
      return;
    }

    const finalItems = await commitClipboardSessions(items);
    if (!finalItems) {
      return;
    }

    onRegister(finalItems);
    onClose();
  };

  const handleCancel = async () => {
    for (const item of items) {
      if (item.clipboardSessionId) {
        try {
          await window.electronAPI.clipboardAPI.discardSession(item.clipboardSessionId);
          debugInfo('キャンセルによりクリップボードセッションを破棄:', item.clipboardSessionId);
        } catch (error) {
          debugInfo('クリップボードセッションの破棄に失敗:', error);
        }
      }
    }
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
    if (!item.path?.trim() || item.type === 'folder' || item.type === 'clipboard') {
      return;
    }

    const setLoadingAt = (idx: number, value: boolean) =>
      setIconFetchLoading((prev) => prev.map((v, i) => (i === idx ? value : v)));

    setLoadingAt(index, true);

    try {
      const itemType = item.type as 'url' | 'file' | 'app' | 'customUri';
      // urlのファビコン取得もgetIconForItem側に集約されている
      const icon = await window.electronAPI.getIconForItem(item.path, itemType);

      if (icon) {
        updateItem(index, { icon });
      } else {
        showWarning(t('register.errors.iconNotFound'));
      }
    } catch (error) {
      debugInfo(`アイコン取得エラー (index: ${index}):`, error);
      showError(t('register.errors.iconFetchError'));
    } finally {
      setLoadingAt(index, false);
    }
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
