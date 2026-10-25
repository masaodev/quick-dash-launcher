import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SetEntry, WindowInfo } from '@common/types';

import type { SetCatalogItem } from '../utils/setEditing';

import SetEntryDetailModal from './SetEntryDetailModal';

const screens = [
  {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  },
];

const todoWindow: WindowInfo = {
  hwnd: 1,
  title: 'Microsoft To Do',
  x: 960,
  y: 0,
  width: 960,
  height: 1040,
  processId: 1,
  isVisible: true,
  processName: 'ApplicationFrameHost.exe',
  desktopNumber: 1,
};

/** パスの無い単一アイテム（対象ウィンドウだけを持つ） */
const todo: SetCatalogItem = {
  key: 'todo1aaa',
  id: 'todo1aaa',
  displayName: 'MS To Do',
  kind: 'window',
  path: '',
  groupName: 'メイン',
  sameGroup: true,
  itemSwitch: { window: { processName: 'ApplicationFrameHost.exe', title: 'Microsoft To Do' } },
  pathless: true,
};

describe('SetEntryDetailModal（📍 ウィンドウ位置を更新）', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        getAllWindowsAllDesktops: async () => [todoWindow],
        getVirtualDesktopInfo: async () => ({ supported: false, desktopCount: 0 }),
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI');
  });

  it('行に対象ウィンドウが無いパスの無い単一アイテムの行は、アイテムの対象ウィンドウで位置だけを記録する', async () => {
    const entry: SetEntry = {
      itemId: 'todo1aaa',
      placement: { x: 0, y: 0, width: 960, height: 1040 },
    };
    const onChange = vi.fn();
    render(
      <SetEntryDetailModal
        entry={entry}
        catalog={new Map([['todo1aaa', todo]])}
        catalogList={[todo]}
        screens={screens}
        onClose={vi.fn()}
        onChange={onChange}
      />
    );
    const button = screen.getByRole('button', {
      name: '📍 ウィンドウ位置を更新',
    }) as HTMLButtonElement;
    // 開いているウィンドウを読み終えると押せるようになる
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(/右半分/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    // 行には対象ウィンドウを書かない（アイテムの対象ウィンドウを借りたまま）
    expect(onChange).toHaveBeenCalledWith({
      itemId: 'todo1aaa',
      placement: { x: 960, y: 0, width: 960, height: 1040 },
    });
  });
});

describe('SetEntryDetailModal（名前の枠）', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        getAllWindowsAllDesktops: async () => [],
        getVirtualDesktopInfo: async () => ({ supported: false, desktopCount: 0 }),
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI');
  });

  async function renderDetail(entry: SetEntry) {
    const onChange = vi.fn();
    render(
      <SetEntryDetailModal
        entry={entry}
        catalog={new Map([['todo1aaa', todo]])}
        catalogList={[todo]}
        screens={screens}
        onClose={vi.fn()}
        onChange={onChange}
      />
    );
    await act(async () => {});
    const input = screen.getByRole('textbox', { name: '名前' }) as HTMLInputElement;
    const close = () => fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    return { onChange, input, close };
  }

  const moveOnly: SetEntry = {
    window: { processName: 'Obsidian.exe', title: 'TODOキャンパス - vault - Obsidian 1.14.4' },
    placement: { x: 0, y: 0, width: 960, height: 1040 },
  };

  it('入れた名前は前後の空白を落として行の名前にし、見出しも変わる', async () => {
    const { onChange, input, close } = await renderDetail(moveOnly);
    expect(input.placeholder).toBe('自動: TODOキャンパス - vault');
    fireEvent.change(input, { target: { value: '  TODO を見る ' } });
    expect(screen.getByRole('heading', { name: '行の詳細: TODO を見る' })).toBeTruthy();
    close();
    expect(onChange).toHaveBeenCalledWith({ ...moveOnly, label: 'TODO を見る' });
  });

  it('空にして閉じると名前を持たせない。「↺ 自動の名前」は自動と違う名前のときだけ出て、押すと空にする', async () => {
    const { onChange, input, close } = await renderDetail({
      ...moveOnly,
      label: 'TODOキャンパス - vault - Obsidian 1.14.4',
    });
    fireEvent.click(screen.getByRole('button', { name: '↺ 自動の名前' }));
    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: '↺ 自動の名前' })).toBeNull();
    fireEvent.change(input, { target: { value: 'TODOキャンパス - vault' } });
    expect(screen.queryByRole('button', { name: '↺ 自動の名前' })).toBeNull();
    fireEvent.change(input, { target: { value: '   ' } });
    close();
    const saved = onChange.mock.calls[0][0] as SetEntry;
    expect(saved).toEqual(moveOnly);
    expect('label' in saved).toBe(false);
  });

  it('パスの行は、空のときパスの最後の部分を自動の名前として出す', async () => {
    const { input } = await renderDetail({ open: { path: 'C:\\tasks\\全体ビュー.md' } });
    expect(input.placeholder).toBe('自動: 全体ビュー.md');
    expect(screen.getByText(/空にするとパスの最後の部分になります/)).toBeTruthy();
  });

  it('アイテムを指す行は入力できず、アイテムの名前を出す（行の名前は触らない）', async () => {
    const entry: SetEntry = { itemId: 'todo1aaa', label: '前の名前 ' };
    const { onChange, input, close } = await renderDetail(entry);
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('アイテムの名前: MS To Do');
    close();
    expect(onChange).toHaveBeenCalledWith(entry);
  });
});
