import React, { useState } from 'react';
import { RawDataLine } from '../../common/types';

interface EditableRawItemListProps {
  rawLines: RawDataLine[];
  selectedItems: Set<string>;
  onLineEdit: (line: RawDataLine) => void;
  onLineSelect: (line: RawDataLine, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onAddLine: () => void;
  onDeleteLines: (lines: RawDataLine[]) => void;
  onEditClick: (line: RawDataLine) => void;
}

const EditableRawItemList: React.FC<EditableRawItemListProps> = ({
  rawLines,
  selectedItems,
  onLineEdit,
  onLineSelect,
  onSelectAll,
  onAddLine,
  onDeleteLines,
  onEditClick
}) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const getLineKey = (line: RawDataLine) => `${line.sourceFile}_${line.lineNumber}`;

  const handleCellEdit = (line: RawDataLine) => {
    const cellKey = getLineKey(line);
    setEditingCell(cellKey);
    setEditingValue(getPathAndArgs(line));
  };

  const handleCellSave = (line: RawDataLine) => {
    const currentPathAndArgs = getPathAndArgs(line);
    if (editingValue !== currentPathAndArgs) {
      let newContent = line.content;
      
      if (line.type === 'item') {
        // アイテム行の場合：パスと引数を更新
        const parts = line.content.split(',');
        const name = parts[0] || '';
        const originalPath = parts[3] || '';
        
        // パスと引数に分解
        const trimmedValue = editingValue.trim();
        const spaceIndex = trimmedValue.indexOf(' ');
        
        if (spaceIndex > 0) {
          // スペースがある場合：パスと引数に分ける
          const pathPart = trimmedValue.substring(0, spaceIndex);
          const argsPart = trimmedValue.substring(spaceIndex + 1);
          newContent = `${name},${pathPart},${argsPart},${originalPath}`;
        } else {
          // スペースがない場合：パスのみ
          newContent = `${name},${trimmedValue},,${originalPath}`;
        }
      } else if (line.type === 'directive') {
        // DIRディレクティブの場合：フォルダパスとオプションを更新
        const parts = line.content.split(',');
        const directive = parts[0] || 'dir';
        
        // パスとオプションに分解
        const trimmedValue = editingValue.trim();
        const spaceIndex = trimmedValue.indexOf(' ');
        
        if (spaceIndex > 0) {
          // スペースがある場合：パスとオプションに分ける
          const pathPart = trimmedValue.substring(0, spaceIndex);
          const optionsPart = trimmedValue.substring(spaceIndex + 1);
          newContent = `${directive},${pathPart},${optionsPart}`;
        } else {
          // スペースがない場合：パスのみ
          newContent = `${directive},${trimmedValue}`;
        }
      } else {
        // コメント行や空行の場合：そのまま更新
        newContent = editingValue;
      }
      
      const updatedLine = { ...line, content: newContent };
      onLineEdit(updatedLine);
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const handleNameEdit = (line: RawDataLine) => {
    const parts = line.content.split(',');
    const name = parts[0]?.trim() || '';
    const cellKey = `${getLineKey(line)}_name`;
    setEditingCell(cellKey);
    setEditingValue(name);
  };

  const handleNameSave = (line: RawDataLine) => {
    const parts = line.content.split(',');
    parts[0] = editingValue.trim();
    const newContent = parts.join(',');
    
    if (newContent !== line.content) {
      const updatedLine = { ...line, content: newContent };
      onLineEdit(updatedLine);
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const handleNameKeyDown = (e: React.KeyboardEvent, line: RawDataLine) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameSave(line);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, line: RawDataLine) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellSave(line);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const getLineTypeIcon = (type: RawDataLine['type']) => {
    switch (type) {
      case 'directive': return '🗂️';
      case 'item': return '📄';
      case 'comment': return '💬';
      case 'empty': return '⬜';
      default: return '❓';
    }
  };

  const getLineTypeDisplayName = (type: RawDataLine['type']) => {
    switch (type) {
      case 'directive': return 'DIR';
      case 'item': return 'アイテム';
      case 'comment': return 'コメント';
      case 'empty': return '空行';
      default: return '不明';
    }
  };

  const renderNameCell = (line: RawDataLine) => {
    if (line.type === 'item') {
      // アイテム行の場合、CSV形式から名前を抽出
      const parts = line.content.split(',');
      const name = parts[0]?.trim() || '';
      
      const cellKey = `${getLineKey(line)}_name`;
      const isEditing = editingCell === cellKey;

      if (isEditing) {
        return (
          <input
            type="text"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() => handleNameSave(line)}
            onKeyDown={(e) => handleNameKeyDown(e, line)}
            className="edit-input"
            autoFocus
          />
        );
      }

      return (
        <div
          className="editable-cell"
          onClick={() => handleNameEdit(line)}
          title="クリックして名前を編集"
        >
          {name || '(名前なし)'}
        </div>
      );
    } else {
      // DIRディレクティブなどは名称編集不可
      return (
        <div className="readonly-cell">
          -
        </div>
      );
    }
  };

  const getPathAndArgs = (line: RawDataLine) => {
    if (line.type === 'item') {
      // アイテム行の場合：パス＋引数の組み合わせ
      const parts = line.content.split(',');
      const pathPart = parts[1]?.trim() || '';
      const argsPart = parts[2]?.trim() || '';
      return argsPart ? `${pathPart} ${argsPart}` : pathPart;
    } else if (line.type === 'directive') {
      // DIRディレクティブの場合：フォルダパス＋オプション
      const parts = line.content.split(',');
      const pathPart = parts[1]?.trim() || '';
      const options = parts.slice(2).join(',').trim();
      return options ? `${pathPart} ${options}` : pathPart;
    } else {
      // コメント行や空行の場合：元の内容を表示
      return line.content || (line.type === 'empty' ? '(空行)' : '');
    }
  };

  const renderEditableCell = (line: RawDataLine) => {
    const cellKey = getLineKey(line);
    const isEditing = editingCell === cellKey;

    if (isEditing) {
      return (
        <input
          type="text"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => handleCellSave(line)}
          onKeyDown={(e) => handleKeyDown(e, line)}
          className="edit-input"
          autoFocus
        />
      );
    }

    return (
      <div
        className="editable-cell"
        onClick={() => handleCellEdit(line)}
        title="クリックして編集"
      >
        {getPathAndArgs(line)}
      </div>
    );
  };

  const allSelected = rawLines.length > 0 && rawLines.every(line => selectedItems.has(getLineKey(line)));
  const someSelected = rawLines.some(line => selectedItems.has(getLineKey(line)));

  return (
    <div className="editable-raw-item-list">
      <div className="raw-list-header">
        <button onClick={onAddLine} className="add-line-button">
          ➕ 行を追加
        </button>
        <button 
          onClick={() => {
            const selectedLines = rawLines.filter(line => selectedItems.has(getLineKey(line)));
            if (selectedLines.length > 0 && window.confirm(`${selectedLines.length}行を削除しますか？`)) {
              onDeleteLines(selectedLines);
            }
          }}
          className="delete-lines-button"
          disabled={selectedItems.size === 0}
        >
          🗑️ 選択行を削除 ({selectedItems.size})
        </button>
      </div>

      <table className="raw-items-table">
        <thead>
          <tr>
            <th className="checkbox-column">
              <input
                type="checkbox"
                checked={allSelected}
                ref={input => {
                  if (input) input.indeterminate = someSelected && !allSelected;
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            <th className="line-number-column">#</th>
            <th className="type-column">種類</th>
            <th className="name-column">名前</th>
            <th className="content-column">パスと引数</th>
            <th className="actions-column">操作</th>
          </tr>
        </thead>
        <tbody>
          {rawLines.map((line) => {
            const lineKey = getLineKey(line);
            const isSelected = selectedItems.has(lineKey);
            
            return (
              <tr 
                key={lineKey} 
                className={`raw-item-row ${isSelected ? 'selected' : ''} ${line.type}`}
              >
                <td className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onLineSelect(line, e.target.checked)}
                  />
                </td>
                <td className="line-number-column">
                  {line.lineNumber}
                </td>
                <td className="type-column">
                  <span className="type-icon">{getLineTypeIcon(line.type)}</span>
                  <span className="type-name">{getLineTypeDisplayName(line.type)}</span>
                </td>
                <td className="name-column">
                  {renderNameCell(line)}
                </td>
                <td className="content-column">
                  {renderEditableCell(line)}
                </td>
                <td className="actions-column">
                  <div className="action-buttons">
                    <button
                      className="cell-edit-button"
                      onClick={() => handleCellEdit(line)}
                      title="セル編集"
                    >
                      📝
                    </button>
                    <button
                      className="detail-edit-button"
                      onClick={() => onEditClick(line)}
                      title="詳細編集"
                    >
                      ✏️
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => {
                        if (window.confirm(`行 ${line.lineNumber} を削除しますか？`)) {
                          onDeleteLines([line]);
                        }
                      }}
                      title="削除"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {rawLines.length === 0 && (
        <div className="no-items">
          データファイルに行がありません
        </div>
      )}
    </div>
  );
};

export default EditableRawItemList;