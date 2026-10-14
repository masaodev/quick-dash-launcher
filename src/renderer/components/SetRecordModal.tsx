import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { SetEntry, WindowInfo } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import { autoLinkWindows, canAutoLink, matchesWindow } from '@common/utils/setWindowMatching';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import {
  describeSetEntry,
  entryOpensAsTab,
  entryFromWindow,
  linkEntryToWindow,
  placementText,
  toMatchableEntry,
  windowDisplayName,
  windowPickNotes,
  type SetCatalogItem,
} from '../utils/setEditing';
import { logError } from '../utils/debug';
import '../styles/components/SetEditor.css';

import WindowSelectorModal from './WindowSelectorModal';
import { Button } from './ui';

interface SetRecordModalProps {
  isOpen: boolean;
  entries: SetEntry[];
  catalog: ReadonlyMap<string, SetCatalogItem>;
  screens: readonly ScreenArea[];
  onClose: () => void;
  /** 記録した結果の行（並びは元の行のあとに、新しく足した行） */
  onConfirm: (entries: SetEntry[]) => void;
}

/** QDL 自身のウィンドウ（登録画面など）は記録の対象にしない */
function isOwnWindow(window: WindowInfo): boolean {
  return /quick-?dash-?launcher|^electron\.exe$/i.test(window.processName ?? '');
}

function windowKey(window: WindowInfo): string {
  return String(window.hwnd);
}

/** ウィンドウについて知らせること（タブとして開く・最小化中・管理者権限） */
export const WindowNotes: React.FC<{ window: WindowInfo; opensAsTab: boolean }> = ({
  window: w,
  opensAsTab,
}) => {
  const { t } = useTranslation();
  const notes = windowPickNotes(w);
  return (
    <>
      {opensAsTab && <span className="set-note">{t('set.record.tabNote')}</span>}
      {notes.includes('minimized') && (
        <span className="set-note">{t('set.record.minimizedNote')}</span>
      )}
      {notes.includes('elevated') && (
        <span className="set-note">{t('set.record.elevatedNote')}</span>
      )}
    </>
  );
};

/**
 * 「今の位置を記録」の確認画面
 *
 * 開いているウィンドウを行と自動で結び付けて 3 つに分けて出し、ウィンドウごとにどうするかを選ばせる
 * - 行と結び付けたウィンドウ: 結び付けたまま／外す
 * - 行に無いウィンドウ: 追加しない（既定）／新しい行として追加／まだ結び付いていない行に結び付ける
 * - 位置を記録できなかった行: 理由を出す。「ウィンドウを選ぶ」で手で結び付けられる（URL の行は自動では探さないので、いつもここに出る）
 */
