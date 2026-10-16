/**
 * ウィンドウ切り替えの欄（対象ウィンドウ・ウィンドウ位置・開くときの動き）
 *
 * セットの行の詳細（SetEntryDetailModal）と、単一アイテムの登録・編集（ItemWindowSwitchEditor）が同じ部品を使う。
 * 画面仕様: docs/screens/set-editor-modals.md#5-行の詳細・docs/screens/register-modal.md
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SetPlacement, SetWindowMatch, WindowInfo } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import { ANY_WINDOW_TITLE } from '@common/utils/windowTitle';
import {
  decideWindowMatch,
  matchesWindow,
  placementFromWindow,
} from '@common/utils/setWindowMatching';

import { placementText, titleParts, windowPickNotes } from '../utils/setEditing';
import '../styles/components/SetEditor.css';

import { Button } from './ui';

/** 空の文字列は undefined にする（保存したときに空のキーを書かない） */
export function orUndefined(value: string): string | undefined {
  return value.trim() === '' ? undefined : value;
}

/** ウィンドウ位置を言葉にする（例: 画面 1・右半分・デスクトップ 2） */
export function placementSummary(
  placement: SetPlacement | undefined,
  screens: readonly ScreenArea[],
  desktopNames?: Readonly<Record<number, string | undefined>>
): string | undefined {
  return placementText({ placement }, screens, desktopNames);
}

/**
 * 「開いているウィンドウから取り込む」で選んだウィンドウから、対象ウィンドウとウィンドウ位置を作る
 *
 * 最小化中は座標が画面の外になるので、対象ウィンドウだけ取る（placement は返さない＝前のまま）
 */
export function pickFromWindow(
  w: WindowInfo,
  desktopCount: number
): {
  window: SetWindowMatch;
  placement?: SetPlacement;
  notes: Array<'minimized' | 'elevated'>;
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
  /** 枠の下の説明（セットと単一アイテムで主語が違う） */
  hint: string;
  /** exe 名もタイトルも空になったら undefined */
  onChange: (window: SetWindowMatch | undefined) => void;
}

/** 対象ウィンドウ（exe 名・ウィンドウタイトル・一部だけで探す候補・今合うウィンドウ） */
export const WindowMatchFields: React.FC<WindowMatchFieldsProps> = ({
  idPrefix,
  value,
  initial,
  windows,
  hint,
  onChange,
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
      <div className="set-detail-group-title">{t('set.detail.find')}</div>
      <label className="set-detail-label" htmlFor={`${idPrefix}-process`}>
        {t('set.detail.processName')}
      </label>
      <input
        id={`${idPrefix}-process`}
        type="text"
        placeholder={t('set.detail.processNamePlaceholder')}
        value={value?.processName ?? ''}
        onChange={(e) => update({ processName: orUndefined(e.target.value) })}
      />
      <label className="set-detail-label set-detail-label-top" htmlFor={`${idPrefix}-title`}>
        {t('set.detail.windowTitle')}
      </label>
      {/* 欄 → 一部だけで探す候補 → 今合うウィンドウ の順。元に戻すは欄に対する操作なので欄の右 */}
      <div className="set-title-field">
        <div className="set-title-row">
          <input
            id={`${idPrefix}-title`}
            type="text"
            placeholder={t('set.detail.windowTitlePlaceholder')}
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
        {(parts.length > 0 || value?.processName) && (
          <div className="set-title-parts">
            <span>{t('set.detail.titleParts')}</span>
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
      <span />
      <small className="set-detail-hint">{hint}</small>
    </div>
  );
};

interface WindowPlacementFieldsProps {
  idPrefix: string;
  placement: SetPlacement | undefined;
  screens: readonly ScreenArea[];
  desktopNames: Readonly<Record<number, string | undefined>>;
  /** 「開いているウィンドウから取り込む」（ウィンドウを選ぶ画面を開く） */
  onTakeFromWindow: () => void;
  onChange: (placement: SetPlacement | undefined) => void;
  /** 記録したウィンドウ位置の下に添える知らせ（タブで開く・最小化中だった など）。無ければ行を出さない */
  notes?: React.ReactNode;
  /** 仮想デスクトップの欄の横に置くもの（単一アイテムの「全デスクトップに表示」）。あればウィンドウ位置が無くても行を出す */
  desktopExtra?: React.ReactNode;
  /** 仮想デスクトップの番号を入れさせない（全デスクトップに表示するとき） */
  desktopDisabled?: boolean;
}

/** ウィンドウ位置（記録したウィンドウ位置・取り込む・外す・仮想デスクトップ） */
export const WindowPlacementFields: React.FC<WindowPlacementFieldsProps> = ({
  idPrefix,
  placement,
  screens,
  desktopNames,
  onTakeFromWindow,
  onChange,
  notes,
  desktopExtra,
  desktopDisabled = false,
}) => {
  const { t } = useTranslation();
  const desktopInput = placement && (
    <input
      id={`${idPrefix}-desktop`}
      type="number"
      min={1}
      step={1}
      disabled={desktopDisabled}
      placeholder={t('set.detail.desktopKeep')}
      value={placement.virtualDesktopNumber ?? ''}
      onChange={(e) => {
        // 1 以上の整数だけ（0・負の数・小数は「変えない」と同じ空にする）
        const n = Number(e.target.value);
        onChange({
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
      <span className="set-detail-label">{t('set.detail.recorded')}</span>
      <span className="set-detail-pair">
        <span className="set-row-place">
          {placement
            ? `📍 ${placementSummary(placement, screens, desktopNames)}`
            : t('set.detail.noPlacement')}
        </span>
        <Button variant="secondary" size="sm" onClick={onTakeFromWindow}>
          {t('set.detail.takeFromWindow')}
        </Button>
        {placement && (
          <Button variant="secondary" size="sm" onClick={() => onChange(undefined)}>
            {t('set.detail.clearPlacement')}
          </Button>
        )}
      </span>
      {notes && (
        <>
          <span />
          <span>{notes}</span>
        </>
      )}
      {(placement || desktopExtra) && (
        <>
          {placement ? (
            <label className="set-detail-label" htmlFor={`${idPrefix}-desktop`}>
              {t('set.detail.desktop')}
            </label>
          ) : (
            <span className="set-detail-label">{t('set.detail.desktop')}</span>
          )}
          {desktopExtra ? (
            <span className="set-detail-pair">
              {desktopInput}
              {desktopExtra}
            </span>
          ) : (
            desktopInput
          )}
        </>
      )}
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
