import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { SetEntry } from '@common/types';

import SetEntriesEditor from './SetEntriesEditor';

const screens = [
  {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  },
];

describe('SetEntriesEditor（番号と 📍 の列）', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        loadDataFiles: async () => [],
        getSettings: async () => ({ dataFileTabs: [] }),
        loadCachedIcons: async () => ({}),
        ensureIcons: async () => ({}),
        getScreenAreas: async () => screens,
        getVirtualDesktopInfo: async () => ({ supported: true, desktopCount: 2, desktopNames: {} }),
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI');
  });

  /** 開いたときの読み込み（アイテム・画面・仮想デスクトップ）が終わるまで待つ */
  async function renderEditor(entries: SetEntry[]) {
    const result = render(<SetEntriesEditor entries={entries} onChange={vi.fn()} />);
    await act(async () => {});
    return result;
  }

  it('デスクトップの番号だけの位置しか無くても、番号と「デスクトップ N」を出す（図は出さない）', async () => {
    const { container } = await renderEditor([
      { open: { path: 'C:\\a.txt' }, placement: { virtualDesktopNumber: 2 } },
      { open: { path: 'C:\\b.txt' } },
    ]);
    await waitFor(() => expect(screen.getByText('📍 デスクトップ 2')).toBeTruthy());
    expect(container.querySelectorAll('.set-row-number')).toHaveLength(2);
    // 座標が無いので、セット全体の図も行の極小の図も描かない
    expect(container.querySelector('.set-editor-map')).toBeNull();
    expect(container.querySelector('.set-row-map')?.childElementCount).toBe(0);
  });

  it('座標のある行があればセット全体の図も出す', async () => {
    const { container } = await renderEditor([
      { open: { path: 'C:\\a.txt' }, placement: { x: 0, y: 0, width: 960, height: 1040 } },
      { open: { path: 'C:\\b.txt' }, placement: { virtualDesktopNumber: 2 } },
    ]);
    await waitFor(() => expect(container.querySelector('.set-editor-map')).not.toBeNull());
    expect(screen.getByText('📍 デスクトップ 2')).toBeTruthy();
  });

  it('ウィンドウ位置のある行が 1 つも無ければ、番号も 📍 の列も出さない', async () => {
    const { container } = await renderEditor([{ open: { path: 'C:\\a.txt' } }]);
    expect(container.querySelector('.set-row-number')).toBeNull();
    expect(container.querySelector('.set-row-place')).toBeNull();
  });
});
