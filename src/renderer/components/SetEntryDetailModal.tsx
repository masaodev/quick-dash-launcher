/**
 * 画面: セットの行の詳細
 * 画面仕様: docs/screens/set-editor-modals.md#5-行の詳細
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { SetEntry } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import { isUnresolvedEntry } from '@common/utils/setWindowMatching';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { useWindowEnvironment } from '../hooks/useWindowEnvironment';
import {
  catalogItemToEntry,
  describeSetEntry,
  entryOpensAsTab,
  SET_KIND_ICONS,
  usesItemSwitch,
  type SetCatalogItem,
} from '../utils/setEditing';
import '../styles/components/SetEditor.css';

import SetItemPickerModal from './SetItemPickerModal';
import WindowSelectorModal from './WindowSelectorModal';
import {
  OpenBehaviorFields,
  orUndefined,
  pickFromWindow,
  WindowMatchFields,
  WindowPlacementFields,
  withoutDesktop,
  type WindowPickNote,
} from './WindowSwitchFields';
import { Button } from './ui';

/** 行が開くものの持ち方（画面の選択肢） */
type OpenKind = 'none' | 'item' | 'path';

function openKindOf(entry: SetEntry): OpenKind {
  if (entry.itemId || isUnresolvedEntry(entry)) return 'item';
  return entry.open ? 'path' : 'none';
}

interface SetEntryDetailModalProps {
  entry: SetEntry | null;
  catalog: ReadonlyMap<string, SetCatalogItem>;
  /** 行が開くアイテムを選ぶときの一覧（追加の画面と同じ並び） */
  catalogList: SetCatalogItem[];
  screens: readonly ScreenArea[];
  onClose: () => void;
  onChange: (entry: SetEntry) => void;
}

/**
 * セットの行の詳細（開くもの・動かすウィンドウ・位置・開くときの動き）
 */
