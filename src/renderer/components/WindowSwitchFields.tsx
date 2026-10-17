/**
 * ウィンドウ切り替えの欄（対象ウィンドウ・ウィンドウ位置・開くときの動き）
 *
 * セットの行の詳細（SetEntryDetailModal）と、単一アイテムの登録・編集（ItemWindowSwitchEditor）が同じ部品を使う。
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SetPlacement, SetWindowMatch, WindowInfo } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import { hasPlacementRect } from '@common/utils/placementMap';
import { ANY_WINDOW_TITLE } from '@common/utils/windowTitle';
import {
  decideWindowMatch,
  matchesWindow,
  placementFromWindow,
} from '@common/utils/setWindowMatching';

import { placementText, titleParts, windowPickNotes } from '../utils/setEditing';
import '../styles/components/SetEditor.css';

import PlacementMinimap from './PlacementMinimap';
import WindowPlacementPickModal from './WindowPlacementPickModal';
import { Button } from './ui';

/** 空の文字列は undefined にする（保存したときに空のキーを書かない） */
export function orUndefined(value: string): string | undefined {
  return value.trim() === '' ? undefined : value;
}

/**
 * ウィンドウ位置を言葉にする（例: 画面 1・右半分・デスクトップ 2）
 *
 * 全デスクトップに表示するときは、デスクトップの番号を付けない
 */
export function placementSummary(
  placement: SetPlacement | undefined,
  screens: readonly ScreenArea[],
  desktopNames?: Readonly<Record<number, string | undefined>>,
  pinToAllDesktops?: boolean
): string | undefined {
  return placementText({ placement, pinToAllDesktops }, screens, desktopNames);
}

/** 全デスクトップに表示するときは、デスクトップの番号を持たない */
export function withoutDesktop(placement: SetPlacement): SetPlacement {
  const { virtualDesktopNumber: _drop, ...rest } = placement;
  return rest;
}

/**
 * 選んだウィンドウについて知らせること
 * - minimized: 「開いているウィンドウから選ぶ」で最小化中のウィンドウを選んだ（対象ウィンドウだけ取った）
 * - minimizedNotUpdated: 「ウィンドウ位置を更新」で最小化中のウィンドウだった（位置は取らなかった）
 * - elevated: 管理者権限で動いている
 */
export type WindowPickNote = 'minimized' | 'minimizedNotUpdated' | 'elevated';

/**
 * 「開いているウィンドウから選ぶ」で選んだウィンドウから、対象ウィンドウとウィンドウ位置を作る
 *
 * 最小化中は座標が画面の外になるので、対象ウィンドウだけ取る（placement は返さない＝前のまま）
 */
export function pickFromWindow(
  w: WindowInfo,
  desktopCount: number
): {
  window: SetWindowMatch;
  placement?: SetPlacement;
  notes: WindowPickNote[];
} {
  const window = decideWindowMatch(w);
  const notes = windowPickNotes(w);
  return w.windowState === 'minimized'
    ? { window, notes }
    : { window, placement: placementFromWindow(w, desktopCount), notes };
}

interface WindowMatchFieldsProps {
  /** 入力欄の id の頭（同じ画面に 2 つ出るときに分ける） */
  idPrefix: string;
  value: SetWindowMatch | undefined;
  /** 開いたときの対象ウィンドウ（「元に戻す」の先・一部だけで探す候補の元） */
  initial: SetWindowMatch | undefined;
  /** 今開いているウィンドウ（「今合うウィンドウ」を数える） */
  windows: readonly WindowInfo[];
  /** 枠の先頭の 1 文（セットと単一アイテムで主語が違う） */
  lead: string;
  /** 「🔍 開いているウィンドウから選ぶ」（ウィンドウを選ぶ画面を開く。exe 名・タイトル・ウィンドウ位置をまとめて入れる） */
  onPickWindow: () => void;
  /** exe 名もタイトルも空になったら undefined */
  onChange: (window: SetWindowMatch | undefined) => void;
  /**
   * 欄が空のときに薄い字で出す、代わりに使われる値（セットの行がアイテムの設定で開くとき）。
   * 無い欄は既定の placeholder
   */
  inherited?: SetWindowMatch;
}

