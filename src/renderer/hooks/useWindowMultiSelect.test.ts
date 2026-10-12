import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { AppItem, SearchMode, WindowInfo } from '@common/types';

import { useWindowMultiSelect } from './useWindowMultiSelect';

const setEscapeHandledByPage = vi.fn();

function win(hwnd: number): WindowInfo {
  return { hwnd, title: `${hwnd}`, processName: 'a.exe' } as WindowInfo;
}

const wins = [win(1), win(2), win(3), win(4)];

function setup(initial: { items?: AppItem[]; selectedIndex?: number; mode?: SearchMode } = {}) {
  return renderHook(
    (props: { items: AppItem[]; selectedIndex: number; mode: SearchMode }) =>
      useWindowMultiSelect({
        searchMode: props.mode,
        filteredItems: props.items,
        selectedIndex: props.selectedIndex,
      }),
    {
      initialProps: {
        items: initial.items ?? wins,
        selectedIndex: initial.selectedIndex ?? 0,
        mode: initial.mode ?? 'window',
      },
    }
  );
}

const hwnds = (ws: WindowInfo[]) => ws.map((w) => w.hwnd);

beforeEach(() => {
  setEscapeHandledByPage.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { setEscapeHandledByPage },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

describe('useWindowMultiSelect', () => {
  it('Shift+↑↓ の範囲は起点から数え、戻れば縮む。前から選んでいた行は残す', () => {
    const { result, rerender } = setup({ selectedIndex: 1 });

    act(() => result.current.toggle(3)); // 4 を選んでおく
    rerender({ items: wins, selectedIndex: 1, mode: 'window' });
    act(() => result.current.resetAnchor());
    act(() => result.current.extendTo(2));
    rerender({ items: wins, selectedIndex: 2, mode: 'window' }); // カーソルも動く
    expect(hwnds(result.current.markedWindows)).toEqual([2, 3, 4]);

    act(() => result.current.extendTo(1)); // 起点まで戻る
    expect(hwnds(result.current.markedWindows)).toEqual([2, 4]);
  });

  it('Ctrl+クリックのあとカーソルがほかの操作（マウスのホバーなど）で動いたら、Shift+↑↓ は今の行から選ぶ', () => {
    const { result, rerender } = setup({ selectedIndex: 0 });

    act(() => result.current.toggle(0)); // 1 行目を Ctrl+クリック
    rerender({ items: wins, selectedIndex: 2, mode: 'window' }); // ホバーで 3 行目へ
    act(() => result.current.extendTo(3));
    expect(hwnds(result.current.markedWindows)).toEqual([1, 3, 4]);
  });

  it('Shift+↑↓ の途中でカーソルがマウスのホバーで動いても、起点は Shift を押し始めた行のまま', () => {
    const { result, rerender } = setup({ selectedIndex: 0 });

    act(() => result.current.extendTo(1));
    rerender({ items: wins, selectedIndex: 2, mode: 'window' }); // 一覧が動いてホバーで 3 行目へ
    act(() => result.current.extendTo(1));
    act(() => result.current.extendTo(0)); // 起点まで戻れば縮む
    expect(hwnds(result.current.markedWindows)).toEqual([1]);
  });

  it('Ctrl+クリックした行からそのまま Shift+↑↓ を押せば、その行から選ぶ', () => {
    const { result, rerender } = setup({ selectedIndex: 1 });

    act(() => result.current.toggle(1));
    act(() => result.current.extendTo(2));
    rerender({ items: wins, selectedIndex: 2, mode: 'window' });
    act(() => result.current.extendTo(3));
    expect(hwnds(result.current.markedWindows)).toEqual([2, 3, 4]);
  });

  it('Ctrl+クリックで 1 行ずつ付け外しし、Shift+クリックで範囲を足す', () => {
    const { result } = setup();

    act(() => result.current.toggle(0));
    act(() => result.current.toggle(2));
    expect(hwnds(result.current.markedWindows)).toEqual([1, 3]);
    act(() => result.current.toggle(0));
    expect(hwnds(result.current.markedWindows)).toEqual([3]);

    act(() => result.current.selectRangeTo(3)); // 起点（最後に Ctrl+クリックした 1 行目）から 4 行目まで
    expect(hwnds(result.current.markedWindows)).toEqual([1, 2, 3, 4]);
  });

  it('検索語やタブで見えなくなった行は選択から外し、通常モードに戻ったら全部外す', () => {
    const { result, rerender } = setup();

    act(() => result.current.selectAll());
    expect(result.current.markedWindows).toHaveLength(4);

    rerender({ items: [wins[1], wins[3]], selectedIndex: 0, mode: 'window' });
    expect(hwnds(result.current.markedWindows)).toEqual([2, 4]);

    // また見えるようになっても戻らない（見えないあいだに外れている）
    rerender({ items: wins, selectedIndex: 0, mode: 'window' });
    expect(hwnds(result.current.markedWindows)).toEqual([2, 4]);

    rerender({ items: [], selectedIndex: 0, mode: 'normal' });
    expect(result.current.markedWindows).toHaveLength(0);
  });

  it('選択か確認の帯があるあいだだけ、Esc をページで受けるようメインプロセスに知らせる', () => {
    const { result } = setup();
    expect(setEscapeHandledByPage).toHaveBeenLastCalledWith(false);

    act(() => result.current.toggle(0));
    expect(setEscapeHandledByPage).toHaveBeenLastCalledWith(true);

    act(() => result.current.clear());
    expect(setEscapeHandledByPage).toHaveBeenLastCalledWith(false);
  });

  it('選択中に画面が外れたら（読み直し・アンマウント）、Esc をページで受ける印を戻す', () => {
    const { result, unmount } = setup();
    act(() => result.current.toggle(0));
    expect(setEscapeHandledByPage).toHaveBeenLastCalledWith(true);

    unmount();
    expect(setEscapeHandledByPage).toHaveBeenLastCalledWith(false);
  });

  it('操作の対象は、選んでいればそれ、なければカーソルの行', () => {
    const { result } = setup();
    expect(result.current.targetsFor(wins[2])).toEqual([wins[2]]);

    act(() => result.current.toggle(1));
    expect(result.current.targetsFor(wins[2])).toEqual([wins[1]]);
  });
});
