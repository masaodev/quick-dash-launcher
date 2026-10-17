/**
 * 画面: ウィンドウを追加
 * 画面仕様: docs/screens/set-editor-modals.md#3-ウィンドウを追加
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { SetEntry, VirtualDesktopInfo, WindowInfo } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import { autoLinkWindows } from '@common/utils/setWindowMatching';
import { desktopLabel } from '@common/utils/desktopLabel';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import {
  describeSetEntry,
  entryFromWindow,
  isOwnWindow,
  toMatchableEntry,
  windowPlacementText,
  windowProcessLabel,
  type SetCatalogItem,
} from '../utils/setEditing';
import { logError } from '../utils/debug';
import '../styles/components/WindowSelectorModal.css';
import '../styles/components/SetEditor.css';

import { WindowMinimap } from './PlacementMinimap';
import { Button } from './ui';

interface SetAddWindowsModalProps {
  isOpen: boolean;
  /** 今の行（行と結び付くウィンドウを「追加済み」にする） */
  entries: SetEntry[];
  catalog: ReadonlyMap<string, SetCatalogItem>;
  screens: readonly ScreenArea[];
  onClose: () => void;
  /** 足す行（選んだウィンドウから作った、動かすだけの行。一覧の順） */
  onAdd: (entries: SetEntry[]) => void;
}

/** タブ: 0 = すべて、1 以降 = 仮想デスクトップの番号、-1 = デスクトップが分からないウィンドウ */
type TabId = number;
const ALL_TAB = 0;
const UNKNOWN_TAB = -1;

function windowKey(window: WindowInfo): string {
  return String(window.hwnd);
}

function onTab(window: WindowInfo, tab: TabId): boolean {
  if (tab === ALL_TAB) return true;
  const unknown = window.desktopNumber === undefined || window.desktopNumber <= 0;
  return tab === UNKNOWN_TAB ? unknown : window.desktopNumber === tab;
}

function matchesQuery(window: WindowInfo, q: string): boolean {
  return (
    !q ||
    window.title.toLowerCase().includes(q) ||
    (window.processName ?? '').toLowerCase().includes(q)
  );
}

/**
 * 開いているウィンドウを選んで、セットの行にする画面
 *
 * アイテムを追加の画面と同じく、検索と上のタブ（仮想デスクトップ）で絞り、チェックで複数選ぶ。
 * 選んだウィンドウは、今の位置を持つ「動かすだけ」の行になる（最小化中は位置なし）。
 * 行と結び付くウィンドウは「追加済み」にして選べなくする
 */