/** 対象ウィンドウ（開いているウィンドウから選ぶ・exe 名・ウィンドウタイトル・一部だけで探す候補・今合うウィンドウ） */
export const WindowMatchFields: React.FC<WindowMatchFieldsProps> = ({
  idPrefix,
  value,
  initial,
  windows,
  lead,
  onPickWindow,
  onChange,
  inherited,
}) => {
  const { t } = useTranslation();
  const initialTitle = initial?.title;
  const matched = useMemo(
    () => (value ? windows.filter((w) => matchesWindow(value, w)) : []),
    [value, windows]
  );
  // 候補は開いたときのタイトルから作る。* を含む（もう一部だけにしてある）なら、今合う 1 つのウィンドウのタイトルから
  const parts = useMemo(() => {
    if (initialTitle && !/[*?]/.test(initialTitle)) return titleParts(initialTitle);
    // タイトルが空か、もう一部だけにしてある: 今合う 1 つのウィンドウのタイトルから作る
    const now = initial ? windows.filter((w) => matchesWindow(initial, w)) : [];
    if (now.length === 1) return titleParts(now[0].title);
    return initialTitle ? titleParts(initialTitle) : [];
  }, [initialTitle, initial, windows]);

  const update = (patch: Partial<SetWindowMatch>) => {
    const next = { ...(value ?? {}), ...patch };
    onChange(next.processName || next.title ? next : undefined);
  };

  return (
    <div className="set-detail-group">
      {/* 条件ごと入れ直すボタンは、対象ウィンドウの見出しの右に置く */}
      <div className="set-detail-group-title set-detail-group-title-row">
        <span>{t('set.detail.find')}</span>
        <Button variant="secondary" size="sm" className="set-nowrap" onClick={onPickWindow}>
          {t('set.detail.pickFromWindow')}
        </Button>
      </div>
      <p className="set-detail-lead">{lead}</p>
      <label className="set-detail-label set-detail-label-top" htmlFor={`${idPrefix}-process`}>
        {t('set.detail.processName')}
      </label>
      <div className="set-field-col">
        <input
          id={`${idPrefix}-process`}
          type="text"
          placeholder={
            inherited?.processName
              ? t('set.detail.inheritValue', { value: inherited.processName })
              : t('set.detail.processNamePlaceholder')
          }
          value={value?.processName ?? ''}
          onChange={(e) => update({ processName: orUndefined(e.target.value) })}
        />
        <small className="set-detail-hint">{t('set.detail.processNameNote')}</small>
      </div>
      <label className="set-detail-label set-detail-label-top" htmlFor={`${idPrefix}-title`}>
        {t('set.detail.windowTitle')}
      </label>
      {/* 欄 → 探し方の補足 → 一部だけで探す候補 → 今合うウィンドウ の順。元に戻すは欄に対する操作なので欄の右 */}
      <div className="set-field-col">
        <div className="set-title-row">
          <input
            id={`${idPrefix}-title`}
            type="text"
            placeholder={
              inherited?.title
                ? t('set.detail.inheritValue', { value: inherited.title })
                : t('set.detail.windowTitlePlaceholder')
            }
            value={value?.title ?? ''}
            onChange={(e) => update({ title: orUndefined(e.target.value) })}
          />
          {initialTitle && value?.title !== initialTitle && (
            <button
              type="button"
              className="set-title-revert"
              onClick={() => update({ title: initialTitle })}
            >
              {t('set.detail.revertTitle')}
            </button>
          )}
        </div>
        <small className="set-detail-hint">{t('set.detail.windowTitleNote')}</small>
        {(parts.length > 0 || value?.processName) && (
          // 小見出しを上に置き、チップだけを下に並べる（チップの途中で 1 つだけ落ちる形にしない）
          <div className="set-title-parts-box">
            <span className="set-title-parts-label">{t('set.detail.titleParts')}</span>
            <div className="set-title-parts">
              {value?.processName && (
                <button
                  type="button"
                  className="set-title-part"
                  title={t('set.detail.anyTitleHint')}
                  onClick={() => update({ title: ANY_WINDOW_TITLE })}
                >
                  {t('set.detail.anyTitle')}
                </button>
              )}
              {parts.map((part) => (
                <button
                  key={part}
                  type="button"
                  className="set-title-part"
                  onClick={() => update({ title: `*${part}*` })}
                >
                  {part}
                </button>
              ))}
            </div>
          </div>
        )}
        {value && (
          <span
            className={`set-title-match${
              matched.length === 1 ? ' one' : matched.length > 1 ? ' many' : ''
            }`}
          >
            {matched.length === 0
              ? t('set.detail.matchNone')
              : matched.length === 1
                ? t('set.detail.matchOne', { title: matched[0].title })
                : t('set.detail.matchMany', { count: matched.length })}
          </span>
        )}
      </div>
    </div>
  );
};

