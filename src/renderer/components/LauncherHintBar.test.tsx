import { describe, it, expect, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import i18next from 'i18next';

import LauncherHintBar from './LauncherHintBar';

function hintTexts(): string[] {
  return Array.from(screen.getByTestId('keyboard-hint-bar').querySelectorAll('strong')).map(
    (strong) => strong.textContent ?? ''
  );
}

describe('LauncherHintBar', () => {
  it('通常モードは編集・親フォルダ・検索履歴を出し、タブが無ければ Tab は出さない', () => {
    render(
      <LauncherHintBar searchMode="normal" canSwitchDataFileTab={false} canMoveToDesktop={false} />
    );
    expect(hintTexts()).toEqual(['F2', 'Shift+Enter', 'Ctrl+↑/↓']);
    expect(screen.getByTestId('keyboard-hint-bar').textContent).toBe(
      'F2:編集\u3000Shift+Enter:親フォルダを開く\u3000Ctrl+↑/↓:検索履歴'
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
    expect(hintTexts()).toEqual(['Ctrl+D', 'Ctrl+P', 'Shift+↑/↓', 'F5']);
    rerender(<LauncherHintBar searchMode="window" canSwitchDataFileTab canMoveToDesktop />);
    expect(hintTexts()).toEqual(['Ctrl+D', 'Ctrl+P', 'Shift+↑/↓', 'F5', 'Ctrl+←/→']);
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
      'Ctrl+D:3 件を閉じる　Ctrl+P:3 件を全デスクトップ表示/解除　Esc:選択を外す'
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
    expect(hintTexts()).toEqual(['Ctrl+D', 'Shift+↑/↓', 'F5']);
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

  describe('英語', () => {
    afterEach(async () => {
      await i18next.changeLanguage('ja');
    });

    it('表示言語が英語なら英語で出し、件数を差し込むこと', async () => {
      await i18next.changeLanguage('en');
      render(
        <LauncherHintBar
          searchMode="window"
          canSwitchDataFileTab={false}
          canMoveToDesktop={false}
          markedCount={2}
        />
      );
      expect(screen.getByTestId('keyboard-hint-bar').textContent).toBe(
        'Ctrl+D:Close 2　Ctrl+P:Show 2 on all desktops / undo　Esc:Clear selection'
      );
    });

    it('表示中に言語を切り替えたら描き直すこと', async () => {
      render(
        <LauncherHintBar
          searchMode="normal"
          canSwitchDataFileTab={false}
          canMoveToDesktop={false}
        />
      );
      expect(screen.getByTestId('keyboard-hint-bar').textContent).toContain('親フォルダを開く');
      await act(async () => {
        await i18next.changeLanguage('en');
      });
      expect(screen.getByTestId('keyboard-hint-bar').textContent).toContain(
        'Open containing folder'
      );
    });
  });
});
