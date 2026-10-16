import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ItemWindowSwitch } from '@common/types';

import ItemWindowSwitchEditor from './ItemWindowSwitchEditor';

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1040 };

beforeEach(() => {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      getAllWindowsAllDesktops: async () => [],
      getVirtualDesktopInfo: async () => ({ supported: true, desktopCount: 2, desktopNames: {} }),
      getScreenAreas: async () => [
        { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: WORK_AREA },
      ],
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

function renderEditor(value: ItemWindowSwitch, onChange = vi.fn(), opensSomething = true) {
  render(
    <ItemWindowSwitchEditor
      value={value}
      itemType="file"
      opensSomething={opensSomething}
      onChange={onChange}
    />
  );
  return onChange;
}

const leftHalf = { x: 0, y: 0, width: 960, height: 1040, virtualDesktopNumber: 2 };

describe('ItemWindowSwitchEditor', () => {
  it('たたんでいても見出しの横にウィンドウ位置を言葉で出す', async () => {
    renderEditor({ window: { processName: 'sakura.exe' }, placement: leftHalf });
    const toggle = screen.getByRole('button', {
      name: /オプション設定（ウィンドウ切り替え・ウィンドウ位置）/,
    });
    await waitFor(() => expect(toggle.textContent).toContain('📍'));
    expect(toggle.textContent).toContain('左半分');
    expect(toggle.textContent).toContain('デスクトップ 2');
    expect(screen.queryByLabelText('exe 名')).toBeNull();
  });

  it('全デスクトップに表示なら、要約に「全デスクトップ」と出す', async () => {
    renderEditor({
      window: { processName: 'sakura.exe' },
      placement: { x: 0, y: 0, width: 960, height: 1040 },
      pinToAllDesktops: true,
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { expanded: false }).textContent).toContain(
        '全デスクトップ'
      )
    );
  });

  it('開くと、セットの行の詳細と同じ 3 つの枠を単一アイテムの説明で出す', async () => {
    const onChange = renderEditor({});
    fireEvent.click(screen.getByRole('button', { expanded: false }));

    expect(screen.getByText('対象ウィンドウ')).toBeTruthy();
    expect(screen.getByText('ウィンドウ位置')).toBeTruthy();
    expect(screen.getByText('開くときの動き')).toBeTruthy();
    expect(screen.getByText(/このアイテムを開いたとき/)).toBeTruthy();
    expect(screen.queryByText('開くもの')).toBeNull();

    fireEvent.change(screen.getByLabelText('exe 名'), { target: { value: 'sakura.exe' } });
    expect(onChange).toHaveBeenLastCalledWith({ window: { processName: 'sakura.exe' } });
  });

  it('前面に出すの既定は「出す」', () => {
    renderEditor({ window: { processName: 'a.exe' }, placement: leftHalf });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect((screen.getByLabelText('前面に出す') as HTMLSelectElement).value).toBe('yes');
  });

  it('全デスクトップに表示にすると、デスクトップの番号を外す', () => {
    const onChange = renderEditor({ window: { processName: 'a.exe' }, placement: leftHalf });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByRole('checkbox', { name: /全デスクトップに表示/ }));
    expect(onChange).toHaveBeenLastCalledWith({
      pinToAllDesktops: true,
      placement: { x: 0, y: 0, width: 960, height: 1040 },
    });
  });

  it('パスが空なら「開いていたら」「待つ秒数」を出さない', () => {
    renderEditor({ window: { processName: 'a.exe' }, placement: leftHalf }, vi.fn(), false);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.queryByLabelText('開いていたら')).toBeNull();
    expect(screen.queryByLabelText('ウィンドウが出るのを待つ（秒）')).toBeNull();
    expect(screen.getByLabelText('前面に出す')).toBeTruthy();
  });
});
