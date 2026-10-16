import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
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
import type {
  BookmarkAutoImportResult,
  BookmarkAutoImportRule,
} from '@common/types/bookmarkAutoImport';
import { checkAppDuplicates } from '@common/utils/appDuplicateDetector';

import { useToast } from '../hooks/useToast';
import { logError } from '../utils/debug';
import { useBookmarkAutoImport } from '../hooks/useBookmarkAutoImport';
import { useAdminPathExistence, checkablePathOf } from '../hooks/useAdminPathExistence';
import { useAdminTabStructure, type TabStructureSettings } from '../hooks/useAdminTabStructure';
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
import AdminItemManagerTabBar from './AdminItemManagerTabBar';
import AutoImportFilterDropdown from './AutoImportFilterDropdown';
import BookmarkAutoImportRuleModal from './BookmarkAutoImportRuleModal';
import AppImportModal, { type AppImportDestination } from './AppImportModal';
import ConfirmDialog from './ConfirmDialog';
import { Button } from './ui/Button';

interface EditModeViewProps {
  editing: AdminItemEditing;
  loadError: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dataFileTabs: DataFileTab[];
  dataFileLabels?: Record<string, string>;
  /** メイン画面でタブを表示する設定か（タブを作るときに、表示しない設定なら確認する） */
  showDataFileTabs: boolean;
  /** タブ・データファイルの構成を保存したとき（管理画面全体の設定に反映する） */
  onTabStructureSaved: (settings: Partial<TabStructureSettings>) => void;
  pendingImportModal: 'bookmark' | 'app' | null;
  onClearPendingImportModal: () => void;
  /** 設定「ブックマーク自動取込」を開く（一括取込メニュー・手動取込モーダルの案内から） */
  onOpenAutoImportSettings?: () => void;
}

