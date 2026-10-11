import type { ReactElement } from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ScannedAppItem, DuplicateHandlingOption } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { checkAppDuplicates } from '@common/utils/appDuplicateDetector';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { logError } from '../utils/debug';

import AlertDialog from './AlertDialog';
import { Button } from './ui';

/**
 * 画面: アプリ取込画面
 * 画面仕様: docs/screens/app-import-modal.md
 *
 * スタートメニューのアプリから使うものを選び、アイテム管理で開いているデータファイルに取り込む。
 * 区画の並びと言葉はブックマーク取込画面にそろえ、選び方は 1 件ずつのチェック（初期は未選択）。
 */

interface FilterOptions {
  excludeUninstallers: boolean;
  deduplicateLnkPriority: boolean;
  excludeNonApps: boolean;
}

interface AppImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (apps: ScannedAppItem[], duplicateHandling: DuplicateHandlingOption) => void;
  existingItems: EditableJsonItem[];
  importDestination: string;
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
  importDestination,
}: AppImportModalProps): ReactElement | null {
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

  // 取込先にすでにあるアプリの id
  const registeredIds = useMemo(
    () => new Set(checkAppDuplicates(apps, existingItems).duplicateBookmarkIds),
    [apps, existingItems]
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
            message: 'インストール済みアプリが見つかりませんでした',
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
          message: 'アプリのスキャンに失敗しました',
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

  // 取り込む
  const handleImport = () => {
    if (selectedApps.length === 0) return;
    onImport(selectedApps, duplicateHandling);
    handleClose();
  };

  useModalKeyboard({ isOpen, modalRef, onClose: handleClose });

  if (!isOpen) return null;

  const selectedCount = selectedApps.length;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content app-import-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <h3>インストール済みアプリの追加</h3>

        <div className="app-import-hint">
          使うアプリにチェックを入れて取り込みます。取り込んだアプリは未保存の変更として追加され、「変更を保存」で確定します。
        </div>

        <div className="app-import-body">
          {/* 取込元 */}
          <div className="app-import-section">
            <h4>取込元</h4>
            <div className="app-import-source">
              <span className="app-import-status">
                {loading
                  ? 'スタートメニューをスキャン中...'
                  : `スタートメニューから ${apps.length} 件見つかりました`}
              </span>
              <Button
                variant="info"
                size="sm"
                onClick={() => setScanCount((c) => c + 1)}
                disabled={loading}
              >
                再スキャン
              </Button>
            </div>
          </div>

          {/* 絞り込み */}
          <div className="app-import-section">
            <h4>絞り込み</h4>
            <div className="search-input-container">
              <input
                type="text"
                placeholder="アプリ名またはパスで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="search-clear-button"
                  onClick={() => setSearchQuery('')}
                  type="button"
                  aria-label="検索をクリア"
                >
                  ×
                </button>
              )}
            </div>
            <div className="app-filter-checkboxes">
              {(
                [
                  {
                    key: 'excludeUninstallers',
                    label: 'アンインストーラーを除外',
                    count: filterCounts.uninstallerCount,
                  },
                  {
                    key: 'deduplicateLnkPriority',
                    label: '重複を統合（ショートカット版を優先）',
                    count: filterCounts.deduplicateCount,
                  },
                  {
                    key: 'excludeNonApps',
                    label: 'アプリ以外を除外',
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
                    {count > 0 && ` (${count}件)`}
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
                  除外したものも表示
                  {excludedIds.size > 0 && ` (${excludedIds.size}件)`}
                </span>
              </label>
            </div>
          </div>

          {/* 取込先（アイテム管理で開いているデータファイルに固定） */}
          <div className="app-import-section">
            <h4>取込先</h4>
            <div className="app-import-destination">
              <span className="app-import-destination-value">{importDestination}</span>
              <span className="field-description">
                別のデータファイルに取り込むときは、アイテム管理で切り替えてから開いてください
              </span>
            </div>
          </div>

          {/* アプリ一覧 */}
          <div className="app-import-section app-import-list-section">
            <h4>アプリ一覧（{visibleApps.length}件）</h4>
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
                        title="表示中のアプリをまとめて選ぶ・外す"
                        aria-label="表示中のアプリをまとめて選ぶ・外す"
                      />
                    </th>
                    <th className="icon-column"></th>
                    <th className="name-column">アプリ名</th>
                    <th className="type-column">種別</th>
                    <th className="path-column">ターゲットパス</th>
                  </tr>
                </thead>
                <tbody>
                  {paddingTop > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={5} style={{ height: paddingTop, padding: 0, border: 'none' }} />
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
                          {app.displayName}
                          {registeredIds.has(app.id) && (
                            <span className="app-registered-badge">登録済み</span>
                          )}
                        </td>
                        <td className="type-column">
                          <span className="app-type-badge" title={app.targetPath}>
                            {app.targetExtension}
                          </span>
                        </td>
                        <td className="path-column">{app.targetPath}</td>
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={5}
                        style={{ height: paddingBottom, padding: 0, border: 'none' }}
                      />
                    </tr>
                  )}
                </tbody>
              </table>
              {!loading && apps.length > 0 && visibleApps.length === 0 && (
                <div className="app-list-empty">条件に一致するアプリはありません</div>
              )}
            </div>
          </div>
        </div>

        {/* 登録済みを選んだときの扱い */}
        {selectedRegisteredCount > 0 && (
          <div className="duplicate-warning-section">
            <div className="duplicate-warning-message">
              <span className="duplicate-warning-icon">&#9888;</span>
              <span>選んだアプリのうち {selectedRegisteredCount} 件は取込先に登録済みです</span>
            </div>
            <div className="duplicate-options-section">
              <span className="duplicate-options-label">重複時の処理:</span>
              <label className="duplicate-option">
                <input
                  type="radio"
                  name="appDuplicateHandling"
                  value="skip"
                  checked={duplicateHandling === 'skip'}
                  onChange={() => setDuplicateHandling('skip')}
                />
                <span>スキップ（重複アイテムはインポートしない）</span>
              </label>
              <label className="duplicate-option">
                <input
                  type="radio"
                  name="appDuplicateHandling"
                  value="overwrite"
                  checked={duplicateHandling === 'overwrite'}
                  onChange={() => setDuplicateHandling('overwrite')}
                />
                <span>上書き（既存アイテムを新しい情報で更新）</span>
              </label>
            </div>
          </div>
        )}

        <div className="app-import-footer">
          <div className="status-info">
            {selectedCount > 0 && (
              <>
                <span>{selectedCount} 件を選択中</span>
                <button
                  type="button"
                  className="app-clear-selection"
                  onClick={() => setSelectedIds(new Set())}
                >
                  選択を解除
                </button>
              </>
            )}
          </div>
          <div className="app-modal-actions">
            <Button variant="cancel" onClick={handleClose}>
              キャンセル
            </Button>
            <Button variant="primary" onClick={handleImport} disabled={selectedCount === 0}>
              取り込む ({selectedCount}件)
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
