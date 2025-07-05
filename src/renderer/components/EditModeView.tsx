import React, { useState, useEffect } from 'react';
import { RawDataLine } from '../../common/types';
import EditableRawItemList from './EditableRawItemList';

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
  onSearchChange
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editedLines, setEditedLines] = useState<Map<string, RawDataLine>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleLineEdit = (line: RawDataLine) => {
    const lineKey = `${line.sourceFile}_${line.lineNumber}`;
    const newEditedLines = new Map(editedLines);
    newEditedLines.set(lineKey, line);
    setEditedLines(newEditedLines);
    setHasUnsavedChanges(true);
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
      const allLines = new Set(rawLines.map(line => `${line.sourceFile}_${line.lineNumber}`));
      setSelectedItems(allLines);
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleDeleteLines = (linesToDelete: RawDataLine[]) => {
    const updatedLines = rawLines.filter(line => 
      !linesToDelete.some(deleteThisLine => 
        line.sourceFile === deleteThisLine.sourceFile && 
        line.lineNumber === deleteThisLine.lineNumber
      )
    );
    
    // 行番号を振り直し
    const reorderedLines = reorderLineNumbers(updatedLines);
    onRawDataSave(reorderedLines);
    setSelectedItems(new Set());
  };

  const handleAddLine = () => {
    const newLine: RawDataLine = {
      lineNumber: rawLines.length + 1,
      content: '',
      type: 'empty',
      sourceFile: 'data.txt' // デフォルトでdata.txtに追加
    };
    
    const updatedLines = [...rawLines, newLine];
    const reorderedLines = reorderLineNumbers(updatedLines);
    onRawDataSave(reorderedLines);
  };

  const handleSaveChanges = () => {
    if (editedLines.size === 0) return;
    
    const updatedLines = rawLines.map(line => {
      const lineKey = `${line.sourceFile}_${line.lineNumber}`;
      return editedLines.get(lineKey) || line;
    });
    
    onRawDataSave(updatedLines);
    setEditedLines(new Map());
    setHasUnsavedChanges(false);
  };

  // 行番号を振り直す関数
  const reorderLineNumbers = (lines: RawDataLine[]): RawDataLine[] => {
    const fileGroups = new Map<string, RawDataLine[]>();
    
    // ファイル別にグループ化
    lines.forEach(line => {
      if (!fileGroups.has(line.sourceFile)) {
        fileGroups.set(line.sourceFile, []);
      }
      fileGroups.get(line.sourceFile)!.push(line);
    });
    
    // 各ファイル内で行番号を振り直し
    const reorderedLines: RawDataLine[] = [];
    for (const [_fileName, fileLines] of fileGroups) {
      fileLines.forEach((line, index) => {
        reorderedLines.push({
          ...line,
          lineNumber: index + 1
        });
      });
    }
    
    return reorderedLines;
  };

  const handleExitEditMode = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('未保存の変更があります。編集モードを終了しますか？')) {
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
      const selectedLines = rawLines.filter(line => selectedItems.has(`${line.sourceFile}_${line.lineNumber}`));
      handleDeleteLines(selectedLines);
    } else if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSaveChanges();
    }
  };

  const mergedLines = rawLines.map(line => {
    const lineKey = `${line.sourceFile}_${line.lineNumber}`;
    const editedLine = editedLines.get(lineKey);
    return editedLine || line;
  });

  const filteredLines = mergedLines.filter(line => {
    if (!searchQuery) return true;
    const keywords = searchQuery.toLowerCase().split(/\s+/).filter(k => k.length > 0);
    const lineText = line.content.toLowerCase();
    return keywords.every(keyword => lineText.includes(keyword));
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

  const getFileNames = () => {
    const fileSet = new Set(rawLines.map(line => line.sourceFile));
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
          <button onClick={handleExitEditMode} className="exit-edit-button">
            通常モードに戻る
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

      <EditableRawItemList
        rawLines={filteredLines}
        selectedItems={selectedItems}
        onLineEdit={handleLineEdit}
        onLineSelect={handleLineSelect}
        onSelectAll={handleSelectAll}
        onAddLine={handleAddLine}
        onDeleteLines={handleDeleteLines}
      />

      <div className="edit-mode-status">
        <span className="selection-count">
          {selectedItems.size > 0 ? `${selectedItems.size}行を選択中` : ''}
        </span>
        <span className="total-count">
          合計: {filteredLines.length}行
        </span>
        {hasUnsavedChanges && (
          <span className="unsaved-changes">
            未保存の変更があります
          </span>
        )}
      </div>
    </div>
  );
};

export default EditModeView;