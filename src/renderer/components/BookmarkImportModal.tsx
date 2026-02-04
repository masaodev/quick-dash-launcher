import type { ReactElement } from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  SimpleBookmarkItem,
  BrowserInfo,
  BrowserProfile,
  DuplicateHandlingOption,
} from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { checkDuplicates } from '@common/utils/duplicateDetector';

import { logError } from '../utils/debug';

import AlertDialog from './AlertDialog';
import { Button } from './ui';

type ImportSource = 'chrome' | 'edge' | 'html';

interface BookmarkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (bookmarks: SimpleBookmarkItem[], duplicateHandling: DuplicateHandlingOption) => void;
  existingItems: EditableJsonItem[];
}

function BookmarkImportModal({
  isOpen,
  onClose,
  onImport,
  existingItems,
}: BookmarkImportModalProps): ReactElement | null {
  const [bookmarks, setBookmarks] = useState<SimpleBookmarkItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // 重複処理オプション
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandlingOption>('skip');

  // ブラウザ直接インポート用の状態
  const [importSource, setImportSource] = useState<ImportSource | null>(null);
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<BrowserProfile | null>(null);
  const [loadingBrowsers, setLoadingBrowsers] = useState(false);

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

  // モーダル表示時にブラウザを検出
  useEffect(() => {
    if (isOpen) {
      const detectBrowsers = async () => {
        setLoadingBrowsers(true);
        try {
          const detectedBrowsers = await window.electronAPI.detectInstalledBrowsers();
          setBrowsers(detectedBrowsers);
        } catch (error) {
          logError('Error detecting browsers:', error);
        } finally {
          setLoadingBrowsers(false);
        }
      };
      detectBrowsers();
    }
  }, [isOpen]);

  // フィルタリングされたブックマーク
  const filteredBookmarks = bookmarks.filter((bookmark) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      bookmark.displayName.toLowerCase().includes(searchLower) ||
      bookmark.url.toLowerCase().includes(searchLower)
    );
  });

  // 選択されたブックマークの重複チェック
  const duplicateCheckResult = useMemo(() => {
    const selectedBookmarks = bookmarks.filter((b) => selectedIds.has(b.id));
    if (selectedBookmarks.length === 0) {
      return null;
    }
    return checkDuplicates(selectedBookmarks, existingItems);
  }, [bookmarks, selectedIds, existingItems]);

  // ブックマーク関連の状態をリセット
  const resetBookmarkState = useCallback(() => {
    setBookmarks([]);
    setSelectedIds(new Set());
    setSearchQuery('');
  }, []);

  // インポート元選択
  const handleSelectImportSource = (source: ImportSource) => {
    setImportSource(source);
    resetBookmarkState();
    setFileName(null);
    setSelectedProfile(null);

    // ブラウザの場合、デフォルトプロファイルを選択
    if (source === 'chrome' || source === 'edge') {
      const browser = browsers.find((b) => b.id === source);
      if (browser && browser.profiles.length > 0) {
        setSelectedProfile(browser.profiles[0]);
      }
    }
  };

  // ブラウザからブックマークを読み込む
  const handleLoadBrowserBookmarks = async () => {
    if (!selectedProfile) {
      setAlertDialog({
        isOpen: true,
        message: 'プロファイルを選択してください',
        type: 'warning',
      });
      return;
    }

    try {
      setLoading(true);
      const parsedBookmarks = await window.electronAPI.parseBrowserBookmarks(
        selectedProfile.bookmarkPath
      );
      setBookmarks(parsedBookmarks);
      setSelectedIds(new Set());

      if (parsedBookmarks.length === 0) {
        setAlertDialog({
          isOpen: true,
          message: 'ブックマークが見つかりませんでした',
          type: 'info',
        });
      }
    } catch (error) {
      logError('Error loading browser bookmarks:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'ブックマークの読み込みに失敗しました';
      setAlertDialog({
        isOpen: true,
        message: errorMessage,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // HTMLファイル選択ダイアログを開く
  const handleSelectFile = async () => {
    try {
      const filePath = await window.electronAPI.selectBookmarkFile();
      if (!filePath) return; // ユーザーがキャンセルした場合

      setLoading(true);
      setFileName(filePath.split(/[\\/]/).pop() || filePath);
      const parsedBookmarks = await window.electronAPI.parseBookmarkFile(filePath);
      setBookmarks(parsedBookmarks);
      setSelectedIds(new Set());
    } catch (error) {
      logError('Error selecting bookmark file:', error);
      setAlertDialog({
        isOpen: true,
        message: 'ブックマークファイルの読み込みに失敗しました',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // 個別選択のトグル
  const handleToggleBookmark = (id: string) => {
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

  const handleSelectFiltered = () =>
    updateSelection(
      filteredBookmarks.map((b) => b.id),
      'add'
    );
  const handleDeselectFiltered = () =>
    updateSelection(
      filteredBookmarks.map((b) => b.id),
      'remove'
    );
  const handleSelectAll = () =>
    updateSelection(
      bookmarks.map((b) => b.id),
      'set'
    );
  const handleDeselectAll = () => setSelectedIds(new Set());

  // インポート実行
  const handleImport = () => {
    const selectedBookmarks = bookmarks.filter((b) => selectedIds.has(b.id));
    if (selectedBookmarks.length === 0) {
      setAlertDialog({
        isOpen: true,
        message: 'インポートするブックマークを選択してください',
        type: 'warning',
      });
      return;
    }

    onImport(selectedBookmarks, duplicateHandling);
    handleClose();
  };

  // モーダルを閉じる
  const handleClose = useCallback(() => {
    setBookmarks([]);
    setSelectedIds(new Set());
    setSearchQuery('');
    setFileName(null);
    setImportSource(null);
    setSelectedProfile(null);
    setDuplicateHandling('skip');
    onClose();
  }, [onClose]);

  // キーボードショートカット
  useEffect(() => {
    if (!isOpen) return;

    // フォーカスをモーダルに設定
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
          // Shift+Tab: 逆方向
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        } else {
          // Tab: 順方向
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        }
        // モーダル内でのTab操作なので、すべての場合で背景への伝播を阻止
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      // モーダル内でのキーイベントの場合、背景への伝播を完全に阻止
      const isModalFocused = modal.contains(document.activeElement);
      if (isModalFocused) {
        const activeElement = document.activeElement as HTMLElement;
        const isInputField =
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT');

        if (isInputField) {
          // 入力フィールドでの通常の編集キーは許可
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

  // 選択されたアイテム数（全体）
  const selectedCount = selectedIds.size;
  // フィルタリングされたアイテムのうち選択されている数
  const filteredSelectedCount = filteredBookmarks.filter((b) => selectedIds.has(b.id)).length;

  // 選択中のブラウザ情報
  const selectedBrowser =
    importSource === 'chrome' || importSource === 'edge'
      ? browsers.find((b) => b.id === importSource)
      : null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content bookmark-import-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2>ブックマークをインポート</h2>
          <button className="close-button" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="bookmark-import-controls">
          {/* インポート元選択セクション */}
          <div className="import-source-section">
            <p className="import-source-label">インポート元を選択:</p>
            <div className="import-source-buttons">
              {loadingBrowsers ? (
                <span className="loading-text">ブラウザを検出中...</span>
              ) : (
                <>
                  {browsers.map((browser) => (
                    <button
                      key={browser.id}
                      className={`import-source-button ${importSource === browser.id ? 'selected' : ''} ${!browser.installed ? 'disabled' : ''}`}
                      onClick={() => browser.installed && handleSelectImportSource(browser.id)}
                      disabled={!browser.installed}
                      title={
                        browser.installed
                          ? `${browser.displayName}から直接読み込む`
                          : `${browser.displayName}がインストールされていません`
                      }
                    >
                      <span className="import-source-icon">
                        {browser.id === 'chrome' ? '🌐' : '🔷'}
                      </span>
                      <span>{browser.id === 'chrome' ? 'Chrome' : 'Edge'}</span>
                    </button>
                  ))}
                  <button
                    className={`import-source-button ${importSource === 'html' ? 'selected' : ''}`}
                    onClick={() => handleSelectImportSource('html')}
                  >
                    <span className="import-source-icon">📁</span>
                    <span>HTMLファイル</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ブラウザ選択時：プロファイル選択 */}
          {selectedBrowser && selectedBrowser.profiles.length > 0 && (
            <div className="profile-select-section">
              <label className="profile-select-label">
                プロファイル:
                <select
                  className="profile-selector"
                  value={selectedProfile?.id || ''}
                  onChange={(e) => {
                    const profile = selectedBrowser.profiles.find((p) => p.id === e.target.value);
                    setSelectedProfile(profile || null);
                  }}
                >
                  {selectedBrowser.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.displayName} ({profile.id})
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={handleLoadBrowserBookmarks}
                className="load-bookmarks-button"
                disabled={loading || !selectedProfile}
              >
                {loading ? '読み込み中...' : 'ブックマークを読み込む'}
              </button>
            </div>
          )}

          {/* HTML選択時：ファイル選択 */}
          {importSource === 'html' && (
            <div className="file-select-section">
              <button onClick={handleSelectFile} className="select-file-button" disabled={loading}>
                {loading ? '読み込み中...' : 'ファイルを選択'}
              </button>
              {fileName && <span className="file-name">{fileName}</span>}
            </div>
          )}

          {bookmarks.length > 0 && (
            <div className="search-and-actions">
              <div className="search-input-container">
                <input
                  type="text"
                  placeholder="名前またはURLで検索..."
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
              <div className="bookmark-filtered-actions">
                <button onClick={handleSelectFiltered} className="bookmark-action-button">
                  表示中を選択
                </button>
                <button onClick={handleDeselectFiltered} className="bookmark-action-button">
                  表示中を解除
                </button>
              </div>
              <div className="bookmark-all-actions">
                <button onClick={handleSelectAll} className="bookmark-action-button">
                  全て選択
                </button>
                <button onClick={handleDeselectAll} className="bookmark-action-button">
                  全て解除
                </button>
              </div>
            </div>
          )}
        </div>

        {bookmarks.length > 0 && (
          <div className="bookmark-list-container">
            <table className="bookmark-table">
              <thead>
                <tr>
                  <th className="checkbox-column">選択</th>
                  <th className="name-column">名前</th>
                  <th className="url-column">URL</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookmarks.map((bookmark) => (
                  <tr key={bookmark.id} className={selectedIds.has(bookmark.id) ? 'selected' : ''}>
                    <td className="checkbox-column">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(bookmark.id)}
                        onChange={() => handleToggleBookmark(bookmark.id)}
                      />
                    </td>
                    <td className="name-column">{bookmark.displayName}</td>
                    <td className="url-column">{bookmark.url}</td>
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
                  name="duplicateHandling"
                  value="skip"
                  checked={duplicateHandling === 'skip'}
                  onChange={() => setDuplicateHandling('skip')}
                />
                <span>スキップ（重複アイテムはインポートしない）</span>
              </label>
              <label className="duplicate-option">
                <input
                  type="radio"
                  name="duplicateHandling"
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
            {bookmarks.length > 0 && (
              <span>
                {filteredBookmarks.length}件中{filteredSelectedCount}件を選択中
                {searchQuery && ` (全体: ${bookmarks.length}件中${selectedCount}件)`}
              </span>
            )}
          </div>
          <div className="bookmark-modal-actions">
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

export default BookmarkImportModal;
