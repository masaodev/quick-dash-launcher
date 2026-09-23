import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DEFAULT_DATA_FILE,
  SimpleBookmarkItem,
  ScannedAppItem,
  DataFileTab,
  DuplicateHandlingOption,
  type RegisterItem,
} from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';

import { useToast } from '../hooks/useToast';
import { useBookmarkAutoImport } from '../hooks/useBookmarkAutoImport';
import { useAdminItemEditing } from '../hooks/useAdminItemEditing';
import {
  filterEditableItems,
  getItemKey,
  type AutoImportFilter,
} from '../utils/editableItemOperations';

import AdminItemManagerList from './AdminItemManagerList';
import AdminItemManagerHeader from './AdminItemManagerHeader';
import AutoImportFilterDropdown from './AutoImportFilterDropdown';
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

interface ConfirmDialogState {
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

  const editing = useAdminItemEditing(editableItems, onEditableItemsSave);
  const { workingItems, mergedItems, hasUnsavedChanges, selectedItems } = editing;

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableJsonItem | null>(null);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [isAppImportModalOpen, setIsAppImportModalOpen] = useState(false);

  // タブとファイル選択用の状態
  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(0);
  const [selectedDataFile, setSelectedDataFile] = useState<string>(DEFAULT_DATA_FILE);

