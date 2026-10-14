import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { SetEntry } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import { decideWindowMatch, placementFromWindow } from '@common/utils/setWindowMatching';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import {
  describeSetEntry,
  entryOpensAsTab,
  placementText,
  windowPickNotes,
  type SetCatalogItem,
} from '../utils/setEditing';
import '../styles/components/SetEditor.css';

import WindowSelectorModal from './WindowSelectorModal';
import { Button } from './ui';

interface SetEntryDetailModalProps {
  entry: SetEntry | null;
  catalog: ReadonlyMap<string, SetCatalogItem>;
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
  screens,
  onClose,
  onChange,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<SetEntry | null>(entry);
  const [picking, setPicking] = useState(false);
  /** 最後に選んだウィンドウについて知らせること */
  const [pickNotes, setPickNotes] = useState<Array<'minimized' | 'elevated'>>([]);

  useEffect(() => {
    setDraft(entry);
    setPickNotes([]);
  }, [entry]);
  const close = () => {
    if (draft) onChange(draft);
    onClose();
  };
  useModalKeyboard({ isOpen: entry !== null, modalRef, onClose: close });

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
              <p className="set-detail-text">
                {view.missing
                  ? t('set.detail.openMissing')
                  : view.holding === 'ref'
                    ? t('set.detail.openRef', { name: view.name })
                    : view.holding === 'own'
                      ? t('set.detail.openOwn')
                      : t('set.detail.openNone')}
              </p>
              {draft.open && (
                <>
                  <label className="set-detail-label" htmlFor="set-detail-path">
                    {t('set.detail.path')}
                  </label>
                  <input
                    id="set-detail-path"
                    type="text"
                    value={draft.open.path}
                    onChange={(e) => update({ open: { ...draft.open!, path: e.target.value } })}
                  />
                  <label className="set-detail-label" htmlFor="set-detail-args">
                    {t('set.detail.args')}
                  </label>
                  <input
                    id="set-detail-args"
                    type="text"
                    value={draft.open.args ?? ''}
                    onChange={(e) =>
                      update({ open: { ...draft.open!, args: orUndefined(e.target.value) } })
                    }
                  />
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
              <label className="set-detail-label" htmlFor="set-detail-title">
                {t('set.detail.windowTitle')}
              </label>
              <input
                id="set-detail-title"
                type="text"
                placeholder={t('set.detail.windowTitlePlaceholder')}
                value={draft.window?.title ?? ''}
                onChange={(e) => updateWindow({ title: orUndefined(e.target.value) })}
              />
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
      <WindowSelectorModal
        isOpen={picking}
        onClose={() => setPicking(false)}
        onSelect={(w) => {
          // 最小化中は座標が画面の外になるので、動かすウィンドウだけ取る
          update(
            w.windowState === 'minimized'
              ? { window: decideWindowMatch(w, [w]) }
              : { window: decideWindowMatch(w, [w]), placement: placementFromWindow(w) }
          );
          setPickNotes(windowPickNotes(w));
          setPicking(false);
        }}
      />
    </>,
    document.body
  );
};

export default SetEntryDetailModal;
