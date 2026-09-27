import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DEFAULT_DATA_FILE,
  SimpleBookmarkItem,
  ScannedAppItem,
  DataFileTab,
  DuplicateHandlingOption,
  type JsonItem,
  type RegisterItem,
} from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import type { BookmarkAutoImportRule } from '@common/types/bookmarkAutoImport';

import { useToast } from '../hooks/useToast';
import { logError } from '../utils/debug';
import { useBookmarkAutoImport } from '../hooks/useBookmarkAutoImport';
import { useAdminPathExistence, checkablePathOf } from '../hooks/useAdminPathExistence';
import type { AdminItemEditing } from '../hooks/useAdminItemEditing';
import {
  applyDisplayOrder,
  changeItemType,
  filterEditableItems,
  getItemKey,
  isInlineItemType,
  sortItemIds,
  toggleSort,
  type AutoImportFilter,
  type SortColumn,
  type SortState,
} from '../utils/editableItemOperations';

import AdminItemManagerList from './AdminItemManagerList';
import AdminItemManagerHeader from './AdminItemManagerHeader';
import AutoImportFilterDropdown from './AutoImportFilterDropdown';
import BookmarkAutoImportRuleModal from './BookmarkAutoImportRuleModal';
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
  /** 設定「ブックマーク自動取込」を開く（一括取込メニュー・手動取込モーダルの案内から） */
  onOpenAutoImportSettings?: () => void;
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
  onOpenAutoImportSettings,
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
    baseVersion,
  } = editing;

  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [isAppImportModalOpen, setIsAppImportModalOpen] = useState(false);

  // タブとファイル選択用の状態
  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(0);
  const [selectedDataFile, setSelectedDataFile] = useState<string>(DEFAULT_DATA_FILE);

  // 並べ替え。初期値はメイン画面と同じ表示名の昇順
  const [sortState, setSortState] = useState<SortState>({
    column: 'displayName',
    direction: 'asc',
  });

  // 追加直後に名前セルを編集状態にするアイテム
  const [autoEditItemId, setAutoEditItemId] = useState<string | null>(null);

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

  // 自動取込設定からルールマップを構築。取込画面の「ルールとして保存」もここから行う
  const {
    settings: autoImportSettings,
    addRule: addAutoImportRule,
    executeRule: executeAutoImportRule,
  } = useBookmarkAutoImport();

  // 取込画面のインポート先の選択肢（設定のルール編集と同じく物理ファイル一覧）
  const [importDataFiles, setImportDataFiles] = useState<string[]>([]);
  useEffect(() => {
    if (!isBookmarkModalOpen) return;
    window.electronAPI
      .getDataFiles()
      .then(setImportDataFiles)
      .catch((error) => logError('データファイル一覧の取得に失敗しました:', error));
  }, [isBookmarkModalOpen]);

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

  const currentFileWorkingItems = useMemo(
    () => workingItems.filter((item) => item.meta.sourceFile === selectedDataFile),
    [workingItems, selectedDataFile]
  );

  // リンク切れ（パスが実在しない）。ネットワークパスは応答に時間がかかることがあるので、
  // 自動では確認せず、ツールメニューの「リンク切れを確認」を押したときだけ確認する
  const [missingOnly, setMissingOnly] = useState(false);
  const pathCheck = useAdminPathExistence(baseVersion);
  const missingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of workingItems) {
      const itemPath = checkablePathOf(item);
      if (itemPath && pathCheck.results.get(itemPath) === 'missing') ids.add(getItemKey(item));
    }
    return ids;
  }, [workingItems, pathCheck.results]);

  // 読み込み・保存で結果が捨てられたら絞り込みも解く
  useEffect(() => {
    if (!pathCheck.hasChecked) setMissingOnly(false);
  }, [pathCheck.hasChecked]);

  const handleCheckMissingPaths = async () => {
    const summary = await pathCheck.runCheck(currentFileWorkingItems);
    if (summary.checked === 0) {
      showInfo('確認対象のローカルパスがありません（URL・shell:・コマンド名は確認しません）');
      return;
    }
    const unknownNote =
      summary.unknown > 0
        ? `、応答なし ${summary.unknown} 件（ネットワークパスなど。リンク切れとは数えません）`
        : '';
    if (summary.missing === 0) {
      showSuccess(`${summary.checked} 件を確認しました。リンク切れはありません${unknownNote}`);
    } else {
      showWarning(
        `${summary.checked} 件を確認し、リンク切れが ${summary.missing} 件ありました${unknownNote}。` +
          '「🧰 ツール ▼ リンク切れのみ表示」で絞り込めます',
        { duration: 8000 }
      );
    }
  };

  // 詳細編集で受け取った内容を未保存の編集状態に反映する（最新の editing を使うため ref 経由）
  const applyDetailEditRef = useRef<(target: EditableJsonItem, items: RegisterItem[]) => void>(
    () => {}
  );
  applyDetailEditRef.current = (target, items) => {
    const movedTo = editing.applyRegisterUpdate(target, items);
    if (movedTo) {
      showInfo(
        `「${describeItem(target)}」を ${getFileLabel(movedTo)} へ移動しました（保存で確定）`
      );
    }
  };

  /**
   * 詳細編集を独立した子ウィンドウで開く（管理ウィンドウが親。閉じるまで管理画面は操作できない）
   * 子ウィンドウは保存せずフォームの内容を返すので、ここで未保存の編集状態に反映する
   *
   * @param initialCategory 種類プルダウンで「詳細編集でしか作れない種別」を選んだとき、その種別で開く
   */
  const openDetailEditor = useCallback(
    async (target: EditableJsonItem, initialCategory?: RegisterItem['itemCategory']) => {
      try {
        const result = await window.electronAPI.openMainChildWindow({
          kind: 'register',
          droppedPaths: [],
          editingItem: target,
          initialCategory,
          returnToOpener: true,
        });
        if (result?.kind === 'register') {
          applyDetailEditRef.current(target, result.items);
        }
      } catch (error) {
        logError('詳細編集ウィンドウを開けませんでした:', error);
      }
    },
    []
  );

  // AdminItemManagerList側のIPCリスナー登録effectが依存するため、
  // 毎レンダーの再登録を防ぐ目的でuseCallback化している
  const handleEditItemClick = useCallback(
    (editableItem: EditableJsonItem) => {
      void openDetailEditor(editableItem);
    },
    [openDetailEditor]
  );

  const handleChangeType = (item: EditableJsonItem, newType: JsonItem['type']) => {
    if (isInlineItemType(newType)) {
      editing.recordEdit({ ...item, item: changeItemType(item.item, newType) });
      if (newType === 'group') {
        showInfo('グループに含めるアイテムは ✏️ 詳細編集で選びます');
      }
      return;
    }
    // ウィンドウ操作・クリップボード・ウィンドウ配置は必須データを詳細編集で入れる
    void openDetailEditor(item, newType);
  };

  const handleAddItem = () => {
    // 追加した行が検索・フィルタで隠れないように、絞り込みを外してから追加する
    if (searchQuery) onSearchChange('');
    setAutoImportFilter('all');
    setMissingOnly(false);
    const id = editing.addBlankItem(selectedDataFile);
    setAutoEditItemId(id);
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

  /** 取込画面「今回だけ取り込む」: 未保存の変更として追加（印は付かない） */
  const handleBookmarkImportOnce = (
    bookmarks: SimpleBookmarkItem[],
    duplicateHandling: DuplicateHandlingOption,
    targetFile: string
  ) => {
    editing.importBookmarks(bookmarks, duplicateHandling, targetFile);
    setIsBookmarkModalOpen(false);
    showInfo(`${bookmarks.length} 件を ${getFileLabel(targetFile)} に追加しました（保存で確定）`);
  };

  /** 取込画面「ルールとして保存」: 設定にルールを足してすぐ実行する（自動取込と同じ置き換え方式） */
  const handleBookmarkSaveAsRule = async (rule: BookmarkAutoImportRule) => {
    await addAutoImportRule(rule);
    setIsBookmarkModalOpen(false);
    const result = await executeAutoImportRule(rule);
    if (result.success) {
      const message = `ルール「${rule.name}」を保存して実行しました: ${result.importedCount}件登録`;
      if (result.manualDuplicateCount) {
        showWarning(
          `${message}（手動で登録済みの URL と ${result.manualDuplicateCount} 件重複しています）`
        );
      } else {
        showSuccess(message);
      }
    } else {
      showWarning(
        `ルール「${rule.name}」を保存しましたが実行に失敗しました: ${result.errorMessage}`
      );
    }
  };

  const handleAppImport = (apps: ScannedAppItem[], duplicateHandling: DuplicateHandlingOption) => {
    editing.importApps(apps, duplicateHandling, selectedDataFile);
    setIsAppImportModalOpen(false);
  };

  const handleExitEditMode = () => {
    if (hasUnsavedChanges) {
      openConfirmDialog(
        {
          message: '未保存の変更があります。アイテム管理を終了しますか？',
          danger: true,
        },
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
      const names = items.map((item) => `「${describeItem(item)}」`).join('、');
      const message =
        items.length === 1
          ? `${names}を削除しますか？`
          : items.length <= 3
            ? `${names} の ${items.length} 件を削除しますか？`
            : `${items.length} 件のアイテムを削除しますか？`;
      openConfirmDialog({ message, confirmText: '削除', danger: true }, () =>
        editing.deleteItems(items)
      );
    },
    // openConfirmDialog は毎レンダー作られるが setState しか呼ばないので依存に含めない
    [editing.deleteItems]
  );

  const filteredItems = useMemo(() => {
    const filtered = filterEditableItems(workingItems, {
      sourceFile: selectedDataFile,
      autoImportFilter,
      searchQuery,
    });
    return missingOnly ? filtered.filter((item) => missingIds.has(getItemKey(item))) : filtered;
  }, [workingItems, selectedDataFile, autoImportFilter, searchQuery, missingOnly, missingIds]);

  // 表示順は「読み込み・保存時」と「見出しクリック時」にだけ作り直し、編集中は固定する。
  // こうしないと、名前を入力した瞬間に行が並び順の位置へ飛んでしまう
  const workingItemsRef = useRef(workingItems);
  workingItemsRef.current = workingItems;
  const displayOrder = useMemo(
    () => sortItemIds(workingItemsRef.current, sortState),
    // baseVersion は作り直しの契機として使う（値そのものは使わない）
    [sortState, baseVersion]
  );
  const orderedItems = useMemo(
    () => applyDisplayOrder(filteredItems, displayOrder),
    [filteredItems, displayOrder]
  );

  const handleSortChange = (column: SortColumn) => setSortState((prev) => toggleSort(prev, column));

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

  const isFiltered = searchQuery.trim().length > 0 || autoImportFilter !== 'all' || missingOnly;

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
        onOpenAutoImportSettings={onOpenAutoImportSettings}
        onCheckMissingPaths={() => void handleCheckMissingPaths()}
        checkingMissingPaths={pathCheck.checking}
        missingOnly={missingOnly}
        missingOnlyAvailable={pathCheck.hasChecked}
        onToggleMissingOnly={() => setMissingOnly((prev) => !prev)}
        onDedupe={handleDedupe}
      />

      {/* ツールバーエリア */}
      <div className="edit-mode-toolbar">
        <div className="toolbar-left">
          <Button
            variant="info"
            onClick={handleAddItem}
            title="単一アイテムを先頭に追加します。種類は「種類」列で、引数やメモは ✏️ 詳細編集で変えられます"
          >
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
                placeholder="名前・パス・メモで検索..."
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
          editableItems={orderedItems}
          selectedItems={selectedItems}
          changedIds={changedIds}
          missingIds={missingIds}
          isFiltered={isFiltered}
          sortState={sortState}
          onSortChange={handleSortChange}
          autoEditItemId={autoEditItemId}
          onAutoEditHandled={() => setAutoEditItemId(null)}
          onItemEdit={editing.recordEdit}
          onChangeType={handleChangeType}
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
        {pathCheck.hasChecked && (
          <span className="missing-count">リンク切れ: {missingIds.size} 件</span>
        )}
        {hasUnsavedChanges && (
          <span className="unsaved-changes">
            未保存の変更があります（変更 {changedIds.size} 件
            {deletedCount > 0 ? `・削除 ${deletedCount} 件` : ''}）
          </span>
        )}
      </div>

      {isBookmarkModalOpen && (
        <BookmarkAutoImportRuleModal
          mode="import"
          rule={null}
          dataFiles={importDataFiles.length > 0 ? importDataFiles : [selectedDataFile]}
          dataFileLabels={dataFileLabels}
          defaultTargetFile={selectedDataFile}
          existingItems={workingItems}
          onSave={handleBookmarkSaveAsRule}
          onCancel={() => setIsBookmarkModalOpen(false)}
          onImportOnce={handleBookmarkImportOnce}
          onOpenAutoImportSettings={onOpenAutoImportSettings}
        />
      )}

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
