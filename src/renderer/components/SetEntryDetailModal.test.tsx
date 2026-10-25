import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