/** ウィンドウ位置の枠が変えるもの（どちらのキーも毎回入れる。undefined は外す） */
export interface WindowPlacementPatch {
  placement: SetPlacement | undefined;
  pinToAllDesktops: true | undefined;
}

interface WindowPlacementFieldsProps {
  idPrefix: string;
  placement: SetPlacement | undefined;
  /** 全デスクトップに表示するか */
  pinToAllDesktops: boolean | undefined;
  /** 今の対象ウィンドウ（「📍 ウィンドウ位置を更新」はこれに合うウィンドウの位置を取る） */
  match: SetWindowMatch | undefined;
  /** 今開いているウィンドウ（対象ウィンドウの「今合うウィンドウ」と同じ一覧。ボタンを押せるかを決める） */
  windows: readonly WindowInfo[];
  desktopCount: number;
  screens: readonly ScreenArea[];
  desktopNames: Readonly<Record<number, string | undefined>>;
  onChange: (patch: WindowPlacementPatch) => void;
  /** 「📍 ウィンドウ位置を更新」で選んだウィンドウについて知らせること（無ければ空） */
  onUpdated: (notes: WindowPickNote[]) => void;
  /** タブとして開く種類なら、ウィンドウごと動く旨を添える */
  tabNote?: boolean;
  /** 最後に選んだウィンドウについて知らせること（記録したウィンドウ位置の下に添える） */
  pickNotes?: readonly WindowPickNote[];
  /** 記録が無いときに薄い字で出す、代わりに使われるウィンドウ位置（セットの行がアイテムの設定で開くとき） */
  inheritedPlacement?: SetPlacement;
}

