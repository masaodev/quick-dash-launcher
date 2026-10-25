import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import AlertDialog from './AlertDialog';

describe('AlertDialog', () => {
  it('閉じているときは何も描かない', () => {
    render(<AlertDialog isOpen={false} onClose={vi.fn()} message="本文" />);
    expect(screen.queryByTestId('alert-dialog')).toBeNull();
  });

  it('本文と、種別ごとの既定の見出し・アイコンを出す', () => {
    const { rerender } = render(
      <AlertDialog isOpen onClose={vi.fn()} message="保存できませんでした" type="error" />
    );
    const dialog = screen.getByTestId('alert-dialog');
    expect(dialog.classList.contains('alert-error')).toBe(true);
    expect(dialog.querySelector('.alert-body p')?.textContent).toBe('保存できませんでした');
    expect(screen.getByRole('heading').textContent).toBe('エラー');
    expect(dialog.querySelector('.alert-icon')?.textContent).toBe('❌');

    rerender(<AlertDialog isOpen onClose={vi.fn()} message="本文" />);
    expect(screen.getByRole('heading').textContent).toBe('お知らせ');

    rerender(
      <AlertDialog isOpen onClose={vi.fn()} message="本文" type="warning" title="独自の見出し" />
    );
    expect(screen.getByRole('heading').textContent).toBe('独自の見出し');
  });

  it('OK ボタン・オーバーレイのクリックで閉じ、中身のクリックでは閉じない', () => {
    const onClose = vi.fn();
    render(<AlertDialog isOpen onClose={onClose} message="本文" />);

    fireEvent.click(screen.getByTestId('alert-dialog'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('alert-dialog-ok-button'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('alert-dialog-overlay'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it.each(['Escape', 'Enter'])('%s キーで閉じ、後ろの画面のキー処理には渡さない', (key) => {
    // 後ろの画面の入力欄（メイン画面の検索欄など）がフォーカスを持ち、自分のキー処理で Enter を受ける状況
    const onClose = vi.fn();
    const behind = vi.fn();
    const input = document.createElement('input');
    input.addEventListener('keydown', behind);
    document.body.appendChild(input);
    try {
      render(<AlertDialog isOpen onClose={onClose} message="本文" />);
      fireEvent.keyDown(input, { key });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(behind).not.toHaveBeenCalled();
    } finally {
      input.remove();
    }
  });

  it('閉じたあとはキーを受けない', () => {
    const onClose = vi.fn();
    const { rerender } = render(<AlertDialog isOpen onClose={onClose} message="本文" />);
    rerender(<AlertDialog isOpen={false} onClose={onClose} message="本文" />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
