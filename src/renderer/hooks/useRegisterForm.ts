import { useState, useEffect } from 'react';
import type {
  RegisterItem,
  EditingAppItem,
  EditableJsonItem,
  DataFileTab,
  WindowConfig,
  ClipboardFormat,
} from '@common/types';
import { detectItemType } from '@common/utils/itemTypeDetector';

import { debugInfo } from '../utils/debug';

import { useModalInitializer } from './useModalInitializer';
import { useToast } from './useToast';

const DEFAULT_DIR_OPTIONS: RegisterItem['dirOptions'] = {
  depth: 0,
  types: 'both',
  filter: undefined,
  exclude: undefined,
  prefix: undefined,
  suffix: undefined,
};

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
  const [items, setItems] = useState<RegisterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableTabs, setAvailableTabs] = useState<DataFileTab[]>([]);
  const [dataFileLabels, setDataFileLabels] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<{
    [index: number]: { displayName?: string; path?: string; groupItemNames?: string };
  }>({});
  const [selectorModalOpen, setSelectorModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
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
          showError(result.error || 'クリップボードデータの保存に失敗しました');
          return item;
        } catch (error) {
          debugInfo('クリップボードセッションのコミットに失敗:', error);
          showError('クリップボードデータの保存に失敗しました');
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
  ) => {
    const newItems = [...items];
    if (field === 'groupItemNames') {
      const itemNames = (value as string)
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name);
      newItems[index] = { ...newItems[index], groupItemNames: itemNames };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }

    if (field === 'displayName' || field === 'path' || field === 'windowOperationConfig') {
      clearErrorField(index, field === 'windowOperationConfig' ? 'displayName' : field);
    }

    if (field === 'itemCategory') {
      const item = newItems[index];
      const clearCommonFields = () => {
        delete item.folderProcessing;
        delete item.dirOptions;
        delete item.groupItemNames;
        delete item.windowOperationConfig;
      };
      const clearClipboardFields = () => {
        delete item.clipboardDataRef;
        delete item.clipboardFormats;
        delete item.clipboardSavedAt;
        delete item.clipboardPreview;
        delete item.clipboardSessionId;
      };

      switch (value) {
        case 'dir':
          item.folderProcessing = 'expand';
          item.dirOptions ??= { ...DEFAULT_DIR_OPTIONS };
          delete item.groupItemNames;
          break;
        case 'group':
          clearCommonFields();
          item.groupItemNames ??= [];
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
      newItems[index].dirOptions ??= { ...DEFAULT_DIR_OPTIONS };
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
        newErrors[i].displayName =
          item.itemCategory === 'group'
            ? 'グループ名を入力してください'
            : 'アイテム表示名を入力してください';
      }

      if (
        item.itemCategory !== 'group' &&
        item.itemCategory !== 'window' &&
        item.itemCategory !== 'clipboard' &&
        !item.path.trim()
      ) {
        newErrors[i].path = 'パスを入力してください';
      }

      if (item.itemCategory === 'group') {
        const itemNames = item.groupItemNames || [];
        if (itemNames.length === 0) {
          newErrors[i].groupItemNames = 'グループアイテムを追加してください';
        }
      }

      if (item.itemCategory === 'window') {
        const hasWindowTitle = item.windowOperationConfig?.windowTitle?.trim();
        const hasProcessName = item.windowOperationConfig?.processName?.trim();
        if (!hasWindowTitle && !hasProcessName) {
          newErrors[i].displayName = 'ウィンドウタイトルまたはプロセス名を入力してください';
        }
      }

      if (item.itemCategory === 'clipboard') {
        if (!item.clipboardSessionId && !item.clipboardDataRef) {
          newErrors[i].path = 'クリップボードをキャプチャしてください';
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

  const handleAddGroupItem = (index: number) => {
    setEditingItemIndex(index);
    setSelectorModalOpen(true);
  };

  const handleSelectGroupItem = (itemName: string) => {
    if (editingItemIndex === null) return;

    const currentGroupItemNames = items[editingItemIndex].groupItemNames || [];
    updateItem(editingItemIndex, { groupItemNames: [...currentGroupItemNames, itemName] });
    clearErrorField(editingItemIndex, 'groupItemNames');
  };

  const handleRemoveGroupItem = (itemIndex: number, groupItemNameIndex: number) => {
    const currentGroupItemNames = items[itemIndex].groupItemNames || [];
    updateItem(itemIndex, {
      groupItemNames: currentGroupItemNames.filter((_, i) => i !== groupItemNameIndex),
    });
  };

  const updateItem = (index: number, updatedFields: Partial<RegisterItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updatedFields };
    setItems(newItems);
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
      const icon =
        itemType === 'url'
          ? await window.electronAPI.fetchFavicon(item.path)
          : await window.electronAPI.getIconForItem(item.path, itemType);

      if (icon) {
        updateItem(index, { icon });
      } else {
        showWarning('アイコンを取得できませんでした');
      }
    } catch (error) {
      debugInfo(`アイコン取得エラー (index: ${index}):`, error);
      showError('アイコン取得中にエラーが発生しました');
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

  const addItemsFromPaths = async (paths: string[]) => {
    if (paths.length === 0) return;

    setLoading(true);
    try {
      const itemsWithIcons = await createItemsFromPaths(paths);
      setItems((prevItems) => [...prevItems, ...itemsWithIcons]);
      setIconFetchLoading((prev) => [...prev, ...itemsWithIcons.map(() => false)]);
    } catch (error) {
      debugInfo('ファイル追加エラー:', error);
      showError('ファイルの追加中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
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
      showError('ファイルの読み込み中にエラーが発生しました');
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
    selectorModalOpen,
    editingItemIndex,
    iconFetchLoading,
    handleItemChange,
    handlePathBlur,
    validateAndRegister,
    handleCancel,
    handleAddGroupItem,
    handleSelectGroupItem,
    handleRemoveGroupItem,
    updateItem,
    handleTargetTabChange,
    handleFetchIcon,
    setEditingItemIndex,
    setSelectorModalOpen,
    addItemsFromPaths,
    replaceFirstItemFromPath,
  };
}
