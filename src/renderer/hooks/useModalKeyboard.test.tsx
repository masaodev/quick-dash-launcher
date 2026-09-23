import { useRef, useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { useModalKeyboard } from './useModalKeyboard';

afterEach(cleanup);

/** テスト用のモーダル。onClose は毎レンダー新しい関数を渡す */
function TestModal({ onClose }: { onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  useModalKeyboard({ isOpen: true, modalRef, onClose: () => onClose() });

  return (
    <div ref={modalRef} tabIndex={-1} data-testid="modal">
      <textarea data-testid="memo" value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

describe('useModalKeyboard', () => {
  it('テキストエリアでの Enter は止めない（改行できる）こと', () => {
    render(<TestModal onClose={vi.fn()} />);
    const memo = screen.getByTestId('memo');
    memo.focus();

    const allowed = fireEvent.keyDown(memo, { key: 'Enter' });
    expect(allowed).toBe(true);
  });

  it('入力欄の外のキーは既定動作を止めること', () => {
    render(<TestModal onClose={vi.fn()} />);
    screen.getByTestId('modal').focus();

    const allowed = fireEvent.keyDown(screen.getByTestId('modal'), { key: 'Enter' });
    expect(allowed).toBe(false);
  });

  it('再レンダーでモーダルへフォーカスを移し直さないこと', () => {
    render(<TestModal onClose={vi.fn()} />);
    const memo = screen.getByTestId('memo');
    memo.focus();

    // 入力で再レンダーが起き、onClose も新しい関数になる
    fireEvent.change(memo, { target: { value: 'abc' } });
    expect(document.activeElement).toBe(memo);
  });

  it('Escape では最新の onClose を呼ぶこと', () => {
    const onClose = vi.fn();
    const { rerender } = render(<TestModal onClose={vi.fn()} />);
    rerender(<TestModal onClose={onClose} />);

    fireEvent.keyDown(screen.getByTestId('modal'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
