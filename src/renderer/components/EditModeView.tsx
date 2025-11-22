import React, { useState, useEffect } from 'react';
import { RawDataLine, SimpleBookmarkItem } from '@common/types';

import EditableRawItemList from './EditableRawItemList';
import RegisterModal, { RegisterItem } from './RegisterModal';
import BookmarkImportModal from './BookmarkImportModal';

interface EditModeViewProps {
  rawLines: RawDataLine[];
  onRawDataSave: (rawLines: RawDataLine[]) => void;
  onExitEditMode: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tabNames: Record<string, string>;
}

const EditModeView: React.FC<EditModeViewProps> = ({
  rawLines,
  onRawDataSave,
  onExitEditMode,
  searchQuery,
  onSearchChange,
  tabNames,
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editedLines, setEditedLines] = useState<Map<string, RawDataLine>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RawDataLine | null>(null);
  const [workingLines, setWorkingLines] = useState<RawDataLine[]>(rawLines);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);

  // データファイル選択用の状態
  const [dataFiles, setDataFiles] = useState<string[]>([]);
  const [selectedDataFile, setSelectedDataFile] = useState<string>('data.txt');

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
      // フォルダ取込アイテムの場合
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
    } else if (item.itemCategory === 'group') {
      // グループアイテムの場合：group,グループ名,アイテム1,アイテム2,...
      newType = 'directive';
      const itemNames = item.groupItemNames || [];
      newContent = `group,${item.name},${itemNames.join(',')}`;
    } else {
      // アイテム行の場合：名前,パス,引数,カスタムアイコン の形式
      newType = 'item';
      const args = item.args || '';
      const customIcon = item.customIcon || '';

      // カスタムアイコンが設定されている場合は4番目のフィールドに追加
      if (customIcon) {
        newContent = `${item.name},${item.path},${args},${customIcon}`;
      } else {
        newContent = `${item.name},${item.path},${args}`;
      }
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

  const handleAddLine = () => {
    const newLine: RawDataLine = {
      lineNumber: 1,
      content: '',
      type: 'empty',
      sourceFile: 'data.txt', // デフォルトでdata.txtに追加
    };

    const updatedLines = [newLine, ...workingLines];
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
      lineNumber: index + 1,
      content: `${bookmark.name},${bookmark.url}`,
      type: 'item' as const,
      sourceFile: 'data.txt' as const,
    }));

    const updatedLines = [...newLines, ...workingLines];
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

  // タブ名を優先表示する関数
  const getFileDisplayLabel = (fileName: string): string => {
    const tabName = tabNames[fileName];
    // タブ名が設定されていればタブ名を表示、なければファイル名
    return tabName || fileName;
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

  // tabNamesからデータファイルリストを生成
  useEffect(() => {
    const files = Object.keys(tabNames);
    if (files.length > 0) {
      setDataFiles(files);
      if (!files.includes(selectedDataFile)) {
        setSelectedDataFile(files[0]);
      }
    }
    // selectedDataFileは意図的に依存配列から除外（tabNames変更時のみ実行したい）
  }, [tabNames]);

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

  return (
    <div className="edit-mode-view" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="edit-mode-header">
        <div className="edit-mode-info">
          <label htmlFor="data-file-selector" className="file-selector-label">
            タブ名:
          </label>
          <select
            id="data-file-selector"
            value={selectedDataFile}
            onChange={(e) => setSelectedDataFile(e.target.value)}
            className="data-file-selector"
          >
            {dataFiles.map((fileName) => (
              <option key={fileName} value={fileName}>
                {getFileDisplayLabel(fileName)}
              </option>
            ))}
          </select>
        </div>
        <div className="edit-mode-search">
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
          🗑️ 選択行を削除 (
          {
            filteredLines.filter((line) =>
              selectedItems.has(`${line.sourceFile}_${line.lineNumber}`)
            ).length
          }
          )
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

            // コメント行も含めた全データを整列（コメント行を保持するため）
            const sortedLines = [...mergedLines].sort((a, b) => {
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

              const nameA =
                a.type === 'item' ? (a.content.split(',')[0]?.trim() || '').toLowerCase() : '';
              const nameB =
                b.type === 'item' ? (b.content.split(',')[0]?.trim() || '').toLowerCase() : '';

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
        _onAddLine={handleAddLine}
        onDeleteLines={handleDeleteLines}
        onEditClick={handleEditItem}
        _onSort={handleSort}
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
    </div>
  );
};

export default EditModeView;
