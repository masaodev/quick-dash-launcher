/**
 * 画面: 位置を更新
 * 画面仕様: docs/screens/set-editor-modals.md#4-ウィンドウ位置を更新
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { SetEntry, WindowInfo } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import {
  autoLinkWindows,
  canAutoLink,
  matchesWindow,
  placementFromWindow,
} from '@common/utils/setWindowMatching';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import {
  describeSetEntry,
  entryWindowMatch,
  entryOpensAsTab,
  isOwnWindow,
  linkEntryToWindow,
  placementText,
  windowPlacementText,
  toMatchableEntry,
  windowPickNotes,
  SET_KIND_ICONS,
  type SetCatalogItem,
} from '../utils/setEditing';
import { logError } from '../utils/debug';
import '../styles/components/SetEditor.css';

import WindowSelectorModal from './WindowSelectorModal';
import PlacementMinimap from './PlacementMinimap';
import { Button } from './ui';

interface SetUpdatePositionsModalProps {
  isOpen: boolean;
  entries: SetEntry[];
  catalog: ReadonlyMap<string, SetCatalogItem>;
  /** 行が自分で持つパスのアイコン */
  ownIcons?: ReadonlyMap<string, string>;
  screens: readonly ScreenArea[];
  onClose: () => void;
  /** 位置を更新した結果の行（行の数と並びは変えない） */
  onConfirm: (entries: SetEntry[]) => void;
}

function windowKey(window: WindowInfo): string {
  return String(window.hwnd);
}

/** 行のアイコン（取れていなければ種類の絵文字） */
const RowIcon: React.FC<{ icon?: string; fallback: string }> = ({ icon, fallback }) => (
  <span className="set-row-icon">{icon ? <img src={icon} alt="" /> : fallback}</span>
);

/**
 * 位置の画面の名前の欄（1 段目は名前、2 段目は結び付いた相手のウィンドウや理由。
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

const SectionTitle: React.FC<{ label: string; hint?: string }> = ({ label, hint }) => (
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
      {opensAsTab && <span className="set-info">{t('set.update.tabNote')}</span>}
      {notes.includes('minimized') && (
        <span className="set-note">{t('set.update.minimizedNote')}</span>
      )}
      {notes.includes('elevated') && (
        <span className="set-note">{t('set.update.elevatedNote')}</span>
      )}
    </>
  );
};

/**
 * 「位置を更新」の確認画面
 *
 * 開いているウィンドウを今ある行と自動で結び付けて分けて出し、どうするかを選ばせる。行は足さない
 * （行に無いウィンドウを行にするのは「ウィンドウを追加」）
 * - 位置を取れた行: このまま／別のウィンドウにする／位置を記録しない
 * - 位置を取れなかった行: 理由と、このまま更新するとどうなるかを出す。「ウィンドウを選ぶ」で手で結び付けられる
 *   （URL の行は自動では探さないので、いつもここに出る）。直さなくても更新できる
 */
