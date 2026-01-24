import React, { useState, useEffect, useRef } from 'react';
import { RawDataLine, SimpleBookmarkItem, DataFileTab } from '@common/types';
import { convertRegisterItemToRawDataLine } from '@common/utils/dataConverters';
import type { RegisterItem } from '@common/types';
import { parseCSVLine } from '@common/utils/csvParser';

import { logError } from '../utils/debug';

import AdminItemManagerList from './AdminItemManagerList';
import RegisterModal from './RegisterModal';
import BookmarkImportModal from './BookmarkImportModal';
import ConfirmDialog from './ConfirmDialog';
import { Button } from './ui/Button';

interface EditModeViewProps {
  rawLines: RawDataLine[];
  onRawDataSave: (rawLines: RawDataLine[]) => void;
  onExitEditMode: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dataFileTabs: DataFileTab[];
  dataFileLabels?: Record<string, string>;
}

const AdminItemManagerView: React.FC<EditModeViewProps> = ({
  rawLines,
  onRawDataSave,
  onExitEditMode,
  searchQuery,
  onSearchChange,
  dataFileTabs,
  dataFileLabels = {},
}) => {
  // データファイル名を取得（設定がない場合は物理ファイル名）
  const getFileLabel = (fileName: string): string => {
    return dataFileLabels[fileName] || fileName;
  };
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editedLines, setEditedLines] = useState<Map<string, RawDataLine>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RawDataLine | null>(null);
  const [workingLines, setWorkingLines] = useState<RawDataLine[]>(rawLines);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);

  // タブとファイル選択用の状態
  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(0);
  const [selectedDataFile, setSelectedDataFile] = useState<string>('data.json');

  // 保存時の整列・重複削除チェックボックスの状態
  const [sortAndDedupChecked, setSortAndDedupChecked] = useState(true);

  // ConfirmDialog状態管理
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    title?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    showCheckbox?: boolean;
    checkboxLabel?: string;
    checkboxChecked?: boolean;
    onCheckboxChange?: (checked: boolean) => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    danger: false,
    showCheckbox: false,
    checkboxLabel: '',
    checkboxChecked: false,
  });

  // ドロップダウン状態管理
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState(false);
  const tabDropdownRef = useRef<HTMLDivElement>(null);
  const fileDropdownRef = useRef<HTMLDivElement>(null);

  const handleLineEdit = (line: RawDataLine) => {
    const lineKey = `${line.sourceFile}_${line.lineNumber}`;
    const newEditedLines = new Map(editedLines);
    newEditedLines.set(lineKey, line);
    setEditedLines(newEditedLines);
    setHasUnsavedChanges(true);
  };

  const handleEditItem = (line: RawDataLine) => {
    setEditingItem(line);
    setIsRegisterModalOpen(true);
  };

  const handleUpdateItem = (items: RegisterItem[]) => {
    if (editingItem && items.length > 0) {
      const updatedItem = items[0];
      const updatedLine = convertRegisterItemToRawDataLine(updatedItem, editingItem);

      // 変更内容が異なる場合のみ編集として記録
      if (updatedLine.content !== editingItem.content) {
        // handleLineEditと同様に編集内容を保持（即座保存しない）
        const lineKey = `${updatedLine.sourceFile}_${updatedLine.lineNumber}`;
        const newEditedLines = new Map(editedLines);
        newEditedLines.set(lineKey, updatedLine);
        setEditedLines(newEditedLines);
        setHasUnsavedChanges(true);
      }
    }
    setIsRegisterModalOpen(false);
    setEditingItem(null);
  };

  const handleLineSelect = (line: RawDataLine, selected: boolean) => {
    const lineKey = `${line.sourceFile}_${line.lineNumber}`;
    const newSelected = new Set(selectedItems);
    if (selected) {
      newSelected.add(lineKey);
    } else {
      newSelected.delete(lineKey);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const visibleLines = new Set(
        filteredLines.map((line) => `${line.sourceFile}_${line.lineNumber}`)
      );
      setSelectedItems(visibleLines);
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleDeleteLines = (linesToDelete: RawDataLine[]) => {
    const updatedLines = workingLines.filter(
      (line) =>
        !linesToDelete.some(
          (deleteThisLine) =>
            line.sourceFile === deleteThisLine.sourceFile &&
            line.lineNumber === deleteThisLine.lineNumber
        )
    );

    // 行番号を振り直し
    const reorderedLines = reorderLineNumbers(updatedLines);
    setWorkingLines(reorderedLines);
    setSelectedItems(new Set());
    setHasUnsavedChanges(true);
  };

  const handleDuplicateLines = (linesToDuplicate: RawDataLine[]) => {
    // 1. 複製対象行を行番号でソート（挿入位置を正しく計算するため）
    const sortedLines = [...linesToDuplicate].sort((a, b) => a.lineNumber - b.lineNumber);

    // 2. 最後の行の次に挿入する位置を特定
    const lastLine = sortedLines[sortedLines.length - 1];
    const insertAfterIndex = workingLines.findIndex(
      (line) => line.sourceFile === lastLine.sourceFile && line.lineNumber === lastLine.lineNumber
    );

    if (insertAfterIndex === -1) {
      logError('挿入位置の特定に失敗しました');
      return;
    }

    // 3. 複製行を作成（行番号は仮の値を設定）
    const duplicatedLines = sortedLines.map((line) => ({
      ...line,
      lineNumber: -1, // 後でreorderLineNumbersで振り直される
    }));

    // 4. workingLinesに挿入
    const updatedLines = [
      ...workingLines.slice(0, insertAfterIndex + 1),
      ...duplicatedLines,
      ...workingLines.slice(insertAfterIndex + 1),
    ];

    // 5. 行番号を振り直し
    const reorderedLines = reorderLineNumbers(updatedLines);

    // 6. 状態を更新
    setWorkingLines(reorderedLines);
    setHasUnsavedChanges(true);

    // 7. 選択状態をクリア
    setSelectedItems(new Set());
  };

  const handleAddLine = () => {
    const newLine: RawDataLine = {
      lineNumber: 1,
      content: '',
      type: 'empty',
      sourceFile: selectedDataFile, // 現在選択中のファイルに追加
    };

    const updatedLines = [newLine, ...workingLines];
    const reorderedLines = reorderLineNumbers(updatedLines);
    setWorkingLines(reorderedLines);
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = () => {
    if (!hasUnsavedChanges) return;

    // チェックボックスをデフォルトでONにリセット
    setSortAndDedupChecked(true);

    // 保存時の確認ダイアログを表示
    setConfirmDialog({
      isOpen: true,
      message: '変更を保存しますか？',
      confirmText: '保存',
      showCheckbox: true,
      checkboxLabel: '整列・重複削除を実行',
      checkboxChecked: true,
      onCheckboxChange: (checked: boolean) => {
        setSortAndDedupChecked(checked);
        // confirmDialogの状態も更新
        setConfirmDialog((prev) => ({ ...prev, checkboxChecked: checked }));
      },
      onConfirm: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });

        // editedLinesの変更をworkingLinesに反映
        let updatedLines = workingLines.map((line) => {
          const lineKey = `${line.sourceFile}_${line.lineNumber}`;
          return editedLines.get(lineKey) || line;
        });

        // チェックボックスがONの場合、整列・重複削除を実行
        if (sortAndDedupChecked) {
          // 現在選択中のデータファイルの行のみフィルタリング
          const currentDataFileLines = updatedLines.filter(
            (line) => line.sourceFile === selectedDataFile
          );

          // 他のデータファイルの行
          const otherDataFileLines = updatedLines.filter(
            (line) => line.sourceFile !== selectedDataFile
          );

          // 重複削除関数
          const removeDuplicates = (lines: RawDataLine[]) => {
            const seen = new Set<string>();
            const deduplicated: RawDataLine[] = [];

            for (const line of lines) {
              const key = `${line.type}:${line.content}`;
              if (!seen.has(key)) {
                seen.add(key);
                deduplicated.push(line);
              }
            }
            return deduplicated;
          };

          const getPathAndArgs = (line: RawDataLine) => {
            if (line.type === 'item') {
              const parts = parseCSVLine(line.content);
              const pathPart = parts[1] || '';
              const argsPart = parts[2] || '';
              return argsPart ? `${pathPart} ${argsPart}` : pathPart;
            } else if (line.type === 'directive') {
              const parts = parseCSVLine(line.content);
              const pathPart = parts[1] || '';
              const options = parts.slice(2).join(',').trim();
              return options ? `${pathPart} ${options}` : pathPart;
            } else {
              return line.content || (line.type === 'empty' ? '(空行)' : '');
            }
          };

          // 現在のデータファイルの行のみを整列
          const sortedLines = [...currentDataFileLines].sort((a, b) => {
            const typeOrder = { directive: 0, item: 1, comment: 2, empty: 3 };
            const typeA = typeOrder[a.type] ?? 99;
            const typeB = typeOrder[b.type] ?? 99;

            if (typeA !== typeB) {
              return typeA - typeB;
            }

            const pathAndArgsA = getPathAndArgs(a).toLowerCase();
            const pathAndArgsB = getPathAndArgs(b).toLowerCase();

            if (pathAndArgsA !== pathAndArgsB) {
              return pathAndArgsA.localeCompare(pathAndArgsB);
            }

            const nameA = a.type === 'item' ? (parseCSVLine(a.content)[0] || '').toLowerCase() : '';
            const nameB = b.type === 'item' ? (parseCSVLine(b.content)[0] || '').toLowerCase() : '';

            return nameA.localeCompare(nameB);
          });

          // 重複削除
          const deduplicatedLines = removeDuplicates(sortedLines);

          // 他のデータファイルの行と結合
          updatedLines = [...otherDataFileLines, ...deduplicatedLines];
        }

        // 行番号を振り直して保存
        const reorderedLines = reorderLineNumbers(updatedLines);

        // 全件書き戻し
        onRawDataSave(reorderedLines);
        setEditedLines(new Map());
        setHasUnsavedChanges(false);
        setWorkingLines(reorderedLines);

        // 保存後、チェックボックスをリセット
        setSortAndDedupChecked(false);
      },
      danger: false,
    });
  };

  // 行番号を振り直す関数
  const reorderLineNumbers = (lines: RawDataLine[]): RawDataLine[] => {
    const fileGroups = new Map<string, RawDataLine[]>();

    // ファイル別にグループ化
    lines.forEach((line) => {
      if (!fileGroups.has(line.sourceFile)) {
        fileGroups.set(line.sourceFile, []);
      }
      const group = fileGroups.get(line.sourceFile);
      if (!group) {
        throw new Error(`Failed to get file group for: ${line.sourceFile}`);
      }
      group.push(line);
    });

    // 各ファイル内で行番号を振り直し
    const reorderedLines: RawDataLine[] = [];
    for (const [, fileLines] of fileGroups) {
      fileLines.forEach((line, index) => {
        reorderedLines.push({
          ...line,
          lineNumber: index + 1,
        });
      });
    }

    return reorderedLines;
  };

  const handleBookmarkImport = (bookmarks: SimpleBookmarkItem[]) => {
    // 選択されたブックマークを新規行として追加
    const newLines: RawDataLine[] = bookmarks.map((bookmark, index) => ({
      lineNumber: index + 1,
      content: `${bookmark.displayName},${bookmark.url}`,
      type: 'item' as const,
      sourceFile: selectedDataFile, // 現在選択中のファイルにインポート
    }));

    const updatedLines = [...newLines, ...workingLines];
    const reorderedLines = reorderLineNumbers(updatedLines);
    setWorkingLines(reorderedLines);
    setHasUnsavedChanges(true);
    setIsBookmarkModalOpen(false);
  };

  const handleExitEditMode = () => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        message: '未保存の変更があります。アイテム管理を終了しますか？',
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          onExitEditMode();
        },
        danger: true,
      });
    } else {
      onExitEditMode();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleExitEditMode();
    } else if (e.key === 'Delete' && selectedItems.size > 0) {
      const selectedLines = workingLines.filter((line) =>
        selectedItems.has(`${line.sourceFile}_${line.lineNumber}`)
      );
      handleDeleteLines(selectedLines);
    } else if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSaveChanges();
    }
  };

  const mergedLines = workingLines.map((line) => {
    const lineKey = `${line.sourceFile}_${line.lineNumber}`;
    const editedLine = editedLines.get(lineKey);
    return editedLine || line;
  });

  // タブ変更時の未保存チェック
  const handleTabChange = (newTabIndex: number) => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        message: '未保存の変更があります。タブを切り替えると変更が失われます。続行しますか？',
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          setSelectedTabIndex(newTabIndex);
          setHasUnsavedChanges(false);
          setEditedLines(new Map());
        },
        danger: true,
      });
    } else {
      setSelectedTabIndex(newTabIndex);
    }
  };

  // ファイル変更時の未保存チェック
  const handleFileChange = (newFile: string) => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        message: '未保存の変更があります。ファイルを切り替えると変更が失われます。続行しますか？',
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          setSelectedDataFile(newFile);
          setHasUnsavedChanges(false);
          setEditedLines(new Map());
        },
        danger: true,
      });
    } else {
      setSelectedDataFile(newFile);
    }
  };

  // ドロップダウンメニューアイテムクリック時の処理
  const handleTabMenuItemClick = (newTabIndex: number) => {
    setIsTabDropdownOpen(false);
    handleTabChange(newTabIndex);
  };

  const handleFileMenuItemClick = (newFile: string) => {
    setIsFileDropdownOpen(false);
    handleFileChange(newFile);
  };

  const filteredLines = mergedLines.filter((line) => {
    // 選択されたデータファイルでフィルタリング
    if (line.sourceFile !== selectedDataFile) return false;

    // コメント行を非表示
    if (line.type === 'comment') return false;

    // 検索クエリによるフィルタリング
    if (!searchQuery) return true;
    const keywords = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 0);
    const lineText = line.content.toLowerCase();
    return keywords.every((keyword) => lineText.includes(keyword));
  });

  // タブ変更時にファイルを自動選択
  useEffect(() => {
    if (dataFileTabs.length > 0 && selectedTabIndex < dataFileTabs.length) {
      const currentTab = dataFileTabs[selectedTabIndex];
      if (currentTab.files && currentTab.files.length > 0) {
        // タブの最初のファイルを選択
        setSelectedDataFile(currentTab.files[0]);
      }
    }
  }, [selectedTabIndex, dataFileTabs]);

  // 初回マウント時のみ最初のタブを選択
  useEffect(() => {
    if (dataFileTabs.length > 0) {
      setSelectedTabIndex(0);
    }
  }, []);

  // rawLinesが変更されたらworkingLinesも更新
  useEffect(() => {
    setWorkingLines(rawLines);
    setEditedLines(new Map());
    setHasUnsavedChanges(false);
  }, [rawLines]);

  // 検索クエリが変更されたら、非表示になった行の選択状態をクリア
  useEffect(() => {
    const filteredKeys = new Set(
      filteredLines.map((line) => `${line.sourceFile}_${line.lineNumber}`)
    );
    setSelectedItems((prevSelected) => {
      const newSelectedItems = new Set([...prevSelected].filter((key) => filteredKeys.has(key)));

      // 変更があった場合のみ新しいSetを返す
      if (newSelectedItems.size !== prevSelected.size) {
        return newSelectedItems;
      }
      return prevSelected;
    });
  }, [searchQuery, workingLines]);

  // ドロップダウンのクリック外判定
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tabDropdownRef.current && !tabDropdownRef.current.contains(event.target as Node)) {
        setIsTabDropdownOpen(false);
      }
      if (fileDropdownRef.current && !fileDropdownRef.current.contains(event.target as Node)) {
        setIsFileDropdownOpen(false);
      }
    };

    if (isTabDropdownOpen || isFileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTabDropdownOpen, isFileDropdownOpen]);

  // 現在選択されているタブの情報を取得
  const currentTab = dataFileTabs[selectedTabIndex];
  const currentTabFiles = currentTab?.files || ['data.json'];

  return (
    <div className="edit-mode-view" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="edit-mode-header">
        <div className="edit-mode-info">
          <div className="tab-dropdown" ref={tabDropdownRef}>
            <label className="dropdown-label">タブ:</label>
            <button
              className="dropdown-trigger-btn"
              onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
              title={currentTab?.name || 'タブ選択'}
            >
              <span className="dropdown-trigger-text">{currentTab?.name || 'タブ選択'}</span>
              <span className="dropdown-trigger-icon">{isTabDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {isTabDropdownOpen && (
              <div className="dropdown-menu">
                {dataFileTabs.map((tab, index) => (
                  <button
                    key={index}
                    className={`dropdown-item ${selectedTabIndex === index ? 'selected' : ''}`}
                    onClick={() => handleTabMenuItemClick(index)}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {currentTabFiles.length > 1 && (
            <div className="file-dropdown" ref={fileDropdownRef}>
              <label className="dropdown-label">データファイル:</label>
              <button
                className="dropdown-trigger-btn"
                onClick={() => setIsFileDropdownOpen(!isFileDropdownOpen)}
                title={`${getFileLabel(selectedDataFile)} (${selectedDataFile})`}
              >
                <span className="dropdown-trigger-text">{getFileLabel(selectedDataFile)}</span>
                <span className="dropdown-trigger-icon">{isFileDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {isFileDropdownOpen && (
                <div className="dropdown-menu">
                  {currentTabFiles.map((fileName) => (
                    <button
                      key={fileName}
                      className={`dropdown-item ${selectedDataFile === fileName ? 'selected' : ''}`}
                      onClick={() => handleFileMenuItemClick(fileName)}
                      title={fileName}
                    >
                      {getFileLabel(fileName)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ツールバーエリア */}
      <div className="edit-mode-toolbar">
        <div className="toolbar-left">
          <Button variant="info" onClick={handleAddLine}>
            ➕ 行を追加
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const selectedLines = filteredLines.filter((line) => {
                const lineKey = `${line.sourceFile}_${line.lineNumber}`;
                return selectedItems.has(lineKey);
              });
              if (selectedLines.length > 0) {
                setConfirmDialog({
                  isOpen: true,
                  message: `${selectedLines.length}行を削除しますか？`,
                  onConfirm: () => {
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                    handleDeleteLines(selectedLines);
                  },
                  danger: true,
                });
              }
            }}
            disabled={selectedItems.size === 0}
            title="選択されている行を削除します"
          >
            🗑️ 選択行を削除
          </Button>
          <Button variant="info" onClick={() => setIsBookmarkModalOpen(true)}>
            ブックマークをインポート
          </Button>
          <div className="toolbar-search">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="行の内容を検索..."
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
          <Button
            variant="primary"
            onClick={handleSaveChanges}
            disabled={!hasUnsavedChanges}
          >
            変更を保存
          </Button>
        </div>
      </div>

      <AdminItemManagerList
        rawLines={filteredLines}
        selectedItems={selectedItems}
        onLineEdit={handleLineEdit}
        onLineSelect={handleLineSelect}
        onSelectAll={handleSelectAll}
        onDeleteLines={handleDeleteLines}
        onEditClick={handleEditItem}
        onDuplicateLines={handleDuplicateLines}
      />

      <div className="edit-mode-status">
        <span className="selection-count">
          {(() => {
            const visibleSelectedCount = filteredLines.filter((line) =>
              selectedItems.has(`${line.sourceFile}_${line.lineNumber}`)
            ).length;
            return visibleSelectedCount > 0 ? `${visibleSelectedCount}行を選択中` : '';
          })()}
        </span>
        <span className="total-count">合計: {filteredLines.length}行</span>
        {hasUnsavedChanges && <span className="unsaved-changes">未保存の変更があります</span>}
      </div>

      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setEditingItem(null);
        }}
        onRegister={handleUpdateItem}
        droppedPaths={[]}
        editingItem={editingItem}
      />

      <BookmarkImportModal
        isOpen={isBookmarkModalOpen}
        onClose={() => setIsBookmarkModalOpen(false)}
        onImport={handleBookmarkImport}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        danger={confirmDialog.danger}
        showCheckbox={confirmDialog.showCheckbox}
        checkboxLabel={confirmDialog.checkboxLabel}
        checkboxChecked={confirmDialog.checkboxChecked}
        onCheckboxChange={confirmDialog.onCheckboxChange}
      />
    </div>
  );
};

export default AdminItemManagerView;
