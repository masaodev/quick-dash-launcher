/**
 * WSグループのアイコン（窓の形で、上の帯＝タイトルバーだけをグループの色にする）。
 * メインウィンドウの一覧と、アイテム管理の WSグループのダイアログのプレビューで使う
 *
 * 選択中の行（.item.selected）では窓の線を白にして、帯が選択の色と同じでも形を残す
 *
 * @see docs/features/item-categories.md
 */
import React from 'react';
import { resolveGroupColorCss } from '@common/groupColors';

import '../styles/components/WsGroupIcon.css';

export function WsGroupIcon({ color }: { color?: string }): React.ReactElement {
  return (
    <svg className="ws-group-item-icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect
        className="ws-group-icon-frame"
        x="0.65"
        y="1.15"
        width="14.7"
        height="13.7"
        rx="1.8"
        strokeWidth="1.3"
      />
      <path
        d="M1.3 2.95 Q1.3 1.8 2.45 1.8 H13.55 Q14.7 1.8 14.7 2.95 V5.6 H1.3 Z"
        style={{ fill: resolveGroupColorCss(color) }}
      />
      <line
        className="ws-group-icon-divider"
        x1="1.3"
        y1="5.6"
        x2="14.7"
        y2="5.6"
        strokeWidth="1"
      />
    </svg>
  );
}