/** ウィンドウ位置（記録したウィンドウ位置・ウィンドウ位置を更新・外す・仮想デスクトップ・全デスクトップに表示） */
export const WindowPlacementFields: React.FC<WindowPlacementFieldsProps> = ({
  idPrefix,
  placement,
  pinToAllDesktops,
  match,
  windows,
  desktopCount,
  screens,
  desktopNames,
  onChange,
  onUpdated,
  tabNote = false,
  pickNotes = [],
  inheritedPlacement,
}) => {
  const { t } = useTranslation();
  const pinned = pinToAllDesktops === true;
  /** 合うウィンドウが 2 つ以上のとき、選ぶ画面に並べるウィンドウ（空なら閉じている） */
  const [choices, setChoices] = useState<WindowInfo[]>([]);
  const matchedCount = useMemo(
    () => (match ? windows.filter((w) => matchesWindow(match, w)).length : 0),
    [match, windows]
  );
  const change = (next: SetPlacement | undefined, pin: boolean = pinned) =>
    onChange({
      placement: next && pin ? withoutDesktop(next) : next,
      pinToAllDesktops: pin ? true : undefined,
    });

  /** 選んだウィンドウの今の位置を記録する（exe 名・タイトルは変えない。最小化中は位置を取らない） */
  const record = (w: WindowInfo) => {
    setChoices([]);
    const picked = pickFromWindow(w, desktopCount);
    if (picked.placement) change(picked.placement);
    onUpdated(picked.notes.map((note) => (note === 'minimized' ? 'minimizedNotUpdated' : note)));
  };

  /** 押した時点のウィンドウを読み直して、合うものから位置を取る（欄を開いた後にウィンドウを動かしていることが多い） */
  const updateFromWindow = async () => {
    if (!match) return;
    let now: WindowInfo[];
    try {
      now = await window.electronAPI.getAllWindowsAllDesktops();
    } catch {
      now = [...windows];
    }
    const found = now.filter((w) => matchesWindow(match, w));
    if (found.length === 1) record(found[0]);
    else if (found.length > 1) setChoices(found);
  };

  /** 図に描く位置（自分の位置が無ければ、引き継ぐ位置）と、その言葉 */
  const shownPlacement = placement ?? inheritedPlacement;
  const shownText = placementSummary(shownPlacement, screens, desktopNames, pinned) ?? '';

  const desktopInput = placement && (
    <input
      id={`${idPrefix}-desktop`}
      type="number"
      min={1}
      step={1}
      disabled={pinned}
      placeholder={t('set.detail.desktopKeep')}
      value={placement.virtualDesktopNumber ?? ''}
      onChange={(e) => {
        // 1 以上の整数だけ（0・負の数・小数は「変えない」と同じ空にする）
        const n = Number(e.target.value);
        change({
          ...placement,
          virtualDesktopNumber:
            e.target.value !== '' && Number.isInteger(n) && n >= 1 ? n : undefined,
        });
      }}
    />
  );

  return (
    <div className="set-detail-group">
      <div className="set-detail-group-title">{t('set.detail.placement')}</div>
      <span className="set-detail-label set-detail-label-top">{t('set.detail.recorded')}</span>
      {/* 1 行目に位置の言葉、2 行目にボタン、3 行目に短い補足（ボタンが途中で折り返さない並び） */}
      <div className="set-field-col">
        {shownPlacement ? (
          // 言葉の左に図。図にマウスを乗せると大きな図が出る
          <span className="set-placement-with-map">
            {/* 座標の無い位置（デスクトップ番号だけなど）は図に描けないので、言葉だけ */}
            {hasPlacementRect(shownPlacement) && (
              <PlacementMinimap
                screens={screens}
                placements={[{ placement: shownPlacement }]}
                size="small"
                label={shownText}
                caption={shownText}
              />
            )}
            {placement ? (
              <span className="set-placement-text">📍 {shownText}</span>
            ) : (
              <span className="set-placement-text set-placement-inherited">
                {t('set.detail.inheritPlacement', { place: shownText })}
              </span>
            )}
          </span>
        ) : (
          <span className="set-placement-text">{t('set.detail.noPlacement')}</span>
        )}
        <span className="set-detail-buttons">
          <Button
            variant="secondary"
            size="sm"
            className="set-nowrap"
            disabled={matchedCount === 0}
            title={matchedCount === 0 ? t('set.detail.updatePlacementNoMatch') : undefined}
            onClick={() => void updateFromWindow()}
          >
            {t('set.detail.updatePlacement')}
          </Button>
          {placement && (
            <Button
              variant="secondary"
              size="sm"
              className="set-nowrap"
              onClick={() => change(undefined)}
            >
              {t('set.detail.clearPlacement')}
            </Button>
          )}
        </span>
        <small className="set-detail-hint">{t('set.detail.updatePlacementNote')}</small>
        {tabNote && <span className="set-info">{t('set.update.tabNote')}</span>}
        {pickNotes.includes('minimized') && (
          <span className="set-note">{t('set.detail.minimizedPicked')}</span>
        )}
        {pickNotes.includes('minimizedNotUpdated') && (
          <span className="set-note">{t('set.detail.minimizedNotUpdated')}</span>
        )}
        {pickNotes.includes('elevated') && (
          <span className="set-note">{t('set.update.elevatedNote')}</span>
        )}
      </div>
      {placement ? (
        <label className="set-detail-label" htmlFor={`${idPrefix}-desktop`}>
          {t('set.detail.desktop')}
        </label>
      ) : (
        <span className="set-detail-label">{t('set.detail.desktop')}</span>
      )}
      <span className="set-detail-pair">
        {desktopInput}
        <label className="set-detail-check">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => change(placement, e.target.checked)}
          />
          {t('set.detail.pinToAllDesktops')}
        </label>
      </span>
      <WindowPlacementPickModal
        windows={choices}
        desktopCount={desktopCount}
        screens={screens}
        desktopNames={desktopNames}
        onClose={() => setChoices([])}
        onPick={record}
      />
    </div>
  );
};

