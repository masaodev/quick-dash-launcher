/**
 * 単一アイテムの「オプション設定（ウィンドウ切り替え・ウィンドウ位置）」
 *
 * 中身はセットの行の詳細と同じ部品（対象ウィンドウ・ウィンドウ位置・開くときの動き）。
 * 違いは、開くものの枠が無い（上のパスが開くもの）・説明文の主語・前面に出すの既定が「出す」、の 3 つ。
 * 画面仕様: docs/screens/register-modal.md#単一アイテムのウィンドウ切り替え
 */
import React, { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ItemWindowSwitch, LauncherItem } from '@common/types';
import { opensAsTab, type SetTargetKind } from '@common/utils/setWindowMatching';

import { useWindowEnvironment } from '../hooks/useWindowEnvironment';

import WindowSelectorModal from './WindowSelectorModal';
import {
  OpenBehaviorFields,
  pickFromWindow,
  placementSummary,
  WindowMatchFields,
  WindowPlacementFields,
  withoutDesktop,
  type WindowPickNote,
} from './WindowSwitchFields';

interface ItemWindowSwitchEditorProps {
  /** 編集中のウィンドウ切り替え */
  value: ItemWindowSwitch;
  /** 開くもの（パス）の種類。タブで開く種類なら、ウィンドウごと動く旨を添える */
  itemType: LauncherItem['type'];
  /** 開くもの（パス）があるか。無ければ「開いていたら」「待つ秒数」を出さない */
  opensSomething: boolean;
  onChange: (patch: Partial<ItemWindowSwitch>) => void;
}

const ItemWindowSwitchEditor: React.FC<ItemWindowSwitchEditorProps> = ({
  value,
  itemType,
  opensSomething,
  onChange,
}) => {
  const { t } = useTranslation();
  const idPrefix = `item-window-${useId().replace(/:/g, '')}`;
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);
  /** 開いたときの対象ウィンドウ（「元に戻す」の先・一部だけで探す候補の元） */
  const [initialWindow] = useState(value.window);
  /** 最後に選んだウィンドウについて知らせること */
  const [pickNotes, setPickNotes] = useState<WindowPickNote[]>([]);
  // たたんでいても見出しの横にウィンドウ位置を出すので、画面の並びと仮想デスクトップは最初から読む
  const { windows, desktopCount, desktopNames, screens } = useWindowEnvironment({
    active: true,
    windows: expanded,
    screens: true,
  });

  const placement = value.placement;
  // 画面の並びを読むまでは「今は無い画面」と出てしまうので、要約を出さない
  const place = screens.length > 0 ? placementSummary(placement, screens, desktopNames) : undefined;
  const summary =
    place && (value.pinToAllDesktops ? t('set.placement.onAllDesktops', { place }) : place);
  const tabNote =
    itemType !== 'clipboard' && opensAsTab(itemType as SetTargetKind) && !!value.window;

  return (
    <div className="options-section">
      <button
        type="button"
        className="options-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="toggle-icon">{expanded ? '▼' : '▶'}</span>
        <span>{t('register.windowSwitch.toggle')}</span>
        {summary && <span className="set-row-place options-toggle-summary">📍 {summary}</span>}
      </button>

      {expanded && (
        <div className="options-content" data-testid="item-window-switch">
          <div className="set-detail-groups">
            <WindowMatchFields
              idPrefix={idPrefix}
              value={value.window}
              initial={initialWindow}
              windows={windows}
              lead={t('register.windowSwitch.findLead')}
              onPickWindow={() => setPicking(true)}
              onChange={(window) => onChange({ window })}
            />

            <WindowPlacementFields
              idPrefix={idPrefix}
              placement={placement}
              pinToAllDesktops={value.pinToAllDesktops}
              match={value.window}
              windows={windows}
              desktopCount={desktopCount}
              screens={screens}
              desktopNames={desktopNames}
              onChange={onChange}
              onUpdated={setPickNotes}
              tabNote={tabNote}
              pickNotes={pickNotes}
            />

            <OpenBehaviorFields
              idPrefix={idPrefix}
              ifOpen={value.ifOpen}
              activateWindow={value.activateWindow}
              waitSeconds={value.waitSeconds}
              hasPlacement={!!placement}
              opensSomething={opensSomething}
              activateByDefault
              onChange={onChange}
            />
          </div>
        </div>
      )}

      {/* 登録画面の枠（overflow: hidden）の外に重ねる */}
      {createPortal(
        <WindowSelectorModal
          isOpen={picking}
          onClose={() => setPicking(false)}
          onSelect={(w) => {
            setPicking(false);
            const picked = pickFromWindow(w, desktopCount);
            onChange(
              picked.placement
                ? {
                    window: picked.window,
                    placement: value.pinToAllDesktops
                      ? withoutDesktop(picked.placement)
                      : picked.placement,
                  }
                : { window: picked.window }
            );
            setPickNotes(picked.notes);
          }}
        />,
        document.body
      )}
    </div>
  );
};

export default ItemWindowSwitchEditor;
