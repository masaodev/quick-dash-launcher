import React, { useState, useEffect, useCallback } from 'react';

import { SimpleBookmarkItem } from '../../common/types';

interface BookmarkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (bookmarks: SimpleBookmarkItem[]) => void;
}

const BookmarkImportModal: React.FC<BookmarkImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [bookmarks, setBookmarks] = useState<SimpleBookmarkItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // フィルタリングされたブックマーク
  const filteredBookmarks = bookmarks.filter((bookmark) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      bookmark.name.toLowerCase().includes(searchLower) ||
      bookmark.url.toLowerCase().includes(searchLower)
    );
  });

  // ファイル選択
  const handleSelectFile = async () => {
    try {
      setLoading(true);
      const filePath = await window.electronAPI.selectBookmarkFile();

      if (filePath) {
        setFileName(filePath.split(/[\\/]/).pop() || filePath);
        const parsedBookmarks = await window.electronAPI.parseBookmarkFile(filePath);
        setBookmarks(parsedBookmarks);
        setSelectedIds(new Set());
        setSearchQuery('');
      }
    } catch (error) {
      console.error('Error selecting bookmark file:', error);
      alert('ブックマークファイルの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 個別選択
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

  // 表示中のアイテムを全て選択
  const handleSelectFiltered = () => {
    const filteredIds = filteredBookmarks.map((b) => b.id);
    setSelectedIds((prev) => new Set([...prev, ...filteredIds]));
  };

  // 表示中のアイテムを全て解除
  const handleDeselectFiltered = () => {
    const filteredIds = filteredBookmarks.map((b) => b.id);
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      filteredIds.forEach((id) => newSet.delete(id));
      return newSet;
    });
  };

  // 全て選択
  const handleSelectAll = () => {
    const allIds = bookmarks.map((b) => b.id);
    setSelectedIds(new Set(allIds));
  };

  // 全て解除
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // インポート実行
  const handleImport = () => {
    const selectedBookmarks = bookmarks.filter((b) => selectedIds.has(b.id));
    if (selectedBookmarks.length === 0) {
      alert('インポートするブックマークを選択してください');
      return;
    }

    onImport(selectedBookmarks);
    handleClose();
  };

  // モーダルを閉じる
  const handleClose = () => {
    setBookmarks([]);
    setSelectedIds(new Set());
    setSearchQuery('');
    setFileName(null);
    onClose();
  };

  // キーボードショートカット
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    },
    [isOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  // 選択されたアイテム数（全体）
  const selectedCount = selectedIds.size;
  // フィルタリングされたアイテムのうち選択されている数
  const filteredSelectedCount = filteredBookmarks.filter((b) => selectedIds.has(b.id)).length;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content bookmark-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ブックマークをインポート</h2>
          <button className="close-button" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="bookmark-import-controls">
          <div className="file-select-section">
            <button onClick={handleSelectFile} className="select-file-button" disabled={loading}>
              {loading ? '読み込み中...' : 'ファイルを選択'}
            </button>
            {fileName && <span className="file-name">{fileName}</span>}
          </div>

          {bookmarks.length > 0 && (
            <>
              <div className="search-section">
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
              </div>

              <div className="bookmark-bulk-actions">
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
            </>
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
                    <td className="name-column">{bookmark.name}</td>
                    <td className="url-column">{bookmark.url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <button onClick={handleClose} className="bookmark-cancel-button">
              キャンセル
            </button>
            <button
              onClick={handleImport}
              className="bookmark-import-button"
              disabled={selectedCount === 0}
            >
              インポート ({selectedCount}件)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookmarkImportModal;
