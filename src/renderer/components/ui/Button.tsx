import React from 'react';

import '../../styles/components/Button.css';

export type ButtonVariant = 'primary' | 'danger' | 'info' | 'cancel';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  variant = 'info',
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
