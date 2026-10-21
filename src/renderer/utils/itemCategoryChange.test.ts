import { describe, expect, it, vi } from 'vitest';
import type { RegisterItem } from '@common/types';

import { applyItemCategoryChange } from './itemCategoryChange';

const base: RegisterItem = {
  displayName: '名前',
  path: 'C:/tool.exe',
  type: 'app',
  targetTab: '',
  itemCategory: 'item',
};

describe('applyItemCategoryChange', () => {
  it('渡したアイテムは変えずに新しいアイテムを返す', () => {
    const result = applyItemCategoryChange(base, 'set');
    expect(result).not.toBe(base);
    expect(base.itemCategory).toBe('item');
    expect(result).toMatchObject({ itemCategory: 'set', setEntries: [] });
  });

  it('クリップボードにするとパスを空にし、ほかの種別へ移ると取り込みを捨てる', () => {
    const discardSession = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('window', { electronAPI: { clipboardAPI: { discardSession } } });
    const clipboard = applyItemCategoryChange(base, 'clipboard');
    expect(clipboard).toMatchObject({ path: '', type: 'clipboard' });

    const back = applyItemCategoryChange(
      { ...clipboard, clipboardSessionId: 's1', clipboardDataRef: 'ref' },
      'item'
    );
    expect(discardSession).toHaveBeenCalledWith('s1');
    expect(back).not.toHaveProperty('clipboardSessionId');
    expect(back).not.toHaveProperty('clipboardDataRef');
    vi.unstubAllGlobals();
  });

  it('フォルダ取込にすると展開の既定を入れる', () => {
    const result = applyItemCategoryChange(base, 'dir');
    expect(result.folderProcessing).toBe('expand');
    expect(result.dirOptions).toBeDefined();
  });
});
