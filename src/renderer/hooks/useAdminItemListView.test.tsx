import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { EditableJsonItem } from '@common/types/editableItem';
import type { JsonItem } from '@common/types';

import { useAdminItemListView } from './useAdminItemListView';

function editable(item: JsonItem, lineNumber: number): EditableJsonItem {
  return {
    item,
    displayText: '',
    meta: { sourceFile: 'data.json', lineNumber, isValid: true },
  };
}

const notepad = editable(
  { id: 'np000001', type: 'item', displayName: 'メモ帳', path: 'C:\\Windows\\notepad.exe' },
  0
);
const set = editable(
  {
    id: 'st000001',
    type: 'set',
    displayName: '朝の準備',
    entries: [
      { itemId: 'np000001' },
      { itemId: 'gone0001', label: '消えたアイテム' },
      { open: { path: 'C:\\old\\a.xlsx' }, label: '古い資料' },
      { open: { path: 'C:\\docs\\b.docx' } },
      { open: { path: 'https://example.com' }, label: 'サイト' },
    ],
  },
  1
);
const urlOnlySet = editable(
  {
    id: 'st000002',
    type: 'set',
    displayName: 'サイトだけ',
    entries: [{ open: { path: 'https://example.com' } }],
  },
  2
);

const checkPathsExist = vi.fn();

beforeEach(() => {
  checkPathsExist.mockReset().mockResolvedValue({
    'C:\\Windows\\notepad.exe': 'exists',
    'C:\\old\\a.xlsx': 'missing',
    'C:\\docs\\b.docx': 'exists',
  });
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { checkPathsExist },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

function renderListView(workingItems: EditableJsonItem[]) {
  return renderHook(() =>
    useAdminItemListView({
      workingItems,
      baseVersion: 0,
      selectedDataFile: 'data.json',
      searchQuery: '',
      selectedItems: new Set(),
      retainVisibleSelection: () => {},
      usageOf: () => undefined,
      usageLoaded: true,
      ruleNames: new Map(),
    })
  );
}

describe('useAdminItemListView のパスの確認（セットの行。A3-79 #8）', () => {
  it('セットの、パスを直接書いた行のローカルパスも確かめる（URL は確かめない）', async () => {
    const { result } = renderListView([notepad, set]);
    await act(() => result.current.pathCheck.runCheck([notepad, set]));
    expect(checkPathsExist.mock.calls[0][0]).toEqual([
      'C:\\Windows\\notepad.exe',
      'C:\\old\\a.xlsx',
      'C:\\docs\\b.docx',
    ]);
  });

  it('見つからない行は、パスが無い行と指すアイテムが消えた行。セットは ⚠ でリンク切れに数える', async () => {
    const { result } = renderListView([notepad, set]);
    expect(result.current.linkStatusOf(set)).toBeUndefined();

    await act(() => result.current.pathCheck.runCheck([notepad, set]));
    expect(result.current.missingSetRowsOf(set)).toEqual(['消えたアイテム', '古い資料']);
    expect(result.current.linkStatusOf(set)).toBe('missing');
    expect(result.current.missingIds.has('st000001')).toBe(true);
    expect(result.current.missingSetRowsOf(notepad)).toEqual([]);
  });

  it('全部の行が見つかれば ✓、確かめる行が無い（URL だけ）なら空のまま', async () => {
    const fine = editable(
      { ...(set.item as Extract<JsonItem, { type: 'set' }>), entries: [{ itemId: 'np000001' }] },
      1
    );
    const { result } = renderListView([notepad, fine, urlOnlySet]);
    await act(() => result.current.pathCheck.runCheck([notepad, fine, urlOnlySet]));
    expect(result.current.linkStatusOf(fine)).toBe('exists');
    expect(result.current.linkStatusOf(urlOnlySet)).toBeUndefined();
  });
});