const SetEntryDetailModal: React.FC<SetEntryDetailModalProps> = ({
  entry,
  catalog,
  catalogList,
  screens,
  onClose,
  onChange,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<SetEntry | null>(entry);
  const [picking, setPicking] = useState(false);
  const [pickingItem, setPickingItem] = useState(false);
  /** 「アイテム」を選んだが、まだアイテムを選んでいない間も選択肢を保つ */
  const [openKind, setOpenKind] = useState<OpenKind>(entry ? openKindOf(entry) : 'none');
  /** 最後に選んだウィンドウについて知らせること */
  const [pickNotes, setPickNotes] = useState<WindowPickNote[]>([]);
  /** 今開いているウィンドウ・仮想デスクトップ（別の行を開いたら読み直す） */
  const { windows, desktopCount, desktopNames } = useWindowEnvironment({
    active: entry !== null,
    reloadKey: entry,
  });

  useEffect(() => {
    setDraft(entry);
    setOpenKind(entry ? openKindOf(entry) : 'none');
    setPickNotes([]);
  }, [entry]);

  const close = () => {
    if (draft) {
      // 「パス」を選んで空のままなら、開くものは無し（動かすだけ）にする
      let next: SetEntry =
        draft.open && draft.open.path.trim() === '' ? { ...draft, open: undefined } : draft;
      // 開くものも動かすウィンドウも位置も無い行は何もできない（名前だけ残った行と同じ形になる）ので、
      // 開くものを外した・選ばなかったときは元の開くものに戻す
      if (!next.itemId && !next.open && !next.window && !next.placement && entry) {
        next = { ...next, itemId: entry.itemId, open: entry.open };
      }
      onChange(next);
    }
    onClose();
  };
  // draft が入って画面を描いてからフォーカスを移す（先に呼ぶと ref が空でフォーカスが下の画面に残る）
  useModalKeyboard({ isOpen: entry !== null && draft !== null, modalRef, onClose: close });

  if (!entry || !draft) return null;

  const view = describeSetEntry(draft, catalog);
  const update = (patch: Partial<SetEntry>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  const changeOpenKind = (kind: OpenKind) => {
    setOpenKind(kind);
    if (kind === 'path') {
      // パスに切り替えた最初は空にする（exe などを勝手に入れない）
      update({ itemId: undefined, open: draft.open ?? { path: '' } });
    } else if (kind === 'none') {
      update({ itemId: undefined, open: undefined });
    } else {
      // アイテムは選ぶまで開くもの無し（動かすだけ）のまま
      update({ open: undefined });
    }
  };
  // 名前だけ残った行（アイテムが見つからない）は、開いたときからその形のときだけ「アイテム」の行として出す
  const hasItem = !!draft.itemId || (isUnresolvedEntry(entry) && isUnresolvedEntry(draft));
  /** 動かすウィンドウが無い行は、開くものが無いと何もできないので「なし」を選べない */
  const noneDisabled = !draft.window && openKind !== 'none';
  /**
   * 行に対象ウィンドウもウィンドウ位置も無く、アイテムにウィンドウ切り替えの設定がある: 実行はアイテムの設定で動く。
   * そのことを 1 行で案内し、値は欄の薄い字で見せる（動きは変えない）
   */
  const inherited =
    openKind === 'item' && usesItemSwitch(draft, view) ? view.itemSwitch : undefined;

  return createPortal(
    <>
      <div className="modal-overlay" onClick={close}>
        <div
          className="modal-content set-detail-modal"
          onClick={(e) => e.stopPropagation()}
          ref={modalRef}
          tabIndex={-1}
          role="dialog"
          aria-label={t('set.detail.title', { name: view.name })}
        >
          <div className="set-modal-header">
            <h3>{t('set.detail.title', { name: view.name })}</h3>
          </div>
          {/* 欄は 4 つの枠にまとめる（登録画面の「ウィンドウ設定」と同じ形） */}
          <div className="set-detail-groups">
            <div className="set-detail-group">
              <div className="set-detail-group-title">{t('set.detail.open')}</div>
              <div
                className="set-detail-radios"
                role="radiogroup"
                aria-label={t('set.detail.open')}
              >
                {(['none', 'item', 'path'] as const).map((kind) => (
                  <label
                    key={kind}
                    title={
                      kind === 'none' && noneDisabled
                        ? t('set.detail.openKindNoneDisabled')
                        : undefined
                    }
                  >
                    <input
                      type="radio"
                      name="set-detail-open-kind"
                      checked={openKind === kind}
                      disabled={kind === 'none' && noneDisabled}
                      onChange={() => changeOpenKind(kind)}
                    />
                    {t(
                      kind === 'none'
                        ? 'set.detail.openKindNone'
                        : kind === 'item'
                          ? 'set.detail.openKindItem'
                          : 'set.detail.openKindPath'
                    )}
                  </label>
                ))}
              </div>
              {openKind === 'item' && (
                <>
                  <span className="set-detail-label">{t('set.detail.item')}</span>
                  {hasItem ? (
                    <span className="set-detail-picked">
                      <span className="set-row-icon">
                        {view.icon ? (
                          <img src={view.icon} alt="" />
                        ) : (
                          (SET_KIND_ICONS[view.kind] ?? '📄')
                        )}
                      </span>
                      <span className="set-row-name" title={view.path}>
                        <span className="set-row-title-text">{view.name}</span>
                        {view.path && <span className="set-row-details">{view.path}</span>}
                      </span>
                      <Button variant="secondary" size="sm" onClick={() => setPickingItem(true)}>
                        {t('set.detail.otherItem')}
                      </Button>
                    </span>
                  ) : (
                    <span>
                      <Button variant="secondary" size="sm" onClick={() => setPickingItem(true)}>
                        {t('set.detail.pickItem')}
                      </Button>
                    </span>
                  )}
                  {hasItem && (
                    <>
                      <span />
                      <small className="set-detail-hint">
                        {view.missing ? t('set.detail.openMissing') : t('set.detail.itemNote')}
                      </small>
                    </>
                  )}
                </>
              )}
              {openKind === 'path' && draft.open && (
                <>
                  <label className="set-detail-label" htmlFor="set-detail-path">
                    {t('set.detail.path')}
                  </label>
                  <input
                    id="set-detail-path"
                    type="text"
                    placeholder={t('register.pathPlaceholder')}
                    value={draft.open.path}
                    onChange={(e) => update({ open: { ...draft.open!, path: e.target.value } })}
                  />
                  <label className="set-detail-label" htmlFor="set-detail-args">
                    {t('set.detail.args')}
                  </label>
                  <input
                    id="set-detail-args"
                    type="text"
                    placeholder={t('register.argsPlaceholder')}
                    value={draft.open.args ?? ''}
                    onChange={(e) =>
                      update({ open: { ...draft.open!, args: orUndefined(e.target.value) } })
                    }
                  />
                  <span />
                  <small className="set-detail-hint">{t('set.detail.pathNote')}</small>
                </>
              )}
            </div>

            {inherited && (
              <p className="set-detail-inherit">
                {t('set.detail.inheritNote', { name: view.name })}
              </p>
            )}

            <WindowMatchFields
              idPrefix="set-detail"
              value={draft.window}
              initial={entry.window}
              windows={windows}
              lead={t('set.detail.findLead')}
              onPickWindow={() => setPicking(true)}
              onChange={(window) => update({ window })}
              inherited={inherited?.window}
            />

            <WindowPlacementFields
              idPrefix="set-detail"
              placement={draft.placement}
              pinToAllDesktops={draft.pinToAllDesktops}
              match={draft.window}
              windows={windows}
              desktopCount={desktopCount}
              screens={screens}
              desktopNames={desktopNames}
              onChange={update}
              onUpdated={setPickNotes}
              tabNote={entryOpensAsTab(view)}
              pickNotes={pickNotes}
              inheritedPlacement={inherited?.placement}
            />

            <OpenBehaviorFields
              idPrefix="set-detail"
              ifOpen={draft.ifOpen}
              activateWindow={draft.activateWindow}
              waitSeconds={draft.waitSeconds}
              hasPlacement={!!draft.placement}
              activateByDefault={false}
              onChange={update}
            />
          </div>
          <div className="modal-actions">
            <Button variant="primary" onClick={close}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </div>
      <SetItemPickerModal
        isOpen={pickingItem}
        single
        catalog={catalogList}
        addedKeys={new Set()}
        onClose={() => setPickingItem(false)}
        onAdd={([item]) => {
          if (!item) return;
          // 指す先だけを差し替え、動かすウィンドウ・位置・行の名前は残す
          const target = catalogItemToEntry(item);
          update({ itemId: target.itemId, open: target.open });
          // フォルダ取込の展開分は id を持たずパスで入るので、選択肢も「パス」にする
          if (!target.itemId) setOpenKind('path');
        }}
      />
      <WindowSelectorModal
        isOpen={picking}
        onClose={() => setPicking(false)}
        onSelect={(w) => {
          setPicking(false);
          const picked = pickFromWindow(w, desktopCount);
          // 最小化中は座標が画面の外になるので、対象ウィンドウだけ取る
          update(
            picked.placement
              ? {
                  window: picked.window,
                  placement: draft.pinToAllDesktops
                    ? withoutDesktop(picked.placement)
                    : picked.placement,
                }
              : { window: picked.window }
          );
          setPickNotes(picked.notes);
        }}
      />
    </>,
    document.body
  );
};

export default SetEntryDetailModal;
