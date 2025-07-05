import React, { useState } from 'react';
import { LauncherItem } from '../../common/types';

interface EditableItemListProps {
  items: LauncherItem[];
  selectedItems: Set<string>;
  onItemEdit: (item: LauncherItem) => void;
  onItemSelect: (item: LauncherItem, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

const EditableItemList: React.FC<EditableItemListProps> = ({
  items,
  selectedItems,
  onItemEdit,
  onItemSelect,
  onSelectAll
}) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const getItemKey = (item: LauncherItem) => `${item.sourceFile}_${item.lineNumber}`;

  const handleCellEdit = (item: LauncherItem, field: 'name' | 'path' | 'args') => {
    const cellKey = `${getItemKey(item)}_${field}`;
    setEditingCell(cellKey);
    setEditingValue(item[field] || '');
  };

  const handleCellSave = (item: LauncherItem, field: 'name' | 'path' | 'args') => {
    if (editingValue !== (item[field] || '')) {
      const updatedItem = { ...item, [field]: editingValue };
      onItemEdit(updatedItem);
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: LauncherItem, field: 'name' | 'path' | 'args') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellSave(item, field);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const renderEditableCell = (item: LauncherItem, field: 'name' | 'path' | 'args', value: string) => {
    const cellKey = `${getItemKey(item)}_${field}`;
    const isEditing = editingCell === cellKey;
    const isReadonly = item.isDirExpanded || field === 'args' && item.type !== 'app';

    if (isEditing && !isReadonly) {
      return (
        <input
          type="text"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => handleCellSave(item, field)}
          onKeyDown={(e) => handleKeyDown(e, item, field)}
          className="edit-input"
          autoFocus
        />
      );
    }

    return (
      <div
        className={`editable-cell ${isReadonly ? 'readonly' : ''}`}
        onClick={() => !isReadonly && handleCellEdit(item, field)}
        title={isReadonly ? '編集できません' : 'クリックして編集'}
      >
        {value || (field === 'args' ? '-' : '')}
      </div>
    );
  };

  const getTypeDisplayName = (type: LauncherItem['type']) => {
    switch (type) {
      case 'app': return 'アプリ';
      case 'file': return 'ファイル';
      case 'folder': return 'フォルダ';
      case 'url': return 'URL';
      case 'customUri': return 'カスタムURI';
      default: return type;
    }
  };

  const getItemIcon = (item: LauncherItem) => {
    if (item.icon) {
      return <img src={item.icon} alt="" className="item-icon" />;
    }
    
    switch (item.type) {
      case 'app': return '🚀';
      case 'file': return '📄';
      case 'folder': return '📁';
      case 'url': return '🌐';
      case 'customUri': return '🔗';
      default: return '📄';
    }
  };

  const allSelected = items.length > 0 && items.every(item => selectedItems.has(getItemKey(item)));
  const someSelected = items.some(item => selectedItems.has(getItemKey(item)));

  return (
    <div className="editable-item-list">
      <table className="items-table">
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
            <th className="icon-column">アイコン</th>
            <th className="name-column">名前</th>
            <th className="path-column">パス</th>
            <th className="type-column">タイプ</th>
            <th className="args-column">引数</th>
            <th className="source-column">ソース</th>
            <th className="actions-column">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const itemKey = getItemKey(item);
            const isSelected = selectedItems.has(itemKey);
            const isReadonly = item.isDirExpanded;
            
            return (
              <tr 
                key={itemKey} 
                className={`item-row ${isSelected ? 'selected' : ''} ${isReadonly ? 'readonly' : ''} ${item.isEdited ? 'edited' : ''}`}
              >
                <td className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onItemSelect(item, e.target.checked)}
                  />
                </td>
                <td className="icon-column">
                  {isReadonly && <span className="readonly-icon">🔒</span>}
                  {getItemIcon(item)}
                </td>
                <td className="name-column">
                  {renderEditableCell(item, 'name', item.name)}
                </td>
                <td className="path-column">
                  {renderEditableCell(item, 'path', item.path)}
                </td>
                <td className="type-column">
                  {getTypeDisplayName(item.type)}
                </td>
                <td className="args-column">
                  {renderEditableCell(item, 'args', item.args || '')}
                </td>
                <td className="source-column">
                  <span className="source-info">
                    {item.sourceFile}:{item.lineNumber}
                  </span>
                </td>
                <td className="actions-column">
                  <div className="action-buttons">
                    <button
                      className="edit-button"
                      onClick={() => {
                        // TODO: 詳細編集モーダルを開く
                        console.log('Edit item:', item);
                      }}
                      disabled={isReadonly}
                      title="詳細編集"
                    >
                      ✏️
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => {
                        if (window.confirm(`「${item.name}」を削除しますか？`)) {
                          onItemSelect(item, true);
                          // TODO: 個別削除の実装
                        }
                      }}
                      disabled={isReadonly}
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
      
      {items.length === 0 && (
        <div className="no-items">
          表示するアイテムがありません
        </div>
      )}
    </div>
  );
};

export default EditableItemList;