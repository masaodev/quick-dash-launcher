/**
 * 画面: セットに追加するアイテム
 * 画面仕様: docs/screens/set-editor-modals.md#2-セットに追加するアイテム
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { parseKeywords } from '../utils/dataParser';
import { SET_KIND_ICONS, type SetCatalogItem } from '../utils/setEditing';
import { toggleInSet } from '../utils/setUtils';
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
  /** 見出し（既定は「セットに追加するアイテム」） */
  title?: string;
  /** 見出しの上に出す帯（ワークスペースのグループに追加するときの追加先） */
  banner?: React.ReactNode;
  /**
   * 独立したウィンドウの中身として描く（オーバーレイなしでウィンドウいっぱいに広げる）。
   * 追加を押しても閉じない（開いた側が追加を終えてからウィンドウを閉じる）
   */
  asPage?: boolean;
  /** 追加の処理中（追加のボタンを押せなくする） */
  busy?: boolean;
  /** 下のボタンの左に出すもの（ワークスペースに追加するときの「コピーで追加」） */
  footerExtra?: React.ReactNode;
  /** 追加済みの行に添える言葉（既定は「追加済み」。指す先を選ぶときは「今の指す先」） */
  addedLabel?: string;
  /** 一覧の見出し（同じタブ・ほかのタブの代わり。指す先を選ぶときの「同じパスのアイテム」など） */
  sectionTitles?: { same: string; others: string };
  /**
   * 「すべて」のタブを出す（タブをまたいで先に並べたいものがあるとき。指す先を選ぶ画面の「同じパスのアイテム」）。
   * 既定はランチャーと同じく、タブを 1 つ選んでその中を探す
   */
  allTab?: boolean;
}

/** 表示名が検索のキーワードをすべて含むか（ランチャーの検索と同じく、空白で区切った AND） */
function matchesKeywords(item: SetCatalogItem, keywords: readonly string[]): boolean {
  if (keywords.length === 0) return true;
  const name = item.displayName.toLowerCase();
  return keywords.every((keyword) => name.includes(keyword));
}

/**
 * セットに追加するアイテムを選ぶ画面
 *
 * どのタブのアイテムも選べる。ランチャーと同じく、上のタブを 1 つ選んでその中を探す（開いたときはセットと同じタブ）。
 * allTab のときだけ「すべて」のタブを出し、同じタブ（候補）のアイテムを先に並べる。
 * single のときは行の詳細から開き、行が開くアイテムを 1 つだけ選ぶ
 */
const SetItemPickerModal: React.FC<SetItemPickerModalProps> = ({
  isOpen,
  catalog,
  addedKeys,
  onClose,
  onAdd,
  single = false,
  title,
  banner,
  asPage = false,
  busy = false,
  footerExtra,
  sectionTitles,
  addedLabel,
  allTab = false,
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

  // 選んでいるタブ。まだ選んでいなければ先頭のタブ（catalog は同じタブを先に並べているので、セットと同じタブ）。
  // 「すべて」があるときは、選んでいなければ「すべて」
  const activeGroup = allTab ? group : (group ?? groups[0] ?? null);
  const keywords = useMemo(() => parseKeywords(query), [query]);

  const filtered = useMemo(
    () =>
      catalog.filter(
        (item) =>
          (activeGroup === null || item.groupName === activeGroup) &&
          matchesKeywords(item, keywords)
      ),
    [catalog, keywords, activeGroup]
  );

  // 検索欄で Tab・Shift+Tab を押すと、上のタブを順に切り替える（ランチャーの Tab と同じ。検索中は合うアイテムの無いタブを飛ばす）
  const switchGroupByTab = (event: KeyboardEvent): boolean => {
    if (document.activeElement !== searchRef.current || groups.length <= 1) return false;
    const tabs: (string | null)[] = allTab ? [null, ...groups] : groups;
    const hasMatch = (tab: string | null) =>
      catalog.some(
        (item) => (tab === null || item.groupName === tab) && matchesKeywords(item, keywords)
      );
    const step = event.shiftKey ? -1 : 1;
    const current = tabs.indexOf(activeGroup);
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
      return toggleInSet(prev, key);
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
          {/* タブの名前は、「すべて」のタブで、ほかのタブのアイテムにだけ添える */}
          {added ? (
            <span className="set-row-aside">{addedLabel ?? t('set.picker.added')}</span>
          ) : (
            activeGroup === null &&
            !item.sameGroup &&
            groups.length > 1 && <span className="set-row-aside">{item.groupName}</span>
          )}
        </label>
      );
    });

  const confirm = () => {
    onAdd(catalog.filter((item) => selected.has(item.key)));
    if (!asPage) close();
  };

  const heading = title ?? t(single ? 'set.picker.chooseTitle' : 'set.picker.title');

  const content = (
    <div
      className={asPage ? 'set-picker-page' : 'modal-overlay'}
      onClick={asPage ? undefined : close}
    >
      <div
        className={`modal-content set-picker-modal${asPage ? ' set-picker-page-content' : ''}`}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-label={heading}
      >
        {banner}
        <div className="set-modal-header">
          <h3>{heading}</h3>
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
        {/* タブの切り替え（ウィンドウを選ぶ画面の仮想デスクトップのタブと同じ形。多いときは折り返す）。タブが 1 つなら出さない */}
        {groups.length > 1 && (
          <div className="desktop-tabs set-tabs" role="tablist">
            {allTab && (
              <button
                type="button"
                role="tab"
                aria-selected={activeGroup === null}
                className={`desktop-tab${activeGroup === null ? ' active' : ''}`}
                onClick={() => setGroup(null)}
              >
                {t('set.picker.all')}
                <span className="tab-count">({catalog.length})</span>
              </button>
            )}
            {groups.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={activeGroup === name}
                className={`desktop-tab${activeGroup === name ? ' active' : ''}`}
                onClick={() => setGroup(name)}
              >
                <span className="desktop-tab-label" title={name}>
                  {name}
                </span>
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
                <div className="set-section-title">
                  {sectionTitles?.same ?? t('set.picker.sameGroup')}
                </div>
              )}
              {renderRows(same)}
              {same.length > 0 && others.length > 0 && (
                <div className="set-section-title">
                  {sectionTitles?.others ?? t('set.picker.others')}
                </div>
              )}
              {renderRows(others)}
            </>
          )}
        </div>
        <div className="modal-actions">
          {footerExtra && <div className="set-picker-footer-extra">{footerExtra}</div>}
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={selected.size === 0 || busy} onClick={confirm}>
            {single ? t('set.picker.choose') : t('set.picker.add', { count: selected.size })}
          </Button>
        </div>
      </div>
    </div>
  );

  return asPage ? content : createPortal(content, document.body);
};

export default SetItemPickerModal;
