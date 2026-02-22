import React, { useState, useEffect, useMemo } from 'react';
import {
  DEFAULT_DATA_FILE,
  SimpleBookmarkItem,
  ScannedAppItem,
  DataFileTab,
  DuplicateHandlingOption,
  isJsonLauncherItem,
  type RegisterItem,
} from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { jsonItemToDisplayText } from '@common/utils/displayTextConverter';
import { validateEditableItem } from '@common/types/editableItem';
import { convertRegisterItemToJsonItem } from '@common/utils/dataConverters';
import { generateId } from '@common/utils/jsonParser';
import {
  checkDuplicates,
  filterNonDuplicateBookmarks,
  buildUrlToIdMap,
  normalizeUrl,
} from '@common/utils/duplicateDetector';
import {
  checkAppDuplicates,
  filterNonDuplicateApps,
  buildAppPathToIdMap,
  normalizeAppPath,
} from '@common/utils/appDuplicateDetector';

/** EditableJsonItemの一意キーを生成 */
function getItemKey(item: EditableJsonItem): string {
  return `${item.meta.sourceFile}_${item.meta.lineNumber}`;
}

import { logError } from '../utils/debug';
import { useDropdown } from '../hooks/useDropdown';
import { useToast } from '../hooks/useToast';
import { useBookmarkAutoImport } from '../hooks/useBookmarkAutoImport';

import AdminItemManagerList from './AdminItemManagerList';
import RegisterModal from './RegisterModal';
import BookmarkImportModal from './BookmarkImportModal';
import AppImportModal from './AppImportModal';
import ConfirmDialog from './ConfirmDialog';
import { Button } from './ui/Button';

interface EditModeViewProps {
  editableItems: EditableJsonItem[];
  onEditableItemsSave: (editableItems: EditableJsonItem[]) => void;
  onExitEditMode: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dataFileTabs: DataFileTab[];
  dataFileLabels?: Record<string, string>;
  pendingImportModal: 'bookmark' | 'app' | null;
  onClearPendingImportModal: () => void;
}

