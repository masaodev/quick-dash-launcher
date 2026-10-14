/**
 * 画面: 今の位置を記録
 * 画面仕様: docs/screens/set-editor-modals.md#3-今の位置を記録
 */
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
  windowProcessLabel,
  windowPickNotes,
  SET_KIND_ICONS,
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

/** 行やウィンドウのアイコン（取れていなければ種類の絵文字） */
const RowIcon: React.FC<{ icon?: string; fallback: string }> = ({ icon, fallback }) => (
  <span className="set-row-icon">{icon ? <img src={icon} alt="" /> : fallback}</span>
);

/**
 * 記録の画面の名前の欄（1 段目は名前、2 段目は結び付いた相手のウィンドウや理由。
 * はみ出たら省略し、全体はカーソルを当てると出す）
 */
const RecordName: React.FC<{
  name: string;
  sub?: React.ReactNode;
  subTitle?: string;
  notes?: React.ReactNode;
}> = ({ name, sub, subTitle, notes }) => (
  <span className="set-record-name">
    <span className="set-record-main" title={name}>
      {name}
    </span>
    {sub && (
      <span className="set-record-sub" title={subTitle}>
        {sub}
      </span>
    )}
    {notes}
  </span>
);

const Place: React.FC<{ text: string }> = ({ text }) => (
  <span className="set-row-place set-record-place" title={text}>
    📍 {text}
  </span>
);

/** 欄の見出し。onToggle があれば畳める（登録画面の「詳細設定」と同じ ▶ / ▼） */
const SectionTitle: React.FC<{
  label: string;
  hint?: string;
  open?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}> = ({ label, hint, open, onToggle, disabled }) =>
  onToggle ? (
    <button
      type="button"
      className="set-section-title set-section-toggle"
      aria-expanded={open}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="toggle-icon" aria-hidden>
        {open ? '▼' : '▶'}
      </span>
      {label}
      {hint && !open && !disabled && <span className="set-section-hint">{hint}</span>}
    </button>
  ) : (
    <div className="set-section-title">
      {label}
      {hint && <span className="set-section-hint">{hint}</span>}
    </div>
  );

