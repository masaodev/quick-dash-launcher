import React, { useState, useEffect } from 'react';

import { RawDataLine, SimpleBookmarkItem } from '../../common/types';

import EditableRawItemList from './EditableRawItemList';
import RegisterModal, { RegisterItem } from './RegisterModal';
import BookmarkImportModal from './BookmarkImportModal';

interface EditModeViewProps {
  rawLines: RawDataLine[];
  onRawDataSave: (rawLines: RawDataLine[]) => void;
  onExitEditMode: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const EditModeView: React.FC<EditModeViewProps> = ({
  rawLines,
  onRawDataSave,
  onExitEditMode,
  searchQuery,
  onSearchChange,
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editedLines, setEditedLines] = useState<Map<string, RawDataLine>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RawDataLine | null>(null);
  const [workingLines, setWorkingLines] = useState<RawDataLine[]>(rawLines);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);

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

  const convertRegisterItemToRawDataLine = (
    item: RegisterItem,
    originalLine: RawDataLine
  ): RawDataLine => {
    let newContent = '';
    let newType: RawDataLine['type'] = originalLine.type;

    if (item.itemCategory === 'dir') {
      // フォルダ取込ディレクティブの場合
      newType = 'directive';
      if (item.dirOptions) {
        const options = [];
        if (item.dirOptions.depth !== 0) options.push(`depth=${item.dirOptions.depth}`);
        if (item.dirOptions.types !== 'both') options.push(`types=${item.dirOptions.types}`);
        if (item.dirOptions.filter) options.push(`filter=${item.dirOptions.filter}`);
        if (item.dirOptions.exclude) options.push(`exclude=${item.dirOptions.exclude}`);
        if (item.dirOptions.prefix) options.push(`prefix=${item.dirOptions.prefix}`);
        if (item.dirOptions.suffix) options.push(`suffix=${item.dirOptions.suffix}`);

        const optionsStr = options.join(',');
        newContent = optionsStr ? `dir,${item.path},${optionsStr}` : `dir,${item.path}`;
      } else {
        newContent = `dir,${item.path}`;
      }
    } else {
      // アイテム行の場合：名前,パス,引数,元パス の形式
      newType = 'item';
      const args = item.args || '';
      const originalPath = originalLine.content.split(',')[3] || item.path;
      newContent = `${item.name},${item.path},${args},${originalPath}`;
    }

    return {
      ...originalLine,
      content: newContent,
      type: newType,
    };
  };

