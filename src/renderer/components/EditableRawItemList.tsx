import React, { useState } from 'react';

import { RawDataLine } from '../../common/types';

interface EditableRawItemListProps {
  rawLines: RawDataLine[];
  selectedItems: Set<string>;
  onLineEdit: (line: RawDataLine) => void;
  onLineSelect: (line: RawDataLine, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  _onAddLine: () => void;
  onDeleteLines: (lines: RawDataLine[]) => void;
  onEditClick: (line: RawDataLine) => void;
  _onSort: (sortedLines: RawDataLine[]) => void;
}

const EditableRawItemList: React.FC<EditableRawItemListProps> = ({
  rawLines,
  selectedItems,
  onLineEdit,
  onLineSelect,
  onSelectAll,
  _onAddLine, // 未使用（将来の機能拡張用）
  onDeleteLines,
  onEditClick,
  _onSort, // 未使用（将来の機能拡張用）
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

        // パスと引数に分解
        const trimmedValue = editingValue.trim();
        const spaceIndex = trimmedValue.indexOf(' ');

        if (spaceIndex > 0) {
          // スペースがある場合：パスと引数に分ける
          const pathPart = trimmedValue.substring(0, spaceIndex);
          const argsPart = trimmedValue.substring(spaceIndex + 1);
          newContent = `${name},${pathPart},${argsPart}`;
        } else {
          // スペースがない場合：パスのみ
          newContent = `${name},${trimmedValue}`;
        }

        // 元パスが存在する場合は追加
        if (parts.length > 3 && parts[3]) {
          newContent += `,${parts[3]}`;
        }
      } else if (line.type === 'directive') {
        // フォルダ取込アイテムの場合：フォルダパスとオプションを更新
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
      case 'directive':
        return '🗂️';
      case 'item':
        return '📄';
      case 'comment':
        return '💬';
      case 'empty':
        return '⬜';
      default:
        return '❓';
    }
  };

  const getLineTypeDisplayName = (type: RawDataLine['type']) => {
    switch (type) {
      case 'directive':
        return 'フォルダ取込';
      case 'item':
        return '単一アイテム';
      case 'comment':
        return 'コメント';
      case 'empty':
        return '空行';
      default:
        return '不明';
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
      // フォルダ取込アイテムなどは名称編集不可
      return <div className="readonly-cell">-</div>;
    }
  };

  const getPathAndArgs = (line: RawDataLine) => {
    if (line.type === 'item') {
      // アイテム行の場合：パス＋引数の組み合わせ
      const parts = line.content.split(',');
      const pathPart = parts[1]?.trim() || '';
      const argsPart = parts[2]?.trim() || '';
      if (!pathPart) return '(パスなし)';
      return argsPart ? `${pathPart} ${argsPart}` : pathPart;
    } else if (line.type === 'directive') {
      // フォルダ取込アイテムの場合：フォルダパス＋オプション
      const parts = line.content.split(',');
      const pathPart = parts[1]?.trim() || '';
      const options = parts.slice(2).join(',').trim();
      if (!pathPart) return '(フォルダパスなし)';
      return options ? `${pathPart} ${options}` : pathPart;
    } else {
      // コメント行や空行の場合：元の内容を表示
      return line.content || (line.type === 'empty' ? '(空行)' : '');
    }
  };

  const handleTypeSelection = (line: RawDataLine, newType: 'item' | 'directive') => {
    let newContent = '';

    if (newType === 'item') {
      // 単一アイテムの場合：名前,パス,引数の形式（名前とパスは空で初期化）
      newContent = ',';
    } else if (newType === 'directive') {
      // フォルダ取り込みの場合：dir,パスの形式（パスは空で初期化）
      newContent = 'dir,';
    }

    const updatedLine = {
      ...line,
      content: newContent,
      type: newType
    };
    onLineEdit(updatedLine);
  };

  const renderTypeCell = (line: RawDataLine) => {
    if (line.type === 'empty') {
      return (
        <div className="type-selection">
          <button
            className="type-select-button item-button"
            onClick={() => handleTypeSelection(line, 'item')}
            title="単一アイテムとして設定"
          >
            📄 単一アイテム
          </button>
          <button
            className="type-select-button folder-button"
            onClick={() => handleTypeSelection(line, 'directive')}
            title="フォルダ取り込みとして設定"
          >
            🗂️ フォルダ取り込み
          </button>
        </div>
      );
    }

    return (
      <>
        <span className="type-icon">{getLineTypeIcon(line.type)}</span>
        <span className="type-name">{getLineTypeDisplayName(line.type)}</span>
      </>
    );
  };

  const renderEditableCell = (line: RawDataLine) => {
    const cellKey = getLineKey(line);
    const isEditing = editingCell === cellKey;
    const isEmptyLine = line.type === 'empty';

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

    if (isEmptyLine) {
      // 空行の場合は編集不可として表示
      return (
        <div className="readonly-cell" title="空行の場合は編集できません。まず種類を選択してください。">
          (まず種類を選択してください)
        </div>
      );
    }

    return (
      <div className="editable-cell" onClick={() => handleCellEdit(line)} title="クリックして編集">
        {getPathAndArgs(line)}
      </div>
    );
  };

  const allSelected =
    rawLines.length > 0 && rawLines.every((line) => selectedItems.has(getLineKey(line)));
  const someSelected = rawLines.some((line) => selectedItems.has(getLineKey(line)));

  return (
    <div className="editable-raw-item-list">
      <table className="raw-items-table">
        <thead>
          <tr>
            <th className="checkbox-column">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
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
                <td className="line-number-column">{line.lineNumber}</td>
                <td className="type-column">
                  {renderTypeCell(line)}
                </td>
                <td className="name-column">{renderNameCell(line)}</td>
                <td className="content-column">{renderEditableCell(line)}</td>
                <td className="actions-column">
                  <div className="action-buttons">
                    <button
                      className="detail-edit-button"
                      onClick={() => onEditClick(line)}
                      title="詳細編集"
                      disabled={line.type === 'empty'}
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

      {rawLines.length === 0 && <div className="no-items">データファイルに行がありません</div>}
    </div>
  );
};

export default EditableRawItemList;
