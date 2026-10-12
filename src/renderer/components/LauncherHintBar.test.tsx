import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import LauncherHintBar from './LauncherHintBar';

function hintTexts(): string[] {
  return Array.from(screen.getByTestId('keyboard-hint-bar').querySelectorAll('strong')).map(
    (strong) => strong.textContent ?? ''
  );
}

describe('LauncherHintBar', () => {
  it('通常モードは編集・親フォルダー・検索履歴を出し、タブが無ければ Tab は出さない', () => {
    render(
      <LauncherHintBar searchMode="normal" canSwitchDataFileTab={false} canMoveToDesktop={false} />
    );
    expect(hintTexts()).toEqual(['F2', 'Shift+Enter', 'Ctrl+↑/↓']);
    expect(screen.getByTestId('keyboard-hint-bar').textContent).toBe(
      'F2:編集\u3000Shift+Enter:親フォルダーを開く\u3000Ctrl+↑/↓:検索履歴'
    );
  });

  it('通常モードでタブが 2 つ以上あるときは Tab も出す', () => {
    render(<LauncherHintBar searchMode="normal" canSwitchDataFileTab canMoveToDesktop={false} />);
    expect(hintTexts()).toEqual(['F2', 'Shift+Enter', 'Ctrl+↑/↓', 'Tab']);
  });

  it('ウィンドウ検索モードは閉じる・ピン留め・複数選択の順に出し、デスクトップのタブ表示中だけ最後に移動を出す', () => {
    const { rerender } = render(
      <LauncherHintBar searchMode="window" canSwitchDataFileTab canMoveToDesktop={false} />
    );
    expect(hintTexts()).toEqual(['Ctrl+D', 'Ctrl+P', 'Shift+↑/↓']);
    rerender(<LauncherHintBar searchMode="window" canSwitchDataFileTab canMoveToDesktop />);
    expect(hintTexts()).toEqual(['Ctrl+D', 'Ctrl+P', 'Shift+↑/↓', 'Ctrl+←/→']);
  });
  it('ウィンドウ検索で選んでいるときは、選んだものへの操作と Esc を出す', () => {
    render(
      <LauncherHintBar
        searchMode="window"
        canSwitchDataFileTab={false}
        canMoveToDesktop={false}
        markedCount={3}
      />
    );
    expect(screen.getByTestId('keyboard-hint-bar').textContent).toBe(
      'Ctrl+D:3 件を閉じる　Ctrl+P:3 件を固定/解除　Esc:選択を外す'
    );
  });

  it('仮想デスクトップ非対応の環境では、ウィンドウ検索のヒントに Ctrl+P を出さない', () => {
    const { rerender } = render(
      <LauncherHintBar
        searchMode="window"
        canSwitchDataFileTab={false}
        canMoveToDesktop={false}
        canPinWindow={false}
      />
    );
    expect(hintTexts()).toEqual(['Ctrl+D', 'Shift+↑/↓']);
    rerender(
      <LauncherHintBar
        searchMode="window"
        canSwitchDataFileTab={false}
        canMoveToDesktop={false}
        canPinWindow={false}
        markedCount={2}
      />
    );
    expect(hintTexts()).toEqual(['Ctrl+D', 'Esc']);
  });
});
