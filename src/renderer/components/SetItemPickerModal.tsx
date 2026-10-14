import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import type { SetCatalogItem } from '../utils/setEditing';
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
}

const KIND_ICONS: Record<string, string> = {
  url: '🌐',
  folder: '📁',
  app: '⚙️',
  file: '📄',
  customUri: '🔗',
  window: '🪟',
};

/**
 * セットに追加するアイテムを選ぶ画面
 *
 * どのタブのアイテムも選べる。同じタブのアイテムを先に並べ、上のタブの切り替えで 1 つのタブに絞れる
 */
const SetItemPickerModal: React.FC<SetItemPickerModalProps> = ({
  isOpen,
  catalog,
  addedKeys,
  onClose,
  onAdd,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const close = () => {
    setQuery('');
    setGroup(null);
    setSelected(new Set());
    onClose();
  };
  useModalKeyboard({ isOpen, modalRef, onClose: close });

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

  if (!isOpen) return null;

  const same = filtered.filter((item) => item.sameGroup);
  const others = filtered.filter((item) => !item.sameGroup);

  const toggle = (key: string) => {
    setSelected((prev) => {
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
            type="checkbox"
            checked={checked}
            disabled={added}
            onChange={() => toggle(item.key)}
          />
          <span className="set-row-icon">
            {item.icon ? <img src={item.icon} alt="" /> : (KIND_ICONS[item.kind] ?? '📄')}
          </span>
          <span className="set-row-name">{item.displayName}</span>
          {added ? (
            <span className="set-chip set-chip-muted">{t('set.picker.added')}</span>
          ) : (
            <span className="set-chip set-chip-muted">{item.groupName}</span>
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
        aria-label={t('set.picker.title')}
      >
        <div className="set-modal-header">
          <h3>{t('set.picker.title')}</h3>
          <span className="set-muted">{t('set.picker.selected', { count: selected.size })}</span>
        </div>
        <input
          type="text"
          className="set-search"
          value={query}
          autoFocus
          placeholder={t('set.picker.search')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="set-tab-chips" role="tablist">
          <button
            type="button"
            className={group === null ? 'on' : ''}
            onClick={() => setGroup(null)}
          >
            {t('set.picker.all')}
          </button>
          {groups.map((name) => (
            <button
              key={name}
              type="button"
              className={group === name ? 'on' : ''}
              onClick={() => setGroup(name)}
            >
              {name}
            </button>
          ))}
        </div>
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
            {t('set.picker.add', { count: selected.size })}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SetItemPickerModal;
