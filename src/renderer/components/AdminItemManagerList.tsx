import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { EditableJsonItem } from '@common/types/editableItem';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import type {
  LauncherItem,
  JsonItem,
  JsonLauncherItem,
  JsonGroupItem,
  JsonWindowItem,
  JsonLayoutItem,
  JsonClipboardItem,
} from '@common/types';
import {
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonGroupItem,
  isJsonWindowItem,
  isJsonClipboardItem,
  isJsonLayoutItem,
} from '@common/types';

import {
  describePathAndArgs,
  getItemKey,
  isInlineItemType,
  type InlineItemType,
  type SortColumn,
  type SortState,
} from '../utils/editableItemOperations';

// displayNameを持つアイテム型
type JsonItemWithDisplayName =
  JsonLauncherItem | JsonGroupItem | JsonWindowItem | JsonLayoutItem | JsonClipboardItem;

// displayNameを持つアイテム型かどうかを判定するヘルパー関数
function hasDisplayName(jsonItem: JsonItem): jsonItem is JsonItemWithDisplayName {
  return (
    (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) ||
    (jsonItem.type === 'group' && isJsonGroupItem(jsonItem)) ||
    (jsonItem.type === 'window' && isJsonWindowItem(jsonItem)) ||
    (jsonItem.type === 'layout' && isJsonLayoutItem(jsonItem)) ||
    (jsonItem.type === 'clipboard' && isJsonClipboardItem(jsonItem))
  );
}

/** パス列をセルで直接編集できる種類（それ以外は ✏️ の詳細編集から） */
function isPathEditable(jsonItem: JsonItem): boolean {
  return jsonItem.type === 'item' || jsonItem.type === 'dir';
}