/** 開くときの動きの値（セットの行・単一アイテムで同じキー） */
export interface OpenBehaviorValue {
  ifOpen?: 'move' | 'openNew';
  activateWindow?: boolean;
  waitSeconds?: number;
}

interface OpenBehaviorFieldsProps extends OpenBehaviorValue {
  idPrefix: string;
  /** ウィンドウ位置があるか（無ければ「前面に出す」「待つ秒数」を出さない） */
  hasPlacement: boolean;
  /** 開くものがあるか（無ければ「開いていたら」「待つ秒数」を出さない） */
  opensSomething?: boolean;
  /** 「前面に出す」の既定（セットの行は出さない＝false、単一アイテムは出す＝true）。既定の値は保存しない */
  activateByDefault: boolean;
  onChange: (patch: OpenBehaviorValue) => void;
}

/** 開くときの動き（開いていたら・前面に出す・ウィンドウが出るのを待つ（秒）） */
export const OpenBehaviorFields: React.FC<OpenBehaviorFieldsProps> = ({
  idPrefix,
  ifOpen,
  activateWindow,
  waitSeconds,
  hasPlacement,
  opensSomething = true,
  activateByDefault,
  onChange,
}) => {
  const { t } = useTranslation();
  if (!opensSomething && !hasPlacement) return null;
  const activated = activateWindow ?? activateByDefault;
  return (
    <div className="set-detail-group">
      <div className="set-detail-group-title">{t('set.detail.behavior')}</div>
      {opensSomething && (
        <>
          <label className="set-detail-label" htmlFor={`${idPrefix}-ifopen`}>
            {t('set.detail.ifOpen')}
          </label>
          <select
            id={`${idPrefix}-ifopen`}
            value={ifOpen ?? 'move'}
            onChange={(e) =>
              onChange({ ifOpen: e.target.value === 'openNew' ? 'openNew' : undefined })
            }
          >
            <option value="move">{t('set.detail.ifOpenMove')}</option>
            <option value="openNew">{t('set.detail.ifOpenNew')}</option>
          </select>
        </>
      )}
      {hasPlacement && (
        <>
          <label className="set-detail-label" htmlFor={`${idPrefix}-activate`}>
            {t('set.detail.activate')}
          </label>
          <select
            id={`${idPrefix}-activate`}
            value={activated ? 'yes' : 'no'}
            onChange={(e) => {
              const yes = e.target.value === 'yes';
              // 既定と同じ値は書かない（セットは「出さない」、単一アイテムは「出す」が既定）
              onChange({ activateWindow: yes === activateByDefault ? undefined : yes });
            }}
          >
            <option value="no">{t('set.detail.activateNo')}</option>
            <option value="yes">{t('set.detail.activateYes')}</option>
          </select>
        </>
      )}
      {hasPlacement && opensSomething && (
        <>
          <label className="set-detail-label" htmlFor={`${idPrefix}-wait`}>
            {t('set.detail.wait')}
          </label>
          <input
            id={`${idPrefix}-wait`}
            type="number"
            min={1}
            placeholder="30"
            value={waitSeconds ?? ''}
            onChange={(e) =>
              onChange({
                waitSeconds:
                  e.target.value === '' || Number(e.target.value) <= 0
                    ? undefined
                    : Number(e.target.value),
              })
            }
          />
        </>
      )}
    </div>
  );
};
