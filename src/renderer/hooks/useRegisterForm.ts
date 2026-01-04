import { useState, useEffect } from 'react';
import { type RegisterItem } from '@common/utils/dataConverters';
import { detectItemType } from '@common/utils/itemTypeDetector';
import { RawDataLine, DataFileTab, WindowConfig } from '@common/types';

import { debugInfo } from '../utils/debug';

import { useModalInitializer } from './useModalInitializer';

/**
 * RegisterModalのフォーム状態管理フック
 *
 * アイテムの状態管理、バリデーション、操作を一元管理します。
 */
export function useRegisterForm(
  isOpen: boolean,
  editingItem: RawDataLine | null | undefined,
  droppedPaths: string[],
  currentTab: string | undefined,
  loadCustomIconPreview: (index: number, customIconFileName: string) => Promise<void>,
  onClose: () => void,
  onRegister: (items: RegisterItem[]) => void
) {
  const [items, setItems] = useState<RegisterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableTabs, setAvailableTabs] = useState<DataFileTab[]>([]);
  const [errors, setErrors] = useState<{
    [index: number]: { name?: string; path?: string; groupItemNames?: string };
  }>({});
  const [selectorModalOpen, setSelectorModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // モーダル初期化フック
  const { initializeFromEditingItem, initializeFromDroppedPaths, createEmptyTemplateItem } =
    useModalInitializer();

  /**
   * モーダルが開かれたときの初期化処理
   */
  useEffect(() => {
    if (!isOpen) {
      // モーダルが閉じられたときのクリーンアップ
      setItems([]);
      setErrors({});
      setLoading(false);
      return;
    }

    // 設定からタブ一覧を取得してから、アイテムを初期化
    const loadAvailableTabsAndInitialize = async () => {
      const settings = await window.electronAPI.getSettings();
      setAvailableTabs(settings.dataFileTabs);

      // モーダルが開いたとき、まず前回の状態をクリア
      setItems([]);
      setErrors({});

      if (editingItem) {
        debugInfo('RegisterModal opened in edit mode:', editingItem);
        setLoading(true);
        const items = await initializeFromEditingItem(
          editingItem,
          settings.dataFileTabs,
          loadCustomIconPreview
        );
        setItems(items);
        setLoading(false);
      } else if (droppedPaths && droppedPaths.length > 0) {
        debugInfo('RegisterModal opened with paths:', droppedPaths);
        setLoading(true);
        const items = await initializeFromDroppedPaths(
          droppedPaths,
          currentTab,
          settings.dataFileTabs
        );
        setItems(items);
        setLoading(false);
      } else {
        // ボタンから開かれた場合：空のテンプレートアイテムを1つ作成
        debugInfo('RegisterModal opened manually: creating empty template');
        const items = createEmptyTemplateItem(currentTab, settings.dataFileTabs);
        setItems(items);
      }
    };
    loadAvailableTabsAndInitialize();
  }, [isOpen, droppedPaths, editingItem, currentTab]);

  /**
   * アイテムの値を変更
   */
  const handleItemChange = async (
    index: number,
    field: keyof RegisterItem,
    value:
      | string
      | boolean
      | RegisterItem['dirOptions']
      | WindowConfig
      | RegisterItem['windowOperationConfig']
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
    } else if (field === 'groupItemNames') {
      // groupItemNamesの場合は文字列をパース
      const itemNames = (value as string)
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name);
      newItems[index] = { ...newItems[index], groupItemNames: itemNames };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }

    // 入力変更時に該当フィールドのエラーをクリア
    if (field === 'name' || field === 'path' || field === 'windowOperationConfig') {
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (newErrors[index]) {
          const updatedError = { ...newErrors[index] };
          if (field === 'windowOperationConfig') {
            // windowOperationConfigの場合はnameエラーをクリア
            delete updatedError.name;
          } else {
            delete updatedError[field];
          }
          newErrors[index] = updatedError;
        }
        return newErrors;
      });
    }

    // アイテム種別が変更された場合の処理
    if (field === 'itemCategory') {
      if (value === 'dir') {
        // フォルダ取込選択時：フォルダ処理を展開に設定し、フォルダ取込アイテムオプションを初期化
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
        // グループオプションをクリア
        delete newItems[index].groupItemNames;
      } else if (value === 'group') {
        // グループ選択時：グループアイテムオプションを初期化
        if (!newItems[index].groupItemNames) {
          newItems[index].groupItemNames = [];
        }
        // フォルダ取込オプションをクリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
        // ウィンドウ操作オプションをクリア
        delete newItems[index].windowOperationConfig;
      } else if (value === 'window') {
        // ウィンドウ操作選択時：ウィンドウ操作オプションを初期化
        if (!newItems[index].windowOperationConfig) {
          newItems[index].windowOperationConfig = { windowTitle: '' };
        }
        // その他のオプションをクリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
        delete newItems[index].groupItemNames;
      } else {
        // 単一アイテム選択時：すべてクリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
        delete newItems[index].groupItemNames;
        delete newItems[index].windowOperationConfig;
      }
    }

    // パスが変更された場合、アイテムタイプを再検出
    if (field === 'path' && (value as string).trim()) {
      const newType = await detectItemType(value as string);
      newItems[index].type = newType;

      // タイプに応じてデフォルト値を設定
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
        // フォルダでない場合はフォルダ関連の設定をクリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
      }
    }

    setItems(newItems);
  };

  /**
   * バリデーションを実行して登録
   */
  const validateAndRegister = () => {
    // バリデーション：名前とパスの必須チェック
    const newErrors: typeof errors = {};

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      newErrors[i] = {};

      // フォルダ取込以外は名前が必須
      if (item.itemCategory !== 'dir' && !item.name.trim()) {
        newErrors[i].name =
          item.itemCategory === 'group'
            ? 'グループ名を入力してください'
            : item.itemCategory === 'window'
              ? '表示名を入力してください'
              : '名前を入力してください';
      }

      // グループ・ウィンドウ操作以外はパスが必須
      if (item.itemCategory !== 'group' && item.itemCategory !== 'window' && !item.path.trim()) {
        newErrors[i].path = 'パスを入力してください';
      }

      // グループの場合はアイテム名リストが必須
      if (item.itemCategory === 'group') {
        const itemNames = item.groupItemNames || [];
        if (itemNames.length === 0) {
          newErrors[i].groupItemNames = 'グループアイテムを追加してください';
        }
      }

      // ウィンドウ操作の場合はウィンドウタイトルまたはプロセス名が必須
      if (item.itemCategory === 'window') {
        const hasWindowTitle = item.windowOperationConfig?.windowTitle?.trim();
        const hasProcessName = item.windowOperationConfig?.processName?.trim();
        if (!hasWindowTitle && !hasProcessName) {
          newErrors[i].name = 'ウィンドウタイトルまたはプロセス名を入力してください';
        }
      }
    }

    // エラーがある場合は登録しない
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

  /**
   * キャンセル処理
   */
  const handleCancel = () => {
    setItems([]);
    onClose();
  };

  /**
   * グループアイテム追加ボタンのクリック
   */
  const handleAddGroupItem = (index: number) => {
    setEditingItemIndex(index);
    setSelectorModalOpen(true);
  };

  /**
   * グループアイテム選択時の処理
   */
  const handleSelectGroupItem = (itemName: string) => {
    if (editingItemIndex === null) return;

    const newItems = [...items];
    const currentGroupItemNames = newItems[editingItemIndex].groupItemNames || [];
    newItems[editingItemIndex] = {
      ...newItems[editingItemIndex],
      groupItemNames: [...currentGroupItemNames, itemName],
    };
    setItems(newItems);

    // エラーをクリア
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

  /**
   * グループアイテムを削除
   */
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

  /**
   * アイテムリストを直接更新（カスタムアイコン選択時など）
   */
  const updateItem = (index: number, updatedFields: Partial<RegisterItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updatedFields };
    setItems(newItems);
  };

  /**
   * 保存先タブ変更時の処理
   */
  const handleTargetTabChange = (index: number, targetTab: string) => {
    const selectedTab = availableTabs.find((tab) => tab.files.includes(targetTab));

    const newItems = [...items];
    newItems[index] = { ...newItems[index], targetTab };

    // タブに複数ファイルがある場合、最初のファイルを設定
    if (selectedTab && selectedTab.files.length > 0) {
      newItems[index] = {
        ...newItems[index],
        targetFile: selectedTab.files[0],
      };
    }

    setItems(newItems);
  };

  return {
    items,
    loading,
    errors,
    availableTabs,
    selectorModalOpen,
    editingItemIndex,
    handleItemChange,
    validateAndRegister,
    handleCancel,
    handleAddGroupItem,
    handleSelectGroupItem,
    handleRemoveGroupItem,
    updateItem,
    handleTargetTabChange,
    setEditingItemIndex,
    setSelectorModalOpen,
  };
}
