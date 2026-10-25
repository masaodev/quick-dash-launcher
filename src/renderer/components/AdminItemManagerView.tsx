import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { DEFAULT_DATA_FILE, DataFileTab, type JsonItem, type RegisterItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { findSetNamesUsingItems } from '@common/utils/setUsage';

import { useToast } from '../hooks/useToast';
import { logError } from '../utils/debug';
import { useBookmarkAutoImport } from '../hooks/useBookmarkAutoImport';
import { useAdminItemImports } from '../hooks/useAdminItemImports';
import { useAdminItemColumns } from '../hooks/useAdminItemColumns';
import { useAdminItemListView } from '../hooks/useAdminItemListView';
import { useLaunchUsage } from '../hooks/useLaunchUsage';
import { useAdminTabStructure, type TabStructureSettings } from '../hooks/useAdminTabStructure';
import type { AdminItemEditing } from '../hooks/useAdminItemEditing';
import { changeItemType, getItemKey, isInlineItemType } from '../utils/editableItemOperations';
import { itemsToCsv, planCsvImport, type CsvImportPlan } from '../utils/itemCsv';
import { setUsageWarning } from '../utils/setUsageWarning';

import AdminItemManagerList from './AdminItemManagerList';
import AdminItemManagerTabBar from './AdminItemManagerTabBar';
import AdminItemManagerToolbar from './AdminItemManagerToolbar';
import BookmarkImportModal from './BookmarkImportModal';
import AppImportModal from './AppImportModal';
import AdminItemCsvImportModal from './AdminItemCsvImportModal';
import ConfirmDialog from './ConfirmDialog';

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
  /** 管理ウィンドウを閉じるたびに増える数（開いている取込画面を閉じる合図） */
  importModalCloseSignal: number;
  /** 設定「ブックマーク自動取込」を開く（追加の ▼ メニュー・手動取込モーダルの案内から） */
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
  importModalCloseSignal,
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

  // タブとファイル選択用の状態
  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(0);
  const [selectedDataFile, setSelectedDataFile] = useState<string>(DEFAULT_DATA_FILE);

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
  const fileItemIds = useCallback(
    (fileName: string) =>
      workingItems.filter((item) => item.meta.sourceFile === fileName).map((item) => item.item.id),
    [workingItems]
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
    fileItemIds,
  });

  const currentFileWorkingItems = useMemo(
    () => workingItems.filter((item) => item.meta.sourceFile === selectedDataFile),
    [workingItems, selectedDataFile]
  );

  const launchUsage = useLaunchUsage();
  const listView = useAdminItemListView({
    workingItems,
    baseVersion,
    selectedDataFile,
    searchQuery,
    selectedItems,
    retainVisibleSelection: editing.retainVisibleSelection,
    usageOf: launchUsage.usageOf,
    usageLoaded: launchUsage.loaded,
    ruleNames: autoImportRuleMap,
  });
  const {
    sortState,
    handleSortChange,
    setSort,
    filters,
    setColumnFilter,
    pathCheck,
    linkStatusOf,
    missingSetRowsOf,
    missingIds,
    filteredItems,
    orderedItems,
    visibleSelectedItems,
    isFiltered,
  } = listView;
  // 絞り込む前の件数（絞り込み中の「合計: 8 / 15 件」に使う）
  const fileItemCount = currentFileWorkingItems.length;

  const columns = useAdminItemColumns();

  const filterOptions = useMemo(
    () => ({
      rules: currentFileRules,
      linkChecked: pathCheck.hasChecked,
      usageSince: launchUsage.since,
    }),
    [currentFileRules, pathCheck.hasChecked, launchUsage.since]
  );

  const handleCheckMissingPaths = async () => {
    const summary = await pathCheck.runCheck(currentFileWorkingItems);
    // 指すアイテムが消えた行のあるセットも、リンク切れに数える（パスを確かめなくても分かる。A3-79 #8）
    const itemIds = new Set(workingItems.map((item) => item.item.id));
    const danglingSets = currentFileWorkingItems.filter(
      ({ item }) =>
        item.type === 'set' &&
        item.entries.some((entry) => !!entry.itemId && !itemIds.has(entry.itemId))
    ).length;
    summary.missing += danglingSets;
    // 結果はパスの確認の列に出すので、隠していたら出す（既定では隠している）
    const found = summary.checked > 0 || danglingSets > 0;
    if (found && !columns.visibleColumns.some((c) => c.def.id === 'link')) {
      columns.setColumnVisible('link', true);
    }
    if (!found) {
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
          count: summary.missing,
          checked: summary.checked,
          unknownNote,
        }),
        { duration: 5000 }
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
        } else if (result?.kind === 'delete') {
          // 詳細編集で確認済みなので、ここでは確認を出さずに未保存の削除にする
          editing.deleteItems([target]);
        }
      } catch (error) {
        logError('詳細編集ウィンドウを開けませんでした:', error);
      }
    },
    [editing.deleteItems]
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

  /** 空のアイテムを先頭に追加する（フォルダ取込はパスの入力から始まる） */
  const addBlank = (type: 'item' | 'dir') => {
    // 追加した行が検索・フィルタで隠れないように、絞り込みを外してから追加する
    if (searchQuery) onSearchChange('');
    listView.clearFilters();
    const id = editing.addBlankItem(selectedDataFile, type);
    setAutoEditItemId(id);
  };
  const handleAddItem = () => addBlank('item');
  const handleAddFolder = () => addBlank('dir');

  // 取り込んだブックマークのアイコンを、保存のあとにメインウィンドウで取る（取込画面のチェック。A3-174）
  const fetchIconsAfterSaveRef = useRef(false);

  // 未保存の変更が無くなったら（保存・破棄・閉じるときの「変更を捨てて閉じる」のどれでも）頼まない
  useEffect(() => {
    if (!hasUnsavedChanges) fetchIconsAfterSaveRef.current = false;
  }, [hasUnsavedChanges]);

  const runSave = async () => {
    // 保存すると未保存の変更が無くなり、上の effect が先に戻すことがあるので、保存の前に読んでおく
    const fetchIcons = fetchIconsAfterSaveRef.current;
    const saved = await editing.saveChanges();
    if (saved) {
      showSuccess(t('itemManager.saved'));
      if (fetchIcons) {
        fetchIconsAfterSaveRef.current = false;
        void window.electronAPI.requestFetchMissingIcons();
      }
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

  const imports = useAdminItemImports({
    editing,
    dataFileTabs,
    getFileLabel,
    createImportFile: tabStructure.createImportFile,
    onShowTarget: (target) => {
      if (target.tabIndex >= 0) setSelectedTabIndex(target.tabIndex);
      setSelectedDataFile(target.fileName);
    },
    addAutoImportRule,
    executeAutoImportRule,
    toast: { showSuccess, showInfo, showWarning },
    pendingImportModal,
    onClearPendingImportModal,
    importModalCloseSignal,
    onFetchIconsAfterSave: () => {
      fetchIconsAfterSaveRef.current = true;
    },
  });

  // CSV: 書き出しはすべてのタブ（未保存の変更も含めて今の一覧のまま）、取り込みは確かめてから未保存の変更にする
  const [csvImport, setCsvImport] = useState<{
    fileName: string;
    text: string;
    plan: CsvImportPlan;
    /** 計画を作ったときの一覧（確定までに変わったら作り直す） */
    planned: EditableJsonItem[];
  } | null>(null);
  /** タブの順のデータファイル（どのタブにも入っていないファイルは最後） */
  const orderedDataFiles = useMemo(() => {
    const files = [...new Set(dataFileTabs.flatMap((tab) => tab.files))];
    for (const item of workingItems) {
      if (!files.includes(item.meta.sourceFile)) files.push(item.meta.sourceFile);
    }
    return files;
  }, [dataFileTabs, workingItems]);

  const handleExportCsv = async () => {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    try {
      const savedPath = await window.electronAPI.exportItemsCsv(
        itemsToCsv(workingItems, orderedDataFiles),
        `quick-dash-items-${stamp}.csv`
      );
      if (!savedPath) return;
      const key = hasUnsavedChanges ? 'itemCsv.exportedUnsaved' : 'itemCsv.exported';
      showSuccess(t(key, { count: workingItems.length, path: savedPath }), { duration: 5000 });
    } catch (error) {
      showWarning(
        t('itemCsv.exportFailed', { error: error instanceof Error ? error.message : String(error) })
      );
    }
  };

  const handleImportCsv = async () => {
    try {
      const file = await window.electronAPI.readItemsCsv();
      if (!file) return;
      const plan = planCsvImport(file.text, workingItems, orderedDataFiles, selectedDataFile);
      setCsvImport({ fileName: file.filePath, text: file.text, plan, planned: workingItems });
    } catch (error) {
      showWarning(
        t('itemCsv.readFailed', { error: error instanceof Error ? error.message : String(error) })
      );
    }
  };

  const confirmCsvImport = () => {
    if (!csvImport) return;
    if (csvImport.planned !== workingItems) {
      const plan = planCsvImport(csvImport.text, workingItems, orderedDataFiles, selectedDataFile);
      setCsvImport({ ...csvImport, plan, planned: workingItems });
      showWarning(t('itemCsv.replanned'));
      return;
    }
    const { plan } = csvImport;
    setCsvImport(null);
    // 取り込んだ行が絞り込みで隠れないように、検索と絞り込みを外す
    if (searchQuery) onSearchChange('');
    listView.clearFilters();
    editing.applyCsvImport(plan);
    showInfo(
      t('itemCsv.imported', { updates: plan.updates.length, additions: plan.additions.length })
    );
  };

  /** 削除の確認を出してから削除する（行のボタン・右クリック・Delete キー・一括削除の共通経路） */
  // 削除の確認で、今の（未保存の編集を含む）アイテムを読むための参照
  const workingItemsRef = useRef(workingItems);
  workingItemsRef.current = workingItems;

  const handleRequestDelete = useCallback(
    async (items: EditableJsonItem[]) => {
      if (items.length === 0) return;
      const names = items
        .map((item) => t('itemManager.quotedName', { name: describeItem(item) }))
        .join(t('common.listSeparator'));
      const question =
        items.length === 1
          ? t('itemManager.deleteConfirmOne', { names })
          : items.length <= 3
            ? t('itemManager.deleteConfirmFew', { names, count: items.length })
            : t('itemManager.deleteConfirmMany', { count: items.length });
      // ファイルを消すのかと迷わないよう、何が消えるかを添える（クリップボードは保存した中身も消える）
      const notes: string[] = [t('itemManager.deleteKeepsFiles')];
      if (items.some((item) => item.item.type === 'clipboard')) {
        notes.push(t('itemManager.deleteClipboardData'));
      }
      // ワークスペースから参照されていれば、参照が「元のアイテムが見つかりません」になることを添える
      const refCounts = await window.electronAPI.workspaceAPI
        .countRefs(items.map((item) => item.item.id))
        .catch(() => ({}) as Record<string, number>);
      const refCount = Object.values(refCounts).reduce((sum, n) => sum + n, 0);
      if (refCount > 0) notes.push(t('workspace.ref.deleteWarning', { count: refCount }));
      // セットの行が指していれば、その行が開けなくなることを添える（未保存の編集を含めて見る。A3-79 #6）
      const setWarning = setUsageWarning(
        findSetNamesUsingItems(
          workingItemsRef.current.map((item) => item.item),
          items.map((item) => item.item.id)
        ),
        t
      );
      if (setWarning) notes.push(setWarning);
      const message = `${question}\n\n${notes.join('\n')}`;
      openConfirmDialog({ message, confirmText: t('itemManager.deleteButton'), danger: true }, () =>
        editing.deleteItems(items)
      );
    },
    // openConfirmDialog は毎レンダー作られるが setState しか呼ばないので依存に含めない
    [editing.deleteItems, t]
  );

  const handleDeleteSelected = () => void handleRequestDelete(visibleSelectedItems);

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

  // タブを消したなどで選択中のタブが無くなったら、最後のタブを選ぶ
  useEffect(() => {
    if (dataFileTabs.length > 0 && selectedTabIndex >= dataFileTabs.length) {
      setSelectedTabIndex(dataFileTabs.length - 1);
    }
  }, [dataFileTabs.length, selectedTabIndex]);

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
      <AdminItemManagerToolbar
        onAddItem={handleAddItem}
        onAddFolder={handleAddFolder}
        onOpenBookmarkImport={imports.openBookmarkModal}
        onOpenAppImport={imports.openAppImportModal}
        onImportCsv={() => void handleImportCsv()}
        onExportCsv={() => void handleExportCsv()}
        onOpenAutoImportSettings={onOpenAutoImportSettings}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        filters={filters}
        onClearColumnFilter={(column) => setColumnFilter(column, undefined)}
        onClearAllFilters={listView.clearFilters}
        ruleNames={autoImportRuleMap}
        onCheckMissingPaths={() => void handleCheckMissingPaths()}
        checkingMissingPaths={pathCheck.checking}
        onDedupe={handleDedupe}
        selectedCount={visibleSelectedItems.length}
        onDeleteSelected={handleDeleteSelected}
        onDuplicateSelected={() => editing.duplicateItems(visibleSelectedItems)}
        onClearSelection={() => editing.selectAll(filteredItems, false)}
        hasUnsavedChanges={hasUnsavedChanges}
        unsavedCount={changedIds.size + deletedCount}
        onDiscard={handleDiscardChanges}
        onSave={handleSaveChanges}
      />

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
          onSort={setSort}
          columns={columns}
          filters={filters}
          onFilterChange={setColumnFilter}
          filterOptions={filterOptions}
          linkStatusOf={linkStatusOf}
          missingSetRowsOf={missingSetRowsOf}
          usageOf={launchUsage.usageOf}
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
          {isFiltered && filteredItems.length !== fileItemCount
            ? t('itemManager.status.totalFiltered', {
                count: filteredItems.length,
                total: fileItemCount,
              })
            : t('itemManager.status.total', { count: filteredItems.length })}
        </span>
        {invalidCount > 0 && (
          <span className="invalid-count">
            {t('itemManager.status.invalid', { count: invalidCount })}
          </span>
        )}
        {pathCheck.hasChecked && (
          <span className="missing-count" title={t('itemManager.missingCheck.statusTitle')}>
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

      {imports.isBookmarkModalOpen && (
        <BookmarkImportModal
          existingItems={workingItems}
          dataFileTabs={dataFileTabs}
          dataFileLabels={dataFileLabels}
          initialTabIndex={selectedTabIndex}
          onImport={imports.handleBookmarkImport}
          onSaveAsRule={imports.handleBookmarkSaveAsRule}
          onCancel={imports.closeBookmarkModal}
          onOpenAutoImportSettings={onOpenAutoImportSettings}
          autoImportRuleCount={autoImportSettings.rules.length}
        />
      )}

      <AppImportModal
        isOpen={imports.isAppImportModalOpen}
        onClose={imports.closeAppImportModal}
        onImport={imports.handleAppImport}
        existingItems={workingItems}
        dataFileTabs={dataFileTabs}
        dataFileLabels={dataFileLabels}
        initialTabIndex={selectedTabIndex}
      />

      {csvImport && (
        <AdminItemCsvImportModal
          fileName={csvImport.fileName}
          plan={csvImport.plan}
          getFileLabel={getFileLabel}
          onConfirm={confirmCsvImport}
          onCancel={() => setCsvImport(null)}
        />
      )}

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
