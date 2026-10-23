import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SetupFirstLaunch } from './SetupFirstLaunch';

const changeHotkey = vi.fn();
const isItemSearchHotkeyAvailable = vi.fn();
let firePressed: (() => void) | null = null;

beforeEach(() => {
  changeHotkey.mockReset().mockResolvedValue(true);
  isItemSearchHotkeyAvailable.mockReset().mockResolvedValue(true);
  firePressed = null;
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      changeHotkey,
      isItemSearchHotkeyAvailable,
      validateHotkey: vi.fn(async () => ({ isValid: true })),
      setHotkeyRecording: vi.fn(async () => undefined),
      onFirstLaunchHotkeyPressed: (callback: () => void) => {
        firePressed = callback;
        return () => {
          firePressed = null;
        };
      },
    },
  });
});

afterEach(() => {
  // 先に片付ける（まだ走っていない useEffect が、消したあとの electronAPI を読んで落ちないように）
  cleanup();
  Reflect.deleteProperty(window, 'electronAPI');
});

async function goToTryStep() {
  fireEvent.click(screen.getByRole('button', { name: '次へ' }));
  fireEvent.click(screen.getByRole('button', { name: '次へ' }));
  await screen.findByText('準備ができました');
}

describe('SetupFirstLaunch', () => {
  it('ようこそ → ホットキー → 試してみるの順に進み、ホットキーは「次へ」で登録する', async () => {
    render(<SetupFirstLaunch onComplete={vi.fn(async () => true)} />);
    expect(screen.getByText('QuickDashLauncher へようこそ')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    expect(screen.getByText('ホットキーを決めましょう')).toBeTruthy();
    expect(changeHotkey).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    await screen.findByText('準備ができました');
    expect(changeHotkey).toHaveBeenCalledWith('Alt+Space');
  });

  it('ほかのアプリが使っているキーなら、知らせて先へ進まない', async () => {
    changeHotkey.mockResolvedValue(false);
    render(<SetupFirstLaunch onComplete={vi.fn(async () => true)} />);
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));

    await screen.findByText('このキーはほかのアプリが使っています。別のキーを選んでください。');
    expect(screen.getByText('ホットキーを決めましょう')).toBeTruthy();
  });

  it('試してみるでホットキーが押されたら ✓ を出す', async () => {
    render(<SetupFirstLaunch onComplete={vi.fn(async () => true)} />);
    await goToTryStep();
    expect(screen.getByText('押すと、ここに ✓ が出ます')).toBeTruthy();

    act(() => firePressed?.());
    expect(screen.getByText('✓ 呼び出せました')).toBeTruthy();
  });

  it('ホットキーを押すまで「使いはじめる」は押せない', async () => {
    render(<SetupFirstLaunch onComplete={vi.fn(async () => true)} />);
    await goToTryStep();
    const start = screen.getByRole('button', { name: '使いはじめる' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);

    act(() => firePressed?.());
    expect(start.disabled).toBe(false);
  });

  it('自動起動は既定でオンのまま「使いはじめる」で渡す', async () => {
    const onComplete = vi.fn(async () => true);
    render(<SetupFirstLaunch onComplete={onComplete} />);
    await goToTryStep();
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);

    act(() => firePressed?.());
    fireEvent.click(screen.getByRole('button', { name: '使いはじめる' }));
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({
        hotkey: 'Alt+Space',
        autoLaunch: true,
        itemSearchHotkey: 'Ctrl+Alt+Space',
      })
    );
  });

  it('ウィンドウ検索のキーをほかのアプリが使っていたら、閉じた欄を開いて知らせ、先へ進まない', async () => {
    isItemSearchHotkeyAvailable.mockResolvedValue(false);
    render(<SetupFirstLaunch onComplete={vi.fn(async () => true)} />);
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));

    await screen.findByText(
      'このキーはほかのアプリか起動ホットキーが使っています。別のキーを選ぶか「使わない」を押してください。'
    );
    expect(isItemSearchHotkeyAvailable).toHaveBeenCalledWith('Ctrl+Alt+Space');
    expect(screen.getByText('ホットキーを決めましょう')).toBeTruthy();
    expect((document.querySelector('.first-launch-more') as HTMLDetailsElement).open).toBe(true);
  });

  it('保存に失敗したら知らせて、「使いはじめる」「戻る」・自動起動のチェックを押せる状態に戻す', async () => {
    const onComplete = vi.fn(async () => false);
    render(<SetupFirstLaunch onComplete={onComplete} />);
    await goToTryStep();
    act(() => firePressed?.());
    fireEvent.click(screen.getByRole('button', { name: '使いはじめる' }));

    await screen.findByText(
      '設定を保存できませんでした。もう一度「使いはじめる」を押してください。'
    );
    expect(
      (screen.getByRole('button', { name: '使いはじめる' }) as HTMLButtonElement).disabled
    ).toBe(false);
    expect((screen.getByRole('button', { name: '戻る' }) as HTMLButtonElement).disabled).toBe(
      false
    );
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(false);

    // もう一度押せば保存し直す
    onComplete.mockResolvedValue(true);
    fireEvent.click(screen.getByRole('button', { name: '使いはじめる' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(2));
  });
});
