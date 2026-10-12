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
      <LauncherHintBar
        searchMode="normal"
        canSwitchDataFileTab={false}
        canSwitchDesktopTab={false}
        canMoveToDesktop={false}
      />
    );
    expect(hintTexts()).toEqual(['F2', 'Shift+Enter', 'Ctrl+↑/↓']);
    expect(screen.getByTestId('keyboard-hint-bar').textContent).toBe(
      'F2:編集\u3000Shift+Enter:親フォルダーを開く\u3000Ctrl+↑/↓:検索履歴'
    );
  });

  it('通常モードでタブが 2 つ以上あるときは Tab も出す', () => {
    render(
      <LauncherHintBar
        searchMode="normal"
        canSwitchDataFileTab
        canSwitchDesktopTab={false}
        canMoveToDesktop={false}
      />
    );
    expect(hintTexts()).toEqual(['F2', 'Shift+Enter', 'Ctrl+↑/↓', 'Tab']);
  });

  it('ウィンドウ検索モードはピン留め・閉じるを出し、デスクトップのタブ表示中だけ移動を出す', () => {
    const { rerender } = render(
      <LauncherHintBar
        searchMode="window"
        canSwitchDataFileTab
        canSwitchDesktopTab={false}
        canMoveToDesktop={false}
      />
    );
    expect(hintTexts()).toEqual(['Ctrl+P', 'Ctrl+D', 'Shift+↑/↓']);
    rerender(
      <LauncherHintBar
        searchMode="window"
        canSwitchDataFileTab
        canSwitchDesktopTab
        canMoveToDesktop
      />
    );
    expect(hintTexts()).toEqual(['Ctrl+P', 'Ctrl+D', 'Tab', 'Ctrl+←/→', 'Shift+↑/↓']);
  });
  it('ウィンドウ検索で選んでいるときは、選んだものへの操作と Esc を出す', () => {
    render(
      <LauncherHintBar
        searchMode="window"
        canSwitchDataFileTab={false}
        canSwitchDesktopTab
        canMoveToDesktop={false}
        markedCount={3}
      />
    );
    expect(screen.getByTestId('keyboard-hint-bar').textContent).toBe(
      'Ctrl+D:3 件を閉じる　Ctrl+P:3 件を固定/解除　Esc:選択を外す'
    );
  });
});