const SetRecordModal: React.FC<SetRecordModalProps> = ({
  isOpen,
  entries,
  catalog,
  screens,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [windows, setWindows] = useState<WindowInfo[] | null>(null);
  /** 行の添字 → 結び付けたウィンドウ（null は「外す」を選んだ） */
  const [assign, setAssign] = useState<Map<number, WindowInfo | null>>(new Map());
  /** 新しい行として追加するウィンドウ */
  const [newRows, setNewRows] = useState<Set<string>>(new Set());
  /** 手で結び付けるウィンドウを選んでいる行 */
  const [pickingFor, setPickingFor] = useState<number | null>(null);

  useModalKeyboard({ isOpen, modalRef, onClose });

  useEffect(() => {
    if (!isOpen) {
      setWindows(null);
      return;
    }
    let cancelled = false;
    window.electronAPI
      .getAllWindowsAllDesktops()
      .then((all) => {
        if (cancelled) return;
        const list = all.filter((w) => !isOwnWindow(w));
        const result = autoLinkWindows(
          entries.map((entry, i) => toMatchableEntry(entry, i, catalog)),
          list
        );
        const initial = new Map<number, WindowInfo | null>();
        for (const [index, w] of result.links) initial.set(index, w as WindowInfo);
        setAssign(initial);
        setNewRows(new Set());
        setWindows(list);
      })
      .catch((error) => {
        logError('ウィンドウの一覧を取得できませんでした:', error);
        if (!cancelled) setWindows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, entries, catalog]);

  const views = useMemo(() => entries.map((e) => describeSetEntry(e, catalog)), [entries, catalog]);

  if (!isOpen) return null;

  const assignedKeys = new Set(
    [...assign.values()].filter((w): w is WindowInfo => !!w).map(windowKey)
  );
  const minimized = (windows ?? []).filter(
    (w) => w.windowState === 'minimized' && !assignedKeys.has(windowKey(w))
  );
  const unlinkedWindows = (windows ?? []).filter(
    (w) => w.windowState !== 'minimized' && !assignedKeys.has(windowKey(w))
  );
  const linkedIndexes = entries.map((_, i) => i).filter((i) => assign.get(i));
  const failedIndexes = entries.map((_, i) => i).filter((i) => !assign.get(i));
  /** まだウィンドウと結び付いていない行 */
  const linkableIndexes = failedIndexes;

  const setWindowFor = (index: number, w: WindowInfo | null) => {
    setAssign((prev) => {
      const next = new Map(prev);
      // 同じウィンドウがほかの行に結び付いていたら、そちらは外す
      if (w) {
        for (const [i, other] of next) {
          if (i !== index && other && windowKey(other) === windowKey(w)) next.delete(i);
        }
        setNewRows((rows) => {
          const r = new Set(rows);
          r.delete(windowKey(w));
          return r;
        });
      }
      next.set(index, w);
      return next;
    });
  };

  const onUnlinkedChoice = (w: WindowInfo, value: string) => {
    const key = windowKey(w);
    if (value === 'skip' || value === 'newRow') {
      setNewRows((rows) => {
        const r = new Set(rows);
        if (value === 'newRow') r.add(key);
        else r.delete(key);
        return r;
      });
      return;
    }
    setWindowFor(Number(value), w);
  };

  const confirm = () => {
    const all = windows ?? [];
    const result = entries.map((entry, i) => {
      const w = assign.get(i);
      if (w) {
        // 前の見つけ方がこのウィンドウに当てはまらなければ（手で結び付けた・付け替えた）、決め直す
        const base =
          entry.window && matchesWindow(entry.window, w) ? entry : { ...entry, window: undefined };
        return linkEntryToWindow(base, w, all);
      }
      if (assign.has(i) && w === null) {
        const { window: _w, placement: _p, ...rest } = entry;
        return rest;
      }
      return entry;
    });
    for (const w of all) {
      if (newRows.has(windowKey(w))) result.push(entryFromWindow(w, all));
    }
    onConfirm(result);
    onClose();
  };

  const nameOf = (i: number) => views[i]?.name || `#${i + 1}`;
  const placeOf = (w: WindowInfo) =>
    placementText({ placement: { x: w.x, y: w.y, width: w.width, height: w.height } }, screens) ??
    '';
  const cannotReopen = (w: WindowInfo) =>
    /^(explorer|applicationframehost)\.exe$/i.test(w.processName ?? '');

  return createPortal(
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content set-record-modal"
          onClick={(e) => e.stopPropagation()}
          ref={modalRef}
          tabIndex={-1}
          role="dialog"
          aria-label={t('set.record.title')}
        >
          <div className="set-modal-header">
            <h3>{t('set.record.title')}</h3>
          </div>

          {windows === null ? (
            <div className="set-empty">{t('set.record.loading')}</div>
          ) : (
            <div className="set-record-body">
              <div className="set-section-title">
                {t('set.record.linked', { count: linkedIndexes.length })}
              </div>
              {linkedIndexes.map((i) => {
                const w = assign.get(i)!;
                const minimizedPick = w.windowState === 'minimized';
                return (
                  <div key={`l${i}`} className="set-record-row">
                    <span className="set-ok">✓</span>
                    <span className="set-row-name">
                      {nameOf(i)} <span className="set-muted">— {w.title}</span>
                      <WindowNotes window={w} opensAsTab={entryOpensAsTab(views[i])} />
                    </span>
                    {minimizedPick ? (
                      <span className="set-chip set-chip-muted">
                        {entries[i].placement
                          ? t('set.record.keepPrevious')
                          : t('set.record.noPlacement')}
                      </span>
                    ) : (
                      <span className="set-chip set-chip-place">📍 {placeOf(w)}</span>
                    )}
                    <select
                      value="keep"
                      onChange={(e) => {
                        if (e.target.value === 'unlink') setWindowFor(i, null);
                        if (e.target.value === 'pick') setPickingFor(i);
                      }}
                    >
                      <option value="keep">{t('set.record.keep')}</option>
                      <option value="pick">{t('set.record.pickWindow')}</option>
                      <option value="unlink">{t('set.record.unlink')}</option>
                    </select>
                  </div>
                );
              })}

              <div className="set-section-title">
                {t('set.record.unlinked', { count: unlinkedWindows.length })}
              </div>
              {unlinkedWindows.map((w) => (
                <div key={windowKey(w)} className="set-record-row">
                  <span className="set-row-icon">
                    {w.icon ? <img src={w.icon} alt="" /> : '🪟'}
                  </span>
                  <span className="set-row-name">
                    {windowDisplayName(w)} <span className="set-muted">— {w.title}</span>
                    {newRows.has(windowKey(w)) && cannotReopen(w) && (
                      <span className="set-note">{t('set.record.placeOnlyNote')}</span>
                    )}
                    <WindowNotes window={w} opensAsTab={false} />
                  </span>
                  <span className="set-chip set-chip-place">📍 {placeOf(w)}</span>
                  <select
                    value={newRows.has(windowKey(w)) ? 'newRow' : 'skip'}
                    onChange={(e) => onUnlinkedChoice(w, e.target.value)}
                  >
                    <option value="skip">{t('set.record.skip')}</option>
                    <option value="newRow">{t('set.record.newRow')}</option>
                    {linkableIndexes.map((i) => (
                      <option key={i} value={String(i)}>
                        {t('set.record.linkTo', { name: nameOf(i) })}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="set-section-title">
                {t('set.record.failed', { count: failedIndexes.length })}
              </div>
              {failedIndexes.map((i) => {
                const view = views[i];
                // URL の行は自動では探さない（手で結び付ける）
                const urlRow =
                  !entries[i].window &&
                  view.kind !== 'window' &&
                  view.kind !== 'none' &&
                  !canAutoLink(view.kind);
                const reason =
                  assign.get(i) === null
                    ? t('set.record.unlink')
                    : urlRow
                      ? t('set.record.reasonUrl')
                      : t('set.record.reasonNotFound');
                return (
                  <div key={`f${i}`} className="set-record-row">
                    <span className="set-muted">{urlRow ? '–' : '!'}</span>
                    <span className="set-row-name">
                      {nameOf(i)}{' '}
                      <span className="set-muted">
                        — {reason}
                        {entries[i].placement && assign.get(i) !== null
                          ? `（${t('set.record.keepPrevious')}）`
                          : ''}
                      </span>
                      {entryOpensAsTab(view) && (
                        <span className="set-note">{t('set.record.tabNote')}</span>
                      )}
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => setPickingFor(i)}>
                      {t('set.record.pickWindow')}
                    </Button>
                  </div>
                );
              })}

              {minimized.length > 0 && (
                <>
                  <div className="set-section-title">
                    {t('set.record.minimized', { count: minimized.length })}
                  </div>
                  {minimized.map((w) => (
                    <div key={windowKey(w)} className="set-record-row set-muted">
                      <span>–</span>
                      <span className="set-row-name">
                        {windowDisplayName(w)} — {w.title}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" disabled={windows === null} onClick={confirm}>
              {t('set.record.confirm')}
            </Button>
          </div>
        </div>
      </div>

      <WindowSelectorModal
        isOpen={pickingFor !== null}
        onClose={() => setPickingFor(null)}
        onSelect={(w) => {
          if (pickingFor !== null) setWindowFor(pickingFor, w);
          setPickingFor(null);
        }}
      />
    </>,
    document.body
  );
};

export default SetRecordModal;
