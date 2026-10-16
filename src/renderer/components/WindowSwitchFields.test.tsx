import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WindowInfo } from '@common/types';

import { OpenBehaviorFields, WindowMatchFields, WindowPlacementFields } from './WindowSwitchFields';

describe('OpenBehaviorFields', () => {
  it('単一アイテム（既定は出す）: 未指定なら「出す」と出し、出さないは false、出すは書かない', () => {
    const onChange = vi.fn();
    render(<OpenBehaviorFields idPrefix="t" hasPlacement activateByDefault onChange={onChange} />);
    const select = screen.getByLabelText('前面に出す') as HTMLSelectElement;
    expect(select.value).toBe('yes');

    fireEvent.change(select, { target: { value: 'no' } });
    expect(onChange).toHaveBeenLastCalledWith({ activateWindow: false });
    fireEvent.change(select, { target: { value: 'yes' } });
    expect(onChange).toHaveBeenLastCalledWith({ activateWindow: undefined });
  });

  it('セットの行（既定は出さない）: 未指定なら「出さない」、出すは true', () => {
    const onChange = vi.fn();
    render(
      <OpenBehaviorFields idPrefix="t" hasPlacement activateByDefault={false} onChange={onChange} />
    );
    const select = screen.getByLabelText('前面に出す') as HTMLSelectElement;
    expect(select.value).toBe('no');
    fireEvent.change(select, { target: { value: 'yes' } });
    expect(onChange).toHaveBeenLastCalledWith({ activateWindow: true });
  });

  it('ウィンドウ位置が無ければ「開いていたら」だけ出す', () => {
    render(
      <OpenBehaviorFields idPrefix="t" hasPlacement={false} activateByDefault onChange={vi.fn()} />
    );
    expect(screen.getByLabelText('開いていたら')).toBeTruthy();
    expect(screen.queryByLabelText('前面に出す')).toBeNull();
    expect(screen.queryByLabelText('ウィンドウが出るのを待つ（秒）')).toBeNull();
  });

  it('開くものが無ければ「開いていたら」「待つ秒数」を出さない（位置も無ければ枠ごと出さない）', () => {
    const { container, rerender } = render(
      <OpenBehaviorFields
        idPrefix="t"
        hasPlacement
        opensSomething={false}
        activateByDefault
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText('開いていたら')).toBeNull();
    expect(screen.queryByLabelText('ウィンドウが出るのを待つ（秒）')).toBeNull();
    expect(screen.getByLabelText('前面に出す')).toBeTruthy();

    rerender(
      <OpenBehaviorFields
        idPrefix="t"
        hasPlacement={false}
        opensSomething={false}
        activateByDefault
        onChange={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('開いていたら: もう 1 つ開くは openNew、開かずに使うは書かない', () => {
    const onChange = vi.fn();
    render(
      <OpenBehaviorFields idPrefix="t" hasPlacement={false} activateByDefault onChange={onChange} />
    );
    const select = screen.getByLabelText('開いていたら');
    fireEvent.change(select, { target: { value: 'openNew' } });
    expect(onChange).toHaveBeenLastCalledWith({ ifOpen: 'openNew' });
    fireEvent.change(select, { target: { value: 'move' } });
    expect(onChange).toHaveBeenLastCalledWith({ ifOpen: undefined });
  });
});

describe('WindowMatchFields', () => {
  it('exe 名とタイトルが両方空になったら undefined を返す', () => {
    const onChange = vi.fn();
    render(
      <WindowMatchFields
        idPrefix="t"
        value={{ processName: 'notepad.exe' }}
        initial={undefined}
        windows={[]}
        lead="説明"
        onPickWindow={vi.fn()}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText('exe 名'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('開いたときのタイトルから一部だけで探す候補を出し、押すと *…* にする', () => {
    const onChange = vi.fn();
    const initial = { processName: 'sakura.exe', title: '一時メモ.txt - sakura' };
    render(
      <WindowMatchFields
        idPrefix="t"
        value={initial}
        initial={initial}
        windows={[]}
        lead="説明"
        onPickWindow={vi.fn()}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '一時メモ.txt' }));
    expect(onChange).toHaveBeenLastCalledWith({
      processName: 'sakura.exe',
      title: '*一時メモ.txt*',
    });
    expect(screen.getByText('説明')).toBeTruthy();
    expect(screen.getByText('今合うウィンドウ: 0 件')).toBeTruthy();
  });
});

describe('WindowMatchFields の並び', () => {
  it('見出しの右に「開いているウィンドウから選ぶ」、先頭に説明、欄の下に短い補足を出す', () => {
    const onPickWindow = vi.fn();
    render(
      <WindowMatchFields
        idPrefix="t"
        value={{ processName: 'sakura.exe' }}
        initial={undefined}
        windows={[]}
        lead="先頭の説明"
        onPickWindow={onPickWindow}
        onChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '🔍 開いているウィンドウから選ぶ' }));
    expect(onPickWindow).toHaveBeenCalled();
    expect(screen.getByText('先頭の説明')).toBeTruthy();
    expect(screen.getByText('一部でも探せます（例: sakura）')).toBeTruthy();
    expect(
      screen.getByText('全体が同じものを探します。* は任意の文字（例: *Obsidian）')
    ).toBeTruthy();
    expect(screen.getByText('タイトルの一部だけで探す')).toBeTruthy();
  });
});

function win(hwnd: number, title: string, extra: Partial<WindowInfo> = {}): WindowInfo {
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
    ...extra,
  };
}

describe('WindowPlacementFields（📍 ウィンドウ位置を更新）', () => {
  const screens = [
    {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    },
  ];
  let current: WindowInfo[] = [];

  beforeEach(() => {
    current = [];
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { getAllWindowsAllDesktops: async () => current },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI');
  });

  function renderPlacement(
    windows: WindowInfo[],
    props: Partial<React.ComponentProps<typeof WindowPlacementFields>> = {}
  ) {
    current = windows;
    const onChange = vi.fn();
    const onUpdated = vi.fn();
    render(
      <WindowPlacementFields
        idPrefix="t"
        placement={undefined}
        pinToAllDesktops={undefined}
        match={{ processName: 'sakura.exe' }}
        windows={windows}
        desktopCount={2}
        screens={screens}
        desktopNames={{}}
        onChange={onChange}
        onUpdated={onUpdated}
        {...props}
      />
    );
    return { onChange, onUpdated };
  }

  const button = () => screen.getByRole('button', { name: '📍 ウィンドウ位置を更新' });

  it('合うウィンドウが 0 件なら押せない（ツールチップで理由を出す）', () => {
    renderPlacement([win(1, 'メモ帳', { processName: 'notepad.exe' })]);
    expect((button() as HTMLButtonElement).disabled).toBe(true);
    expect(button().getAttribute('title')).toBe('合うウィンドウが開いていません');
  });

  it('1 件ならそのウィンドウの今の位置だけを記録する（ウィンドウ位置がまだ無くても押せる）', async () => {
    const { onChange, onUpdated } = renderPlacement([win(1, 'a.txt - sakura')]);
    expect(screen.getByText('まだ記録していません')).toBeTruthy();
    fireEvent.click(button());
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        placement: { x: 100, y: 0, width: 800, height: 600, virtualDesktopNumber: 1 },
        pinToAllDesktops: undefined,
      })
    );
    expect(onUpdated).toHaveBeenCalledWith([]);
  });

  it('全デスクトップに表示なら、デスクトップの番号を外して記録する', async () => {
    const { onChange } = renderPlacement([win(1, 'a.txt - sakura')], { pinToAllDesktops: true });
    fireEvent.click(button());
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        placement: { x: 100, y: 0, width: 800, height: 600 },
        pinToAllDesktops: true,
      })
    );
  });

  it('2 件以上なら合うウィンドウだけを並べた画面を出し、選んだものを記録する', async () => {
    const { onChange } = renderPlacement([
      win(1, 'a.txt - sakura'),
      win(2, 'b.txt - sakura'),
      win(3, 'メモ帳', { processName: 'notepad.exe' }),
    ]);
    fireEvent.click(button());
    const dialog = await screen.findByRole('dialog', {
      name: 'どのウィンドウの位置を記録しますか',
    });
    expect(dialog.textContent).toContain('a.txt - sakura');
    expect(dialog.textContent).toContain('b.txt - sakura');
    expect(dialog.textContent).not.toContain('メモ帳');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: '記録する' }));
    expect(onChange).toHaveBeenCalledWith({
      placement: { x: 200, y: 0, width: 800, height: 600, virtualDesktopNumber: 1 },
      pinToAllDesktops: undefined,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('最小化中なら位置は取らずに知らせる', async () => {
    const { onChange, onUpdated } = renderPlacement([
      win(1, 'a.txt - sakura', { windowState: 'minimized', x: -32000, y: -32000 }),
    ]);
    fireEvent.click(button());
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(['minimizedNotUpdated']));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('全デスクトップに表示にすると、デスクトップの番号を外す', () => {
    const { onChange } = renderPlacement([], {
      placement: { x: 0, y: 0, width: 960, height: 1040, virtualDesktopNumber: 2 },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /全デスクトップに表示/ }));
    expect(onChange).toHaveBeenLastCalledWith({
      placement: { x: 0, y: 0, width: 960, height: 1040 },
      pinToAllDesktops: true,
    });
  });
});
