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
import type { AdminItemEditing } from '../hooks/useAdminItemEditing';
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
  editing: AdminItemEditing;
  loadError: string | null;
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
}

/** 確認メッセージ用のアイテム名（名前が無い種類はパス） */
function describeItem(item: EditableJsonItem): string {
  const jsonItem = item.item as { displayName?: string; path?: string };
  return jsonItem.displayName || jsonItem.path || '(名前なし)';
}

/** キー入力の発生元がテキスト入力欄か（入力中のキーを画面のショートカットとして扱わないため） */
function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

const AdminItemManagerView: React.FC<EditModeViewProps> = ({
  editing,
  loadError,
  onExitEditMode,
  searchQuery,
  onSearchChange,
  dataFileTabs,
  dataFileLabels = {},
  pendingImportModal,
  onClearPendingImportModal,
}) => {
  const { showSuccess, showInfo, showWarning } = useToast();

  // データファイル名を取得（設定がない場合は物理ファイル名）
  const getFileLabel = (fileName: string): string => {
    return dataFileLabels[fileName] || fileName;
  };

  const {
    workingItems,
    changedIds,
    deletedCount,
    hasUnsavedChanges,
    invalidCount,
    selectedItems,
    rebaseNotice,
  } = editing;

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableJsonItem | null>(null);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [isAppImportModalOpen, setIsAppImportModalOpen] = useState(false);

  // タブとファイル選択用の状態
  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(0);
  const [selectedDataFile, setSelectedDataFile] = useState<string>(DEFAULT_DATA_FILE);

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
      const movedTo = editing.applyRegisterUpdate(editingItem, items);
      if (movedTo) {
        showInfo(
          `「${describeItem(editingItem)}」を ${getFileLabel(movedTo)} へ移動しました（保存で確定）`
        );
      }
    }
    closeRegisterModal();
  };

  const runSave = async () => {
    const saved = await editing.saveChanges();
    if (saved) {
      showSuccess('変更を保存しました');
    }
  };

  const handleSaveChanges = () => {
    if (!hasUnsavedChanges) return;

    const invalidNote =
      invalidCount > 0
        ? `\n\n名前やパスが空など、入力に不備があるアイテムが ${invalidCount} 件あります。そのまま保存されます。`
        : '';

    openConfirmDialog(
      {
        message: `変更を保存しますか？${invalidNote}`,
        confirmText: '保存',
        danger: false,
      },
      () => {
        void runSave();
      }
    );
  };

  // Ctrl+S をセル入力中に押したとき、入力欄を確定（blur）してから保存に進むための参照
  const saveHandlerRef = useRef(handleSaveChanges);
  saveHandlerRef.current = handleSaveChanges;

  const handleDiscardChanges = () => {
    if (!hasUnsavedChanges) return;
    openConfirmDialog(
      {
        message: '未保存の変更をすべて捨てて、ファイルの内容に戻しますか？',
        confirmText: '破棄',
        danger: true,
      },
      () => {
        editing.discardChanges();
        showInfo('変更を破棄しました');
      }
    );
  };

  const handleDedupe = () => {
    const count = editing.countDuplicates(selectedDataFile);
    if (count === 0) {
      showInfo('重複するアイテムはありません');
      return;
    }
    openConfirmDialog(
      {
        message:
          `${getFileLabel(selectedDataFile)} に、種類・名前・パスが同じアイテムが ${count} 件あります。` +
          '先にある 1 件を残して削除しますか？（保存で確定）',
        confirmText: '削除',
        danger: true,
      },
      () => {
        const removed = editing.dedupeFile(selectedDataFile);
        showSuccess(`重複 ${removed} 件を削除しました`);
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

  const handleExitEditMode = () => {
    if (hasUnsavedChanges) {
      openConfirmDialog(
        { message: '未保存の変更があります。アイテム管理を終了しますか？', danger: true },
        onExitEditMode
      );
    } else {
      onExitEditMode();
    }
  };

  /** 削除の確認を出してから削除する（行のボタン・右クリック・Delete キー・一括削除の共通経路） */
  const handleRequestDelete = useCallback(
    (items: EditableJsonItem[]) => {
      if (items.length === 0) return;
      const message =
        items.length === 1
          ? `「${describeItem(items[0])}」を削除しますか？`
          : `${items.length} 件のアイテムを削除しますか？`;
      openConfirmDialog({ message, confirmText: '削除', danger: true }, () =>
        editing.deleteItems(items)
      );
    },
    // openConfirmDialog は毎レンダー作られるが setState しか呼ばないので依存に含めない
    [editing.deleteItems]
  );

  const filteredItems = useMemo(
    () =>
      filterEditableItems(workingItems, {
        sourceFile: selectedDataFile,
        autoImportFilter,
        searchQuery,
      }),
    [workingItems, selectedDataFile, autoImportFilter, searchQuery]
  );

  const visibleSelectedItems = useMemo(
    () => filteredItems.filter((item) => selectedItems.has(getItemKey(item))),
    [filteredItems, selectedItems]
  );

  const handleDeleteSelected = () => handleRequestDelete(visibleSelectedItems);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (isTextInputTarget(e.target)) {
        // 入力中のセルを確定してから保存に進む（確定は blur の状態更新後に反映される）
        (e.target as HTMLElement).blur();
        setTimeout(() => saveHandlerRef.current(), 0);
      } else {
        handleSaveChanges();
      }
      return;
    }
    // 入力欄の中のキーは文字編集なので、画面のショートカットとして扱わない
    if (isTextInputTarget(e.target)) return;

    if (e.key === 'Escape') {
      handleExitEditMode();
    } else if (e.key === 'Delete') {
      handleDeleteSelected();
    }
  };

  // タブ変更時にファイルを自動選択（選択中のファイルがそのタブに無いときだけ）
  useEffect(() => {
    if (dataFileTabs.length > 0 && selectedTabIndex < dataFileTabs.length) {
      const files = dataFileTabs[selectedTabIndex].files ?? [];
      if (files.length > 0 && !files.includes(selectedDataFile)) {
        setSelectedDataFile(files[0]);
      }
    }
  }, [selectedTabIndex, dataFileTabs, selectedDataFile]);

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

  // 表示されなくなったアイテム（検索・フィルタ・ファイル切替）の選択を外す
  useEffect(() => {
    editing.retainVisibleSelection(filteredItems);
  }, [filteredItems, editing.retainVisibleSelection]);

  // 外部の変更を取り込んだときの結果を知らせる
  useEffect(() => {
    if (!rebaseNotice) return;
    if (rebaseNotice.conflicts.length > 0) {
      const names = rebaseNotice.conflicts.map((c) => `「${c.displayName}」`).join('、');
      showWarning(
        `他で変更・削除されたアイテムがあるため、次の未保存の変更は取り消しました: ${names}`,
        { duration: 10000 }
      );
    } else {
      showInfo(
        `他で変更された内容を取り込みました（未保存の変更 ${rebaseNotice.applied} 件は保持）`
      );
    }
    editing.clearRebaseNotice();
  }, [rebaseNotice]);

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

  const currentFileWorkingItems = useMemo(
    () => workingItems.filter((item) => item.meta.sourceFile === selectedDataFile),
    [workingItems, selectedDataFile]
  );

  return (
    <div className="edit-mode-view" onKeyDown={handleKeyDown} tabIndex={0}>
      <AdminItemManagerHeader
        dataFileTabs={dataFileTabs}
        selectedTabIndex={selectedTabIndex}
        currentTabFiles={currentTabFiles}
        selectedDataFile={selectedDataFile}
        getFileLabel={getFileLabel}
        onSelectTab={setSelectedTabIndex}
        onSelectFile={setSelectedDataFile}
        onOpenBookmarkImport={() => setIsBookmarkModalOpen(true)}
        onOpenAppImport={() => setIsAppImportModalOpen(true)}
      />

      {/* ツールバーエリア */}
      <div className="edit-mode-toolbar">
        <div className="toolbar-left">
          <Button variant="info" onClick={() => editing.addBlankItem(selectedDataFile)}>
            ➕ アイテムを追加
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteSelected}
            disabled={visibleSelectedItems.length === 0}
            title="チェックしたアイテムを削除します"
          >
            🗑️ 選択したアイテムを削除
            {visibleSelectedItems.length > 0 ? ` (${visibleSelectedItems.length})` : ''}
          </Button>
          <Button
            variant="info"
            onClick={handleDedupe}
            title="種類・名前・パスが同じアイテムを、先にある 1 件を残して削除します"
          >
            🧹 重複を削除
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
                placeholder="アイテムを検索..."
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
          <Button variant="cancel" onClick={handleDiscardChanges} disabled={!hasUnsavedChanges}>
            変更を破棄
          </Button>
          <Button variant="primary" onClick={handleSaveChanges} disabled={!hasUnsavedChanges}>
            変更を保存
          </Button>
        </div>
      </div>

      {loadError ? (
        <div className="edit-mode-load-error" data-testid="edit-mode-load-error">
          データファイルを読み込めませんでした。ファイルを修復してからウィンドウを開き直してください。
          <div className="edit-mode-load-error-detail">{loadError}</div>
        </div>
      ) : (
        <AdminItemManagerList
          editableItems={filteredItems}
          selectedItems={selectedItems}
          changedIds={changedIds}
          isFiltered={searchQuery.trim().length > 0 || autoImportFilter !== 'all'}
          onItemEdit={editing.recordEdit}
          onItemSelect={editing.selectItem}
          onSelectAll={(selected) => editing.selectAll(filteredItems, selected)}
          onRequestDelete={handleRequestDelete}
          onEditClick={handleEditItemClick}
          onDuplicateItems={editing.duplicateItems}
          autoImportRuleMap={autoImportRuleMap}
        />
      )}

      <div className="edit-mode-status">
        <span className="selection-count">
          {visibleSelectedItems.length > 0 ? `${visibleSelectedItems.length} 件を選択中` : ''}
        </span>
        <span className="total-count">合計: {filteredItems.length} 件</span>
        {invalidCount > 0 && <span className="invalid-count">入力不備: {invalidCount} 件</span>}
        {hasUnsavedChanges && (
          <span className="unsaved-changes">
            未保存の変更があります（変更 {changedIds.size} 件
            {deletedCount > 0 ? `・削除 ${deletedCount} 件` : ''}）
          </span>
        )}
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
      />
    </div>
  );
};

export default AdminItemManagerView;
