/**
 * トーストプロバイダーコンポーネント
 *
 * react-hot-toastを使用した軽量なトースト通知を提供します。
 * ウィンドウ内での軽いフィードバック表示に使用します。
 */

import React from 'react';
import { Toaster, ToasterProps } from 'react-hot-toast';

interface ToastProviderProps {
  /** 子要素 */
  children?: React.ReactNode;
  /** トースト表示位置 */
  position?: ToasterProps['position'];
}

/**
 * トーストプロバイダー
 *
 * アプリケーションのルートに配置して、トースト通知を有効にします。
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * ```
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  position = 'bottom-right',
}) => {
  return (
    <>
      {children}
      <Toaster
        position={position}
        toastOptions={{
          // デフォルトの表示時間
          duration: 3000,

          // 成功トースト（GlobalLoadingIndicatorと統一）
          success: {
            duration: 2000,
            style: {
              background: 'var(--color-white)',
              color: 'var(--text-muted)',
            },
            iconTheme: {
              primary: 'var(--color-primary)',
              secondary: 'var(--color-white)',
            },
          },

          // エラートースト
          error: {
            duration: 4000,
            style: {
              background: 'var(--color-danger)',
              color: 'var(--color-white)',
            },
            iconTheme: {
              primary: 'var(--color-white)',
              secondary: 'var(--color-danger)',
            },
          },

          // 共通スタイル（GlobalLoadingIndicatorと統一）
          style: {
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-xs)',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            border: 'var(--border-normal)',
            borderRadius: 'var(--border-radius-sm)',
            boxShadow: 'var(--shadow)',
            maxWidth: '350px',
          },
        }}
        containerStyle={{
          // メインウィンドウ内で適切な位置に表示
          bottom: 'var(--spacing-lg)',
          right: 'var(--spacing-lg)',
        }}
        gutter={8} // spacing-sm相当（8px）
      />
    </>
  );
};

export default ToastProvider;
