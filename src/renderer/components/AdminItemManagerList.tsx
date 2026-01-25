import React, { useState, useEffect, useRef } from 'react';
import type { EditableJsonItem } from '@common/types/editableItem';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import type { LauncherItem, JsonItem } from '@common/types';
import {
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonGroupItem,
  isJsonWindowItem,
} from '@common/types';

import { logError } from '../utils/debug';

import ConfirmDialog from './ConfirmDialog';

interface EditableRawItemListProps {
  editableItems: EditableJsonItem[];
  selectedItems: Set<string>;
  onItemEdit: (item: EditableJsonItem) => void;
  onItemSelect: (item: EditableJsonItem, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onDeleteItems: (items: EditableJsonItem[]) => void;
  onEditClick: (item: EditableJsonItem) => void;
  onDuplicateItems: (items: EditableJsonItem[]) => void;
}

const AdminItemManagerList: React.FC<EditableRawItemListProps> = ({
  editableItems,
  selectedItems,
  onItemEdit,
  onItemSelect,
  onSelectAll,
  onDeleteItems,
  onEditClick,
  onDuplicateItems,
}) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // アイコンキャッシュ: Map<行番号, base64データURL>
  const [itemIcons, setItemIcons] = useState<Map<number, string>>(new Map());

  // 右クリックされたアイテムを保存（コンテキストメニューイベント用）
  const contextMenuItemsRef = useRef<EditableJsonItem[]>([]);

