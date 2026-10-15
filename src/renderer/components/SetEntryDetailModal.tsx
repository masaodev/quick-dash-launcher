/**
 * 画面: セットの行の詳細
 * 画面仕様: docs/screens/set-editor-modals.md#4-行の詳細
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { SetEntry, WindowInfo } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import {
  decideWindowMatch,
  isUnresolvedEntry,
  matchesWindow,
  placementFromWindow,
} from '@common/utils/setWindowMatching';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import {
  catalogItemToEntry,
  describeSetEntry,
  entryOpensAsTab,
  placementText,
  SET_KIND_ICONS,
  titleParts,
  windowPickNotes,
  type SetCatalogItem,
} from '../utils/setEditing';
import '../styles/components/SetEditor.css';

import SetItemPickerModal from './SetItemPickerModal';
import WindowSelectorModal from './WindowSelectorModal';
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

/** 空の文字列は undefined にする（保存したときに空のキーを書かない） */
function orUndefined(value: string): string | undefined {
  return value.trim() === '' ? undefined : value;
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
  const [pickNotes, setPickNotes] = useState<Array<'minimized' | 'elevated'>>([]);
  /** 今開いているウィンドウ（タイトル欄の「今合うウィンドウ」を数える） */
  const [windows, setWindows] = useState<WindowInfo[]>([]);

  useEffect(() => {
    setDraft(entry);
    setOpenKind(entry ? openKindOf(entry) : 'none');
    setPickNotes([]);
    if (!entry) return;
    let alive = true;
    window.electronAPI
      .getAllWindowsAllDesktops()
      .then((all) => {
        if (alive) setWindows(all);
      })
      .catch(() => {
        if (alive) setWindows([]);
      });
    return () => {
      alive = false;
    };
  }, [entry]);

  /** 開いたときのタイトル（元に戻す先・候補の元） */
  const initialTitle = entry?.window?.title;
  const draftWindow = draft?.window;
  const matched = useMemo(
    () => (draftWindow ? windows.filter((w) => matchesWindow(draftWindow, w)) : []),
    [draftWindow, windows]
  );
  // 候補は開いたときのタイトルから作る。* を含む（もう一部だけにしてある）なら、今合う 1 つのウィンドウのタイトルから
  const entryWindow = entry?.window;
  const parts = useMemo(() => {
    if (!initialTitle) return [];
    if (!/[*?]/.test(initialTitle) || !entryWindow) return titleParts(initialTitle);
    const now = windows.filter((w) => matchesWindow(entryWindow, w));
    return now.length === 1 ? titleParts(now[0].title) : titleParts(initialTitle);
  }, [initialTitle, entryWindow, windows]);

  const close = () => {
    // 「パス」を選んで空のままなら、開くものは無し（動かすだけ）にする
    if (draft) {
      onChange(draft.open && draft.open.path.trim() === '' ? { ...draft, open: undefined } : draft);
    }
    onClose();
  };
  // draft が入って画面を描いてからフォーカスを移す（先に呼ぶと ref が空でフォーカスが下の画面に残る）
  useModalKeyboard({ isOpen: entry !== null && draft !== null, modalRef, onClose: close });

  if (!entry || !draft) return null;

  const view = describeSetEntry(draft, catalog);
  const update = (patch: Partial<SetEntry>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  const updateWindow = (patch: Partial<NonNullable<SetEntry['window']>>) => {
    const next = { ...(draft.window ?? {}), ...patch };
    update({ window: next.processName || next.title ? next : undefined });
  };
  const updatePlacement = (patch: Partial<NonNullable<SetEntry['placement']>>) =>
    update({ placement: { ...(draft.placement ?? {}), ...patch } });
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
  const hasItem = !!draft.itemId || isUnresolvedEntry(draft);

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
                  <label key={kind}>
                    <input
                      type="radio"
                      name="set-detail-open-kind"
                      checked={openKind === kind}
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

            <div className="set-detail-group">
              <div className="set-detail-group-title">{t('set.detail.find')}</div>
              <label className="set-detail-label" htmlFor="set-detail-process">
                {t('set.detail.processName')}
              </label>
              <input
                id="set-detail-process"
                type="text"
                placeholder={t('set.detail.processNamePlaceholder')}
                value={draft.window?.processName ?? ''}
                onChange={(e) => updateWindow({ processName: orUndefined(e.target.value) })}
              />
              <label className="set-detail-label set-detail-label-top" htmlFor="set-detail-title">
                {t('set.detail.windowTitle')}
              </label>
              {/* 欄 → 一部だけで探す候補 → 今合うウィンドウ の順。元に戻すは欄に対する操作なので欄の右 */}
              <div className="set-title-field">
                <div className="set-title-row">
                  <input
                    id="set-detail-title"
                    type="text"
                    placeholder={t('set.detail.windowTitlePlaceholder')}
                    value={draft.window?.title ?? ''}
                    onChange={(e) => updateWindow({ title: orUndefined(e.target.value) })}
                  />
                  {initialTitle && draft.window?.title !== initialTitle && (
                    <button
                      type="button"
                      className="set-title-revert"
                      onClick={() => updateWindow({ title: initialTitle })}
                    >
                      {t('set.detail.revertTitle')}
                    </button>
                  )}
                </div>
                {parts.length > 0 && (
                  <div className="set-title-parts">
                    <span>{t('set.detail.titleParts')}</span>
                    {parts.map((part) => (
                      <button
                        key={part}
                        type="button"
                        className="set-title-part"
                        onClick={() => updateWindow({ title: `*${part}*` })}
                      >
                        {part}
                      </button>
                    ))}
                  </div>
                )}
                {draft.window && (
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
              <small className="set-detail-hint">{t('set.detail.findHint')}</small>
            </div>

            <div className="set-detail-group">
              <div className="set-detail-group-title">{t('set.detail.placement')}</div>
              <span className="set-detail-label">{t('set.detail.recorded')}</span>
              <span className="set-detail-pair">
                <span className="set-row-place">
                  {draft.placement
                    ? `📍 ${placementText(draft, screens)}`
                    : t('set.detail.noPlacement')}
                </span>
                <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
                  {t('set.detail.takeFromWindow')}
                </Button>
                {draft.placement && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => update({ placement: undefined })}
                  >
                    {t('set.detail.clearPlacement')}
                  </Button>
                )}
              </span>
              {(entryOpensAsTab(view) || pickNotes.length > 0) && (
                <>
                  <span />
                  <span>
                    {entryOpensAsTab(view) && (
                      <span className="set-info">{t('set.record.tabNote')}</span>
                    )}
                    {pickNotes.includes('minimized') && (
                      <span className="set-note">{t('set.detail.minimizedPicked')}</span>
                    )}
                    {pickNotes.includes('elevated') && (
                      <span className="set-note">{t('set.record.elevatedNote')}</span>
                    )}
                  </span>
                </>
              )}
              {draft.placement && (
                <>
                  <label className="set-detail-label" htmlFor="set-detail-desktop">
                    {t('set.detail.desktop')}
                  </label>
                  <input
                    id="set-detail-desktop"
                    type="number"
                    min={1}
                    placeholder={t('set.detail.desktopKeep')}
                    value={draft.placement.virtualDesktopNumber ?? ''}
                    onChange={(e) =>
                      updatePlacement({
                        virtualDesktopNumber:
                          e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </>
              )}
            </div>

            <div className="set-detail-group">
              <div className="set-detail-group-title">{t('set.detail.behavior')}</div>
              <label className="set-detail-label" htmlFor="set-detail-ifopen">
                {t('set.detail.ifOpen')}
              </label>
              <select
                id="set-detail-ifopen"
                value={draft.ifOpen ?? 'move'}
                onChange={(e) =>
                  update({ ifOpen: e.target.value === 'openNew' ? 'openNew' : undefined })
                }
              >
                <option value="move">{t('set.detail.ifOpenMove')}</option>
                <option value="openNew">{t('set.detail.ifOpenNew')}</option>
              </select>
              {draft.placement && (
                <>
                  <label className="set-detail-label" htmlFor="set-detail-activate">
                    {t('set.detail.activate')}
                  </label>
                  <select
                    id="set-detail-activate"
                    value={draft.activateWindow === false ? 'no' : 'yes'}
                    onChange={(e) =>
                      update({ activateWindow: e.target.value === 'no' ? false : undefined })
                    }
                  >
                    <option value="yes">{t('set.detail.activateYes')}</option>
                    <option value="no">{t('set.detail.activateNo')}</option>
                  </select>
                  <label className="set-detail-label" htmlFor="set-detail-wait">
                    {t('set.detail.wait')}
                  </label>
                  <input
                    id="set-detail-wait"
                    type="number"
                    min={1}
                    placeholder="30"
                    value={draft.waitSeconds ?? ''}
                    onChange={(e) =>
                      update({
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
        onSelect={async (w) => {
          setPicking(false);
          // 同じ exe のウィンドウがほかにもあればタイトルも残すので、開いているウィンドウ全体と比べる
          const all = await window.electronAPI.getAllWindowsAllDesktops().catch(() => [w]);
          const match = decideWindowMatch(w, all.length > 0 ? all : [w]);
          // 最小化中は座標が画面の外になるので、動かすウィンドウだけ取る
          update(
            w.windowState === 'minimized'
              ? { window: match }
              : { window: match, placement: placementFromWindow(w) }
          );
          setPickNotes(windowPickNotes(w));
        }}
      />
    </>,
    document.body
  );
};

export default SetEntryDetailModal;
