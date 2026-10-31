import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import type { AppItem } from '@common/types';

import { useKeepSelectionOnReorder } from './useKeepSelectionOnReorder';

const item = (name: string) =>
  ({ type: 'url', displayName: name, path: name }) as unknown as AppItem;
const a = item('A');
const b = item('B');
const c = item('C');

function useHarness(initial: { items: AppItem[]; orderKey: unknown }) {
  const [state, setState] = useState(initial);
  const [selectedIndex, setSelectedIndex] = useState(1);
  useKeepSelectionOnReorder(state.items, selectedIndex, setSelectedIndex, state.orderKey);
  return { selectedIndex, setState, setSelectedIndex, items: state.items };
}

describe('useKeepSelectionOnReorder', () => {
  it('並べ方が変わったら、選んでいたアイテムの番号に合わせ直す', () => {
    const { result } = renderHook(() => useHarness({ items: [b, a, c], orderKey: 1 }));
    expect(result.current.items[result.current.selectedIndex]).toBe(a);

    act(() => result.current.setState({ items: [a, b, c], orderKey: 2 }));
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.items[result.current.selectedIndex]).toBe(a);
  });

  it('並べ方が同じまま一覧が変わったとき（検索語を変えた）は、番号を動かさない', () => {
    const { result } = renderHook(() => useHarness({ items: [b, a, c], orderKey: 1 }));
    act(() => result.current.setState({ items: [a, c], orderKey: 1 }));
    expect(result.current.selectedIndex).toBe(1);
  });

  it('選んでいたアイテムが無くなったときは、番号を動かさない', () => {
    const { result } = renderHook(() => useHarness({ items: [b, a, c], orderKey: 1 }));
    act(() => result.current.setState({ items: [c, b], orderKey: 2 }));
    expect(result.current.selectedIndex).toBe(1);
  });
});
