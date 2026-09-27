import React from 'react';
import type { JsonItem } from '@common/types';
import { isJsonLauncherItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import {
  ITEM_TYPE_INFO,
  formatUpdatedAt,
  getItemTypeIcon,
  getItemTypeName,
  hasDisplayName,
  isPathEditable,
} from '../utils/adminItemDisplay';
import { describePathAndArgs, getItemKey } from '../utils/editableItemOperations';

export interface AdminItemManagerRowProps {
  item: EditableJsonItem;
  index: number;
  isSelected: boolean;
  /** 未保存の変更があるか（行の左端に印） */
  isChanged: boolean;
  /** 単一アイテムのアイコン（base64 データ URL）。無ければ undefined */
  iconData?: string;
  /** 自動取込ルール名（自動取込で登録されたアイテムのみ） */
  autoImportRuleName?: string;
  /** この行で編集中のセル。編集中でなければ null */
  editingColumn: 'name' | 'path' | null;
  /** 編集中の入力値（この行が編集中のときだけ意味を持つ） */
  editingValue: string;
  /** 仮想化の実測用 ref */
  measureRef: (element: HTMLTableRowElement | null) => void;
  onSelect: (item: EditableJsonItem, selected: boolean) => void;
  onEditClick: (item: EditableJsonItem) => void;
  onRequestDelete: (items: EditableJsonItem[]) => void;
  onChangeType: (item: EditableJsonItem, newType: JsonItem['type']) => void;
  onContextMenu: (event: React.MouseEvent, item: EditableJsonItem) => void;
  onStartNameEdit: (item: EditableJsonItem) => void;
  onStartPathEdit: (item: EditableJsonItem) => void;
  onEditingValueChange: (value: string) => void;
  onCommitName: (item: EditableJsonItem) => void;
  onCommitPath: (item: EditableJsonItem) => void;
  onNameKeyDown: (e: React.KeyboardEvent, item: EditableJsonItem) => void;
  onPathKeyDown: (e: React.KeyboardEvent, item: EditableJsonItem) => void;
}

const TYPE_SELECT_TITLE =
  '種類を変更します。単一アイテム・フォルダ取込・グループはその場で切り替わり、' +
  'ウィンドウ操作・クリップボード・ウィンドウ配置（複数のウィンドウを保存した位置に一括で並べる）は詳細編集が開きます';

/**
 * アイテム管理の一覧の 1 行
 *
 * props がすべて同じなら再描画しない（memo）。ハンドラは呼び出し側で参照を固定すること。
 */
const AdminItemManagerRow: React.FC<AdminItemManagerRowProps> = ({
  item,
  index,
  isSelected,
  isChanged,
  iconData,
  autoImportRuleName,
  editingColumn,
  editingValue,
  measureRef,
  onSelect,
  onEditClick,
  onRequestDelete,
  onChangeType,
  onContextMenu,
  onStartNameEdit,
  onStartPathEdit,
  onEditingValueChange,
  onCommitName,
  onCommitPath,
  onNameKeyDown,
  onPathKeyDown,
}) => {
  const jsonItem = item.item;
  const itemKey = getItemKey(item);

  const renderTypeCell = () => (
    <span className="type-cell">
      <span className="type-icon">{getItemTypeIcon(jsonItem)}</span>
      <select
        className="type-select"
        value={jsonItem.type}
        onChange={(e) => onChangeType(item, e.target.value as JsonItem['type'])}
        title={TYPE_SELECT_TITLE}
      >
        <option value="item">{ITEM_TYPE_INFO.item.name}</option>
        <option value="dir">{ITEM_TYPE_INFO.dir.name}</option>
        <option value="group">{ITEM_TYPE_INFO.group.name}</option>
        <option value="window">{ITEM_TYPE_INFO.window.name}…</option>
        <option value="clipboard">{ITEM_TYPE_INFO.clipboard.name}…</option>
        <option value="layout">{ITEM_TYPE_INFO.layout.name}…</option>
      </select>
    </span>
  );

  const renderIconCell = () => {
    // 単一アイテムの場合のみアイコンを表示
    if (jsonItem.type !== 'item') return null;
    if (iconData) {
      return <img src={iconData} alt="" className="item-icon-image" />;
    }
    // アイコンがない場合、パスから型を判定してフォルダなら絵文字表示
    const path = jsonItem.path || '';
    if (path && detectItemTypeSync(path) === 'folder') {
      return <span className="folder-emoji">📁</span>;
    }
    return null;
  };

  const renderNameCell = () => {
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

    if (editingColumn === 'name') {
      return (
        <input
          type="text"
          value={editingValue}
          onChange={(e) => onEditingValueChange(e.target.value)}
          onBlur={() => onCommitName(item)}
          onKeyDown={(e) => onNameKeyDown(e, item)}
          className="edit-input"
          placeholder="名前を入力（Enter でパスへ）"
          autoFocus
        />
      );
    }

    const hasError = !item.meta.isValid;
    return (
      <div
        className={`editable-cell ${hasError ? 'error' : ''}`}
        onClick={() => onStartNameEdit(item)}
        title={
          hasError ? `入力に不備があります: ${item.meta.validationError}` : 'クリックして名前を編集'
        }
      >
        {jsonItem.displayName || '(名前なし)'}
        {isJsonLauncherItem(jsonItem) && jsonItem.autoImportRuleId && (
          <span className="auto-import-label" title={autoImportRuleName ?? '不明なルール'}>
            自動取込
          </span>
        )}
      </div>
    );
  };

  const renderPathCell = () => {
    const text = describePathAndArgs(jsonItem);

    if (editingColumn === 'path') {
      return (
        <input
          type="text"
          value={editingValue}
          onChange={(e) => onEditingValueChange(e.target.value)}
          onBlur={() => onCommitPath(item)}
          onKeyDown={(e) => onPathKeyDown(e, item)}
          className="edit-input"
          placeholder={jsonItem.type === 'dir' ? 'フォルダのパスを入力' : 'パスまたは URL を入力'}
          autoFocus
        />
      );
    }

    // パスをセルで編集できない種類は、詳細編集へ誘導する
    if (!isPathEditable(jsonItem)) {
      const hint =
        jsonItem.type === 'group'
          ? 'グループに含めるアイテムは ✏️ 詳細編集で選びます（ダブルクリックで開く）'
          : `${getItemTypeName(jsonItem)}は ✏️ 詳細編集から編集します（ダブルクリックで開く）`;
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
        onClick={() => onStartPathEdit(item)}
        title={`${text}\nクリックしてパスを編集。引数は ✏️ 詳細編集から`}
      >
        {text}
      </div>
    );
  };

  return (
    <tr
      data-index={index}
      data-item-id={itemKey}
      ref={measureRef}
      className={`raw-item-row ${isSelected ? 'selected' : ''} ${isChanged ? 'changed' : ''} ${jsonItem.type}`}
      onContextMenu={(e) => onContextMenu(e, item)}
      title={isChanged ? '未保存の変更があります' : undefined}
    >
      <td className="checkbox-column">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(item, e.target.checked)}
        />
      </td>
      <td className="actions-column">
        <div className="action-buttons">
          <button
            className="detail-edit-button"
            onClick={() => onEditClick(item)}
            title="詳細編集（種類・引数・メモ・保存先など、すべての項目を編集）"
          >
            ✏️
          </button>
          <button className="delete-button" onClick={() => onRequestDelete([item])} title="削除">
            🗑️
          </button>
        </div>
      </td>
      <td className="type-column">{renderTypeCell()}</td>
      <td className="icon-column">{renderIconCell()}</td>
      <td className="name-column">{renderNameCell()}</td>
      <td className="content-column">{renderPathCell()}</td>
      <td className="updated-at-column">{formatUpdatedAt(jsonItem.updatedAt)}</td>
    </tr>
  );
};

export default React.memo(AdminItemManagerRow);
