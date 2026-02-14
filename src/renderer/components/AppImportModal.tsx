import type { ReactElement } from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ScannedAppItem, DuplicateHandlingOption, AppTargetType } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { checkAppDuplicates } from '@common/utils/appDuplicateDetector';

import { logError } from '../utils/debug';

import AlertDialog from './AlertDialog';
import { Button } from './ui';

/** ターゲットタイプのラベル */
const TARGET_TYPE_LABELS: Record<AppTargetType, string> = {
  app: '実行ファイル',
  other: 'その他',
};

interface AppImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (apps: ScannedAppItem[], duplicateHandling: DuplicateHandlingOption) => void;
  existingItems: EditableJsonItem[];
  importDestination: string;
}

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
  const [typeFilter, setTypeFilter] = useState<AppTargetType | 'all'>('app');
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

  // モーダル表示時にスタートメニューを自動スキャン
  useEffect(() => {
    if (isOpen) {
      const scanApps = async () => {
        setLoading(true);
        try {
          const result = await window.electronAPI.scanInstalledApps();
          setApps(result.apps);
          setScanDuration(result.scanDuration);
          setSelectedIds(
            new Set(result.apps.filter((a) => a.targetType === 'app').map((a) => a.id))
          );

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

  // タイプごとの件数を集計
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: apps.length };
    for (const app of apps) {
      counts[app.targetType] = (counts[app.targetType] || 0) + 1;
    }
    return counts;
  }, [apps]);

  // フィルタリングされたアプリ
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      if (typeFilter !== 'all' && app.targetType !== typeFilter) return false;
      if (!searchQuery) return true;
      const searchLower = searchQuery.toLowerCase();
      return (
        app.displayName.toLowerCase().includes(searchLower) ||
        app.targetPath.toLowerCase().includes(searchLower)
      );
    });
  }, [apps, typeFilter, searchQuery]);

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
    setTypeFilter('app');
    setDuplicateHandling('skip');
    onClose();
  }, [onClose]);

  // キーボードショートカット
  useEffect(() => {
    if (!isOpen) return;

    modalRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = modalRef.current;
      if (!modal) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        handleClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusableElement = focusableElements[0] as HTMLElement;
        const lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        } else {
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      const isModalFocused = modal.contains(document.activeElement);
      if (isModalFocused) {
        const activeElement = document.activeElement as HTMLElement;
        const isInputField =
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT');

        if (isInputField) {
          if (
            event.key.length === 1 ||
            [
              'Backspace',
              'Delete',
              'ArrowLeft',
              'ArrowRight',
              'ArrowUp',
              'ArrowDown',
              'Home',
              'End',
            ].includes(event.key) ||
            (event.ctrlKey && ['a', 'c', 'v', 'x', 'z', 'y'].includes(event.key))
          ) {
            event.stopPropagation();
            event.stopImmediatePropagation();
            return;
          }
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, handleClose]);

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
              <div className="app-type-filter">
                <span className="app-type-filter-label">種別:</span>
                <div className="app-type-filter-buttons">
                  <button
                    className={`app-type-filter-button ${typeFilter === 'all' ? 'selected' : ''}`}
                    onClick={() => setTypeFilter('all')}
                  >
                    すべて ({typeCounts['all'] || 0})
                  </button>
                  {(['app', 'other'] as AppTargetType[])
                    .filter((type) => (typeCounts[type] || 0) > 0)
                    .map((type) => (
                      <button
                        key={type}
                        className={`app-type-filter-button ${typeFilter === type ? 'selected' : ''}`}
                        onClick={() => setTypeFilter(type)}
                      >
                        {TARGET_TYPE_LABELS[type]} ({typeCounts[type]})
                      </button>
                    ))}
                </div>
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
                      <span
                        className={`app-type-badge app-type-${app.targetType}`}
                        title={app.targetExtension}
                      >
                        {TARGET_TYPE_LABELS[app.targetType]}
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
