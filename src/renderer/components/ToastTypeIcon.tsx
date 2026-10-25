/**
 * 知らせの種類のアイコン（色の丸に記号）。UI 内トーストと AlertDialog の見出しで使う
 *
 * 独立トースト（overlay.html）のシンプル形式と同じ記号・色にする
 *
 * @see docs/features/toast-notifications.md
 */
import React from 'react';
import type { NotificationType } from '@common/types';

import '../styles/components/Toast.css';

/** 種類ごとの記号（overlay.html の typeIcons と同じ） */
const TYPE_GLYPHS: Record<NotificationType, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

export function ToastTypeIcon({
  type,
  size = 'normal',
}: {
  type: NotificationType;
  /** large は AlertDialog の見出し用 */
  size?: 'normal' | 'large';
}): React.ReactElement {
  return (
    <span
      className={`toast-type-icon ${type}${size === 'large' ? ' large' : ''}`}
      data-testid={`toast-type-icon-${type}`}
    >
      {TYPE_GLYPHS[type]}
    </span>
  );
}
