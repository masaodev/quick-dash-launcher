import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { OpenBehaviorFields, WindowMatchFields } from './WindowSwitchFields';

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
        hint="説明"
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
        hint="説明"
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