const SetUpdatePositionsModal: React.FC<SetUpdatePositionsModalProps> = ({
  isOpen,
  entries,
  catalog,
  ownIcons,
  screens,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  /** 仮想デスクトップの数（2 未満なら番号を記録も表示もしない） */
  const [desktopCount, setDesktopCount] = useState(0);
  const [desktopNames, setDesktopNames] = useState<Record<number, string | undefined>>({});
  /** 行の添字 → 結び付けたウィンドウ（null は「外す」を選んだ） */
  const [assign, setAssign] = useState<Map<number, WindowInfo | null>>(new Map());
  /** 手で結び付けるウィンドウを選んでいる行 */
  const [pickingFor, setPickingFor] = useState<number | null>(null);

  useModalKeyboard({ isOpen, modalRef, onClose });

  useEffect(() => {
    if (!isOpen) {
      setLoaded(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      window.electronAPI.getAllWindowsAllDesktops(),
      window.electronAPI.getVirtualDesktopInfo().catch(() => null),
    ])
      .then(([all, info]) => {
        if (cancelled) return;
        setDesktopCount(info?.supported ? info.desktopCount : 0);
        setDesktopNames(info?.desktopNames ?? {});
        const result = autoLinkWindows(
          entries.map((entry, i) => toMatchableEntry(entry, i, catalog)),
          all.filter((w) => !isOwnWindow(w))
        );
        const initial = new Map<number, WindowInfo | null>();
        for (const [index, w] of result.links) initial.set(index, w as WindowInfo);
        setAssign(initial);
        setLoaded(true);
      })
      .catch((error) => {
        logError('ウィンドウの一覧を取得できませんでした:', error);
        if (!cancelled) {
          setAssign(new Map());
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, entries, catalog]);

  const views = useMemo(
    () => entries.map((e) => describeSetEntry(e, catalog, ownIcons)),
    [entries, catalog, ownIcons]
  );

  if (!isOpen) return null;

  const linkedIndexes = entries.map((_, i) => i).filter((i) => assign.get(i));
  const failedIndexes = entries.map((_, i) => i).filter((i) => !assign.get(i));

  const setWindowFor = (index: number, w: WindowInfo | null) => {
    setAssign((prev) => {
      const next = new Map(prev);
      // 同じウィンドウがほかの行に結び付いていたら、そちらは外す
      if (w) {
        for (const [i, other] of next) {
          if (i !== index && other && windowKey(other) === windowKey(w)) next.delete(i);
        }
      }
      next.set(index, w);
      return next;
    });
  };

  const confirm = () => {
    const result = entries.map((entry, i) => {
      const w = assign.get(i);
      if (w) {
        // パスの無い単一アイテムの対象ウィンドウを借りている行は、合うなら借りたまま位置だけ入れる
        //（行に見つけ方を書くと、アイテムの対象ウィンドウを直しても効かなくなる）
        const borrowed = entries[i].window ? undefined : entryWindowMatch(entry, views[i]);
        if (borrowed && matchesWindow(borrowed, w)) {
          const { window: _w, ...linked } = linkEntryToWindow(entry, w, desktopCount);
          return linked;
        }
        // 前の見つけ方がこのウィンドウに当てはまらなければ（手で結び付けた・付け替えた）、決め直す
        const base =
          entry.window && matchesWindow(entry.window, w) ? entry : { ...entry, window: undefined };
        return linkEntryToWindow(base, w, desktopCount);
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
    onConfirm(result);
    onClose();
  };

  const nameOf = (i: number) => views[i]?.name || `#${i + 1}`;
  const placeOf = (w: WindowInfo) => windowPlacementText(w, screens, desktopCount, desktopNames);
  const iconOf = (i: number) => (
    <RowIcon icon={views[i]?.icon} fallback={SET_KIND_ICONS[views[i]?.kind ?? 'none'] ?? '📄'} />
  );
  /** 結び付いた相手のウィンドウ（アプリのアイコンとタイトル） */
  const windowLine = (w: WindowInfo) => (
    <>
      {w.icon && <img className="set-record-window-icon" src={w.icon} alt="" />}
      {t('set.update.windowLabel', { title: w.title })}
    </>
  );

  return createPortal(
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content set-record-modal"
          onClick={(e) => e.stopPropagation()}
          ref={modalRef}
          tabIndex={-1}
          role="dialog"
          aria-label={t('set.update.title')}
        >
          <div className="set-modal-header">
            <h3>{t('set.update.title')}</h3>
          </div>
          <span className="set-muted">{t('set.update.description')}</span>

          {!loaded ? (
            <div className="set-empty">{t('set.update.loading')}</div>
          ) : (
            <div className="set-record-body">
              <SectionTitle
                label={t('set.update.linked', { count: linkedIndexes.length })}
                hint={linkedIndexes.length > 0 ? t('set.update.linkedHint') : undefined}
              />
              {linkedIndexes.map((i) => {
                const w = assign.get(i)!;
                const minimizedPick = w.windowState === 'minimized';
                const before = entries[i].placement;
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
                          ? t('set.update.keepPrevious')
                          : t('set.update.noPlacement')}
                      </span>
                    ) : (
                      <span className="set-record-place-with-map">
                        {/* 前の位置（破線）と新しい位置を重ねた図 */}
                        <PlacementMinimap
                          screens={screens}
                          placements={[
                            ...(before ? [{ placement: before, variant: 'before' as const }] : []),
                            { placement: placementFromWindow(w, desktopCount) },
                          ]}
                          size="tiny"
                          label={placeOf(w)}
                          caption={
                            before
                              ? t('set.update.mapCaption', {
                                  before: placementText(entries[i], screens, desktopNames) ?? '',
                                  after: placeOf(w),
                                })
                              : placeOf(w)
                          }
                        />
                        <Place text={placeOf(w)} />
                      </span>
                    )}
                    <select
                      className="set-record-action"
                      value="keep"
                      aria-label={t('set.update.keep')}
                      onChange={(e) => {
                        if (e.target.value === 'unlink') setWindowFor(i, null);
                        if (e.target.value === 'pick') setPickingFor(i);
                      }}
                    >
                      <option value="keep">{t('set.update.keep')}</option>
                      <option value="pick">{t('set.update.pickOther')}</option>
                      <option value="unlink">{t('set.update.unlink')}</option>
                    </select>
                  </div>
                );
              })}

              {failedIndexes.length > 0 && (
                <>
                  <SectionTitle
                    label={t('set.update.failed', { count: failedIndexes.length })}
                    hint={t('set.update.failedHint')}
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
                        ? t('set.update.reasonUnlinked')
                        : urlRow
                          ? t('set.update.reasonUrl')
                          : t('set.update.reasonNotFound');
                    // このまま更新するとどうなるか（外した行と、前の位置が無い行は開くだけになる）
                    const previous =
                      assign.get(i) !== null && entries[i].placement
                        ? placementText(entries[i], screens, desktopNames)
                        : null;
                    const outcome = previous
                      ? t('set.update.outcomeKeep', { place: previous })
                      : view.moveOnly
                        ? t('set.update.outcomeFrontOnly')
                        : t('set.update.outcomeOpenOnly');
                    // アイテムが見つからない行は、更新しても開けないので理由だけを出す
                    const sub = view.missing
                      ? t('set.editor.missing')
                      : t('set.update.reasonWithOutcome', { reason, outcome });
                    return (
                      <div key={`f${i}`} className="set-record-row">
                        {iconOf(i)}
                        <RecordName
                          name={nameOf(i)}
                          sub={sub}
                          subTitle={sub}
                          notes={
                            entryOpensAsTab(view) && (
                              <span className="set-info">{t('set.update.tabNote')}</span>
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
                          {t('set.update.pickWindow')}
                        </Button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" disabled={!loaded} onClick={confirm}>
              {t('set.update.confirm')}
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

export default SetUpdatePositionsModal;
