import React from 'react';

import '../../styles/components/Button.css';

/**
 * ボタンの種類（使い分けは docs/architecture/ui-components.md）
 * - primary: 確定・保存・登録などの主操作。1 つの領域に 1 個まで
 * - secondary: キャンセル・閉じる・補助の操作
 * - danger: 削除などの危険な操作（赤の枠）
 * - danger-solid: 元に戻せない操作の最終確認（確認ダイアログの確定ボタンだけ）
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-solid';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps): React.ReactElement {
  const classNames = [
    'btn',
    `btn-${variant}`,
    size !== 'md' && `btn-${size}`,
    fullWidth && 'btn-full-width',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classNames} {...props}>
      {children}
    </button>
  );
}
