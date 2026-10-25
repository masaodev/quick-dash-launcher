import React from 'react';
import { useTranslation } from 'react-i18next';
import type { JsonItem } from '@common/types';
import { isJsonLauncherItem } from '@common/types';
import type { EditableJsonItem, PathExistenceStatus } from '@common/types/editableItem';
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
  /** 「リンク切れを確認」の結果（確認していない・対象外なら undefined） */
  linkStatus?: PathExistenceStatus;
  /** セットの行のうち見つからない行の名前（A3-79 #8。セット以外は空） */
  missingSetRows?: string[];
  /** 最後に起動した日時と回数（記録が無ければ undefined） */
  lastLaunchedAt?: number;
  launchCount?: number;
  /** この行で編集中のセル。編集中でなければ null */
  editingColumn: 'name' | 'path' | 'memo' | null;
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
  onStartMemoEdit: (item: EditableJsonItem) => void;
  onCommitMemo: (item: EditableJsonItem) => void;
  onMemoKeyDown: (e: React.KeyboardEvent, item: EditableJsonItem) => void;
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
  linkStatus,
  missingSetRows = [],
  lastLaunchedAt,
  launchCount,
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
  onStartMemoEdit,
  onCommitMemo,
  onMemoKeyDown,
}) => {
  const { t } = useTranslation();
  const jsonItem = item.item;
  const itemKey = getItemKey(item);
  // 取込元・リンクの列を出しているときは、名前・パスのセルに同じ印を重ねない
  const showsSourceColumn = columns.includes('source');
  const showsLinkColumn = columns.includes('link');

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
        {!showsSourceColumn && isJsonLauncherItem(jsonItem) && jsonItem.autoImportRuleId && (
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

  /** セットの見つからない行の印（「⚠ N 行見つかりません」。どの行かはツールチップ） */
  const renderSetRowsMissingLabel = () => (
    <span
      className="missing-path-label"
      title={t('itemManager.row.setRowsMissingTitle', { rows: missingSetRows.join('\n') })}
    >
      {t('itemManager.row.setRowsMissing', { count: missingSetRows.length })}
    </span>
  );

  const renderPathCell = () => {
    const text = describePathAndArgs(jsonItem);
    // パスの確認の列を隠しているときは、パスの列の先頭に同じ印を付ける（セットは行の数と名前）
    const missingBadge =
      pathMissing && !showsLinkColumn ? (
        missingSetRows.length > 0 ? (
          renderSetRowsMissingLabel()
        ) : (
          <span className="missing-path-label" title={t('itemManager.row.pathMissingTitle')}>
            {t('itemManager.row.pathMissing')}
          </span>
        )
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

  const renderSourceCell = () => {
    if (!isJsonLauncherItem(jsonItem) || !jsonItem.autoImportRuleId) {
      return <span className="source-manual">{t('itemManager.row.sourceManual')}</span>;
    }
    const ruleName = autoImportRuleName ?? t('itemManager.row.unknownRule');
    // 枠のある札にするとボタンに見えるので、何の名前か読める文字だけで出す（A3-178）
    return (
      <span
        className="source-auto"
        title={t('itemManager.row.sourceAutoTitle', { rule: ruleName })}
      >
        {t('itemManager.row.sourceAuto', { rule: ruleName })}
      </span>
    );
  };

  const renderLinkCell = () => {
    if (linkStatus === 'missing' && missingSetRows.length > 0) {
      return renderSetRowsMissingLabel();
    }
    if (linkStatus === 'missing') {
      return (
        <span className="missing-path-label" title={t('itemManager.row.pathMissingTitle')}>
          {t('itemManager.row.pathMissing')}
        </span>
      );
    }
    if (linkStatus === 'exists') {
      return (
        <span className="link-exists" title={t('itemManager.row.linkExistsTitle')}>
          ✓
        </span>
      );
    }
    if (linkStatus === 'unknown') {
      return (
        <span className="link-unknown" title={t('itemManager.row.linkUnknownTitle')}>
          ?
        </span>
      );
    }
    return null;
  };

  const renderMemoCell = () => {
    if (editingColumn === 'memo') {
      return (
        <div className="memo-edit-overlay">
          <textarea
            value={editingValue}
            onChange={(e) => onEditingValueChange(e.target.value)}
            onBlur={() => onCommitMemo(item)}
            onKeyDown={(e) => onMemoKeyDown(e, item)}
            onFocus={(e) => {
              // 続きを書けるように、カーソルを末尾に置く
              const end = e.currentTarget.value.length;
              e.currentTarget.setSelectionRange(end, end);
            }}
            className="memo-edit-textarea"
            placeholder={t('itemManager.row.memoPlaceholder')}
            autoFocus
          />
          {/* 押すと textarea のフォーカスが外れて確定してしまうので、押下を止める */}
          <div className="memo-edit-hint" onMouseDown={(e) => e.preventDefault()}>
            {t('itemManager.row.memoEditHint')}
          </div>
        </div>
      );
    }

    const memo = jsonItem.memo ?? '';
    const [firstLine, ...restLines] = memo.split(/\r?\n/);
    const hasMoreLines = restLines.some((line) => line.trim().length > 0);
    return (
      <div
        className="editable-cell memo-cell"
        role="button"
        tabIndex={0}
        onClick={() => onStartMemoEdit(item)}
        onKeyDown={activateOnEnterOrSpace(() => onStartMemoEdit(item))}
        title={
          memo ? t('itemManager.row.memoTitle', { memo }) : t('itemManager.row.memoEmptyTitle')
        }
      >
        {firstLine}
        {hasMoreLines && (
          <span className="memo-more" aria-label={t('itemManager.row.memoMoreLines')}>
            ↵
          </span>
        )}
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
          case 'memo':
            return (
              <td key={column} className="memo-column">
                {renderMemoCell()}
              </td>
            );
          case 'source':
            return (
              <td key={column} className="source-column">
                {renderSourceCell()}
              </td>
            );
          case 'link':
            return (
              <td key={column} className="link-column">
                {renderLinkCell()}
              </td>
            );
          case 'lastLaunched':
            return (
              <td
                key={column}
                className="last-launched-column"
                title={lastLaunchedAt ? formatUpdatedAt(lastLaunchedAt) : undefined}
              >
                {lastLaunchedAt ? formatUpdatedAt(lastLaunchedAt) : '-'}
              </td>
            );
          case 'launchCount':
            return (
              <td key={column} className="launch-count-column">
                {launchCount ?? '-'}
              </td>
            );
          case 'updatedAt':
            return (
              <td
                key={column}
                className="updated-at-column"
                title={jsonItem.updatedAt ? formatUpdatedAt(jsonItem.updatedAt) : undefined}
              >
                {formatUpdatedAt(jsonItem.updatedAt)}
              </td>
            );
        }
      })}
    </tr>
  );
};

export default React.memo(AdminItemManagerRow);
