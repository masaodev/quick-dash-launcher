import type { ReactElement } from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import type { ScannedAppItem, DuplicateHandlingOption, DataFileTab } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { checkAppDuplicates } from '@common/utils/appDuplicateDetector';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import {
  NEW_FILE,
  useImportDestination,
  type ImportDestination,
} from '../hooks/useImportDestination';
import { logError } from '../utils/debug';

import AlertDialog from './AlertDialog';
import { Button } from './ui';
import DuplicateHandlingSection from './DuplicateHandlingSection';
import ImportDestinationBand from './ImportDestinationBand';

/**
 * 画面: アプリ取込画面
 * 画面仕様: docs/screens/app-import-modal.md
 *
 * スタートメニューのアプリから使うものを選び、データファイルに取り込む。選び方は 1 件ずつのチェック（初期は未選択）。
 * 取込先は登録画面の「保存先」の帯と同じ形で選び、初期値は「選択中のタブに新しいデータファイルを作る」。
 * 新しいタブ・ファイルは「取り込む」を押した時点で作る（キャンセルなら何も作らない）。
 */

/** 取込先（ブックマーク取込と共通の形） */
export type AppImportDestination = ImportDestination;

interface FilterOptions {
  excludeUninstallers: boolean;
  deduplicateLnkPriority: boolean;
  excludeNonApps: boolean;
}

interface AppImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 取り込む。取込先のファイルを作れなかったときは false（画面を開いたままにする） */
  onImport: (
    apps: ScannedAppItem[],
    duplicateHandling: DuplicateHandlingOption,
    destination: AppImportDestination
  ) => Promise<boolean>;
  /** アイテム管理の作業中のアイテム（全ファイル分。登録済みの判定に使う） */
  existingItems: EditableJsonItem[];
  dataFileTabs: DataFileTab[];
  dataFileLabels: Record<string, string>;
  /** アイテム管理で選んでいるタブ（取込先の初期値） */
  initialTabIndex: number;
}

const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  excludeUninstallers: true,
  deduplicateLnkPriority: true,
  excludeNonApps: true,
};