function formatUpdatedAt(updatedAt?: number): string {
  if (!updatedAt) return '-';
  return new Date(updatedAt).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const itemTypeInfo: Record<string, { icon: string; name: string }> = {
  item: { icon: '📄', name: '単一アイテム' },
  group: { icon: '📦', name: 'グループ' },
  dir: { icon: '🗂️', name: 'フォルダ取込' },
  window: { icon: '🪟', name: 'ウィンドウ操作' },
  clipboard: { icon: '📋', name: 'クリップボード' },
  layout: { icon: '🖥️', name: 'ウィンドウレイアウト' },
};

interface EditableRawItemListProps {
  /** 表示順に並べ済みのアイテム（並べ替えは呼び出し側が行う） */
  editableItems: EditableJsonItem[];
  selectedItems: Set<string>;
  /** 未保存の変更があるアイテムの id（行に印を付ける） */
  changedIds: Set<string>;
  /** 検索・フィルタで絞り込み中か（0 件のときの文言に使う） */
  isFiltered: boolean;
  sortState: SortState;
  onSortChange: (column: SortColumn) => void;
  /** 追加直後に名前セルを編集状態にするアイテムの id */
  autoEditItemId: string | null;
  onAutoEditHandled: () => void;
  onItemEdit: (item: EditableJsonItem) => void;
  onChangeType: (item: EditableJsonItem, newType: InlineItemType) => void;
  onItemSelect: (item: EditableJsonItem, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  /** 削除の確認は呼び出し側（AdminItemManagerView）で行う */
  onRequestDelete: (items: EditableJsonItem[]) => void;
  onEditClick: (item: EditableJsonItem) => void;
  onDuplicateItems: (items: EditableJsonItem[]) => void;
  autoImportRuleMap?: Map<string, string>;
}

const AdminItemManagerList: React.FC<EditableRawItemListProps> = ({
  editableItems,
  selectedItems,
  changedIds,
  isFiltered,
  sortState,
  onSortChange,
  autoEditItemId,
  onAutoEditHandled,
  onItemEdit,
  onChangeType,
  onItemSelect,
  onSelectAll,
  onRequestDelete,
  onEditClick,
  onDuplicateItems,
  autoImportRuleMap,
}) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  // Enter で次のセルへ移った直後に前の入力欄の blur が遅れて届いても、別のセルの値で上書きしないための参照
  const editingCellRef = useRef<string | null>(null);
  editingCellRef.current = editingCell;
  const editingValueRef = useRef('');
  editingValueRef.current = editingValue;

  // 列リサイズ
  const [nameColumnWidth, setNameColumnWidth] = useState<number | null>(null);
  const nameThRef = useRef<HTMLTableCellElement>(null);
  const resizeStateRef = useRef({ isResizing: false, startX: 0, startWidth: 0 });

  // アイコンキャッシュ: Map<パス, base64データURL>
  const [itemIcons, setItemIcons] = useState<Map<string, string>>(new Map());
  // 取得試行済みのパス→updatedAt。フィルタ・選択等でeditableItemsの参照が変わるたびに
  // 全アイコンをIPC再取得しないよう、未取得または内容が更新されたアイテムのみ取得する
  const fetchedIconVersionsRef = useRef<Map<string, number | undefined>>(new Map());

  // 右クリックされたアイテムを保存（コンテキストメニューイベント用）
  const contextMenuItemsRef = useRef<EditableJsonItem[]>([]);

  // アイテムアイコンを取得（ファビコン + 自動取得 + カスタム）
  useEffect(() => {
    const loadIcons = async () => {
      // editableItemsからLauncherItemsに変換（type='item'のみ、パスが空でないもののみ）。
      // 取得済みかつ未更新のアイテムはスキップし、差分のみIPCで取得する
      const fetched = fetchedIconVersionsRef.current;
      const launcherItems = editableItems
        .filter((editableItem) => {
          const jsonItem = editableItem.item;
          if (jsonItem.type !== 'item' || !jsonItem.path) return false;
          return !fetched.has(jsonItem.path) || fetched.get(jsonItem.path) !== jsonItem.updatedAt;
        })
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

      if (launcherItems.length === 0) {
        return;
      }

      editableItems.forEach((editableItem) => {
        const jsonItem = editableItem.item;
        if (jsonItem.type === 'item' && jsonItem.path) {
          fetched.set(jsonItem.path, jsonItem.updatedAt);
        }
      });

      // loadCachedIcons()でアイコンを一括取得（Main Windowと同じAPI）
      const iconCache = await window.electronAPI.loadCachedIcons(launcherItems);

      setItemIcons((prev) => {
        const next = new Map(prev);
        Object.entries(iconCache).forEach(([path, iconData]) => {
          if (iconData) {
            next.set(path, iconData);
          }
        });
        return next;
      });
    };

    loadIcons();
  }, [editableItems]);

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

    // 削除（確認は呼び出し側で出す）
    const cleanupDelete = window.electronAPI.onAdminMenuDeleteItems(() => {
      const targetItems = contextMenuItemsRef.current;
      if (targetItems.length > 0) {
        onRequestDelete(targetItems);
      }
    });

    // クリーンアップ
    return () => {
      cleanupDuplicate();
      cleanupEdit();
      cleanupDelete();
    };
  }, [onDuplicateItems, onEditClick, onRequestDelete]);

  // 列リサイズ: マウスドラッグ処理
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = nameThRef.current;
    if (!th) return;
    resizeStateRef.current = {
      isResizing: true,
      startX: e.clientX,
      startWidth: th.getBoundingClientRect().width,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state.isResizing) return;
      const delta = e.clientX - state.startX;
      const newWidth = Math.max(100, state.startWidth + delta);
      setNameColumnWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (!resizeStateRef.current.isResizing) return;
      resizeStateRef.current.isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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

  const getEditablePath = (jsonItem: JsonItem): string => {
    if (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) {
      return jsonItem.path || '';
    } else if (jsonItem.type === 'dir' && isJsonDirItem(jsonItem)) {
      return jsonItem.path || '';
    }
    return '';
  };

  const startPathEdit = (item: EditableJsonItem) => {
    if (!isPathEditable(item.item)) return;
    setEditingCell(getItemKey(item));
    setEditingValue(getEditablePath(item.item));
  };

  const startNameEdit = (item: EditableJsonItem) => {
    const jsonItem = item.item;
    if (!hasDisplayName(jsonItem)) return;
    setEditingCell(`${getItemKey(item)}_name`);
    setEditingValue(jsonItem.displayName || '');
  };

  /** パスセルの入力を確定する。別のセルへ移った後の遅い blur は無視する */
  const commitPathEdit = (item: EditableJsonItem) => {
    if (editingCellRef.current !== getItemKey(item)) return;
    const trimmedValue = editingValueRef.current.trim();
    const jsonItem = item.item;

    if (trimmedValue !== getEditablePath(jsonItem)) {
      let updatedJsonItem: JsonItem = jsonItem;
      if (jsonItem.type === 'item' && isJsonLauncherItem(jsonItem)) {
        updatedJsonItem = { ...jsonItem, path: trimmedValue };
      } else if (jsonItem.type === 'dir' && isJsonDirItem(jsonItem)) {
        updatedJsonItem = { ...jsonItem, path: trimmedValue };
      }
      // 表示テキスト・検証は onItemEdit 側（useAdminItemEditing.recordEdit）で作り直す
      onItemEdit({ ...item, item: updatedJsonItem });
    }
    setEditingCell(null);
    setEditingValue('');
  };

  /** 名前セルの入力を確定する */
  const commitNameEdit = (item: EditableJsonItem) => {
    if (editingCellRef.current !== `${getItemKey(item)}_name`) return;
    const newName = editingValueRef.current.trim();
    const jsonItem = item.item;

    if (hasDisplayName(jsonItem) && newName !== (jsonItem.displayName || '')) {
      onItemEdit({ ...item, item: { ...jsonItem, displayName: newName } });
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  // 名前セルで Enter / Tab: 確定して、そのままパスセルの編集へ進む（追加直後の入力の流れ）
  const handleNameKeyDown = (e: React.KeyboardEvent, item: EditableJsonItem) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commitNameEdit(item);
      if (isPathEditable(item.item)) {
        // 確定後の値でパス編集を始める（名前の変更は onItemEdit で反映済み）
        startPathEdit(item);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const handlePathKeyDown = (e: React.KeyboardEvent, item: EditableJsonItem) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commitPathEdit(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const getItemTypeIcon = (item: EditableJsonItem) => itemTypeInfo[item.item.type]?.icon ?? '❓';

  const getItemTypeDisplayName = (item: EditableJsonItem) =>
    itemTypeInfo[item.item.type]?.name ?? '不明';

  const renderTypeCell = (item: EditableJsonItem) => {
    const type = item.item.type;
    if (isInlineItemType(type)) {
      return (
        <span className="type-cell">
          <span className="type-icon">{getItemTypeIcon(item)}</span>
          <select
            className="type-select"
            value={type}
            onChange={(e) => onChangeType(item, e.target.value as InlineItemType)}
            title="種類を変更（ウィンドウ操作・クリップボード・レイアウトにするには ✏️ 詳細編集）"
          >
            <option value="item">{itemTypeInfo.item.name}</option>
            <option value="dir">{itemTypeInfo.dir.name}</option>
            <option value="group">{itemTypeInfo.group.name}</option>
          </select>
        </span>
      );
    }
    return (
      <span
        className="type-cell readonly"
        onClick={() => onEditClick(item)}
        title="この種類は ✏️ 詳細編集から編集します（クリックで開く）"
      >
        <span className="type-icon">{getItemTypeIcon(item)}</span>
        <span className="type-name">{getItemTypeDisplayName(item)}</span>
      </span>
    );
  };

  const renderNameCell = (item: EditableJsonItem) => {
    const jsonItem = item.item;

    if (!hasDisplayName(jsonItem)) {
      return (
        <div
          className="readonly-cell"
          title="フォルダ取込は名前を持ちません（取り込んだファイル名で表示）"
        >
          -
        </div>
      );
    }

    const name = jsonItem.displayName || '';
    const hasError = !item.meta.isValid;
    const cellKey = `${getItemKey(item)}_name`;
    const isEditing = editingCell === cellKey;

    if (isEditing) {
      return (
        <input
          type="text"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => commitNameEdit(item)}
          onKeyDown={(e) => handleNameKeyDown(e, item)}
          className="edit-input"
          placeholder="名前を入力（Enter でパスへ）"
          autoFocus
        />
      );
    }

    return (
      <div
        className={`editable-cell ${hasError ? 'error' : ''}`}
        onClick={() => startNameEdit(item)}
        title={
          hasError ? `入力に不備があります: ${item.meta.validationError}` : 'クリックして名前を編集'
        }
      >
        {name || '(名前なし)'}
        {isJsonLauncherItem(jsonItem) && jsonItem.autoImportRuleId && (
          <span
            className="auto-import-label"
            title={autoImportRuleMap?.get(jsonItem.autoImportRuleId) ?? '不明なルール'}
          >
            自動取込
          </span>
        )}
      </div>
    );
  };

  const renderIconCell = (item: EditableJsonItem) => {
    // 単一アイテムの場合のみアイコンを表示
    if (item.item.type === 'item') {
      const iconData = itemIcons.get(item.item.path || '');
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
    const text = describePathAndArgs(item.item);

    if (isEditing) {
      return (
        <input
          type="text"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => commitPathEdit(item)}
          onKeyDown={(e) => handlePathKeyDown(e, item)}
          className="edit-input"
          placeholder={item.item.type === 'dir' ? 'フォルダのパスを入力' : 'パスまたは URL を入力'}
          autoFocus
        />
      );
    }

    // パスをセルで編集できない種類は、詳細編集へ誘導する
    if (!isPathEditable(item.item)) {
      const hint =
        item.item.type === 'group'
          ? 'グループに含めるアイテムは ✏️ 詳細編集で選びます（ダブルクリックで開く）'
          : `${getItemTypeDisplayName(item)}は ✏️ 詳細編集から編集します（ダブルクリックで開く）`;
      return (
        <div
          className="readonly-cell"
          title={`${text}\n${hint}`}
          onDoubleClick={() => onEditClick(item)}
        >
          {text}
        </div>
      );
    }

    return (
      <div
        className="editable-cell"
        onClick={() => startPathEdit(item)}
        title={`${text}\nクリックしてパスを編集。引数は ✏️ 詳細編集から`}
      >
        {text}
      </div>
    );
  };

  // 行の仮想化: スクロールコンテナは .editable-raw-item-list。
  // テーブル構造（sticky thead・列幅）を保つため、可視範囲外は上下のスペーサー行で高さを確保する
  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: editableItems.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 28, // 行高26px + 境界線。折り返し行はmeasureElementで実測補正
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  // 追加直後のアイテム: 見える位置へスクロールして名前セルを編集状態にする
  useEffect(() => {
    if (!autoEditItemId) return;
    const index = editableItems.findIndex((item) => item.item.id === autoEditItemId);
    if (index === -1) return;
    rowVirtualizer.scrollToIndex(index);
    setEditingCell(`${autoEditItemId}_name`);
    setEditingValue('');
    onAutoEditHandled();
  }, [autoEditItemId, editableItems]);

  // ソートインジケーターを描画
  const renderSortIndicator = (column: SortColumn): React.ReactNode => {
    const isActive = sortState.column === column;
    const icon = isActive ? (sortState.direction === 'asc' ? '▲' : '▼') : '⇅';
    return <span className={`sort-indicator ${isActive ? 'active' : 'inactive'}`}>{icon}</span>;
  };

  const allSelected =
    editableItems.length > 0 && editableItems.every((item) => selectedItems.has(getItemKey(item)));
  const someSelected = editableItems.some((item) => selectedItems.has(getItemKey(item)));

  return (
    <div className="editable-raw-item-list" ref={listRef}>
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
            <th className="actions-column">操作</th>
            <th className="line-number-column" title="ファイル内の位置">
              #
            </th>
            <th
              className="type-column sortable-header"
              onClick={() => onSortChange('type')}
              title="並べ替えは見出しをクリックしたときと読み込み時にだけ適用されます（編集中に行は動きません）"
            >
              <span className="header-content">
                種類
                {renderSortIndicator('type')}
              </span>
            </th>
            <th className="icon-column"></th>
            <th
              className="name-column sortable-header"
              onClick={() => onSortChange('displayName')}
              ref={nameThRef}
              style={
                nameColumnWidth !== null
                  ? { width: nameColumnWidth, minWidth: nameColumnWidth, maxWidth: nameColumnWidth }
                  : undefined
              }
              title="並べ替えは見出しをクリックしたときと読み込み時にだけ適用されます（編集中に行は動きません）"
            >
              <span className="header-content">
                名前
                {renderSortIndicator('displayName')}
              </span>
              <div
                className="column-resize-handle"
                onMouseDown={handleResizeMouseDown}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th
              className="content-column sortable-header"
              onClick={() => onSortChange('pathAndArgs')}
              title="パスはクリックして編集できます。引数は ✏️ 詳細編集から"
            >
              <span className="header-content">
                パスと引数
                {renderSortIndicator('pathAndArgs')}
              </span>
            </th>
            <th
              className="updated-at-column sortable-header"
              onClick={() => onSortChange('updatedAt')}
            >
              <span className="header-content">
                更新日
                {renderSortIndicator('updatedAt')}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={8} style={{ height: paddingTop, padding: 0, border: 'none' }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const item = editableItems[virtualRow.index];
            const itemKey = getItemKey(item);
            const isSelected = selectedItems.has(itemKey);
            const isChanged = changedIds.has(itemKey);

            return (
              <tr
                key={itemKey}
                data-index={virtualRow.index}
                data-item-id={itemKey}
                ref={rowVirtualizer.measureElement}
                className={`raw-item-row ${isSelected ? 'selected' : ''} ${isChanged ? 'changed' : ''} ${item.item.type}`}
                onContextMenu={(e) => handleContextMenu(e, item)}
                title={isChanged ? '未保存の変更があります' : undefined}
              >
                <td className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onItemSelect(item, e.target.checked)}
                  />
                </td>
                <td className="actions-column">
                  <div className="action-buttons">
                    <button
                      className="detail-edit-button"
                      onClick={() => onEditClick(item)}
                      title="詳細編集（種類・引数・メモ・保存先など、すべての項目を編集）"
                    >
                      ✏️ 詳細編集
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => onRequestDelete([item])}
                      title="削除"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
                <td className="line-number-column">{item.meta.lineNumber + 1}</td>
                <td className="type-column">{renderTypeCell(item)}</td>
                <td className="icon-column">{renderIconCell(item)}</td>
                <td className="name-column">{renderNameCell(item)}</td>
                <td className="content-column">{renderEditableCell(item)}</td>
                <td className="updated-at-column">{formatUpdatedAt(item.item.updatedAt)}</td>
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={8} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
            </tr>
          )}
        </tbody>
      </table>

      {editableItems.length === 0 && (
        <div className="no-items">
          {isFiltered
            ? '条件に一致するアイテムがありません'
            : 'このデータファイルにアイテムがありません。「➕ アイテムを追加」か「アイテムを一括取り込み」で追加できます'}
        </div>
      )}
    </div>
  );
};

export default AdminItemManagerList;
