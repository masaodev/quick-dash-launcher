import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import ConfirmDialog from './ConfirmDialog';

function renderDialog(props: Partial<ComponentProps<typeof ConfirmDialog>> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const result = render(
    <ConfirmDialog
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      message="行を削除しますか？"
      {...props}
    />
  );
  return { ...result, onClose, onConfirm };
}

describe('ConfirmDialog', () => {
  it('閉じているときは何も描かない', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });

  it('本文と既定の見出し・ボタンの文言を出し、指定があればそれに替える', () => {
    const { rerender, onClose, onConfirm } = renderDialog();
    expect(screen.getByTestId('confirm-dialog').querySelector('.confirm-body p')?.textContent).toBe(
      '行を削除しますか？'
    );
    expect(screen.getByRole('heading').textContent).toBe('確認');
    expect(screen.getByTestId('confirm-dialog-cancel-button').textContent).toBe('キャンセル');
    expect(screen.getByTestId('confirm-dialog-confirm-button').textContent).toBe('OK');

    rerender(
      <ConfirmDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        message="本文"
        title="削除の確認"
        confirmText="削除する"
        cancelText="やめる"
      />
    );
    expect(screen.getByRole('heading').textContent).toBe('削除の確認');
    expect(screen.getByTestId('confirm-dialog-cancel-button').textContent).toBe('やめる');
    expect(screen.getByTestId('confirm-dialog-confirm-button').textContent).toBe('削除する');
  });

  it('確定ボタンで onConfirm、キャンセル・オーバーレイで onClose を呼び、中身のクリックでは何もしない', () => {
    const { onClose, onConfirm } = renderDialog();

    fireEvent.click(screen.getByTestId('confirm-dialog'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('confirm-dialog-confirm-button'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('confirm-dialog-cancel-button'));
    fireEvent.click(screen.getByTestId('confirm-dialog-overlay'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Esc キーで onClose、Enter キーで onConfirm を呼ぶ', () => {
    const { onClose, onConfirm } = renderDialog();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('閉じたあとはキーを受けない', () => {
    const { rerender, onClose, onConfirm } = renderDialog();
    rerender(
      <ConfirmDialog isOpen={false} onClose={onClose} onConfirm={onConfirm} message="本文" />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('danger で確定ボタンを危険の見た目にし、warning を赤字の注意として出す', () => {
    renderDialog({ danger: true, warning: '元に戻せません' });
    expect(screen.getByTestId('confirm-dialog').classList.contains('confirm-danger')).toBe(true);
    expect(screen.getByTestId('confirm-dialog-warning').textContent).toBe('元に戻せません');
  });

  it('チェックボックスを出し、変更を onCheckboxChange に渡す', () => {
    const onCheckboxChange = vi.fn();
    renderDialog({
      showCheckbox: true,
      checkboxLabel: '次から確認しない',
      checkboxChecked: false,
      onCheckboxChange,
    });
    expect(screen.getByText('次から確認しない')).toBeTruthy();
    fireEvent.click(screen.getByTestId('confirm-dialog-checkbox'));
    expect(onCheckboxChange).toHaveBeenCalledWith(true);
  });

  it('asPage では外側をクリックしても閉じない（独立した確認ウィンドウの中身）', () => {
    const { onClose } = renderDialog({ asPage: true });
    const outer = screen.getByTestId('confirm-dialog-overlay');
    expect(outer.classList.contains('confirm-window-page')).toBe(true);
    expect(screen.getByTestId('confirm-dialog').classList.contains('confirm-window-content')).toBe(
      true
    );
    fireEvent.click(outer);
    expect(onClose).not.toHaveBeenCalled();
  });
});