/** ウィンドウについて知らせること（タブとして開く・最小化中・管理者権限） */
export const WindowNotes: React.FC<{ window: WindowInfo; opensAsTab: boolean }> = ({
  window: w,
  opensAsTab,
}) => {
  const { t } = useTranslation();
  const notes = windowPickNotes(w);
  return (
    <>
      {opensAsTab && <span className="set-info">{t('set.record.tabNote')}</span>}
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
 * 開いているウィンドウを行と自動で結び付けて分けて出し、どうするかを選ばせる
 * - 位置を取れた行: このまま／別のウィンドウにする／位置を記録しない
 * - 位置を取れなかった行: 理由と、このまま記録するとどうなるかを出す。「ウィンドウを選ぶ」で手で結び付けられる
 *   （URL の行は自動では探さないので、いつもここに出る）。直さなくても記録できる
 * - 行に無いウィンドウ: 追加しない（既定）／行として追加／まだ位置を取れていない行の位置にする。既定は畳んでおく
 * - 最小化中のウィンドウ: 位置が取れないので出すだけ。既定は畳んでおく
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
  /** 「行に無いウィンドウ」「最小化中」の欄を開いているか（既定は畳む。行を足すときだけ開けばよい） */
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [showMinimized, setShowMinimized] = useState(false);

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
        // 開くものの無い行（動かすだけ）は、動かすウィンドウまで外すと何もできない行になるので、位置だけ外す
        if (!entry.itemId && !entry.open)
          return { ...rest, ...(entry.window ? { window: entry.window } : {}) };
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
  const iconOf = (i: number) => (
    <RowIcon icon={views[i]?.icon} fallback={SET_KIND_ICONS[views[i]?.kind ?? 'none'] ?? '📄'} />
  );
  /** 結び付いた相手のウィンドウ（アプリのアイコンとタイトル） */
  const windowLine = (w: WindowInfo) => (
    <>
      {w.icon && <img className="set-record-window-icon" src={w.icon} alt="" />}
      {t('set.record.windowLabel', { title: w.title })}
    </>
  );
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
              <SectionTitle
                label={t('set.record.linked', { count: linkedIndexes.length })}
                hint={linkedIndexes.length > 0 ? t('set.record.linkedHint') : undefined}
              />
              {linkedIndexes.map((i) => {
                const w = assign.get(i)!;
                const minimizedPick = w.windowState === 'minimized';
                return (
                  <div key={`l${i}`} className="set-record-row">
                    {iconOf(i)}
                    <RecordName
                      name={nameOf(i)}
                      sub={windowLine(w)}
                      subTitle={w.title}
                      notes={<WindowNotes window={w} opensAsTab={entryOpensAsTab(views[i])} />}
                    />
                    {minimizedPick ? (
                      <span className="set-row-place set-record-place">
                        {entries[i].placement
                          ? t('set.record.keepPrevious')
                          : t('set.record.noPlacement')}
                      </span>
                    ) : (
                      <Place text={placeOf(w)} />
                    )}
                    <select
                      className="set-record-action"
                      value="keep"
                      aria-label={t('set.record.keep')}
                      onChange={(e) => {
                        if (e.target.value === 'unlink') setWindowFor(i, null);
                        if (e.target.value === 'pick') setPickingFor(i);
                      }}
                    >
                      <option value="keep">{t('set.record.keep')}</option>
                      <option value="pick">{t('set.record.pickOther')}</option>
                      <option value="unlink">{t('set.record.unlink')}</option>
                    </select>
                  </div>
                );
              })}

              {failedIndexes.length > 0 && (
                <>
                  <SectionTitle
                    label={t('set.record.failed', { count: failedIndexes.length })}
                    hint={t('set.record.failedHint')}
                  />
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
                        ? t('set.record.reasonUnlinked')
                        : urlRow
                          ? t('set.record.reasonUrl')
                          : t('set.record.reasonNotFound');
                    // このまま記録するとどうなるか（外した行と、前の位置が無い行は開くだけになる）
                    const previous =
                      assign.get(i) !== null && entries[i].placement
                        ? placementText(entries[i], screens)
                        : null;
                    const outcome = previous
                      ? t('set.record.outcomeKeep', { place: previous })
                      : view.holding === 'none'
                        ? t('set.record.outcomeFrontOnly')
                        : t('set.record.outcomeOpenOnly');
                    const sub = t('set.record.reasonWithOutcome', { reason, outcome });
                    return (
                      <div key={`f${i}`} className="set-record-row">
                        {iconOf(i)}
                        <RecordName
                          name={nameOf(i)}
                          sub={sub}
                          subTitle={sub}
                          notes={
                            entryOpensAsTab(view) && (
                              <span className="set-info">{t('set.record.tabNote')}</span>
                            )
                          }
                        />
                        <span />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="set-record-action"
                          onClick={() => setPickingFor(i)}
                        >
                          {t('set.record.pickWindow')}
                        </Button>
                      </div>
                    );
                  })}
                </>
              )}

              <SectionTitle
                label={t('set.record.unlinked', { count: unlinkedWindows.length })}
                hint={t('set.record.unlinkedHint')}
                open={showUnlinked}
                onToggle={() => setShowUnlinked((v) => !v)}
                disabled={unlinkedWindows.length === 0}
              />
              {showUnlinked &&
                unlinkedWindows.map((w) => (
                  <div key={windowKey(w)} className="set-record-row">
                    <RowIcon icon={w.icon} fallback="🪟" />
                    <RecordName
                      name={w.title}
                      sub={windowProcessLabel(w)}
                      notes={
                        <>
                          {newRows.has(windowKey(w)) && cannotReopen(w) && (
                            <span className="set-info">{t('set.record.placeOnlyNote')}</span>
                          )}
                          <WindowNotes window={w} opensAsTab={false} />
                        </>
                      }
                    />
                    <Place text={placeOf(w)} />
                    <select
                      className="set-record-action"
                      aria-label={t('set.record.skip')}
                      value={newRows.has(windowKey(w)) ? 'newRow' : 'skip'}
                      onChange={(e) => onUnlinkedChoice(w, e.target.value)}
                    >
                      <option value="skip">{t('set.record.skip')}</option>
                      <option value="newRow">{t('set.record.newRow')}</option>
                      {linkableIndexes.length > 0 && (
                        <optgroup label={t('set.record.linkGroup')}>
                          {linkableIndexes.map((i) => (
                            <option key={i} value={String(i)}>
                              {nameOf(i)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                ))}

              {minimized.length > 0 && (
                <>
                  <SectionTitle
                    label={t('set.record.minimized', { count: minimized.length })}
                    open={showMinimized}
                    onToggle={() => setShowMinimized((v) => !v)}
                  />
                  {showMinimized &&
                    minimized.map((w) => (
                      <div key={windowKey(w)} className="set-record-row set-record-row-muted">
                        <RowIcon icon={w.icon} fallback="🪟" />
                        <RecordName name={w.title} sub={windowProcessLabel(w)} />
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