const AdminItemManagerView: React.FC<EditModeViewProps> = ({
  editableItems,
  onEditableItemsSave,
  onExitEditMode,
  searchQuery,
  onSearchChange,
  dataFileTabs,
  dataFileLabels = {},
  pendingImportModal,
  onClearPendingImportModal,
}) => {
  const { showSuccess } = useToast();

  // データファイル名を取得（設定がない場合は物理ファイル名）
  const getFileLabel = (fileName: string): string => {
    return dataFileLabels[fileName] || fileName;
  };
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editedItems, setEditedItems] = useState<Map<string, EditableJsonItem>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableJsonItem | null>(null);
  const [workingItems, setWorkingItems] = useState<EditableJsonItem[]>(editableItems);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [isAppImportModalOpen, setIsAppImportModalOpen] = useState(false);

  // タブとファイル選択用の状態
  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(0);
  const [selectedDataFile, setSelectedDataFile] = useState<string>(DEFAULT_DATA_FILE);

  // 保存時の整列・重複削除チェックボックスの状態
  const [sortAndDedupChecked, setSortAndDedupChecked] = useState(true);

  // ConfirmDialog状態管理
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    title?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    showCheckbox?: boolean;
    checkboxLabel?: string;
    checkboxChecked?: boolean;
    onCheckboxChange?: (checked: boolean) => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });

  // 自動取込設定からルールマップを構築
  const { settings: autoImportSettings } = useBookmarkAutoImport();

  const autoImportRuleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const rule of autoImportSettings.rules) {
      map.set(rule.id, rule.name);
    }
    return map;
  }, [autoImportSettings.rules]);

  // 現在のデータファイルに関連するルールのみ抽出
  const currentFileRules = useMemo(
    () => autoImportSettings.rules.filter((rule) => rule.targetFile === selectedDataFile),
    [autoImportSettings.rules, selectedDataFile]
  );

  // 自動取込フィルタの状態
  type AutoImportFilter = 'all' | 'auto-import-only' | 'manual-only' | string;
  const [autoImportFilter, setAutoImportFilter] = useState<AutoImportFilter>('all');

  // ドロップダウン状態管理
  const tabDropdown = useDropdown();
  const fileDropdown = useDropdown();
  const importDropdown = useDropdown();
  const autoImportFilterDropdown = useDropdown();

  // 自動取込フィルタの表示テキストを取得
  const getAutoImportFilterLabel = (filter: AutoImportFilter): string => {
    switch (filter) {
      case 'all':
        return '取込元: 全て';
      case 'auto-import-only':
        return '取込元: 自動取込のみ';
      case 'manual-only':
        return '取込元: 手動登録のみ';
      default:
        return `取込元: ${autoImportRuleMap.get(filter) ?? '不明なルール'}`;
    }
  };

  // 自動取込フィルタの選択ハンドラ
  const handleAutoImportFilterSelect = (filter: AutoImportFilter): void => {
    setAutoImportFilter(filter);
    autoImportFilterDropdown.close();
  };

  const handleItemEdit = (editableItem: EditableJsonItem) => {
    const newEditedItems = new Map(editedItems);
    newEditedItems.set(getItemKey(editableItem), editableItem);
    setEditedItems(newEditedItems);
    setHasUnsavedChanges(true);
  };

  const handleEditItemClick = (editableItem: EditableJsonItem) => {
    setEditingItem(editableItem);
    setIsRegisterModalOpen(true);
  };

  const handleUpdateItem = (items: RegisterItem[]) => {
    if (editingItem && items.length > 0) {
      const updatedRegisterItem = items[0];

      // RegisterItemからJsonItemに変換（既存のIDを保持）
      const updatedJsonItem = convertRegisterItemToJsonItem(
        updatedRegisterItem,
        editingItem.item.id
      );

      // バリデーション
      const validation = validateEditableItem(updatedJsonItem);

      const updatedEditableItem: EditableJsonItem = {
        item: updatedJsonItem,
        displayText: jsonItemToDisplayText(updatedJsonItem),
        meta: {
          ...editingItem.meta,
          isValid: validation.isValid,
          validationError: validation.error,
        },
      };

      // 変更内容が異なる場合のみ編集として記録
      if (updatedEditableItem.displayText !== editingItem.displayText) {
        const newEditedItems = new Map(editedItems);
        newEditedItems.set(getItemKey(updatedEditableItem), updatedEditableItem);
        setEditedItems(newEditedItems);
        setHasUnsavedChanges(true);
      }
    }
    setIsRegisterModalOpen(false);
    setEditingItem(null);
  };

  const handleItemSelect = (editableItem: EditableJsonItem, selected: boolean) => {
    const key = getItemKey(editableItem);
    const newSelected = new Set(selectedItems);
    if (selected) {
      newSelected.add(key);
    } else {
      newSelected.delete(key);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedItems(new Set(filteredItems.map(getItemKey)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleDeleteItems = (itemsToDelete: EditableJsonItem[]) => {
    const updatedItems = workingItems.filter(
      (item) =>
        !itemsToDelete.some(
          (deleteThisItem) =>
            item.meta.sourceFile === deleteThisItem.meta.sourceFile &&
            item.meta.lineNumber === deleteThisItem.meta.lineNumber
        )
    );

    // 行番号を振り直し
    const reorderedItems = reorderItemNumbers(updatedItems);
    setWorkingItems(reorderedItems);
    setSelectedItems(new Set());
    setHasUnsavedChanges(true);
  };

  const handleDuplicateItems = (itemsToDuplicate: EditableJsonItem[]) => {
    // 1. 複製対象アイテムを行番号でソート（挿入位置を正しく計算するため）
    const sortedItems = [...itemsToDuplicate].sort((a, b) => a.meta.lineNumber - b.meta.lineNumber);

    // 2. 最後のアイテムの次に挿入する位置を特定
    const lastItem = sortedItems[sortedItems.length - 1];
    const insertAfterIndex = workingItems.findIndex(
      (item) =>
        item.meta.sourceFile === lastItem.meta.sourceFile &&
        item.meta.lineNumber === lastItem.meta.lineNumber
    );

    if (insertAfterIndex === -1) {
      logError('挿入位置の特定に失敗しました');
      return;
    }

    // 3. 複製アイテムを作成（行番号は仮の値を設定）
    const duplicatedItems = sortedItems.map((item) => ({
      ...item,
      item: { ...item.item, id: generateId(), updatedAt: Date.now() },
      meta: {
        ...item.meta,
        lineNumber: -1, // 後でreorderItemNumbersで振り直される
      },
    }));

    // 4. workingItemsに挿入
    const updatedItems = [
      ...workingItems.slice(0, insertAfterIndex + 1),
      ...duplicatedItems,
      ...workingItems.slice(insertAfterIndex + 1),
    ];

    // 5. 行番号を振り直し
    const reorderedItems = reorderItemNumbers(updatedItems);

    // 6. 状態を更新
    setWorkingItems(reorderedItems);
    setHasUnsavedChanges(true);

    // 7. 選択状態をクリア
    setSelectedItems(new Set());
  };

  const handleAddItem = () => {
    // 新しい空のアイテムを作成
    const newItem: EditableJsonItem = {
      item: {
        id: `temp-${Date.now()}`,
        type: 'item',
        displayName: '',
        path: '',
        updatedAt: Date.now(),
      },
      displayText: ',',
      meta: {
        sourceFile: selectedDataFile,
        lineNumber: 0,
        isValid: false,
        validationError: 'displayNameが空です',
      },
    };

    const updatedItems = [newItem, ...workingItems];
    const reorderedItems = reorderItemNumbers(updatedItems);
    setWorkingItems(reorderedItems);
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = () => {
    if (!hasUnsavedChanges) return;

    // チェックボックスをデフォルトでONにリセット
    setSortAndDedupChecked(true);

    // 保存時の確認ダイアログを表示
    setConfirmDialog({
      isOpen: true,
      message: '変更を保存しますか？',
      confirmText: '保存',
      showCheckbox: true,
      checkboxLabel: '整列・重複削除を実行',
      checkboxChecked: true,
      onCheckboxChange: (checked: boolean) => {
        setSortAndDedupChecked(checked);
        // confirmDialogの状態も更新
        setConfirmDialog((prev) => ({ ...prev, checkboxChecked: checked }));
      },
      onConfirm: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });

        // editedItemsの変更をworkingItemsに反映
        let updatedItems = workingItems.map((item) => {
          const editedItem = editedItems.get(getItemKey(item));
          if (editedItem) {
            return {
              ...editedItem,
              item: { ...editedItem.item, updatedAt: Date.now() },
            };
          }
          return item;
        });

        // チェックボックスがONの場合、整列・重複削除を実行
        if (sortAndDedupChecked) {
          // 現在選択中のデータファイルのアイテムのみフィルタリング
          const currentDataFileItems = updatedItems.filter(
            (item) => item.meta.sourceFile === selectedDataFile
          );

          // 他のデータファイルのアイテム
          const otherDataFileItems = updatedItems.filter(
            (item) => item.meta.sourceFile !== selectedDataFile
          );

          // 重複削除関数
          const removeDuplicates = (items: EditableJsonItem[]) => {
            const seen = new Set<string>();
            const deduplicated: EditableJsonItem[] = [];

            for (const item of items) {
              const key = `${item.item.type}:${item.displayText}`;
              if (!seen.has(key)) {
                seen.add(key);
                deduplicated.push(item);
              }
            }
            return deduplicated;
          };

          const getPathAndArgs = (item: EditableJsonItem) => {
            const jsonItem = item.item;
            switch (jsonItem.type) {
              case 'item': {
                const argsPart = jsonItem.args || '';
                return argsPart ? `${jsonItem.path || ''} ${argsPart}` : jsonItem.path || '';
              }
              case 'dir': {
                const options = jsonItem.options
                  ? Object.entries(jsonItem.options)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(',')
                  : '';
                return options ? `${jsonItem.path || ''} ${options}` : jsonItem.path || '';
              }
              case 'group':
              case 'window':
                return jsonItem.displayName || '';
              default:
                return '';
            }
          };

          // 現在のデータファイルのアイテムのみを整列
          const sortedItems = [...currentDataFileItems].sort((a, b) => {
            const typeOrder: Record<string, number> = {
              dir: 0,
              group: 1,
              window: 2,
              item: 3,
              clipboard: 4,
            };
            const typeA = typeOrder[a.item.type] ?? 99;
            const typeB = typeOrder[b.item.type] ?? 99;

            if (typeA !== typeB) {
              return typeA - typeB;
            }

            const pathAndArgsA = getPathAndArgs(a).toLowerCase();
            const pathAndArgsB = getPathAndArgs(b).toLowerCase();

            if (pathAndArgsA !== pathAndArgsB) {
              return pathAndArgsA.localeCompare(pathAndArgsB);
            }

            const nameA = a.item.type === 'item' ? (a.item.displayName || '').toLowerCase() : '';
            const nameB = b.item.type === 'item' ? (b.item.displayName || '').toLowerCase() : '';

            return nameA.localeCompare(nameB);
          });

          // 重複削除
          const deduplicatedItems = removeDuplicates(sortedItems);

          // 他のデータファイルのアイテムと結合
          updatedItems = [...otherDataFileItems, ...deduplicatedItems];
        }

        // 行番号を振り直して保存
        const reorderedItems = reorderItemNumbers(updatedItems);

        // 全件書き戻し
        onEditableItemsSave(reorderedItems);
        setEditedItems(new Map());
        setHasUnsavedChanges(false);
        setWorkingItems(reorderedItems);

        // 保存後、チェックボックスをリセット
        setSortAndDedupChecked(false);

        // 保存成功をトーストで通知
        showSuccess('変更を保存しました');
      },
      danger: false,
    });
  };

  // アイテム番号を振り直す関数
  const reorderItemNumbers = (items: EditableJsonItem[]): EditableJsonItem[] => {
    const fileCounters = new Map<string, number>();

    return items.map((item) => {
      const counter = fileCounters.get(item.meta.sourceFile) ?? 0;
      fileCounters.set(item.meta.sourceFile, counter + 1);
      return {
        ...item,
        meta: { ...item.meta, lineNumber: counter },
      };
    });
  };

  /** JsonItemからEditableJsonItemを生成する共通ヘルパー */
  const toEditableItem = (jsonItem: EditableJsonItem['item']): EditableJsonItem => {
    const validation = validateEditableItem(jsonItem);
    return {
      item: jsonItem,
      displayText: jsonItemToDisplayText(jsonItem),
      meta: {
        sourceFile: selectedDataFile,
        lineNumber: 0,
        isValid: validation.isValid,
        validationError: validation.error,
      },
    };
  };

  /** インポート共通: 重複ハンドリング後のworkingItemsを返す */
  const getUpdatedWorkingItems = (
    duplicateHandling: DuplicateHandlingOption,
    duplicateExistingIds: string[]
  ): EditableJsonItem[] => {
    if (duplicateHandling === 'overwrite') {
      const idsToRemove = new Set(duplicateExistingIds);
      return workingItems.filter((item) => !idsToRemove.has(item.item.id));
    }
    return [...workingItems];
  };

  /** インポート結果をworkingItemsに反映する共通処理 */
  const applyImport = (
    newItems: EditableJsonItem[],
    updatedWorkingItems: EditableJsonItem[],
    closeModal: () => void
  ) => {
    const reorderedItems = reorderItemNumbers([...newItems, ...updatedWorkingItems]);
    setWorkingItems(reorderedItems);
    setHasUnsavedChanges(true);
    closeModal();
  };

  const handleBookmarkImport = (
    bookmarks: SimpleBookmarkItem[],
    duplicateHandling: DuplicateHandlingOption
  ) => {
    const currentFileItems = workingItems.filter(
      (item) => item.meta.sourceFile === selectedDataFile
    );
    const duplicateResult = checkDuplicates(bookmarks, currentFileItems);

    const bookmarksToImport =
      duplicateHandling === 'skip'
        ? filterNonDuplicateBookmarks(bookmarks, duplicateResult.duplicateBookmarkIds)
        : bookmarks;

    const urlToIdMap = duplicateHandling === 'overwrite' ? buildUrlToIdMap(currentFileItems) : null;

    const newItems = bookmarksToImport.map((bookmark) => {
      const existingId = urlToIdMap?.get(normalizeUrl(bookmark.url));
      return toEditableItem({
        id: existingId ?? generateId(),
        type: 'item' as const,
        displayName: bookmark.displayName,
        path: bookmark.url,
        updatedAt: Date.now(),
      });
    });

    applyImport(
      newItems,
      getUpdatedWorkingItems(duplicateHandling, duplicateResult.duplicateExistingIds),
      () => setIsBookmarkModalOpen(false)
    );
  };

  const handleAppImport = (apps: ScannedAppItem[], duplicateHandling: DuplicateHandlingOption) => {
    const currentFileItems = workingItems.filter(
      (item) => item.meta.sourceFile === selectedDataFile
    );
    const duplicateResult = checkAppDuplicates(apps, currentFileItems);

    const appsToImport =
      duplicateHandling === 'skip'
        ? filterNonDuplicateApps(apps, duplicateResult.duplicateBookmarkIds)
        : apps;

    const pathToIdMap =
      duplicateHandling === 'overwrite' ? buildAppPathToIdMap(currentFileItems) : null;

    const newItems = appsToImport.map((app) => {
      const existingId =
        pathToIdMap?.get(normalizeAppPath(app.shortcutPath)) ??
        pathToIdMap?.get(normalizeAppPath(app.targetPath));
      const jsonItem = {
        id: existingId ?? generateId(),
        type: 'item' as const,
        displayName: app.displayName,
        path: app.shortcutPath,
        originalPath: app.targetPath,
        args: app.args,
        updatedAt: Date.now(),
      };
      const validation = validateEditableItem(jsonItem);
      return {
        item: jsonItem,
        displayText: jsonItemToDisplayText(jsonItem),
        meta: {
          sourceFile: selectedDataFile,
          lineNumber: 0,
          isValid: validation.isValid,
          validationError: validation.error,
        },
      };
    });

    applyImport(
      newItems,
      getUpdatedWorkingItems(duplicateHandling, duplicateResult.duplicateExistingIds),
      () => setIsAppImportModalOpen(false)
    );
  };

  // 未保存チェック付きアクション実行ヘルパー
  const confirmIfUnsaved = (message: string, action: () => void) => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        message,
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          action();
        },
        danger: true,
      });
    } else {
      action();
    }
  };

  const handleExitEditMode = () => {
    confirmIfUnsaved('未保存の変更があります。アイテム管理を終了しますか？', onExitEditMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleExitEditMode();
    } else if (e.key === 'Delete' && selectedItems.size > 0) {
      const selectedEditableItems = workingItems.filter((item) =>
        selectedItems.has(getItemKey(item))
      );
      handleDeleteItems(selectedEditableItems);
    } else if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSaveChanges();
    }
  };

  const mergedItems = workingItems.map((item) => editedItems.get(getItemKey(item)) || item);

  const discardAndSwitch = (action: () => void) => {
    action();
    setHasUnsavedChanges(false);
    setEditedItems(new Map());
  };

  // タブ変更時の未保存チェック
  const handleTabChange = (newTabIndex: number) => {
    confirmIfUnsaved(
      '未保存の変更があります。タブを切り替えると変更が失われます。続行しますか？',
      () => discardAndSwitch(() => setSelectedTabIndex(newTabIndex))
    );
  };

  // ファイル変更時の未保存チェック
  const handleFileChange = (newFile: string) => {
    confirmIfUnsaved(
      '未保存の変更があります。ファイルを切り替えると変更が失われます。続行しますか？',
      () => discardAndSwitch(() => setSelectedDataFile(newFile))
    );
  };

  // ドロップダウンメニューアイテムクリック時の処理
  const handleTabMenuItemClick = (newTabIndex: number) => {
    tabDropdown.close();
    handleTabChange(newTabIndex);
  };

  const handleFileMenuItemClick = (newFile: string) => {
    fileDropdown.close();
    handleFileChange(newFile);
  };

  const filteredItems = mergedItems.filter((item) => {
    // 選択されたデータファイルでフィルタリング
    if (item.meta.sourceFile !== selectedDataFile) return false;

    // 自動取込フィルタ
    if (autoImportFilter !== 'all') {
      const ruleId = isJsonLauncherItem(item.item) ? item.item.autoImportRuleId : undefined;

      if (autoImportFilter === 'auto-import-only') return !!ruleId;
      if (autoImportFilter === 'manual-only') return !ruleId;
      // 特定ルールIDでフィルタ
      if (ruleId !== autoImportFilter) return false;
    }

    // 検索クエリによるフィルタリング
    if (!searchQuery) return true;
    const keywords = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 0);
    const itemText = item.displayText.toLowerCase();
    return keywords.every((keyword) => itemText.includes(keyword));
  });

  const visibleSelectedCount = filteredItems.filter((item) =>
    selectedItems.has(getItemKey(item))
  ).length;

  // タブ変更時にファイルを自動選択
  useEffect(() => {
    if (dataFileTabs.length > 0 && selectedTabIndex < dataFileTabs.length) {
      const currentTab = dataFileTabs[selectedTabIndex];
      if (currentTab.files && currentTab.files.length > 0) {
        // タブの最初のファイルを選択
        setSelectedDataFile(currentTab.files[0]);
      }
    }
  }, [selectedTabIndex, dataFileTabs]);

  // ファイル変更時にフィルタをリセット
  useEffect(() => {
    setAutoImportFilter('all');
  }, [selectedDataFile]);

  // 初回マウント時のみ最初のタブを選択
  useEffect(() => {
    if (dataFileTabs.length > 0) {
      setSelectedTabIndex(0);
    }
  }, []);

  // メインウィンドウからのインポートモーダル表示リクエストを処理
  useEffect(() => {
    if (!pendingImportModal) return;

    switch (pendingImportModal) {
      case 'bookmark':
        setIsBookmarkModalOpen(true);
        break;
      case 'app':
        setIsAppImportModalOpen(true);
        break;
    }
    onClearPendingImportModal();
  }, [pendingImportModal]);

  // editableItemsが変更されたらworkingItemsも更新
  useEffect(() => {
    setWorkingItems(editableItems);
    setEditedItems(new Map());
    setHasUnsavedChanges(false);
  }, [editableItems]);

  // 検索クエリが変更されたら、非表示になったアイテムの選択状態をクリア
  useEffect(() => {
    const filteredKeys = new Set(filteredItems.map(getItemKey));
    setSelectedItems((prevSelected) => {
      const newSelectedItems = new Set([...prevSelected].filter((key) => filteredKeys.has(key)));

      // 変更があった場合のみ新しいSetを返す
      if (newSelectedItems.size !== prevSelected.size) {
        return newSelectedItems;
      }
      return prevSelected;
    });
  }, [searchQuery, workingItems]);

  // 現在選択されているタブの情報を取得
  const currentTab = dataFileTabs[selectedTabIndex];
  const currentTabFiles = currentTab?.files || [DEFAULT_DATA_FILE];

  // インポート先の表示テキストを生成
  const getImportDestination = (): string => {
    const tabName = currentTab?.name || '';
    if (currentTabFiles.length > 1) {
      return `${tabName} > ${getFileLabel(selectedDataFile)}`;
    }
    return tabName;
  };

  return (
    <div className="edit-mode-view" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="edit-mode-header">
        <div className="edit-mode-info">
          <div className="tab-dropdown" ref={tabDropdown.ref}>
            <label className="dropdown-label">タブ:</label>
            <button
              className="dropdown-trigger-btn"
              onClick={tabDropdown.toggle}
              title={currentTab?.name || 'タブ選択'}
            >
              <span className="dropdown-trigger-text">{currentTab?.name || 'タブ選択'}</span>
              <span className="dropdown-trigger-icon">{tabDropdown.isOpen ? '▲' : '▼'}</span>
            </button>
            {tabDropdown.isOpen && (
              <div className="dropdown-menu">
                {dataFileTabs.map((tab, index) => (
                  <button
                    key={index}
                    className={`dropdown-item ${selectedTabIndex === index ? 'selected' : ''}`}
                    onClick={() => handleTabMenuItemClick(index)}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {currentTabFiles.length > 1 && (
            <div className="file-dropdown" ref={fileDropdown.ref}>
              <label className="dropdown-label">データファイル:</label>
              <button
                className="dropdown-trigger-btn"
                onClick={fileDropdown.toggle}
                title={`${getFileLabel(selectedDataFile)} (${selectedDataFile})`}
              >
                <span className="dropdown-trigger-text">{getFileLabel(selectedDataFile)}</span>
                <span className="dropdown-trigger-icon">{fileDropdown.isOpen ? '▲' : '▼'}</span>
              </button>
              {fileDropdown.isOpen && (
                <div className="dropdown-menu">
                  {currentTabFiles.map((fileName) => (
                    <button
                      key={fileName}
                      className={`dropdown-item ${selectedDataFile === fileName ? 'selected' : ''}`}
                      onClick={() => handleFileMenuItemClick(fileName)}
                      title={fileName}
                    >
                      {getFileLabel(fileName)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="import-dropdown" ref={importDropdown.ref}>
            <button className="dropdown-trigger-btn" onClick={importDropdown.toggle}>
              <span className="dropdown-trigger-text">アイテムを一括取り込み</span>
              <span className="dropdown-trigger-icon">{importDropdown.isOpen ? '▲' : '▼'}</span>
            </button>
            {importDropdown.isOpen && (
              <div className="dropdown-menu">
                <button
                  className="dropdown-item"
                  onClick={() => {
                    importDropdown.close();
                    setIsBookmarkModalOpen(true);
                  }}
                >
                  ブラウザのブックマークを追加
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    importDropdown.close();
                    setIsAppImportModalOpen(true);
                  }}
                >
                  インストール済みアプリを追加
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ツールバーエリア */}
      <div className="edit-mode-toolbar">
        <div className="toolbar-left">
          <Button variant="info" onClick={handleAddItem}>
            ➕ 行を追加
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const selectedEditableItems = filteredItems.filter((item) =>
                selectedItems.has(getItemKey(item))
              );
              if (selectedEditableItems.length > 0) {
                setConfirmDialog({
                  isOpen: true,
                  message: `${selectedEditableItems.length}行を削除しますか？`,
                  onConfirm: () => {
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                    handleDeleteItems(selectedEditableItems);
                  },
                  danger: true,
                });
              }
            }}
            disabled={selectedItems.size === 0}
            title="選択されている行を削除します"
          >
            🗑️ 選択行を削除
          </Button>
          <div className="auto-import-filter" ref={autoImportFilterDropdown.ref}>
            <button
              className="dropdown-trigger-btn"
              onClick={autoImportFilterDropdown.toggle}
              title="自動取込フィルタ"
            >
              <span className="dropdown-trigger-text">
                {getAutoImportFilterLabel(autoImportFilter)}
              </span>
              <span className="dropdown-trigger-icon">
                {autoImportFilterDropdown.isOpen ? '▲' : '▼'}
              </span>
            </button>
            {autoImportFilterDropdown.isOpen && (
              <div className="dropdown-menu">
                {(
                  [
                    { value: 'all', label: '全て' },
                    { value: 'auto-import-only', label: '自動取込のみ' },
                    { value: 'manual-only', label: '手動登録のみ' },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    className={`dropdown-item ${autoImportFilter === value ? 'selected' : ''}`}
                    onClick={() => handleAutoImportFilterSelect(value)}
                  >
                    {label}
                  </button>
                ))}
                {currentFileRules.length > 0 && (
                  <>
                    <div className="dropdown-separator" />
                    {currentFileRules.map((rule) => (
                      <button
                        key={rule.id}
                        className={`dropdown-item ${autoImportFilter === rule.id ? 'selected' : ''}`}
                        onClick={() => handleAutoImportFilterSelect(rule.id)}
                      >
                        {rule.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="toolbar-search">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="行の内容を検索..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="search-clear-button"
                  onClick={() => onSearchChange('')}
                  type="button"
                  aria-label="検索をクリア"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="toolbar-right">
          <Button variant="primary" onClick={handleSaveChanges} disabled={!hasUnsavedChanges}>
            変更を保存
          </Button>
        </div>
      </div>

      <AdminItemManagerList
        editableItems={filteredItems}
        selectedItems={selectedItems}
        onItemEdit={handleItemEdit}
        onItemSelect={handleItemSelect}
        onSelectAll={handleSelectAll}
        onDeleteItems={handleDeleteItems}
        onEditClick={handleEditItemClick}
        onDuplicateItems={handleDuplicateItems}
        autoImportRuleMap={autoImportRuleMap}
      />

      <div className="edit-mode-status">
        <span className="selection-count">
          {visibleSelectedCount > 0 ? `${visibleSelectedCount}行を選択中` : ''}
        </span>
        <span className="total-count">合計: {filteredItems.length}行</span>
        {hasUnsavedChanges && <span className="unsaved-changes">未保存の変更があります</span>}
      </div>

      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setEditingItem(null);
        }}
        onRegister={handleUpdateItem}
        droppedPaths={[]}
        editingItem={editingItem}
      />

      <BookmarkImportModal
        isOpen={isBookmarkModalOpen}
        onClose={() => setIsBookmarkModalOpen(false)}
        onImport={handleBookmarkImport}
        existingItems={workingItems.filter((item) => item.meta.sourceFile === selectedDataFile)}
        importDestination={getImportDestination()}
      />

      <AppImportModal
        isOpen={isAppImportModalOpen}
        onClose={() => setIsAppImportModalOpen(false)}
        onImport={handleAppImport}
        existingItems={workingItems.filter((item) => item.meta.sourceFile === selectedDataFile)}
        importDestination={getImportDestination()}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        danger={confirmDialog.danger}
        showCheckbox={confirmDialog.showCheckbox}
        checkboxLabel={confirmDialog.checkboxLabel}
        checkboxChecked={confirmDialog.checkboxChecked}
        onCheckboxChange={confirmDialog.onCheckboxChange}
      />
    </div>
  );
};

export default AdminItemManagerView;