interface ConfirmDialogState {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  /** キャンセル（閉じる）したとき */
  onCancel?: () => void;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** 確認メッセージ用のアイテム名（名前が無い種類はパス） */
function describeItem(item: EditableJsonItem): string {
  const jsonItem = item.item as { displayName?: string; path?: string };
  return jsonItem.displayName || jsonItem.path || i18next.t('itemManager.noName');
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
  searchQuery,
  onSearchChange,
  dataFileTabs,
  dataFileLabels = {},
  showDataFileTabs,
  onTabStructureSaved,
  pendingImportModal,
  onClearPendingImportModal,
  onOpenAutoImportSettings,
}) => {
  const { t } = useTranslation();
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

  const cancelConfirmDialog = () => {
    confirmDialog.onCancel?.();
    closeConfirmDialog();
  };

  /** 確認ダイアログを出し、確定なら true・キャンセルなら false で解決する */
  const confirmAsync = useCallback(
    (
      message: string,
      options: Omit<ConfirmDialogState, 'isOpen' | 'onConfirm' | 'onCancel' | 'message'> = {}
    ) =>
      new Promise<boolean>((resolve) => {
        setConfirmDialog({
          ...options,
          message,
          isOpen: true,
          onConfirm: () => {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            resolve(true);
          },
          onCancel: () => resolve(false),
        });
      }),
    []
  );

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

  // タブ・データファイルの構成の変更（その場で確定する）
  const countItems = useCallback(
    (fileName: string) => {
      const items = workingItems.filter((item) => item.meta.sourceFile === fileName);
      return {
        total: items.length,
        unsaved: items.filter((item) => changedIds.has(getItemKey(item))).length,
      };
    },
    [workingItems, changedIds]
  );
  const tabStructure = useAdminTabStructure({
    dataFileTabs,
    dataFileLabels,
    showDataFileTabs,
    onSaved: onTabStructureSaved,
    confirm: confirmAsync,
    showSuccess,
    showWarning,
    countItems,
    dropFileItems: editing.dropFileItems,
  });

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
      showInfo(t('itemManager.missingCheck.nothingToCheck'));
      return;
    }
    const unknownNote =
      summary.unknown > 0
        ? t('itemManager.missingCheck.unknownNote', { count: summary.unknown })
        : '';
    if (summary.missing === 0) {
      showSuccess(
        t('itemManager.missingCheck.noneMissing', { checked: summary.checked, unknownNote })
      );
    } else {
      showWarning(
        t('itemManager.missingCheck.someMissing', {
          checked: summary.checked,
          missing: summary.missing,
          unknownNote,
        }),
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
        t('itemManager.movedTo', { name: describeItem(target), file: getFileLabel(movedTo) })
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
      return;
    }
    // セット・ウィンドウ操作・クリップボードは必須データを詳細編集で入れる
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
      showSuccess(t('itemManager.saved'));
    }
  };

  const handleSaveChanges = () => {
    if (!hasUnsavedChanges) return;

    const invalidNote =
      invalidCount > 0 ? t('itemManager.saveConfirmInvalid', { count: invalidCount }) : '';

    openConfirmDialog(
      {
        message: `${t('itemManager.saveConfirm')}${invalidNote}`,
        confirmText: t('itemManager.saveButton'),
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
        message: t('itemManager.discardConfirm'),
        confirmText: t('itemManager.discardButton'),
        danger: true,
      },
      () => {
        editing.discardChanges();
        showInfo(t('itemManager.discarded'));
      }
    );
  };

  const handleDedupe = () => {
    const count = editing.countDuplicates(selectedDataFile);
    if (count === 0) {
      showInfo(t('itemManager.noDuplicates'));
      return;
    }
    openConfirmDialog(
      {
        message: t('itemManager.dedupeConfirm', { file: getFileLabel(selectedDataFile), count }),
        confirmText: t('itemManager.deleteButton'),
        danger: true,
      },
      () => {
        const removed = editing.dedupeFile(selectedDataFile);
        showSuccess(t('itemManager.deduped', { count: removed }));
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
    showInfo(
      t('itemManager.imported', { count: bookmarks.length, file: getFileLabel(targetFile) })
    );
  };

  /** 取込画面「ルールとして保存」: 設定にルールを足してすぐ実行する（自動取込と同じ置き換え方式） */
  const handleBookmarkSaveAsRule = async (rule: BookmarkAutoImportRule) => {
    await addAutoImportRule(rule);
    setIsBookmarkModalOpen(false);
    let result: BookmarkAutoImportResult;
    try {
      result = await executeAutoImportRule(rule);
    } catch (error) {
      // 実行の IPC が例外で失敗したときも、success: false と同じく知らせる
      result = {
        success: false,
        importedCount: 0,
        deletedCount: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
        executedAt: Date.now(),
      };
    }
    if (result.success) {
      const message = t('itemManager.ruleSavedAndRun', {
        name: rule.name,
        count: result.importedCount,
      });
      if (result.manualDuplicateCount) {
        showWarning(
          t('itemManager.ruleManualDuplicates', { message, count: result.manualDuplicateCount })
        );
      } else {
        showSuccess(message);
      }
    } else {
      showWarning(
        t('itemManager.ruleRunFailed', { name: rule.name, error: result.errorMessage ?? '' })
      );
    }
  };

  /**
   * アプリ取込画面「取り込む」: 新しいタブ・ファイルが取込先ならここで作ってから、未保存の変更として追加する。
   * 取り込んだ先のタブ・ファイルを開く。ファイルを作れなかったら false（取込画面は開いたまま）
   */
  const handleAppImport = async (
    apps: ScannedAppItem[],
    duplicateHandling: DuplicateHandlingOption,
    destination: AppImportDestination
  ): Promise<boolean> => {
    let target: { tabIndex: number; fileName: string; fileLabel: string };
    if (destination.kind === 'existing') {
      target = {
        tabIndex: dataFileTabs.findIndex((tab) => tab.files.includes(destination.fileName)),
        fileName: destination.fileName,
        fileLabel: getFileLabel(destination.fileName),
      };
    } else {
      const created = await tabStructure.createImportFile(destination);
      if (!created) return false;
      target = created;
    }
    // スキップのときは取込先に登録済みの分は入らない
    const fileItems = workingItems.filter((item) => item.meta.sourceFile === target.fileName);
    const addedCount =
      duplicateHandling === 'skip' ? checkAppDuplicates(apps, fileItems).newCount : apps.length;
    editing.importApps(apps, duplicateHandling, target.fileName);
    if (target.tabIndex >= 0) setSelectedTabIndex(target.tabIndex);
    setSelectedDataFile(target.fileName);
    showInfo(t('itemManager.imported', { count: addedCount, file: target.fileLabel }));
    return true;
  };

  /** 削除の確認を出してから削除する（行のボタン・右クリック・Delete キー・一括削除の共通経路） */
  const handleRequestDelete = useCallback(
    (items: EditableJsonItem[]) => {
      if (items.length === 0) return;
      const names = items
        .map((item) => t('itemManager.quotedName', { name: describeItem(item) }))
        .join(t('common.listSeparator'));
      const message =
        items.length === 1
          ? t('itemManager.deleteConfirmOne', { names })
          : items.length <= 3
            ? t('itemManager.deleteConfirmFew', { names, count: items.length })
            : t('itemManager.deleteConfirmMany', { count: items.length });
      openConfirmDialog({ message, confirmText: t('itemManager.deleteButton'), danger: true }, () =>
        editing.deleteItems(items)
      );
    },
    // openConfirmDialog は毎レンダー作られるが setState しか呼ばないので依存に含めない
    [editing.deleteItems, t]
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

    // Escape では管理ウィンドウを閉じない（誤操作防止。閉じるのは × かホットキー）
    if (e.key === 'Delete') {
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

  // タブを消したなどで選択中のタブが無くなったら、最後のタブを選ぶ
  useEffect(() => {
    if (dataFileTabs.length > 0 && selectedTabIndex >= dataFileTabs.length) {
      setSelectedTabIndex(dataFileTabs.length - 1);
    }
  }, [dataFileTabs.length, selectedTabIndex]);

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
      const names = rebaseNotice.conflicts
        .map((c) => t('itemManager.quotedName', { name: c.displayName }))
        .join(t('common.listSeparator'));
      showWarning(t('itemManager.rebaseConflicts', { names }), { duration: 10000 });
    } else {
      showInfo(t('itemManager.rebaseApplied', { count: rebaseNotice.applied }));
    }
    editing.clearRebaseNotice();
  }, [rebaseNotice]);

  const isFiltered = searchQuery.trim().length > 0 || autoImportFilter !== 'all' || missingOnly;

  return (
    <div className="edit-mode-view" onKeyDown={handleKeyDown} tabIndex={0}>
      <AdminItemManagerTabBar
        dataFileTabs={dataFileTabs}
        selectedTabIndex={selectedTabIndex}
        selectedDataFile={selectedDataFile}
        getFileLabel={getFileLabel}
        onSelectTab={setSelectedTabIndex}
        onSelectFile={setSelectedDataFile}
        structure={tabStructure}
      />
      <AdminItemManagerHeader
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
            variant="primary"
            onClick={handleAddItem}
            title={t('itemManager.toolbar.addItemTitle')}
          >
            {t('itemManager.toolbar.addItem')}
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteSelected}
            disabled={visibleSelectedItems.length === 0}
            title={t('itemManager.toolbar.deleteSelectedTitle')}
          >
            {t('itemManager.toolbar.deleteSelected')}
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
                placeholder={t('itemManager.toolbar.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="close-btn close-btn-sm search-clear-button"
                  onClick={() => onSearchChange('')}
                  type="button"
                  aria-label={t('itemManager.toolbar.clearSearch')}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="toolbar-right">
          <Button variant="secondary" onClick={handleDiscardChanges} disabled={!hasUnsavedChanges}>
            {t('itemManager.toolbar.discard')}
          </Button>
          <Button variant="primary" onClick={handleSaveChanges} disabled={!hasUnsavedChanges}>
            {t('itemManager.toolbar.save')}
          </Button>
        </div>
      </div>

      {loadError ? (
        <div className="edit-mode-load-error" data-testid="edit-mode-load-error">
          {t('itemManager.loadError')}
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
          {visibleSelectedItems.length > 0
            ? t('itemManager.status.selected', { count: visibleSelectedItems.length })
            : ''}
        </span>
        <span className="total-count">
          {t('itemManager.status.total', { count: filteredItems.length })}
        </span>
        {invalidCount > 0 && (
          <span className="invalid-count">
            {t('itemManager.status.invalid', { count: invalidCount })}
          </span>
        )}
        {pathCheck.hasChecked && (
          <span className="missing-count">
            {t('itemManager.status.missing', { count: missingIds.size })}
          </span>
        )}
        {hasUnsavedChanges && (
          <span className="unsaved-changes">
            {t('itemManager.status.unsaved', {
              changed: changedIds.size,
              deleted:
                deletedCount > 0
                  ? t('itemManager.status.unsavedDeleted', { count: deletedCount })
                  : '',
            })}
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
        existingItems={workingItems}
        dataFileTabs={dataFileTabs}
        dataFileLabels={dataFileLabels}
        initialTabIndex={selectedTabIndex}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={cancelConfirmDialog}
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
