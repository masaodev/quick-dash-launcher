import React from 'react';
import { useTranslation } from 'react-i18next';
import type { JsonItem } from '@common/types';
import { isJsonLauncherItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { isPathlessItem } from '@common/utils/itemWindowConversion';

import {
  formatUpdatedAt,
  getItemTypeIcon,
  getItemTypeLabel,
  getItemTypeName,
  hasDisplayName,
  isPathEditable,
} from '../utils/adminItemDisplay';
import type { AdminItemColumnId } from '../utils/adminItemColumns';
import { describePathAndArgs, getItemKey } from '../utils/editableItemOperations';
import { ITEM_TYPE_ICONS } from '../utils/itemTypeIcons';
import { activateOnEnterOrSpace } from '../utils/keyboardActivation';

export interface AdminItemManagerRowProps {
  item: EditableJsonItem;
  /** 出す列（見出しと同じ順。選択と操作の列は常に出す） */
  columns: readonly AdminItemColumnId[];
  index: number;
  isSelected: boolean;
  /** 未保存の変更があるか（行の左端に印） */
  isChanged: boolean;
  /** 単一アイテムのアイコン（base64 データ URL）。無ければ undefined */
  iconData?: string;
  /** 自動取込ルール名（自動取込で登録されたアイテムのみ） */
  autoImportRuleName?: string;
  /** パスが実在しない（リンク切れ）か */
  pathMissing: boolean;
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

/** 種類のプルダウンの選択肢（詳細編集が開くものは名前の後に … を付ける） */
const TYPE_OPTIONS: ReadonlyArray<{ type: JsonItem['type']; opensDetail: boolean }> = [
  { type: 'item', opensDetail: false },
  { type: 'dir', opensDetail: false },
  { type: 'set', opensDetail: true },
  { type: 'clipboard', opensDetail: true },
];

/**
 * アイテム管理の一覧の 1 行
 *
 * props がすべて同じなら再描画しない（memo）。ハンドラは呼び出し側で参照を固定すること。
 */
const AdminItemManagerRow: React.FC<AdminItemManagerRowProps> = ({
  item,
  columns,
  index,
  isSelected,
  isChanged,
  iconData,
  autoImportRuleName,
  pathMissing,
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
  const { t } = useTranslation();
  const jsonItem = item.item;
  const itemKey = getItemKey(item);

  const renderTypeCell = () => (
    <span className="type-cell">
      <span className="type-icon">{getItemTypeIcon(jsonItem)}</span>
      <select
        className="type-select"
        value={jsonItem.type}
        onChange={(e) => onChangeType(item, e.target.value as JsonItem['type'])}
        title={t('itemManager.row.typeSelectTitle')}
      >
        {TYPE_OPTIONS.map(({ type, opensDetail }) => (
          <option key={type} value={type}>
            {getItemTypeLabel(type)}
            {opensDetail ? '…' : ''}
          </option>
        ))}
      </select>
    </span>
  );

  const renderIconCell = () => {
    // 単一アイテムのアイコンと、クリップボード・セットのカスタムアイコン
    if (iconData) {
      return <img src={iconData} alt="" className="item-icon-image" />;
    }
    // アイコンが無いときは、メイン画面と同じ種類ごとの絵文字を出す
    if (jsonItem.type === 'clipboard') return <span className="folder-emoji">📋</span>;
    if (jsonItem.type === 'set') return <span className="folder-emoji">📦</span>;
    if (jsonItem.type === 'dir') return <span className="folder-emoji">🗂️</span>;
    if (jsonItem.type !== 'item') return null;
    // パスの無い単一アイテム（開いているウィンドウに切り替えるだけ）
    if (isPathlessItem(jsonItem)) {
      return <span className="folder-emoji">🪟</span>;
    }
    // 単一アイテムは種類（読み込み時の判定がなければパスから判定）の絵文字
    const type = item.meta.launcherType ?? detectItemTypeSync(jsonItem.path || '');
    return <span className="folder-emoji">{ITEM_TYPE_ICONS[type] ?? ITEM_TYPE_ICONS.file}</span>;
  };

  const renderNameCell = () => {
    if (!hasDisplayName(jsonItem)) {
      return (
        <div className="readonly-cell" title={t('itemManager.row.dirHasNoName')}>
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
          placeholder={t('itemManager.row.namePlaceholder')}
          autoFocus
        />
      );
    }

    const hasError = !item.meta.isValid;
    return (
      <div
        className={`editable-cell ${hasError ? 'error' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => onStartNameEdit(item)}
        onKeyDown={activateOnEnterOrSpace(() => onStartNameEdit(item))}
        title={
          hasError
            ? t('itemManager.row.invalid', { error: item.meta.validationError ?? '' })
            : t('itemManager.row.editNameTitle')
        }
      >
        {jsonItem.displayName || t('itemManager.noName')}
        {isJsonLauncherItem(jsonItem) && jsonItem.autoImportRuleId && (
          <span
            className="auto-import-label"
            title={autoImportRuleName ?? t('itemManager.row.unknownRule')}
          >
            {t('itemManager.row.autoImport')}
          </span>
        )}
      </div>
    );
  };

  const renderPathCell = () => {
    const text = describePathAndArgs(jsonItem);
    const missingBadge = pathMissing ? (
      <span className="missing-path-label" title={t('itemManager.row.pathMissingTitle')}>
        {t('itemManager.row.pathMissing')}
      </span>
    ) : null;

    if (editingColumn === 'path') {
      return (
        <input
          type="text"
          value={editingValue}
          onChange={(e) => onEditingValueChange(e.target.value)}
          onBlur={() => onCommitPath(item)}
          onKeyDown={(e) => onPathKeyDown(e, item)}
          className="edit-input"
          placeholder={
            jsonItem.type === 'dir'
              ? t('itemManager.row.dirPathPlaceholder')
              : t('itemManager.row.pathPlaceholder')
          }
          autoFocus
        />
      );
    }

    // パスをセルで編集できない種類は、詳細編集へ誘導する
    if (!isPathEditable(jsonItem)) {
      const hint = t('itemManager.row.detailOnly', { type: getItemTypeName(jsonItem) });
      return (
        <div
          className="readonly-cell"
          title={`${text}\n${hint}`}
          role="button"
          tabIndex={0}
          onDoubleClick={() => onEditClick(item)}
          onKeyDown={activateOnEnterOrSpace(() => onEditClick(item))}
        >
          {missingBadge}
          {text}
        </div>
      );
    }

    return (
      <div
        className="editable-cell"
        role="button"
        tabIndex={0}
        onClick={() => onStartPathEdit(item)}
        onKeyDown={activateOnEnterOrSpace(() => onStartPathEdit(item))}
        title={t('itemManager.row.pathTitle', {
          text,
          missing: pathMissing ? t('itemManager.row.pathTitleMissing') : '',
        })}
      >
        {missingBadge}
        {text}
      </div>
    );
  };

  return (
    <tr
      data-index={index}
      data-item-id={itemKey}
      ref={measureRef}
      className={`raw-item-row ${isSelected ? 'selected' : ''} ${isChanged ? 'changed' : ''} ${pathMissing ? 'missing-path' : ''} ${jsonItem.type}`}
      onContextMenu={(e) => onContextMenu(e, item)}
      title={isChanged ? t('itemManager.row.unsaved') : undefined}
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
            title={t('itemManager.row.detailEditTitle')}
          >
            ✏️
          </button>
          <button
            className="delete-button"
            onClick={() => onRequestDelete([item])}
            title={t('itemManager.row.delete')}
          >
            🗑️
          </button>
        </div>
      </td>
      {columns.map((column) => {
        switch (column) {
          case 'type':
            return (
              <td key={column} className="type-column">
                {renderTypeCell()}
              </td>
            );
          case 'icon':
            return (
              <td key={column} className="icon-column">
                {renderIconCell()}
              </td>
            );
          case 'name':
            return (
              <td key={column} className="name-column">
                {renderNameCell()}
              </td>
            );
          case 'pathAndArgs':
            return (
              <td key={column} className="content-column">
                {renderPathCell()}
              </td>
            );
          case 'updatedAt':
            return (
              <td key={column} className="updated-at-column">
                {formatUpdatedAt(jsonItem.updatedAt)}
              </td>
            );
        }
      })}
    </tr>
  );
};

export default React.memo(AdminItemManagerRow);