  // ConfirmDialog状態管理
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    danger: false,
  });

  // すべてのアイテムアイコンを取得（ファビコン + 自動取得 + カスタム）
  useEffect(() => {
    const loadIcons = async () => {
      // editableItemsからLauncherItemsに変換（type='item'のみ、パスが空でないもののみ）
      const launcherItems = editableItems
        .filter((editableItem) => editableItem.item.type === 'item' && editableItem.item.path)
        .map((editableItem) => {
          const jsonItem = editableItem.item;
          if (isJsonLauncherItem(jsonItem)) {
            return {
              displayName: jsonItem.displayName || '',
              path: jsonItem.path || '',
              type: detectItemTypeSync(jsonItem.path || ''),
            } as LauncherItem;
          }
          // type='item'でフィルタ済みなのでここには到達しない
          return null;
        })
        .filter((item): item is LauncherItem => item !== null);

      // loadCachedIcons()でアイコンを一括取得（Main Windowと同じAPI）
      const iconCache = await window.electronAPI.loadCachedIcons(launcherItems);

      // パス→アイコンのMapを作成
      const pathToIconMap = new Map<string, string>();
      Object.entries(iconCache).forEach(([path, iconData]) => {
        if (iconData) {
          pathToIconMap.set(path, iconData);
        }
      });

      // 行番号→アイコンのMapに変換（既存のitemIcons stateと互換性を保つ）
      const lineNumberToIconMap = new Map<number, string>();
      editableItems.forEach((editableItem) => {
        if (editableItem.item.type === 'item') {
          const path = editableItem.item.path || '';
          const iconData = pathToIconMap.get(path);
          if (iconData) {
            lineNumberToIconMap.set(editableItem.meta.lineNumber, iconData);
          }
        }
      });

      setItemIcons(lineNumberToIconMap);
    };

    loadIcons();
  }, [editableItems]);

  const getItemKey = (item: EditableJsonItem) =>
    `${item.meta.sourceFile}_${item.meta.lineNumber}`;

  // コンテキストメニューイベントリスナーを登録
  useEffect(() => {
    // 複製
    const cleanupDuplicate = window.electronAPI.onAdminMenuDuplicateItems(() => {
      const targetItems = contextMenuItemsRef.current;
      if (targetItems.length > 0) {
        onDuplicateItems(targetItems);
      }
    });

    // 詳細編集
    const cleanupEdit = window.electronAPI.onAdminMenuEditItem(() => {
      const targetItems = contextMenuItemsRef.current;
      if (targetItems.length === 1) {
        onEditClick(targetItems[0]);
      }
    });

    // 削除
    const cleanupDelete = window.electronAPI.onAdminMenuDeleteItems(() => {
      const targetItems = contextMenuItemsRef.current;
      if (targetItems.length > 0) {
        onDeleteItems(targetItems);
      }
    });

    // クリーンアップ
    return () => {
      cleanupDuplicate();
      cleanupEdit();
      cleanupDelete();
    };
  }, [onDuplicateItems, onEditClick, onDeleteItems]);

  const handleContextMenu = (event: React.MouseEvent, item: EditableJsonItem) => {
    event.preventDefault();
    event.stopPropagation();

    const itemKey = getItemKey(item);
    let selectedCount: number;
    let isSingleItem: boolean;
    let targetItems: EditableJsonItem[];

    // 右クリックしたアイテムが選択されていない場合、そのアイテムだけを対象にする
    if (selectedItems.has(itemKey)) {
      targetItems = editableItems.filter((i) => selectedItems.has(getItemKey(i)));
      selectedCount = targetItems.length;
      isSingleItem = selectedCount === 1;
    } else {
      targetItems = [item];
      selectedCount = 1;
      isSingleItem = true;
    }

    // 対象アイテムを保存（イベントリスナーから参照するため）
    contextMenuItemsRef.current = targetItems;

    // ネイティブメニューを表示
    window.electronAPI.showAdminItemContextMenu(selectedCount, isSingleItem);
  };

  const handleCellEdit = (item: EditableJsonItem) => {
    // ウィンドウ操作アイテムはパス編集不可（詳細編集のみ）
    if (item.item.type === 'window') {
      return;
    }

    const cellKey = getItemKey(item);
    setEditingCell(cellKey);

    // パスのみを取得（引数は編集しない）
    let pathOnly = '';
    const jsonItem = item.item;

    if (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) {
      pathOnly = jsonItem.path || '';
    } else if (jsonItem.type === 'group' && isJsonGroupItem(jsonItem)) {
      // グループの場合：アイテム名のリスト（カンマ区切り）
      pathOnly = jsonItem.itemNames?.join(', ') || '';
    } else if (jsonItem.type === 'dir' && isJsonDirItem(jsonItem)) {
      // フォルダ取込の場合：フォルダパス
      pathOnly = jsonItem.path || '';
    }

    setEditingValue(pathOnly);
  };

  const handleCellSave = (item: EditableJsonItem) => {
    const trimmedValue = editingValue.trim();
    const jsonItem = item.item;

    // 変更があるか確認
    let hasChanged = false;
    if (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) {
      hasChanged = trimmedValue !== (jsonItem.path || '');
    } else if (jsonItem.type === 'group' && isJsonGroupItem(jsonItem)) {
      const currentItemNames = jsonItem.itemNames?.join(', ') || '';
      hasChanged = trimmedValue !== currentItemNames;
    } else if (jsonItem.type === 'dir' && isJsonDirItem(jsonItem)) {
      hasChanged = trimmedValue !== (jsonItem.path || '');
    }

    if (hasChanged) {
      // JsonItemを直接更新
      let updatedJsonItem: JsonItem;

      if (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) {
        updatedJsonItem = { ...jsonItem, path: trimmedValue };
      } else if (jsonItem.type === 'group' && isJsonGroupItem(jsonItem)) {
        // カンマ区切りのアイテム名リストをパース
        const itemNames = trimmedValue
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name);
        updatedJsonItem = { ...jsonItem, itemNames };
      } else if (jsonItem.type === 'dir' && isJsonDirItem(jsonItem)) {
        updatedJsonItem = { ...jsonItem, path: trimmedValue };
      } else {
        updatedJsonItem = jsonItem;
      }

      const updatedItem: EditableJsonItem = {
        ...item,
        item: updatedJsonItem,
      };
      onItemEdit(updatedItem);
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const handleNameEdit = (item: EditableJsonItem) => {
    const jsonItem = item.item;
    let name = '';

    if (
      (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) ||
      (jsonItem.type === 'group' && isJsonGroupItem(jsonItem)) ||
      (jsonItem.type === 'window' && isJsonWindowItem(jsonItem))
    ) {
      name = jsonItem.displayName || '';
    }

    const cellKey = `${getItemKey(item)}_name`;
    setEditingCell(cellKey);
    setEditingValue(name);
  };

  const handleNameSave = (item: EditableJsonItem) => {
    const newName = editingValue.trim();
    const jsonItem = item.item;

    let currentName = '';
    if (
      (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) ||
      (jsonItem.type === 'group' && isJsonGroupItem(jsonItem)) ||
      (jsonItem.type === 'window' && isJsonWindowItem(jsonItem))
    ) {
      currentName = jsonItem.displayName || '';
    }

    // 変更があるか確認
    if (newName !== currentName) {
      // JsonItemのdisplayNameを更新
      let updatedJsonItem: JsonItem;
      if (
        (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) ||
        (jsonItem.type === 'group' && isJsonGroupItem(jsonItem)) ||
        (jsonItem.type === 'window' && isJsonWindowItem(jsonItem))
      ) {
        updatedJsonItem = {
          ...jsonItem,
          displayName: newName,
        };
      } else {
        updatedJsonItem = jsonItem;
      }

      const updatedItem: EditableJsonItem = {
        ...item,
        item: updatedJsonItem,
      };
      onItemEdit(updatedItem);
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const handleNameKeyDown = (e: React.KeyboardEvent, item: EditableJsonItem) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameSave(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: EditableJsonItem) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellSave(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const getItemTypeIcon = (item: EditableJsonItem) => {
    const jsonItem = item.item;
    switch (jsonItem.type) {
      case 'item':
        return '📄';
      case 'group':
        return '📦';
      case 'dir':
        return '🗂️';
      case 'window':
        return '🪟';
      default:
        return '❓';
    }
  };

  const getItemTypeDisplayName = (item: EditableJsonItem) => {
    const jsonItem = item.item;
    switch (jsonItem.type) {
      case 'item':
        return '単一アイテム';
      case 'group':
        return 'グループ';
      case 'dir':
        return 'フォルダ取込';
      case 'window':
        return 'ウィンドウ操作';
      default:
        return '不明';
    }
  };

  const renderNameCell = (item: EditableJsonItem) => {
    const jsonItem = item.item;

    if (
      (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) ||
      (jsonItem.type === 'group' && isJsonGroupItem(jsonItem)) ||
      (jsonItem.type === 'window' && isJsonWindowItem(jsonItem))
    ) {
      const name = jsonItem.displayName || '';
      const hasError = item.meta.validationError !== undefined;

      const cellKey = `${getItemKey(item)}_name`;
      const isEditing = editingCell === cellKey;

      if (isEditing) {
        return (
          <input
            type="text"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() => handleNameSave(item)}
            onKeyDown={(e) => handleNameKeyDown(e, item)}
            className="edit-input"
            autoFocus
          />
        );
      }

      return (
        <div
          className={`editable-cell ${hasError ? 'error' : ''}`}
          onClick={() => handleNameEdit(item)}
          title={
            hasError
              ? `バリデーションエラー: ${item.meta.validationError}`
              : 'クリックして名前を編集'
          }
        >
          {name || '(名前なし)'}
        </div>
      );
    } else {
      // dirアイテムは名称編集不可
      return <div className="readonly-cell">-</div>;
    }
  };

  const getPathAndArgs = (item: EditableJsonItem) => {
    const jsonItem = item.item;

    if (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) {
      // アイテムの場合：パス＋引数の組み合わせ
      const pathPart = jsonItem.path || '';
      const argsPart = jsonItem.args || '';
      if (!pathPart) return '(パスなし)';
      return argsPart ? `${pathPart} ${argsPart}` : pathPart;
    } else if (jsonItem.type === 'group' && isJsonGroupItem(jsonItem)) {
      // グループの場合：アイテム名のリスト
      const itemNames = jsonItem.itemNames || [];
      if (itemNames.length === 0) return '(アイテムなし)';
      return itemNames.join(', ');
    } else if (jsonItem.type === 'window' && isJsonWindowItem(jsonItem)) {
      // ウィンドウ操作の場合：ウィンドウタイトル＋設定情報
      const windowTitle = jsonItem.windowTitle || '';
      const settings: string[] = [];

      if (jsonItem.x !== undefined) settings.push(`x:${jsonItem.x}`);
      if (jsonItem.y !== undefined) settings.push(`y:${jsonItem.y}`);
      if (jsonItem.width !== undefined) settings.push(`w:${jsonItem.width}`);
      if (jsonItem.height !== undefined) settings.push(`h:${jsonItem.height}`);
      if (jsonItem.virtualDesktopNumber !== undefined)
        settings.push(`desk:${jsonItem.virtualDesktopNumber}`);
      if (jsonItem.activateWindow !== undefined) settings.push(`active:${jsonItem.activateWindow}`);

      if (!windowTitle) return '(ウィンドウタイトルなし)';
      return settings.length > 0 ? `${windowTitle} [${settings.join(', ')}]` : windowTitle;
    } else if (jsonItem.type === 'dir' && isJsonDirItem(jsonItem)) {
      // dirの場合：フォルダパス＋オプション
      const dirPath = jsonItem.path || '';
      const options = jsonItem.options || {};
      const optionStrs: string[] = [];

      if (options.depth !== undefined) optionStrs.push(`depth=${options.depth}`);
      if (options.types) optionStrs.push(`types=${options.types}`);
      if (options.exclude) optionStrs.push(`exclude=${options.exclude}`);

      if (!dirPath) return '(フォルダパスなし)';
      return optionStrs.length > 0 ? `${dirPath} [${optionStrs.join(', ')}]` : dirPath;
    } else {
      return '(不明な型)';
    }
  };

  // EditableJsonItemでは空行の概念がないため、この関数は使用されない
  // （空のJsonItemを作成する場合は、AdminItemManagerView側で処理）

  const renderTypeCell = (item: EditableJsonItem) => {
    return (
      <>
        <span className="type-icon">{getItemTypeIcon(item)}</span>
        <span className="type-name">{getItemTypeDisplayName(item)}</span>
      </>
    );
  };

  const renderIconCell = (item: EditableJsonItem) => {
    // 単一アイテムの場合のみアイコンを表示
    if (item.item.type === 'item') {
      const iconData = itemIcons.get(item.meta.lineNumber);
      if (iconData) {
        return <img src={iconData} alt="" className="item-icon-image" />;
      }

      // アイコンがない場合、パスから型を判定してフォルダなら絵文字表示
      const path = item.item.path || '';
      if (path && detectItemTypeSync(path) === 'folder') {
        return <span className="folder-emoji">📁</span>;
      }
    }
    return null;
  };

  const renderEditableCell = (item: EditableJsonItem) => {
    const cellKey = getItemKey(item);
    const isEditing = editingCell === cellKey;

    if (isEditing) {
      return (
        <input
          type="text"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => handleCellSave(item)}
          onKeyDown={(e) => handleKeyDown(e, item)}
          className="edit-input"
          autoFocus
        />
      );
    }

    // ウィンドウ操作アイテムは編集不可
    if (item.item.type === 'window') {
      return (
        <div
          className="readonly-cell"
          title="ウィンドウ操作アイテムは✏️ボタンから詳細編集を開いてください"
        >
          {getPathAndArgs(item)}
        </div>
      );
    }

    // ツールチップテキストを動的に生成
    let tooltipText = '';
    if (item.item.type === 'group') {
      tooltipText = 'クリックしてアイテム名リストを編集できます（カンマ区切りで入力）';
    } else {
      tooltipText =
        'クリックしてパスを編集できます。引数を変更する場合は✏️ボタンから詳細編集を開いてください';
    }

    return (
      <div className="editable-cell" onClick={() => handleCellEdit(item)} title={tooltipText}>
        {getPathAndArgs(item)}
      </div>
    );
  };

  const allSelected =
    editableItems.length > 0 &&
    editableItems.every((item) => selectedItems.has(getItemKey(item)));
  const someSelected = editableItems.some((item) => selectedItems.has(getItemKey(item)));

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
            <th className="icon-column"></th>
            <th className="name-column">名前</th>
            <th className="content-column">パスと引数 (パスのみ編集可、引数編集は✏️から)</th>
            <th className="actions-column">操作</th>
          </tr>
        </thead>
        <tbody>
          {editableItems.map((item) => {
            const itemKey = getItemKey(item);
            const isSelected = selectedItems.has(itemKey);

            return (
              <tr
                key={itemKey}
                className={`raw-item-row ${isSelected ? 'selected' : ''} ${item.item.type}`}
                onContextMenu={(e) => handleContextMenu(e, item)}
              >
                <td className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onItemSelect(item, e.target.checked)}
                  />
                </td>
                <td className="line-number-column">{item.meta.lineNumber}</td>
                <td className="type-column">{renderTypeCell(item)}</td>
                <td className="icon-column">{renderIconCell(item)}</td>
                <td className="name-column">{renderNameCell(item)}</td>
                <td className="content-column">{renderEditableCell(item)}</td>
                <td className="actions-column">
                  <div className="action-buttons">
                    <button
                      className="detail-edit-button"
                      onClick={() => onEditClick(item)}
                      title="詳細編集"
                    >
                      ✏️
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          message: `行 ${item.meta.lineNumber} を削除しますか？`,
                          onConfirm: () => {
                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                            onDeleteItems([item]);
                          },
                          danger: true,
                        });
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

      {editableItems.length === 0 && (
        <div className="no-items">データファイルにアイテムがありません</div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
      />
    </div>
  );
};

export default AdminItemManagerList;
