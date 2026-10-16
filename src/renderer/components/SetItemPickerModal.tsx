/**
 * 画面: セットに追加するアイテム
 * 画面仕様: docs/screens/set-editor-modals.md#2-セットに追加するアイテム
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { SET_KIND_ICONS, type SetCatalogItem } from '../utils/setEditing';
import '../styles/components/WindowSelectorModal.css';
import '../styles/components/SetEditor.css';

import { Button } from './ui';

interface SetItemPickerModalProps {
  isOpen: boolean;
  /** 追加できるアイテム（同じタブを先に並べたもの） */
  catalog: SetCatalogItem[];
  /** すでに行にあるアイテムのキー（追加済みとして出す） */
  addedKeys: ReadonlySet<string>;
  onClose: () => void;
  onAdd: (items: SetCatalogItem[]) => void;
  /** 1 つだけ選ぶ（行の詳細で、行が開くアイテムを選ぶとき） */
  single?: boolean;
}

/**
 * セットに追加するアイテムを選ぶ画面
 *
 * どのタブのアイテムも選べる。同じタブのアイテムを先に並べ、上のタブの切り替えで 1 つのタブに絞れる。
 * single のときは行の詳細から開き、行が開くアイテムを 1 つだけ選ぶ
 */
const SetItemPickerModal: React.FC<SetItemPickerModalProps> = ({
  isOpen,
  catalog,
  addedKeys,
  onClose,
  onAdd,
  single = false,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const close = () => {
    setQuery('');
    setGroup(null);
    setSelected(new Set());
    onClose();
  };

  const groups = useMemo(() => {
    const names: string[] = [];
    for (const item of catalog) if (!names.includes(item.groupName)) names.push(item.groupName);
    return names;
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter(
      (item) =>
        (group === null || item.groupName === group) &&
        (!q || item.displayName.toLowerCase().includes(q))
    );
  }, [catalog, query, group]);

  // 検索欄で Tab・Shift+Tab を押すと、上のタブを順に切り替える（メインウィンドウの Tab と同じ。検索中は合うアイテムの無いタブを飛ばす）
  const switchGroupByTab = (event: KeyboardEvent): boolean => {
    if (document.activeElement !== searchRef.current || groups.length <= 1) return false;
    const tabs: (string | null)[] = [null, ...groups];
    const q = query.trim().toLowerCase();
    const hasMatch = (tab: string | null) =>
      !q ||
      catalog.some(
        (item) =>
          (tab === null || item.groupName === tab) && item.displayName.toLowerCase().includes(q)
      );
    const step = event.shiftKey ? -1 : 1;
    const current = tabs.indexOf(group);
    for (let i = 1; i < tabs.length; i++) {
      const next = tabs[(current + step * i + tabs.length) % tabs.length];
      if (hasMatch(next)) {
        setGroup(next);
        return true;
      }
    }
    return true;
  };
  useModalKeyboard({ isOpen, modalRef, onClose: close, onTab: switchGroupByTab });
  // useModalKeyboard が開いたときにモーダル本体へフォーカスを移すので、その後で検索欄へ戻す（autoFocus だと先に当たって外れる）
  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const same = filtered.filter((item) => item.sameGroup);
  const others = filtered.filter((item) => !item.sameGroup);

  const toggle = (key: string) => {
    setSelected((prev) => {
      if (single) return prev.has(key) ? new Set() : new Set([key]);
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderRows = (items: SetCatalogItem[]) =>
    items.map((item) => {
      const added = addedKeys.has(item.key);
      const checked = selected.has(item.key);
      return (
        <label
          key={item.key}
          className={`set-picker-row${added ? ' added' : ''}${checked ? ' checked' : ''}`}
        >
          <input
            type={single ? 'radio' : 'checkbox'}
            checked={checked}
            disabled={added}
            onChange={() => toggle(item.key)}
          />
          <span className="set-row-icon">
            {item.icon ? <img src={item.icon} alt="" /> : (SET_KIND_ICONS[item.kind] ?? '📄')}
          </span>
          <span className="set-row-name">{item.displayName}</span>
          {/* タブの名前は、ほかのタブのアイテムにだけ添える */}
          {added ? (
            <span className="set-row-aside">{t('set.picker.added')}</span>
          ) : (
            !item.sameGroup &&
            groups.length > 1 && <span className="set-row-aside">{item.groupName}</span>
          )}
        </label>
      );
    });

  const confirm = () => {
    onAdd(catalog.filter((item) => selected.has(item.key)));
    close();
  };

  return createPortal(
    <div className="modal-overlay" onClick={close}>
      <div
        className="modal-content set-picker-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-label={t(single ? 'set.picker.chooseTitle' : 'set.picker.title')}
      >
        <div className="set-modal-header">
          <h3>{t(single ? 'set.picker.chooseTitle' : 'set.picker.title')}</h3>
          {!single && (
            <span className="set-muted">{t('set.picker.selected', { count: selected.size })}</span>
          )}
        </div>
        <input
          type="text"
          className="set-search"
          ref={searchRef}
          value={query}
          placeholder={t('set.picker.search')}
          onChange={(e) => setQuery(e.target.value)}
        />
        {/* タブの絞り込み（ウィンドウを選ぶ画面の仮想デスクトップのタブと同じ形）。タブが 1 つなら出さない */}
        {groups.length > 1 && (
          <div className="desktop-tabs set-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={group === null}
              className={`desktop-tab${group === null ? ' active' : ''}`}
              onClick={() => setGroup(null)}
            >
              {t('set.picker.all')}
              <span className="tab-count">({catalog.length})</span>
            </button>
            {groups.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={group === name}
                className={`desktop-tab${group === name ? ' active' : ''}`}
                onClick={() => setGroup(name)}
              >
                {name}
                <span className="tab-count">
                  ({catalog.filter((item) => item.groupName === name).length})
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="set-picker-list">
          {catalog.length === 0 ? (
            <div className="set-empty">{t('set.picker.empty')}</div>
          ) : filtered.length === 0 ? (
            <div className="set-empty">{t('set.picker.noResults')}</div>
          ) : (
            <>
              {same.length > 0 && others.length > 0 && (
                <div className="set-section-title">{t('set.picker.sameGroup')}</div>
              )}
              {renderRows(same)}
              {same.length > 0 && others.length > 0 && (
                <div className="set-section-title">{t('set.picker.others')}</div>
              )}
              {renderRows(others)}
            </>
          )}
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={selected.size === 0} onClick={confirm}>
            {single ? t('set.picker.choose') : t('set.picker.add', { count: selected.size })}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SetItemPickerModal;