  const handleUpdateItem = (items: RegisterItem[]) => {
    if (editingItem && items.length > 0) {
      const updatedItem = items[0];
      const updatedLine = convertRegisterItemToRawDataLine(updatedItem, editingItem);
      handleLineEdit(updatedLine);
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
      const allLines = new Set(workingLines.map((line) => `${line.sourceFile}_${line.lineNumber}`));
      setSelectedItems(allLines);
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

  const handleAddLine = () => {
    const newLine: RawDataLine = {
      lineNumber: workingLines.length + 1,
      content: '',
      type: 'empty',
      sourceFile: 'data.txt', // デフォルトでdata.txtに追加
    };

    const updatedLines = [...workingLines, newLine];
    const reorderedLines = reorderLineNumbers(updatedLines);
    setWorkingLines(reorderedLines);
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = () => {
    if (!hasUnsavedChanges) return;

    // editedLinesの変更をworkingLinesに反映
    const updatedLines = workingLines.map((line) => {
      const lineKey = `${line.sourceFile}_${line.lineNumber}`;
      return editedLines.get(lineKey) || line;
    });

    // 行番号を振り直して保存
    const reorderedLines = reorderLineNumbers(updatedLines);

    // 全件書き戻し
    onRawDataSave(reorderedLines);
    setEditedLines(new Map());
    setHasUnsavedChanges(false);
    setWorkingLines(reorderedLines);
  };

  // 行番号を振り直す関数
  const reorderLineNumbers = (lines: RawDataLine[]): RawDataLine[] => {
    const fileGroups = new Map<string, RawDataLine[]>();

    // ファイル別にグループ化
    lines.forEach((line) => {
      if (!fileGroups.has(line.sourceFile)) {
        fileGroups.set(line.sourceFile, []);
      }
      fileGroups.get(line.sourceFile)!.push(line);
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

  const handleSort = (sortedLines: RawDataLine[]) => {
    setWorkingLines(sortedLines);
    setHasUnsavedChanges(true);
  };

  const handleBookmarkImport = (bookmarks: SimpleBookmarkItem[]) => {
    // 選択されたブックマークを新規行として追加
    const newLines: RawDataLine[] = bookmarks.map((bookmark, index) => ({
      lineNumber: workingLines.length + index + 1,
      content: `${bookmark.name},${bookmark.url}`,
      type: 'item' as const,
      sourceFile: 'data.txt' as const,
    }));

    const updatedLines = [...workingLines, ...newLines];
    const reorderedLines = reorderLineNumbers(updatedLines);
    setWorkingLines(reorderedLines);
    setHasUnsavedChanges(true);
    setIsBookmarkModalOpen(false);
  };

  const handleExitEditMode = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('未保存の変更があります。アイテム管理を終了しますか？')) {
        onExitEditMode();
      }
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

  const filteredLines = mergedLines.filter((line) => {
    if (!searchQuery) return true;
    const keywords = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 0);
    const lineText = line.content.toLowerCase();
    return keywords.every((keyword) => lineText.includes(keyword));
  });

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        handleSelectAll(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // rawLinesが変更されたらworkingLinesも更新
  useEffect(() => {
    setWorkingLines(rawLines);
    setEditedLines(new Map());
    setHasUnsavedChanges(false);
  }, [rawLines]);

  const getFileNames = () => {
    const fileSet = new Set(workingLines.map((line) => line.sourceFile));
    return Array.from(fileSet).join(', ');
  };

  return (
    <div className="edit-mode-view" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="edit-mode-header">
        <div className="edit-mode-info">
          <span className="editing-files">編集中: {getFileNames()}</span>
        </div>
        <div className="edit-mode-search">
          <input
            type="text"
            placeholder="行の内容を検索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="edit-mode-actions">
          <button onClick={() => setIsBookmarkModalOpen(true)} className="import-bookmark-button">
            ブックマークをインポート
          </button>
          <button
            onClick={handleSaveChanges}
            className="save-changes-button"
            disabled={!hasUnsavedChanges}
          >
            変更を保存
          </button>
        </div>
      </div>

      <div className="edit-mode-operations">
        <button onClick={handleAddLine} className="add-line-button">
          ➕ 行を追加
        </button>
        <button
          onClick={() => {
            const selectedLines = filteredLines.filter((line) => {
              const lineKey = `${line.sourceFile}_${line.lineNumber}`;
              return selectedItems.has(lineKey);
            });
            if (
              selectedLines.length > 0 &&
              window.confirm(`${selectedLines.length}行を削除しますか？`)
            ) {
              handleDeleteLines(selectedLines);
            }
          }}
          className="delete-lines-button"
          disabled={selectedItems.size === 0}
        >
          🗑️ 選択行を削除 ({selectedItems.size})
        </button>
        <button
          onClick={() => {
            // 整列処理: EditableRawItemListからロジックを移植
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
                const parts = line.content.split(',');
                const pathPart = parts[1]?.trim() || '';
                const argsPart = parts[2]?.trim() || '';
                return argsPart ? `${pathPart} ${argsPart}` : pathPart;
              } else if (line.type === 'directive') {
                const parts = line.content.split(',');
                const pathPart = parts[1]?.trim() || '';
                const options = parts.slice(2).join(',').trim();
                return options ? `${pathPart} ${options}` : pathPart;
              } else {
                return line.content || (line.type === 'empty' ? '(空行)' : '');
              }
            };

            const sortedLines = [...filteredLines].sort((a, b) => {
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

              const nameA = a.type === 'item' ? (a.content.split(',')[0]?.trim() || '').toLowerCase() : '';
              const nameB = b.type === 'item' ? (b.content.split(',')[0]?.trim() || '').toLowerCase() : '';

              return nameA.localeCompare(nameB);
            });

            const deduplicatedLines = removeDuplicates(sortedLines);
            const duplicateCount = sortedLines.length - deduplicatedLines.length;

            if (duplicateCount > 0) {
              const confirmed = window.confirm(
                `整列処理が完了しました。\n\n${duplicateCount}件の重複行が見つかりました。\n重複行を削除しますか？`
              );
              handleSort(confirmed ? deduplicatedLines : sortedLines);
            } else {
              handleSort(sortedLines);
            }
          }}
          className="sort-button"
          title="種類→パスと引数→名前の順で整列し、重複行を削除"
        >
          🔤 整列・重複削除
        </button>
      </div>

      <EditableRawItemList
        rawLines={filteredLines}
        selectedItems={selectedItems}
        onLineEdit={handleLineEdit}
        onLineSelect={handleLineSelect}
        onSelectAll={handleSelectAll}
        onAddLine={handleAddLine}
        onDeleteLines={handleDeleteLines}
        onEditClick={handleEditItem}
        onSort={handleSort}
      />

      <div className="edit-mode-status">
        <span className="selection-count">
          {selectedItems.size > 0 ? `${selectedItems.size}行を選択中` : ''}
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
    </div>
  );
};

export default EditModeView;
