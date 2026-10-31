/**
 * 画面: ウィンドウ位置を記録するウィンドウを選ぶ（「📍 ウィンドウ位置を更新」で、合うウィンドウが 2 つ以上あるとき）
 * 画面仕様: docs/screens/set-editor-modals.md#55-ウィンドウ位置を更新
 */
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { WindowInfo } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { windowPlacementText } from '../utils/setEditing';
import '../styles/components/SetEditor.css';

import { WindowMinimap } from './PlacementMinimap';
import { Button } from './ui';

interface WindowPlacementPickModalProps {
  /** 選べるウィンドウ（今の条件に合うものだけ）。空なら閉じている */
  windows: readonly WindowInfo[];
  desktopCount: number;
  screens: readonly ScreenArea[];
  desktopNames: Readonly<Record<number, string | undefined>>;
  onClose: () => void;
  onPick: (window: WindowInfo) => void;
}

const WindowPlacementPickModal: React.FC<WindowPlacementPickModalProps> = ({
  windows,
  desktopCount,
  screens,
  desktopNames,
  onClose,
  onPick,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const isOpen = windows.length > 0;
  const [selected, setSelected] = useState(0);
  // 選べるウィンドウが変わったら先頭を選び直す。useEffect で戻すと、開いた直後に選んだものが
  // 後から走る effect で先頭に戻ることがある（単体テストを全件流して重いときに起きた）ので、描画中に戻す
  const [shownWindows, setShownWindows] = useState(windows);
  if (windows !== shownWindows) {
    setShownWindows(windows);
    setSelected(0);
  }
  useModalKeyboard({ isOpen, modalRef, onClose });

  if (!isOpen) return null;
  const minimized = t('set.addWindows.minimized');

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content set-placement-pick-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-label={t('set.detail.pickPlacementTitle')}
      >
        <div className="set-modal-header">
          <h3>{t('set.detail.pickPlacementTitle')}</h3>
        </div>
        <div className="set-placement-pick-list" role="radiogroup">
          {windows.map((w, index) => {
            const place =
              w.windowState === 'minimized'
                ? minimized
                : `📍 ${windowPlacementText(w, screens, desktopCount, desktopNames)}`;
            return (
              <label key={String(w.hwnd)} className="set-placement-pick-row">
                <input
                  type="radio"
                  name="set-placement-pick"
                  checked={selected === index}
                  onChange={() => setSelected(index)}
                />
                {/* 図は行の頭の決まった幅の列に置き、行ごとに縦をそろえる（最小化中は空ける） */}
                <span className="set-row-map">
                  {w.windowState !== 'minimized' && (
                    <WindowMinimap
                      window={w}
                      screens={screens}
                      desktopCount={desktopCount}
                      desktopNames={desktopNames}
                    />
                  )}
                </span>
                <span className="set-row-name">
                  <span className="set-row-title-text">{w.title}</span>
                  <span className="set-row-details set-placement-pick-details">
                    {w.processName && <span>{w.processName}</span>}
                    <span>{place}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => onPick(windows[selected] ?? windows[0])}>
            {t('set.detail.pickPlacementConfirm')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WindowPlacementPickModal;
