import React, { useState, useEffect } from 'react';
import {
  DEFAULT_DATA_FILE,
  SimpleBookmarkItem,
  ScannedAppItem,
  DataFileTab,
  DuplicateHandlingOption,
} from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import type { RegisterItem } from '@common/types';
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

import { logError } from '../utils/debug';
import { useDropdown } from '../hooks/useDropdown';
import { useToast } from '../hooks/useToast';

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
}

const AdminItemManagerView: React.FC<EditModeViewProps> = ({
  editableItems,
  onEditableItemsSave,
  onExitEditMode,
  searchQuery,
  onSearchChange,
  dataFileTabs,
  dataFileLabels = {},
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
    danger: false,
    showCheckbox: false,
    checkboxLabel: '',
    checkboxChecked: false,
  });

  // ドロップダウン状態管理
  const tabDropdown = useDropdown();
  const fileDropdown = useDropdown();
  const importDropdown = useDropdown();

  const handleItemEdit = (editableItem: EditableJsonItem) => {
    const itemKey = `${editableItem.meta.sourceFile}_${editableItem.meta.lineNumber}`;
    const newEditedItems = new Map(editedItems);
    newEditedItems.set(itemKey, editableItem);
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
        const itemKey = `${updatedEditableItem.meta.sourceFile}_${updatedEditableItem.meta.lineNumber}`;
        const newEditedItems = new Map(editedItems);
        newEditedItems.set(itemKey, updatedEditableItem);
        setEditedItems(newEditedItems);
        setHasUnsavedChanges(true);
      }
    }
    setIsRegisterModalOpen(false);
    setEditingItem(null);
  };

  const handleItemSelect = (editableItem: EditableJsonItem, selected: boolean) => {
    const itemKey = `${editableItem.meta.sourceFile}_${editableItem.meta.lineNumber}`;
    const newSelected = new Set(selectedItems);
    if (selected) {
      newSelected.add(itemKey);
    } else {
      newSelected.delete(itemKey);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const visibleItems = new Set(
        filteredItems.map((item) => `${item.meta.sourceFile}_${item.meta.lineNumber}`)
      );
      setSelectedItems(visibleItems);
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
          const itemKey = `${item.meta.sourceFile}_${item.meta.lineNumber}`;
          const editedItem = editedItems.get(itemKey);
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
            if (jsonItem.type === 'item') {
              const pathPart = jsonItem.path || '';
              const argsPart = jsonItem.args || '';
              return argsPart ? `${pathPart} ${argsPart}` : pathPart;
            } else if (jsonItem.type === 'dir') {
              const pathPart = jsonItem.path || '';
              const options = jsonItem.options
                ? Object.entries(jsonItem.options)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(',')
                : '';
              return options ? `${pathPart} ${options}` : pathPart;
            } else if (jsonItem.type === 'group') {
              return jsonItem.displayName || '';
            } else if (jsonItem.type === 'window') {
              return jsonItem.displayName || '';
            }
            return '';
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
    const fileGroups = new Map<string, EditableJsonItem[]>();

    // ファイル別にグループ化
    items.forEach((item) => {
      if (!fileGroups.has(item.meta.sourceFile)) {
        fileGroups.set(item.meta.sourceFile, []);
      }
      const group = fileGroups.get(item.meta.sourceFile);
      if (!group) {
        throw new Error(`Failed to get file group for: ${item.meta.sourceFile}`);
      }
      group.push(item);
    });

    // 各ファイル内で行番号を振り直し
    const reorderedItems: EditableJsonItem[] = [];
    for (const [, fileItems] of fileGroups) {
      fileItems.forEach((item, index) => {
        reorderedItems.push({
          ...item,
          meta: {
            ...item.meta,
            lineNumber: index,
          },
        });
      });
    }

    return reorderedItems;
  };

  const handleBookmarkImport = (
    bookmarks: SimpleBookmarkItem[],
    duplicateHandling: DuplicateHandlingOption
  ) => {
    // 現在のデータファイルのアイテムのみを対象に重複チェック
    const currentFileItems = workingItems.filter(
      (item) => item.meta.sourceFile === selectedDataFile
    );
    const duplicateResult = checkDuplicates(bookmarks, currentFileItems);

    // スキップ: 重複を除いた新規ブックマークのみ / 上書き: 全ブックマークをインポート
    const bookmarksToImport =
      duplicateHandling === 'skip'
        ? filterNonDuplicateBookmarks(bookmarks, duplicateResult.duplicateBookmarkIds)
        : bookmarks;

    // 上書きモードの場合、重複する既存アイテムを削除
    const updatedWorkingItems =
      duplicateHandling === 'overwrite'
        ? workingItems.filter(
            (item) => !new Set(duplicateResult.duplicateExistingIds).has(item.item.id)
          )
        : [...workingItems];

    // 上書きモード用のURL->IDマッピング
    const urlToIdMap = duplicateHandling === 'overwrite' ? buildUrlToIdMap(currentFileItems) : null;

    // 新規アイテムを作成
    const newItems: EditableJsonItem[] = bookmarksToImport.map((bookmark) => {
      // 上書きモードの場合、既存アイテムのIDを再利用
      const existingId = urlToIdMap?.get(normalizeUrl(bookmark.url));
      const itemId = existingId ?? generateId();

      const jsonItem = {
        id: itemId,
        type: 'item' as const,
        displayName: bookmark.displayName,
        path: bookmark.url,
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

    const finalItems = [...newItems, ...updatedWorkingItems];
    const reorderedItems = reorderItemNumbers(finalItems);
    setWorkingItems(reorderedItems);
    setHasUnsavedChanges(true);
    setIsBookmarkModalOpen(false);
  };

  const handleAppImport = (apps: ScannedAppItem[], duplicateHandling: DuplicateHandlingOption) => {
    // 現在のデータファイルのアイテムのみを対象に重複チェック
    const currentFileItems = workingItems.filter(
      (item) => item.meta.sourceFile === selectedDataFile
    );
    const duplicateResult = checkAppDuplicates(apps, currentFileItems);

    // スキップ: 重複を除いた新規アプリのみ / 上書き: 全アプリをインポート
    const appsToImport =
      duplicateHandling === 'skip'
        ? filterNonDuplicateApps(apps, duplicateResult.duplicateBookmarkIds)
        : apps;

    // 上書きモードの場合、重複する既存アイテムを削除
    const updatedWorkingItems =
      duplicateHandling === 'overwrite'
        ? workingItems.filter(
            (item) => !new Set(duplicateResult.duplicateExistingIds).has(item.item.id)
          )
        : [...workingItems];

    // 上書きモード用のパス->IDマッピング
    const pathToIdMap =
      duplicateHandling === 'overwrite' ? buildAppPathToIdMap(currentFileItems) : null;

    // 新規アイテムを作成
    const newItems: EditableJsonItem[] = appsToImport.map((app) => {
      // 上書きモードの場合、既存アイテムのIDを再利用
      const existingId =
        pathToIdMap?.get(normalizeAppPath(app.shortcutPath)) ??
        pathToIdMap?.get(normalizeAppPath(app.targetPath));
      const itemId = existingId ?? generateId();

      const jsonItem = {
        id: itemId,
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

    const finalItems = [...newItems, ...updatedWorkingItems];
    const reorderedItems = reorderItemNumbers(finalItems);
    setWorkingItems(reorderedItems);
    setHasUnsavedChanges(true);
    setIsAppImportModalOpen(false);
  };

  const handleExitEditMode = () => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        message: '未保存の変更があります。アイテム管理を終了しますか？',
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          onExitEditMode();
        },
        danger: true,
      });
    } else {
      onExitEditMode();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleExitEditMode();
    } else if (e.key === 'Delete' && selectedItems.size > 0) {
      const selectedEditableItems = workingItems.filter((item) =>
        selectedItems.has(`${item.meta.sourceFile}_${item.meta.lineNumber}`)
      );
      handleDeleteItems(selectedEditableItems);
    } else if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSaveChanges();
    }
  };

  const mergedItems = workingItems.map((item) => {
    const itemKey = `${item.meta.sourceFile}_${item.meta.lineNumber}`;
    const editedItem = editedItems.get(itemKey);
    return editedItem || item;
  });

  // タブ変更時の未保存チェック
  const handleTabChange = (newTabIndex: number) => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        message: '未保存の変更があります。タブを切り替えると変更が失われます。続行しますか？',
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          setSelectedTabIndex(newTabIndex);
          setHasUnsavedChanges(false);
          setEditedItems(new Map());
        },
        danger: true,
      });
    } else {
      setSelectedTabIndex(newTabIndex);
    }
  };

  // ファイル変更時の未保存チェック
  const handleFileChange = (newFile: string) => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        message: '未保存の変更があります。ファイルを切り替えると変更が失われます。続行しますか？',
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          setSelectedDataFile(newFile);
          setHasUnsavedChanges(false);
          setEditedItems(new Map());
        },
        danger: true,
      });
    } else {
      setSelectedDataFile(newFile);
    }
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

    // 検索クエリによるフィルタリング
    if (!searchQuery) return true;
    const keywords = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 0);
    const itemText = item.displayText.toLowerCase();
    return keywords.every((keyword) => itemText.includes(keyword));
  });

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

  // 初回マウント時のみ最初のタブを選択
  useEffect(() => {
    if (dataFileTabs.length > 0) {
      setSelectedTabIndex(0);
    }
  }, []);

  // editableItemsが変更されたらworkingItemsも更新
  useEffect(() => {
    setWorkingItems(editableItems);
    setEditedItems(new Map());
    setHasUnsavedChanges(false);
  }, [editableItems]);

  // 検索クエリが変更されたら、非表示になったアイテムの選択状態をクリア
  useEffect(() => {
    const filteredKeys = new Set(
      filteredItems.map((item) => `${item.meta.sourceFile}_${item.meta.lineNumber}`)
    );
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
        </div>
        <div className="import-dropdown" ref={importDropdown.ref}>
          <button className="dropdown-trigger-btn" onClick={importDropdown.toggle}>
            <span className="dropdown-trigger-text">インポート</span>
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
                ブラウザブックマークをインポート
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  importDropdown.close();
                  setIsAppImportModalOpen(true);
                }}
              >
                アプリをインポート
              </button>
            </div>
          )}
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
              const selectedEditableItems = filteredItems.filter((item) => {
                const itemKey = `${item.meta.sourceFile}_${item.meta.lineNumber}`;
                return selectedItems.has(itemKey);
              });
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
      />

      <div className="edit-mode-status">
        <span className="selection-count">
          {(() => {
            const visibleSelectedCount = filteredItems.filter((item) =>
              selectedItems.has(`${item.meta.sourceFile}_${item.meta.lineNumber}`)
            ).length;
            return visibleSelectedCount > 0 ? `${visibleSelectedCount}行を選択中` : '';
          })()}
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