function AppImportModal({
  isOpen,
  onClose,
  onImport,
  existingItems,
  dataFileTabs,
  dataFileLabels,
  initialTabIndex,
}: AppImportModalProps): ReactElement | null {
  const { t } = useTranslation();
  const [apps, setApps] = useState<ScannedAppItem[]>([]);
  // 初期は未選択。使うアプリだけを選んで取り込む（登録型のランチャーなので全部は入れない）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  // 再スキャンのたびに増やし、スキャンの effect を走らせ直す
  const [scanCount, setScanCount] = useState(0);
  // アイコンはrefのMapに蓄積し、バッチごとにバージョン更新で再描画する
  // （stateのオブジェクトコピーだとバッチ毎に全件コピーでO(N²)になるため）
  const iconsRef = useRef<Map<string, string | null>>(new Map());
  const [, setIconVersion] = useState(0);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(DEFAULT_FILTER_OPTIONS);
  const [showExcluded, setShowExcluded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // 重複処理オプション
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandlingOption>('skip');

  // 取込先（開くたびに「選択中のタブに新しいデータファイル」に戻す）
  const dest = useImportDestination({
    isOpen,
    dataFileTabs,
    dataFileLabels,
    initialTabIndex,
    defaultName: t('appImport.defaultName'),
  });
  const [importing, setImporting] = useState(false);

  // AlertDialog状態管理
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    message: string;
    type?: 'info' | 'error' | 'warning' | 'success';
  }>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  // 各フィルタで除外される件数
  const filterCounts = useMemo(() => {
    const uninstallerCount = apps.filter((a) => a.isUninstaller).length;
    const nonAppCount = apps.filter((a) => a.targetType === 'other').length;

    // 重複統合の件数: 同一displayNameで複数あるもののうち、lnk以外が除外される件数
    const nameGroups = new Map<string, ScannedAppItem[]>();
    for (const app of apps) {
      const group = nameGroups.get(app.displayName) || [];
      group.push(app);
      nameGroups.set(app.displayName, group);
    }
    let deduplicateCount = 0;
    for (const group of nameGroups.values()) {
      if (group.length > 1) {
        const hasLnk = group.some((a) => a.source === 'lnk');
        if (hasLnk) {
          deduplicateCount += group.filter((a) => a.source !== 'lnk').length;
        } else {
          deduplicateCount += group.length - 1;
        }
      }
    }

    return { uninstallerCount, deduplicateCount, nonAppCount };
  }, [apps]);

  // 除外条件に当たるアイテムの id
  const excludedIds = useMemo(() => {
    const excluded = new Set<string>();

    // 条件に合致するアイテムを除外対象としてマーク
    function markExcluded(
      items: ScannedAppItem[],
      shouldExclude: (a: ScannedAppItem) => boolean
    ): ScannedAppItem[] {
      const kept: ScannedAppItem[] = [];
      for (const a of items) {
        if (shouldExclude(a)) excluded.add(a.id);
        else kept.push(a);
      }
      return kept;
    }

    let result = [...apps];

    if (filterOptions.excludeUninstallers) {
      result = markExcluded(result, (a) => a.isUninstaller);
    }
    if (filterOptions.excludeNonApps) {
      result = markExcluded(result, (a) => a.targetType === 'other');
    }

    // 重複統合（ショートカット版を優先）
    if (filterOptions.deduplicateLnkPriority) {
      const nameGroups = new Map<string, ScannedAppItem[]>();
      for (const app of result) {
        const group = nameGroups.get(app.displayName) || [];
        group.push(app);
        nameGroups.set(app.displayName, group);
      }
      for (const group of nameGroups.values()) {
        const kept =
          (group.length > 1 ? group.find((a) => a.source === 'lnk') : undefined) || group[0];
        for (const a of group) {
          if (a !== kept) excluded.add(a.id);
        }
      }
    }

    return excluded;
  }, [apps, filterOptions]);

  // 取込先にすでにあるアプリの id。新しいファイルなら、そのタブのほかのファイルと照らす
  // （印を出すだけで、新しいファイルは空なので重複の扱いは聞かない）
  const destItems = useMemo(
    () => existingItems.filter((item) => dest.compareFiles.includes(item.meta.sourceFile)),
    [existingItems, dest.compareFiles]
  );
  const registeredIds = useMemo(
    () => new Set(checkAppDuplicates(apps, destItems).duplicateBookmarkIds),
    [apps, destItems]
  );

  // 一覧に出すアプリ（除外条件 + 検索）
  const visibleApps = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return apps.filter((app) => {
      if (!showExcluded && excludedIds.has(app.id)) return false;
      if (!searchLower) return true;
      return (
        app.displayName.toLowerCase().includes(searchLower) ||
        app.targetPath.toLowerCase().includes(searchLower)
      );
    });
  }, [apps, excludedIds, showExcluded, searchQuery]);

  // 行の仮想化: スクロールコンテナは .app-list-container。
  // テーブル構造（sticky thead・列幅）を保つため、可視範囲外は上下のスペーサー行で高さを確保する
  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: visibleApps.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 34, // パディング + 1行分のテキスト。折り返し行はmeasureElementで実測補正
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  // モーダル表示時と再スキャン時にスタートメニューをスキャン
  useEffect(() => {
    if (!isOpen) return;

    // モーダルを閉じたらスキャン結果の反映とアイコン取得ループを中断する
    const controller = new AbortController();
    const scanApps = async () => {
      setLoading(true);
      // スキャンのたびに id が振り直されるので、選択は持ち越さない
      setSelectedIds(new Set());
      try {
        const result = await window.electronAPI.scanInstalledApps();
        if (controller.signal.aborted) return;
        setApps(result.apps);

        if (result.apps.length === 0) {
          setAlertDialog({
            isOpen: true,
            message: t('appImport.notFound'),
            type: 'info',
          });
        }

        // バックグラウンドでアイコンを取得
        fetchIcons(result.apps, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return;
        logError('Error scanning installed apps:', error);
        setAlertDialog({
          isOpen: true,
          message: t('appImport.scanFailed'),
          type: 'error',
        });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    scanApps();

    return () => controller.abort();
  }, [isOpen, scanCount]);

  // バックグラウンドでアイコンを非同期取得
  const fetchIcons = async (appList: ScannedAppItem[], signal: AbortSignal) => {
    const BATCH_SIZE = 10;
    for (let i = 0; i < appList.length; i += BATCH_SIZE) {
      if (signal.aborted) return;
      const batch = appList.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (app) => {
          try {
            const icon = await window.electronAPI.extractIcon(app.shortcutPath);
            return { path: app.shortcutPath, icon };
          } catch {
            return { path: app.shortcutPath, icon: null };
          }
        })
      );
      if (signal.aborted) return;
      for (const { path: p, icon } of results) {
        iconsRef.current.set(p, icon);
      }
      setIconVersion((v) => v + 1);
    }
  };

  const selectedApps = useMemo(
    () => apps.filter((a) => selectedIds.has(a.id)),
    [apps, selectedIds]
  );
  const selectedRegisteredCount = selectedApps.filter((a) => registeredIds.has(a.id)).length;

  // 見出しのチェック: 一覧に出ている分をまとめて選ぶ・外す
  const visibleSelectedCount = visibleApps.filter((a) => selectedIds.has(a.id)).length;
  const allVisibleSelected = visibleApps.length > 0 && visibleSelectedCount === visibleApps.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const handleToggleVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const app of visibleApps) {
        if (allVisibleSelected) next.delete(app.id);
        else next.add(app.id);
      }
      return next;
    });
  };

  const handleToggleApp = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // モーダルを閉じる
  const handleClose = useCallback(() => {
    setApps([]);
    setSelectedIds(new Set());
    setSearchQuery('');
    iconsRef.current = new Map();
    setFilterOptions(DEFAULT_FILTER_OPTIONS);
    setShowExcluded(false);
    setDuplicateHandling('skip');
    onClose();
  }, [onClose]);

  const { destination, destinationText } = dest;

  // 取り込む（新しいタブ・ファイルはここで作る）
  const handleImport = async () => {
    if (selectedApps.length === 0 || importing) return;
    setImporting(true);
    try {
      const imported = await onImport(
        selectedApps,
        destination.kind === 'existing' ? duplicateHandling : 'skip',
        destination
      );
      if (imported) handleClose();
    } finally {
      setImporting(false);
    }
  };

  useModalKeyboard({ isOpen, modalRef, onClose: handleClose });

  if (!isOpen) return null;

  const selectedCount = selectedApps.length;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content import-modal app-import-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="import-header">
          <h3>{t('appImport.title')}</h3>
          <div className="import-selection">
            <span>{t('appImport.selected', { count: selectedCount })}</span>
            {selectedCount > 0 && (
              <button
                type="button"
                className="import-clear-selection"
                onClick={() => setSelectedIds(new Set())}
              >
                {t('appImport.clearSelection')}
              </button>
            )}
          </div>
        </div>

        <div className="import-hint">{t('appImport.hint')}</div>

        {/* 取込先（登録画面の保存先の帯と同じ形） */}
        <ImportDestinationBand dest={dest} />

        <div className="app-import-body">
          {/* 検索と取込元 */}
          <div className="app-import-toolbar">
            <div className="search-input-container">
              <input
                type="text"
                placeholder={t('appImport.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="close-btn close-btn-sm search-clear-button"
                  onClick={() => setSearchQuery('')}
                  type="button"
                  aria-label={t('appImport.clearSearch')}
                >
                  ×
                </button>
              )}
            </div>
            <div className="app-import-source">
              <span className="app-import-status">
                {loading ? t('appImport.scanning') : t('appImport.found', { count: apps.length })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setScanCount((c) => c + 1)}
                disabled={loading}
              >
                {t('appImport.rescan')}
              </Button>
            </div>
          </div>

          <div className="app-filter-checkboxes">
            {(
              [
                {
                  key: 'excludeUninstallers',
                  label: t('appImport.excludeUninstallers'),
                  count: filterCounts.uninstallerCount,
                },
                {
                  key: 'deduplicateLnkPriority',
                  label: t('appImport.deduplicateLnkPriority'),
                  count: filterCounts.deduplicateCount,
                },
                {
                  key: 'excludeNonApps',
                  label: t('appImport.excludeNonApps'),
                  count: filterCounts.nonAppCount,
                },
              ] as const
            ).map(({ key, label, count }) => (
              <label key={key} className="app-filter-checkbox">
                <input
                  type="checkbox"
                  checked={filterOptions[key]}
                  onChange={(e) =>
                    setFilterOptions((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
                <span>
                  {label}
                  {count > 0 && t('appImport.filterCount', { count })}
                </span>
              </label>
            ))}
            <label className="app-filter-checkbox">
              <input
                type="checkbox"
                checked={showExcluded}
                onChange={(e) => setShowExcluded(e.target.checked)}
              />
              <span>
                {t('appImport.showExcluded')}
                {excludedIds.size > 0 && t('appImport.filterCount', { count: excludedIds.size })}
              </span>
            </label>
          </div>

          {/* アプリ一覧 */}
          <div className="app-list-container" ref={listRef}>
            <table className="app-table">
              <thead>
                <tr>
                  <th className="checkbox-column">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleToggleVisible}
                      disabled={visibleApps.length === 0}
                      title={t('appImport.toggleVisible')}
                      aria-label={t('appImport.toggleVisible')}
                    />
                  </th>
                  <th className="icon-column"></th>
                  <th className="name-column">
                    {t('appImport.list', { count: visibleApps.length })}
                  </th>
                  <th className="type-column">{t('appImport.type')}</th>
                </tr>
              </thead>
              <tbody>
                {paddingTop > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={4} style={{ height: paddingTop, padding: 0, border: 'none' }} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const app = visibleApps[virtualRow.index];
                  const icon = iconsRef.current.get(app.shortcutPath);
                  const rowClasses = [
                    selectedIds.has(app.id) ? 'selected' : '',
                    excludedIds.has(app.id) ? 'excluded' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <tr
                      key={app.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className={rowClasses}
                      onClick={() => handleToggleApp(app.id)}
                    >
                      <td className="checkbox-column">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(app.id)}
                          onChange={() => handleToggleApp(app.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="icon-column">
                        {icon ? (
                          <img src={icon} alt="" className="app-icon" />
                        ) : (
                          <span className="app-icon-placeholder" />
                        )}
                      </td>
                      <td className="name-column">
                        <div className="app-name">
                          {app.displayName}
                          {registeredIds.has(app.id) && (
                            <span
                              className="app-registered-badge"
                              title={
                                dest.destFile === NEW_FILE
                                  ? t('appImport.registeredInTab')
                                  : undefined
                              }
                            >
                              {t('appImport.registered')}
                            </span>
                          )}
                        </div>
                        <div className="app-path">{app.targetPath}</div>
                      </td>
                      <td className="type-column">
                        <span className="app-type-badge" title={app.targetPath}>
                          {app.targetExtension}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={4} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
                  </tr>
                )}
              </tbody>
            </table>
            {!loading && apps.length > 0 && visibleApps.length === 0 && (
              <div className="app-list-empty">{t('appImport.noMatches')}</div>
            )}
          </div>
        </div>

        {/* 登録済みを選んだときの扱い（既存のファイルに入れるときだけ。新しいファイルは空なので聞かない） */}
        {dest.destFile !== NEW_FILE && selectedRegisteredCount > 0 && (
          <DuplicateHandlingSection
            message={t('appImport.registeredSelected', { count: selectedRegisteredCount })}
            value={duplicateHandling}
            onChange={setDuplicateHandling}
            name="appDuplicateHandling"
          />
        )}

        <div className="import-footer">
          <span className="import-echo">
            {t('importCommon.destinationEcho', { target: destinationText })}
          </span>
          <div className="import-actions">
            <Button variant="secondary" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleImport()}
              disabled={selectedCount === 0 || importing}
            >
              {t('appImport.import', { count: selectedCount })}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        message={alertDialog.message}
        type={alertDialog.type}
      />
    </div>
  );
}

export default AppImportModal;
