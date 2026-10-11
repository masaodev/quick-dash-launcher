import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import LauncherHintBar from './LauncherHintBar';

function hintTexts(): string[] {
  return Array.from(screen.getByTestId('keyboard-hint-bar').querySelectorAll('kbd')).map(
    (kbd) => kbd.textContent ?? ''
  );
}

describe('LauncherHintBar', () => {
  it('通常モードは起動・フォルダ・管理画面・ワークスペースを出し、タブが無ければ Tab は出さない', () => {
    render(
      <LauncherHintBar searchMode="normal" canSwitchDataFileTab={false} canMoveToDesktop={false} />
    );
    expect(hintTexts()).toEqual(['Enter', 'Shift+Enter', 'Ctrl+E', 'Ctrl+W']);
    expect(screen.getByText('管理画面')).toBeTruthy();
  });

  it('通常モードでタブが 2 つ以上あるときは Tab も出す', () => {
    render(<LauncherHintBar searchMode="normal" canSwitchDataFileTab canMoveToDesktop={false} />);
    expect(hintTexts()).toEqual(['Enter', 'Shift+Enter', 'Tab', 'Ctrl+E', 'Ctrl+W']);
  });

  it('ウィンドウ検索モードはピン留め・閉じるを出し、デスクトップのタブ表示中だけ移動を出す', () => {
    const { rerender } = render(
      <LauncherHintBar searchMode="window" canSwitchDataFileTab canMoveToDesktop={false} />
    );
    expect(hintTexts()).toEqual(['Ctrl+P', 'Ctrl+D']);
    rerender(<LauncherHintBar searchMode="window" canSwitchDataFileTab canMoveToDesktop />);
    expect(hintTexts()).toEqual(['Ctrl+P', 'Ctrl+D', 'Ctrl+←/→']);
  });
});