const SetAddWindowsModal: React.FC<SetAddWindowsModalProps> = ({
  isOpen,
  entries,
  catalog,
  screens,
  onClose,
  onAdd,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [windows, setWindows] = useState<WindowInfo[] | null>(null);
  const [desktop, setDesktop] = useState<VirtualDesktopInfo | null>(null);
  const [tab, setTab] = useState<TabId>(ALL_TAB);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /** 仮想デスクトップの数（2 未満ならタブも番号も出さない） */
  const desktopCount = desktop?.supported ? desktop.desktopCount : 0;

  useEffect(() => {
    if (!isOpen) {
      setWindows(null);
      return;
    }
    // 開くたびに前回の選び方を残さない
    setQuery('');
    setSelected(new Set());
    let cancelled = false;
    Promise.all([
      window.electronAPI.getAllWindowsAllDesktops(),
      window.electronAPI.getVirtualDesktopInfo().catch(() => null),
    ])
      .then(([all, info]) => {
        if (cancelled) return;
        setDesktop(info);
        // 開いたときは今いるデスクトップのタブ（ウィンドウを選ぶ画面と同じ）
        setTab(
          info?.supported && info.desktopCount > 1 && info.currentDesktop > 0
            ? info.currentDesktop
            : ALL_TAB
        );
        setWindows(all.filter((w) => !isOwnWindow(w)));
      })
      .catch((error) => {
        logError('ウィンドウの一覧を取得できませんでした:', error);
        if (!cancelled) setWindows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  /** 行と結び付くウィンドウ（キー → 行の名前） */
  const addedNames = useMemo(() => {
    const names = new Map<string, string>();
    if (!windows) return names;
    const result = autoLinkWindows(
      entries.map((entry, i) => toMatchableEntry(entry, i, catalog)),
      windows
    );
    for (const [index, w] of result.links) {
      const view = describeSetEntry(entries[index], catalog);
      names.set(windowKey(w as WindowInfo), view.name || `#${index + 1}`);
    }
    return names;
  }, [windows, entries, catalog]);

  const showTabs = desktopCount > 1;
  const q = query.trim().toLowerCase();
  const tabs = useMemo(() => {
    if (!showTabs || !desktop) return [];
    const list: TabId[] = [ALL_TAB];
    for (let i = 1; i <= desktop.desktopCount; i++) list.push(i);
    if ((windows ?? []).some((w) => onTab(w, UNKNOWN_TAB))) list.push(UNKNOWN_TAB);
    return list;
  }, [showTabs, desktop, windows]);

  // 検索欄で Tab・Shift+Tab を押すと、上のタブを順に切り替える（アイテムを追加と同じ。検索中は合うウィンドウの無いタブを飛ばす）
  const switchTabByKey = (event: KeyboardEvent): boolean => {
    if (document.activeElement !== searchRef.current || tabs.length <= 1) return false;
    const hasMatch = (id: TabId) => (windows ?? []).some((w) => onTab(w, id) && matchesQuery(w, q));
    const step = event.shiftKey ? -1 : 1;
    const current = Math.max(0, tabs.indexOf(tab));
    for (let i = 1; i < tabs.length; i++) {
      const next = tabs[(current + step * i + tabs.length) % tabs.length];
      if (hasMatch(next)) {
        setTab(next);
        return true;
      }
    }
    return true;
  };
  useModalKeyboard({ isOpen, modalRef, onClose, onTab: switchTabByKey });
  // useModalKeyboard が開いたときにモーダル本体へフォーカスを移すので、その後で検索欄へ戻す
  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const shown = (windows ?? []).filter((w) => onTab(w, tab) && matchesQuery(w, q));
  const selectable = shown.filter((w) => !addedNames.has(windowKey(w)));

  const tabLabel = (id: TabId) => {
    if (id === ALL_TAB) return t('windowPicker.all');
    if (id === UNKNOWN_TAB) return t('windowPicker.unknown');
    const number = desktopLabel(id, desktop?.desktopNames);
    return id === desktop?.currentDesktop
      ? t('windowPicker.currentDesktop', { number })
      : t('windowPicker.desktop', { number });
  };
  const tabCount = (id: TabId) =>
    (windows ?? []).filter((w) => onTab(w, id) && matchesQuery(w, q)).length;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const selectShown = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const w of selectable) next.add(windowKey(w));
      return next;
    });
  };
  const confirm = () => {
    onAdd(
      (windows ?? [])
        .filter((w) => selected.has(windowKey(w)))
        .map((w) => entryFromWindow(w, desktopCount))
    );
    onClose();
  };

  /** 2 段目（exe 名と位置。最小化中は位置なし） */
  const subLine = (w: WindowInfo) => {
    const place =
      w.windowState === 'minimized'
        ? t('set.addWindows.minimized')
        : `📍 ${windowPlacementText(w, screens, desktopCount, desktop?.desktopNames)}`;
    const exe = windowProcessLabel(w);
    return exe ? t('set.addWindows.details', { exe, place }) : place;
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content set-picker-modal set-addwin-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-label={t('set.addWindows.title')}
      >
        <div className="set-modal-header">
          <h3>{t('set.addWindows.title')}</h3>
          <span className="set-muted">{t('set.picker.selected', { count: selected.size })}</span>
        </div>
        <span className="set-muted">{t('set.addWindows.description')}</span>
        <input
          type="text"
          className="set-search"
          ref={searchRef}
          value={query}
          placeholder={t('set.addWindows.search')}
          onChange={(e) => setQuery(e.target.value)}
        />
        {showTabs && (
          <div className="desktop-tabs set-tabs" role="tablist">
            {tabs.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`desktop-tab${tab === id ? ' active' : ''}`}
                onClick={() => setTab(id)}
              >
                {tabLabel(id)}
                <span className="tab-count">({tabCount(id)})</span>
              </button>
            ))}
          </div>
        )}
        <div className="set-picker-list">
          {windows === null ? (
            <div className="set-empty">{t('set.addWindows.loading')}</div>
          ) : windows.length === 0 ? (
            <div className="set-empty">{t('set.addWindows.empty')}</div>
          ) : shown.length === 0 ? (
            <div className="set-empty">{t('set.addWindows.noResults')}</div>
          ) : (
            shown.map((w) => {
              const key = windowKey(w);
              const addedAs = addedNames.get(key);
              const checked = selected.has(key);
              return (
                <label
                  key={key}
                  className={`set-picker-row set-addwin-row${addedAs !== undefined ? ' added' : ''}${
                    checked ? ' checked' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={addedAs !== undefined}
                    onChange={() => toggle(key)}
                  />
                  <span className="set-row-icon">
                    {w.icon ? <img src={w.icon} alt="" /> : '🪟'}
                  </span>
                  <span className="set-record-name">
                    <span className="set-record-main" title={w.title}>
                      {w.title || windowProcessLabel(w)}
                    </span>
                    <span className="set-record-sub set-sub-with-map" title={w.executablePath}>
                      {/* 図の場所は図が無い行（最小化中・追加済み）でも空け、言葉の頭をそろえる */}
                      <span className="set-row-map">
                        {addedAs === undefined && w.windowState !== 'minimized' && (
                          <WindowMinimap window={w} screens={screens} desktopCount={desktopCount} />
                        )}
                      </span>
                      <span className="set-sub-text">
                        {addedAs !== undefined
                          ? t('set.addWindows.added', { name: addedAs })
                          : subLine(w)}
                      </span>
                    </span>
                    {w.isElevated && addedAs === undefined && (
                      <span className="set-note">{t('set.update.elevatedNote')}</span>
                    )}
                  </span>
                  {/* すべてのタブでは、どのデスクトップのウィンドウかを添える */}
                  {tab === ALL_TAB &&
                  showTabs &&
                  w.desktopNumber !== undefined &&
                  w.desktopNumber > 0 ? (
                    <span className="set-row-aside">
                      {t('windowPicker.desktop', {
                        number: desktopLabel(w.desktopNumber, desktop?.desktopNames),
                      })}
                    </span>
                  ) : (
                    <span />
                  )}
                </label>
              );
            })
          )}
        </div>
        <span className="set-info">{t('set.addWindows.note')}</span>
        <div className="modal-actions set-addwin-actions">
          <Button
            variant="secondary"
            size="sm"
            disabled={selectable.length === 0}
            onClick={selectShown}
          >
            {t('set.addWindows.selectShown')}
          </Button>
          <span className="set-addwin-spacer" />
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={selected.size === 0} onClick={confirm}>
            {selected.size === 0
              ? t('set.addWindows.addNone')
              : t('set.addWindows.add', { count: selected.size })}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SetAddWindowsModal;
