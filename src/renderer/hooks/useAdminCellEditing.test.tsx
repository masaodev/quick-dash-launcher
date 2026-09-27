import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { JsonItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';

import { toEditableItem } from '../utils/editableItemOperations';

import { useAdminCellEditing } from './useAdminCellEditing';

const FILE = 'datafiles/data.json';

function launcher(id: string, displayName: string, path: string): EditableJsonItem {
  return toEditableItem({ id, type: 'item', displayName, path } as JsonItem, FILE);
}

const key = (k: string) => ({ key: k, preventDefault: vi.fn() }) as unknown as ReactKeyboardEvent;

describe('useAdminCellEditing', () => {
  it('名前セルの編集を確定すると onItemEdit に名前だけ変えたアイテムを渡すこと', () => {
    const onItemEdit = vi.fn();
    const item = launcher('a1', 'GitHub', 'https://github.com');
    const { result } = renderHook(() => useAdminCellEditing(onItemEdit));

    act(() => result.current.startNameEdit(item));
    expect(result.current.editingCell).toEqual({ itemId: 'a1', column: 'name' });
    expect(result.current.editingValue).toBe('GitHub');

    act(() => result.current.setEditingValue('  GitHub2 '));
    act(() => result.current.commitNameEdit(item));
    expect(onItemEdit).toHaveBeenCalledTimes(1);
    expect(onItemEdit.mock.calls[0][0].item).toMatchObject({ id: 'a1', displayName: 'GitHub2' });
    expect(result.current.editingCell).toBeNull();
  });

  it('値が変わっていなければ onItemEdit を呼ばないこと', () => {
    const onItemEdit = vi.fn();
    const item = launcher('a1', 'GitHub', 'https://github.com');
    const { result } = renderHook(() => useAdminCellEditing(onItemEdit));
    act(() => result.current.startPathEdit(item));
    act(() => result.current.commitPathEdit(item));
    expect(onItemEdit).not.toHaveBeenCalled();
  });

  it('名前セルの Enter で確定し、同じ行のパスセルの編集に進むこと', () => {
    const onItemEdit = vi.fn();
    const item = launcher('a1', '', '');
    const { result } = renderHook(() => useAdminCellEditing(onItemEdit));

    act(() => result.current.beginNameEditFor('a1'));
    act(() => result.current.setEditingValue('新規'));
    act(() => result.current.handleNameKeyDown(key('Enter'), item));

    expect(onItemEdit.mock.calls[0][0].item).toMatchObject({ displayName: '新規' });
    expect(result.current.editingCell).toEqual({ itemId: 'a1', column: 'path' });
    expect(result.current.editingValue).toBe('');
  });

  it('別のセルへ移った後に届いた古い確定（blur）は無視すること', () => {
    const onItemEdit = vi.fn();
    const item = launcher('a1', 'GitHub', 'https://github.com');
    const { result } = renderHook(() => useAdminCellEditing(onItemEdit));

    act(() => result.current.startNameEdit(item));
    act(() => result.current.setEditingValue('renamed'));
    act(() => result.current.handleNameKeyDown(key('Tab'), item));
    // ここでパス編集中。遅れて届いた名前セルの blur
    act(() => result.current.setEditingValue('https://example.com'));
    act(() => result.current.commitNameEdit(item));

    expect(onItemEdit).toHaveBeenCalledTimes(1);
    expect(onItemEdit.mock.calls[0][0].item).toMatchObject({ displayName: 'renamed' });
    expect(result.current.editingCell).toEqual({ itemId: 'a1', column: 'path' });
  });

  it('Escape で編集を取り消すこと。編集できない種類では編集を始めないこと', () => {
    const onItemEdit = vi.fn();
    const item = launcher('a1', 'GitHub', 'https://github.com');
    const group = toEditableItem(
      { id: 'g1', type: 'group', displayName: 'G', itemNames: ['a'] } as JsonItem,
      FILE
    );
    const { result } = renderHook(() => useAdminCellEditing(onItemEdit));

    act(() => result.current.startPathEdit(item));
    act(() => result.current.handlePathKeyDown(key('Escape'), item));
    expect(result.current.editingCell).toBeNull();
    expect(onItemEdit).not.toHaveBeenCalled();

    act(() => result.current.startPathEdit(group));
    expect(result.current.editingCell).toBeNull();
  });

  it('ハンドラの参照が再レンダーで変わらないこと（行の memo を効かせるため）', () => {
    const { result, rerender } = renderHook(() => useAdminCellEditing(vi.fn()));
    const before = { ...result.current };
    rerender();
    expect(result.current.startNameEdit).toBe(before.startNameEdit);
    expect(result.current.commitPathEdit).toBe(before.commitPathEdit);
    expect(result.current.handleNameKeyDown).toBe(before.handleNameKeyDown);
  });
});
