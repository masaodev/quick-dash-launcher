/**
 * トーストプロバイダーコンポーネント（UI内トースト）
 *
 * react-hot-toastを使用した軽量なトースト通知を提供します。
 * ウィンドウ内での軽いフィードバック表示に使用します。
 *
 * @see docs/features/toast-notifications.md
 */

import React from 'react';
import { Toaster, ToasterProps } from 'react-hot-toast';

interface ToastProviderProps {
  /** 子要素 */
  children?: React.ReactNode;
  /** トースト表示位置 */
  position?: ToasterProps['position'];
  /** 下端からの距離（画面の下に帯がある画面では、その高さの分だけ上げて重ならないようにする） */
  bottomOffset?: string;
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
  bottomOffset = 'var(--spacing-lg)',
}) => {
  return (
    <>
      {children}
      <Toaster
        position={position}
        toastOptions={{
          // 表示時間は useToast が種類ごとに決める（src/common/constants.ts の toastDurationMs）
          // 共通の形（独立トーストの overlay.html と同じ白地のカード）。種類の色は useToast が左の帯とアイコンで足す
          style: {
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-xs)',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            background: 'var(--color-white)',
            color: 'var(--text-primary)',
            // 種類の帯（borderLeft*）を足すので、変数入りの border の一括指定は使わない（ほかの辺が消える）
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--color-gray-500)',
            borderRadius: 'var(--border-radius-sm)',
            boxShadow: 'var(--shadow)',
            maxWidth: '350px',
          },
        }}
        containerStyle={{
          // ランチャー内で適切な位置に表示
          bottom: bottomOffset,
          right: 'var(--spacing-lg)',
        }}
        gutter={8} // spacing-sm相当（8px）
      />
    </>
  );
};

export default ToastProvider;
