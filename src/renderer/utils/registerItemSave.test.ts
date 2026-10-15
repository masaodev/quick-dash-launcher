import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RegisterItem } from '@common/types';

import { withOwnClipboardData } from './registerItemSave';

const duplicateData = vi.fn(async (ref: string) => ref.replace('.json', '-copy.json'));

beforeEach(() => {
  duplicateData.mockClear();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { clipboardAPI: { duplicateData } },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

function clipboardItem(ref: string): RegisterItem {
  return {
    displayName: 'メモ',
    path: '',
    type: 'clipboard',
    targetTab: 'datafiles/data.json',
    itemCategory: 'clipboard',
    clipboardDataRef: ref,
  };
}

describe('withOwnClipboardData', () => {
  it('初期値の実データを指したままのクリップボードアイテムは、複製した参照に差し替える', async () => {
    const prefill = [clipboardItem('clipboard-data/abc.json')];
    const result = await withOwnClipboardData(prefill, prefill);
    expect(duplicateData).toHaveBeenCalledWith('clipboard-data/abc.json');
    expect(result[0].clipboardDataRef).toBe('clipboard-data/abc-copy.json');
  });

  it('登録画面で取り直した（参照が変わった）アイテムは複製しない', async () => {
    const prefill = [clipboardItem('clipboard-data/abc.json')];
    const result = await withOwnClipboardData([clipboardItem('clipboard-data/new.json')], prefill);
    expect(duplicateData).not.toHaveBeenCalled();
    expect(result[0].clipboardDataRef).toBe('clipboard-data/new.json');
  });

  it('初期値が無い（ファイルのドロップ・手での登録）ときは何もしない', async () => {
    const items = [clipboardItem('clipboard-data/abc.json')];
    expect(await withOwnClipboardData(items, undefined)).toBe(items);
    expect(duplicateData).not.toHaveBeenCalled();
  });

  it('複製できなければ元の参照のまま保存する', async () => {
    duplicateData.mockResolvedValueOnce(null as unknown as string);
    const prefill = [clipboardItem('clipboard-data/abc.json')];
    const result = await withOwnClipboardData(prefill, prefill);
    expect(result[0].clipboardDataRef).toBe('clipboard-data/abc.json');
  });
});
