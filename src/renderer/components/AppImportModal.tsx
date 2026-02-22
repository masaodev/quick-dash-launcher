import type { ReactElement } from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ScannedAppItem, DuplicateHandlingOption } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { checkAppDuplicates } from '@common/utils/appDuplicateDetector';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { logError } from '../utils/debug';

import AlertDialog from './AlertDialog';
import { Button } from './ui';

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanDuration, setScanDuration] = useState<number | null>(null);
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(DEFAULT_FILTER_OPTIONS);
  const [viewMode, setViewMode] = useState<'filtered' | 'all' | 'excluded'>('filtered');
  const modalRef = useRef<HTMLDivElement>(null);

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

  // フィルタ適用結果と除外済みアイテムを計算
  const { coreFiltered, coreExcluded } = useMemo(() => {
    const excludedIds = new Set<string>();

    // 条件に合致するアイテムを除外対象としてマーク
    function markExcluded(
      items: ScannedAppItem[],
      shouldExclude: (a: ScannedAppItem) => boolean
    ): ScannedAppItem[] {
      const kept: ScannedAppItem[] = [];
      for (const a of items) {
        if (shouldExclude(a)) excludedIds.add(a.id);
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
      const deduplicated: ScannedAppItem[] = [];
      for (const group of nameGroups.values()) {
        const kept =
          (group.length > 1 ? group.find((a) => a.source === 'lnk') : undefined) || group[0];
        deduplicated.push(kept);
        for (const a of group) {
          if (a !== kept) excludedIds.add(a.id);
        }
      }
      result = deduplicated;
    }

    return {
      coreFiltered: result,
      coreExcluded: apps.filter((a) => excludedIds.has(a.id)),
    };
  }, [apps, filterOptions]);

  // ビューモードに応じた表示アプリ（+ 検索フィルタ）
  const filteredApps = useMemo(() => {
    let result: ScannedAppItem[];
    if (viewMode === 'filtered') result = coreFiltered;
    else if (viewMode === 'excluded') result = coreExcluded;
    else result = apps;

    if (!searchQuery) return result;

    const searchLower = searchQuery.toLowerCase();
    return result.filter(
      (app) =>
        app.displayName.toLowerCase().includes(searchLower) ||
        app.targetPath.toLowerCase().includes(searchLower)
    );
  }, [apps, coreFiltered, coreExcluded, viewMode, searchQuery]);

  // モーダル表示時にスタートメニューを自動スキャン
  useEffect(() => {
    if (isOpen) {
      const scanApps = async () => {
        setLoading(true);
        try {
          const result = await window.electronAPI.scanInstalledApps();
          setApps(result.apps);
          setScanDuration(result.scanDuration);

          if (result.apps.length === 0) {
            setAlertDialog({
              isOpen: true,
              message: 'インストール済みアプリが見つかりませんでした',
              type: 'info',
            });
          }

          // バックグラウンドでアイコンを取得
          fetchIcons(result.apps);
        } catch (error) {
          logError('Error scanning installed apps:', error);
          setAlertDialog({
            isOpen: true,
            message: 'アプリのスキャンに失敗しました',
            type: 'error',
          });
        } finally {
          setLoading(false);
        }
      };
      scanApps();
    }
  }, [isOpen]);

  // フィルタ適用後のアプリが変わったら初期選択を更新
  useEffect(() => {
    if (apps.length > 0 && !loading) {
      setSelectedIds(new Set(coreFiltered.map((a) => a.id)));
    }
  }, [coreFiltered, apps.length, loading]);

  // バックグラウンドでアイコンを非同期取得
  const fetchIcons = async (appList: ScannedAppItem[]) => {
    const BATCH_SIZE = 10;
    for (let i = 0; i < appList.length; i += BATCH_SIZE) {
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
      setIcons((prev) => {
        const updated = { ...prev };
        for (const { path: p, icon } of results) {
          updated[p] = icon;
        }
        return updated;
      });
    }
  };

  // 選択されたアプリの重複チェック
  const duplicateCheckResult = useMemo(() => {
    const selectedApps = apps.filter((a) => selectedIds.has(a.id));
    if (selectedApps.length === 0) {
      return null;
    }
    return checkAppDuplicates(selectedApps, existingItems);
  }, [apps, selectedIds, existingItems]);

  // 選択操作の共通処理
  const updateSelection = (ids: string[], action: 'add' | 'remove' | 'set') => {
    setSelectedIds((prev) => {
      if (action === 'set') {
        return new Set(ids);
      }
      const newSet = new Set(prev);
      ids.forEach((id) => (action === 'add' ? newSet.add(id) : newSet.delete(id)));
      return newSet;
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

  const handleSelectFiltered = () =>
    updateSelection(
      filteredApps.map((a) => a.id),
      'add'
    );
  const handleDeselectFiltered = () =>
    updateSelection(
      filteredApps.map((a) => a.id),
      'remove'
    );
  const handleSelectAll = () =>
    updateSelection(
      apps.map((a) => a.id),
      'set'
    );
  const handleDeselectAll = () => setSelectedIds(new Set());

  // インポート実行
  const handleImport = () => {
    const selectedApps = apps.filter((a) => selectedIds.has(a.id));
    if (selectedApps.length === 0) {
      setAlertDialog({
        isOpen: true,
        message: 'インポートするアプリを選択してください',
        type: 'warning',
      });
      return;
    }

    onImport(selectedApps, duplicateHandling);
    handleClose();
  };

  // モーダルを閉じる
  const handleClose = useCallback(() => {
    setApps([]);
    setSelectedIds(new Set());
    setSearchQuery('');
    setScanDuration(null);
    setIcons({});
    setFilterOptions(DEFAULT_FILTER_OPTIONS);
    setViewMode('filtered');
    setDuplicateHandling('skip');
    onClose();
  }, [onClose]);

  useModalKeyboard({ isOpen, modalRef, onClose: handleClose });

  if (!isOpen) return null;

  const selectedCount = selectedIds.size;
  const filteredSelectedCount = filteredApps.filter((a) => selectedIds.has(a.id)).length;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content app-import-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2>インストール済みアプリの追加</h2>
          <button className="close-button" onClick={handleClose}>
            &#10005;
          </button>
        </div>

        <div className="import-destination-bar">
          <span className="import-destination-label">インポート先:</span>
          <span className="import-destination-value">{importDestination}</span>
        </div>

        <div className="app-import-controls">
          {loading && (
            <div className="app-scan-status">
              <span className="loading-text">スタートメニューをスキャン中...</span>
            </div>
          )}

          {!loading && apps.length > 0 && (
            <>
              <div className="app-scan-status">
                <span className="app-scan-info">
                  {apps.length}件のアプリが見つかりました
                  {scanDuration !== null && ` (${scanDuration}ms)`}
                </span>
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
              </div>
              <div className="app-view-mode-buttons">
                {(
                  [
                    { mode: 'filtered', label: 'フィルタ適用', count: coreFiltered.length },
                    { mode: 'all', label: '全体', count: apps.length },
                    { mode: 'excluded', label: '除外済み', count: coreExcluded.length },
                  ] as const
                ).map(({ mode, label, count }) => (
                  <button
                    key={mode}
                    className={`app-view-mode-button ${viewMode === mode ? 'selected' : ''}`}
                    onClick={() => setViewMode(mode)}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>
              <div className="search-and-actions">
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
                <div className="app-filtered-actions">
                  <button onClick={handleSelectFiltered} className="app-action-button">
                    表示中を選択
                  </button>
                  <button onClick={handleDeselectFiltered} className="app-action-button">
                    表示中を解除
                  </button>
                </div>
                <div className="app-all-actions">
                  <button onClick={handleSelectAll} className="app-action-button">
                    全て選択
                  </button>
                  <button onClick={handleDeselectAll} className="app-action-button">
                    全て解除
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {apps.length > 0 && (
          <div className="app-list-container">
            <table className="app-table">
              <thead>
                <tr>
                  <th className="checkbox-column">選択</th>
                  <th className="icon-column"></th>
                  <th className="name-column">アプリ名</th>
                  <th className="type-column">種別</th>
                  <th className="path-column">ターゲットパス</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((app) => (
                  <tr key={app.id} className={selectedIds.has(app.id) ? 'selected' : ''}>
                    <td className="checkbox-column">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(app.id)}
                        onChange={() => handleToggleApp(app.id)}
                      />
                    </td>
                    <td className="icon-column">
                      {icons[app.shortcutPath] ? (
                        <img src={icons[app.shortcutPath]!} alt="" className="app-icon" />
                      ) : (
                        <span className="app-icon-placeholder" />
                      )}
                    </td>
                    <td className="name-column">{app.displayName}</td>
                    <td className="type-column">
                      <span className="app-type-badge" title={app.targetPath}>
                        {app.targetExtension}
                      </span>
                    </td>
                    <td className="path-column">{app.targetPath}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 重複警告セクション */}
        {duplicateCheckResult && duplicateCheckResult.duplicateCount > 0 && (
          <div className="duplicate-warning-section">
            <div className="duplicate-warning-message">
              <span className="duplicate-warning-icon">&#9888;</span>
              <span>{duplicateCheckResult.duplicateCount}件の重複が検出されました</span>
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

        <div className="modal-footer">
          <div className="status-info">
            {apps.length > 0 && (
              <span>
                {filteredApps.length}件中{filteredSelectedCount}件を選択中
                {searchQuery && ` (全体: ${apps.length}件中${selectedCount}件)`}
              </span>
            )}
          </div>
          <div className="app-modal-actions">
            <Button variant="cancel" onClick={handleClose}>
              キャンセル
            </Button>
            <Button variant="primary" onClick={handleImport} disabled={selectedCount === 0}>
              インポート ({selectedCount}件)
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
