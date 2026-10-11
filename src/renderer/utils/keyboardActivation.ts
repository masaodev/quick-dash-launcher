import type React from 'react';

/**
 * クリックで動く div・th をキーボードでも動かすための onKeyDown。Enter と Space で handler を呼ぶ
 * （Space は画面のスクロールを止める）。tabIndex={0} と組み合わせて使う
 */
export function activateOnEnterOrSpace(
  handler: () => void
): (e: React.KeyboardEvent<HTMLElement>) => void {
  return (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}