  // 保存時の整列・重複削除チェックボックスの状態。
  // 確認ダイアログの onConfirm は開いた時点のクロージャなので、確定時の値は ref から読む
  const sortAndDedupCheckedRef = useRef(true);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });

  const closeConfirmDialog = () => setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

  /** 確認ダイアログを出し、確定されたら閉じてから action を実行する */
  const openConfirmDialog = (
    options: Omit<ConfirmDialogState, 'isOpen' | 'onConfirm'>,
    action: () => void
  ) => {
    setConfirmDialog({
      ...options,
      isOpen: true,
      onConfirm: () => {
        closeConfirmDialog();
        action();
      },
    });
  };

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

  const [autoImportFilter, setAutoImportFilter] = useState<AutoImportFilter>('all');

  // AdminItemManagerList側のIPCリスナー登録effectが依存するため、
  // 毎レンダーの再登録を防ぐ目的でuseCallback化している
  const handleEditItemClick = useCallback((editableItem: EditableJsonItem) => {
    setEditingItem(editableItem);
    setIsRegisterModalOpen(true);
  }, []);

  const closeRegisterModal = () => {
    setIsRegisterModalOpen(false);
    setEditingItem(null);
  };

  const handleUpdateItem = (items: RegisterItem[]) => {
    if (editingItem) {
      editing.applyRegisterUpdate(editingItem, items);
    }
    closeRegisterModal();
  };

  const handleSaveChanges = () => {
    if (!hasUnsavedChanges) return;

    // チェックボックスをデフォルトでONにリセット
    sortAndDedupCheckedRef.current = true;

    openConfirmDialog(
      {
        message: '変更を保存しますか？',
        confirmText: '保存',
        showCheckbox: true,
        checkboxLabel: '整列・重複削除を実行',
        checkboxChecked: true,
        onCheckboxChange: (checked: boolean) => {
          sortAndDedupCheckedRef.current = checked;
          // confirmDialogの状態も更新
          setConfirmDialog((prev) => ({ ...prev, checkboxChecked: checked }));
        },
        danger: false,
      },
      () => {
        editing.saveChanges({
          sortAndDedupe: sortAndDedupCheckedRef.current,
          sourceFile: selectedDataFile,
        });
        showSuccess('変更を保存しました');
      }
    );
  };

  const handleBookmarkImport = (
    bookmarks: SimpleBookmarkItem[],
    duplicateHandling: DuplicateHandlingOption
  ) => {
    editing.importBookmarks(bookmarks, duplicateHandling, selectedDataFile);
    setIsBookmarkModalOpen(false);
  };

  const handleAppImport = (apps: ScannedAppItem[], duplicateHandling: DuplicateHandlingOption) => {
    editing.importApps(apps, duplicateHandling, selectedDataFile);
    setIsAppImportModalOpen(false);
  };

  // 未保存チェック付きアクション実行ヘルパー
  const confirmIfUnsaved = (message: string, action: () => void) => {
    if (hasUnsavedChanges) {
      openConfirmDialog({ message, danger: true }, action);
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
      editing.deleteItems(workingItems.filter((item) => selectedItems.has(getItemKey(item))));
    } else if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSaveChanges();
    }
  };

  // タブ変更時の未保存チェック
  const handleTabChange = (newTabIndex: number) => {
    confirmIfUnsaved(
      '未保存の変更があります。タブを切り替えると変更が失われます。続行しますか？',
      () => {
        setSelectedTabIndex(newTabIndex);
        editing.discardEdits();
      }
    );
  };

  // ファイル変更時の未保存チェック
  const handleFileChange = (newFile: string) => {
    confirmIfUnsaved(
      '未保存の変更があります。ファイルを切り替えると変更が失われます。続行しますか？',
      () => {
        setSelectedDataFile(newFile);
        editing.discardEdits();
      }
    );
  };

  const filteredItems = useMemo(
    () =>
      filterEditableItems(mergedItems, {
        sourceFile: selectedDataFile,
        autoImportFilter,
        searchQuery,
      }),
    [mergedItems, selectedDataFile, autoImportFilter, searchQuery]
  );

  const visibleSelectedCount = filteredItems.filter((item) =>
    selectedItems.has(getItemKey(item))
  ).length;

  const handleDeleteSelected = () => {
    const selectedEditableItems = filteredItems.filter((item) =>
      selectedItems.has(getItemKey(item))
    );
    if (selectedEditableItems.length === 0) return;
    openConfirmDialog(
      { message: `${selectedEditableItems.length}行を削除しますか？`, danger: true },
      () => editing.deleteItems(selectedEditableItems)
    );
  };

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

  // 検索クエリが変更されたら、非表示になったアイテムの選択状態をクリア
  useEffect(() => {
    editing.retainVisibleSelection(filteredItems);
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

  const currentFileWorkingItems = workingItems.filter(
    (item) => item.meta.sourceFile === selectedDataFile
  );

  return (
    <div className="edit-mode-view" onKeyDown={handleKeyDown} tabIndex={0}>
      <AdminItemManagerHeader
        dataFileTabs={dataFileTabs}
        selectedTabIndex={selectedTabIndex}
        currentTabFiles={currentTabFiles}
        selectedDataFile={selectedDataFile}
        getFileLabel={getFileLabel}
        onSelectTab={handleTabChange}
        onSelectFile={handleFileChange}
        onOpenBookmarkImport={() => setIsBookmarkModalOpen(true)}
        onOpenAppImport={() => setIsAppImportModalOpen(true)}
      />

      {/* ツールバーエリア */}
      <div className="edit-mode-toolbar">
        <div className="toolbar-left">
          <Button variant="info" onClick={() => editing.addBlankItem(selectedDataFile)}>
            ➕ 行を追加
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteSelected}
            disabled={selectedItems.size === 0}
            title="選択されている行を削除します"
          >
            🗑️ 選択行を削除
          </Button>
          <AutoImportFilterDropdown
            filter={autoImportFilter}
            onChange={setAutoImportFilter}
            rules={currentFileRules}
            ruleNames={autoImportRuleMap}
          />
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
        onItemEdit={editing.recordEdit}
        onItemSelect={editing.selectItem}
        onSelectAll={(selected) => editing.selectAll(filteredItems, selected)}
        onDeleteItems={editing.deleteItems}
        onEditClick={handleEditItemClick}
        onDuplicateItems={editing.duplicateItems}
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
        onClose={closeRegisterModal}
        onRegister={handleUpdateItem}
        droppedPaths={[]}
        editingItem={editingItem}
      />

      <BookmarkImportModal
        isOpen={isBookmarkModalOpen}
        onClose={() => setIsBookmarkModalOpen(false)}
        onImport={handleBookmarkImport}
        existingItems={currentFileWorkingItems}
        importDestination={getImportDestination()}
      />

      <AppImportModal
        isOpen={isAppImportModalOpen}
        onClose={() => setIsAppImportModalOpen(false)}
        onImport={handleAppImport}
        existingItems={currentFileWorkingItems}
        importDestination={getImportDestination()}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
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
