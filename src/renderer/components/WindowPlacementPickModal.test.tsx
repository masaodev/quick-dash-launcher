import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WindowInfo } from '@common/types';

import WindowPlacementPickModal from './WindowPlacementPickModal';

function win(hwnd: number, title: string): WindowInfo {
  return {
    hwnd,
    title,
    x: 100 * hwnd,
    y: 0,
    width: 800,
    height: 600,
    processId: hwnd,
    isVisible: true,
    processName: 'sakura.exe',
    desktopNumber: 1,
  };
}

const screens = [
  {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  },
];

function modal(windows: WindowInfo[], onPick: (w: WindowInfo) => void) {
  return (
    <WindowPlacementPickModal
      windows={windows}
      desktopCount={1}
      screens={screens}
      desktopNames={{}}
      onClose={vi.fn()}
      onPick={onPick}
    />
  );
}

describe('WindowPlacementPickModal', () => {
  it('選べるウィンドウが変わったら、先頭を選び直す', () => {
    const onPick = vi.fn();
    const { rerender } = render(modal([win(1, 'a'), win(2, 'b')], onPick));
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);

    const next = [win(3, 'c'), win(4, 'd')];
    rerender(modal(next, onPick));
    expect((screen.getAllByRole('radio')[0] as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '記録する' }));
    expect(onPick).toHaveBeenCalledWith(next[0]);
  });
});
