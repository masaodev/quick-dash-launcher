import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SetupFirstLaunch } from './SetupFirstLaunch';

const changeHotkey = vi.fn();
let firePressed: (() => void) | null = null;

beforeEach(() => {
  changeHotkey.mockReset().mockResolvedValue(true);
  firePressed = null;
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      changeHotkey,
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
    render(<SetupFirstLaunch onComplete={vi.fn()} />);
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
    render(<SetupFirstLaunch onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));

    await screen.findByText('このキーはほかのアプリが使っています。別のキーを選んでください。');
    expect(screen.getByText('ホットキーを決めましょう')).toBeTruthy();
  });

  it('試してみるでホットキーが押されたら ✓ を出す', async () => {
    render(<SetupFirstLaunch onComplete={vi.fn()} />);
    await goToTryStep();
    expect(screen.getByText('押すと、ここに ✓ が出ます')).toBeTruthy();

    act(() => firePressed?.());
    expect(screen.getByText('✓ 呼び出せました')).toBeTruthy();
  });

  it('ホットキーを押すまで「使いはじめる」は押せない', async () => {
    render(<SetupFirstLaunch onComplete={vi.fn()} />);
    await goToTryStep();
    const start = screen.getByRole('button', { name: '使いはじめる' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);

    act(() => firePressed?.());
    expect(start.disabled).toBe(false);
  });

  it('自動起動は既定でオンのまま「使いはじめる」で渡す', async () => {
    const onComplete = vi.fn();
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
});
