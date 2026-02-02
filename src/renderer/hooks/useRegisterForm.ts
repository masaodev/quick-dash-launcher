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

async function loadCachedIconsForItems(items: RegisterItem[]): Promise<Record<string, string>> {
  const itemsNeedingIcons = items.filter(
    (item) => !item.icon && item.path.trim() && item.type !== 'folder'
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
    if (field === 'dirOptions') {
      newItems[index] = { ...newItems[index], dirOptions: value as RegisterItem['dirOptions'] };
    } else if (field === 'windowConfig') {
      newItems[index] = { ...newItems[index], windowConfig: value as WindowConfig };
    } else if (field === 'windowOperationConfig') {
      newItems[index] = {
        ...newItems[index],
        windowOperationConfig: value as RegisterItem['windowOperationConfig'],
      };
    } else if (field === 'clipboardDataRef') {
      newItems[index] = { ...newItems[index], clipboardDataRef: value as string };
    } else if (field === 'clipboardFormats') {
      newItems[index] = { ...newItems[index], clipboardFormats: value as ClipboardFormat[] };
    } else if (field === 'clipboardSavedAt') {
      newItems[index] = { ...newItems[index], clipboardSavedAt: value as number };
    } else if (field === 'clipboardPreview') {
      newItems[index] = { ...newItems[index], clipboardPreview: value as string };
    } else if (field === 'groupItemNames') {
      const itemNames = (value as string)
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name);
      newItems[index] = { ...newItems[index], groupItemNames: itemNames };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }

    if (field === 'displayName' || field === 'path' || field === 'windowOperationConfig') {
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (newErrors[index]) {
          const updatedError = { ...newErrors[index] };
          if (field === 'windowOperationConfig') {
            delete updatedError.displayName;
          } else {
            delete updatedError[field];
          }
          newErrors[index] = updatedError;
        }
        return newErrors;
      });
    }

    if (field === 'itemCategory') {
      if (value === 'dir') {
        newItems[index].folderProcessing = 'expand';
        if (!newItems[index].dirOptions) {
          newItems[index].dirOptions = {
            depth: 0,
            types: 'both',
            filter: undefined,
            exclude: undefined,
            prefix: undefined,
            suffix: undefined,
          };
        }
        delete newItems[index].groupItemNames;
      } else if (value === 'group') {
        if (!newItems[index].groupItemNames) {
          newItems[index].groupItemNames = [];
        }
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
        delete newItems[index].windowOperationConfig;
      } else if (value === 'window') {
        if (!newItems[index].windowOperationConfig) {
          newItems[index].windowOperationConfig = { displayName: '', windowTitle: '' };
        }
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
        delete newItems[index].groupItemNames;
        delete newItems[index].clipboardDataRef;
        delete newItems[index].clipboardFormats;
        delete newItems[index].clipboardSavedAt;
        delete newItems[index].clipboardPreview;
      } else if (value === 'clipboard') {
        // クリップボードアイテムの場合、他のフィールドをクリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
        delete newItems[index].groupItemNames;
        delete newItems[index].windowOperationConfig;
        // pathは不要なのでクリア
        newItems[index].path = '';
        newItems[index].type = 'clipboard';
      } else {
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
        delete newItems[index].groupItemNames;
        delete newItems[index].windowOperationConfig;
        delete newItems[index].clipboardDataRef;
        delete newItems[index].clipboardFormats;
        delete newItems[index].clipboardSavedAt;
        delete newItems[index].clipboardPreview;
      }
    }

    setItems(newItems);
  };

  const handlePathBlur = async (index: number) => {
    const item = items[index];
    if (!item.path.trim()) {
      return;
    }

    const newType = await detectItemType(item.path);
    const newItems = [...items];
    newItems[index].type = newType;

    if (newType === 'folder') {
      if (!newItems[index].folderProcessing) {
        newItems[index].folderProcessing = 'folder';
      }
      if (!newItems[index].dirOptions) {
        newItems[index].dirOptions = {
          depth: 0,
          types: 'both',
          filter: undefined,
          exclude: undefined,
          prefix: undefined,
          suffix: undefined,
        };
      }
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

  const validateAndRegister = () => {
    const newErrors: typeof errors = {};

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      newErrors[i] = {};

      if (item.itemCategory !== 'dir' && !item.displayName.trim()) {
        newErrors[i].displayName =
          item.itemCategory === 'group'
            ? 'グループ名を入力してください'
            : item.itemCategory === 'window'
              ? 'アイテム表示名を入力してください'
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
        if (!item.clipboardDataRef) {
          newErrors[i].path = 'クリップボードをキャプチャしてください';
        }
      }
    }

    setErrors(newErrors);
    const hasErrors = Object.values(newErrors).some((e) =>
      Object.values(e).some((msg) => msg !== undefined)
    );

    if (hasErrors) {
      return;
    }

    onRegister(items);
    onClose();
  };

  const handleCancel = () => {
    setItems([]);
    onClose();
  };

  const handleAddGroupItem = (index: number) => {
    setEditingItemIndex(index);
    setSelectorModalOpen(true);
  };

  const handleSelectGroupItem = (itemName: string) => {
    if (editingItemIndex === null) return;

    const newItems = [...items];
    const currentGroupItemNames = newItems[editingItemIndex].groupItemNames || [];
    newItems[editingItemIndex] = {
      ...newItems[editingItemIndex],
      groupItemNames: [...currentGroupItemNames, itemName],
    };
    setItems(newItems);

    setErrors((prev) => {
      const newErrors = { ...prev };
      if (newErrors[editingItemIndex]) {
        const updatedError = { ...newErrors[editingItemIndex] };
        delete updatedError.groupItemNames;
        newErrors[editingItemIndex] = updatedError;
      }
      return newErrors;
    });
  };

  const handleRemoveGroupItem = (itemIndex: number, groupItemNameIndex: number) => {
    const newItems = [...items];
    const currentGroupItemNames = newItems[itemIndex].groupItemNames || [];
    const updatedGroupItemNames = currentGroupItemNames.filter((_, i) => i !== groupItemNameIndex);
    newItems[itemIndex] = {
      ...newItems[itemIndex],
      groupItemNames: updatedGroupItemNames,
    };
    setItems(newItems);
  };

  const updateItem = (index: number, updatedFields: Partial<RegisterItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updatedFields };
    setItems(newItems);
  };

  const handleTargetTabChange = (index: number, targetTab: string) => {
    const selectedTab = availableTabs.find((tab) => tab.files.includes(targetTab));

    const newItems = [...items];
    newItems[index] = { ...newItems[index], targetTab };

    if (selectedTab && selectedTab.files.length > 0) {
      newItems[index] = {
        ...newItems[index],
        targetFile: selectedTab.files[0],
      };
    }

    setItems(newItems);
  };

  const handleFetchIcon = async (index: number) => {
    const item = items[index];
    if (!item.path.trim() || item.type === 'folder' || item.type === 'clipboard') {
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

  // パスからアイテムを作成しキャッシュアイコンを適用する共通処理
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
