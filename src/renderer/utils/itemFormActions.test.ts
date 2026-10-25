import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TFunction } from 'i18next';
import type { RegisterItem } from '@common/types';

import { commitClipboardContent, resolvePathChange, validateItemForm } from './itemFormActions';

const t = ((key: string) => key) as unknown as TFunction;
const notify = { showWarning: vi.fn(), showError: vi.fn() };
const loadCachedIcons = vi.fn(async (): Promise<Record<string, string>> => ({}));
const commitSession = vi.fn();

const baseItem: RegisterItem = {
  displayName: 'メモ帳',
  path: 'C:\\Windows\\notepad.exe',
  type: 'app',
  targetTab: '',
  itemCategory: 'item',
};

beforeEach(() => {
  notify.showWarning.mockClear();
  notify.showError.mockClear();
  loadCachedIcons.mockClear();
  commitSession.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { loadCachedIcons, clipboardAPI: { commitSession } },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

describe('resolvePathChange', () => {
  it('パスに合う種別にし、キャッシュにあるアイコンを当てる', async () => {
    loadCachedIcons.mockResolvedValueOnce({ 'https://example.com': 'data:icon' });
    const apply = await resolvePathChange({ ...baseItem, path: 'https://example.com' });
    expect(apply?.(baseItem)).toMatchObject({ type: 'url', icon: 'data:icon' });
  });

  it('「選択」で選んだパスはまだ item に無いので、パスも入れる', async () => {
    const apply = await resolvePathChange(baseItem, 'https://example.com');
    expect(apply?.(baseItem)).toMatchObject({ path: 'https://example.com', type: 'url' });
  });

  it('判定を待つ間に変わったほかの欄は戻さない', async () => {
    const apply = await resolvePathChange({ ...baseItem, path: 'https://example.com' });
    expect(apply?.({ ...baseItem, memo: '待つ間に書いた' })).toMatchObject({
      memo: '待つ間に書いた',
      type: 'url',
    });
  });

  it('パスを空にした単一アイテムは、ウィンドウに切り替えるだけの種別にする', async () => {
    const apply = await resolvePathChange({ ...baseItem, path: '', icon: 'data:old' });
    expect(apply?.(baseItem)).toMatchObject({ type: 'windowSwitch', icon: undefined });
  });

  it('クリップボードは決め直さない', async () => {
    expect(await resolvePathChange({ ...baseItem, itemCategory: 'clipboard' })).toBeUndefined();
  });
});

describe('validateItemForm', () => {
  it('入力漏れが無ければ空', () => {
    expect(validateItemForm(baseItem, t)).toEqual({});
  });

  it('名前が空なら名前の欄に出す（フォルダ取込は名前を持たないので出さない）', () => {
    expect(validateItemForm({ ...baseItem, displayName: ' ' }, t)).toEqual({
      displayName: 'register.errors.displayNameRequired',
    });
    expect(validateItemForm({ ...baseItem, displayName: '', itemCategory: 'dir' }, t)).toEqual({});
  });

  it('行の無いセットは行の欄に出す', () => {
    expect(validateItemForm({ ...baseItem, itemCategory: 'set', setEntries: [] }, t)).toEqual({
      setEntries: 'set.editor.entriesRequired',
    });
  });

  it('中身の無いクリップボードはパスの欄に出す', () => {
    expect(validateItemForm({ ...baseItem, path: '', itemCategory: 'clipboard' }, t)).toEqual({
      path: 'register.errors.clipboardRequired',
    });
  });
});

describe('commitClipboardContent', () => {
  const captured: RegisterItem = {
    ...baseItem,
    path: '',
    itemCategory: 'clipboard',
    clipboardSessionId: 'session-1',
  };

  it('クリップボード以外と、確定するものが無いときはそのまま返す', async () => {
    expect(await commitClipboardContent(baseItem, notify, t)).toBe(baseItem);
    const saved = { ...captured, clipboardSessionId: undefined, clipboardDataRef: 'a.json' };
    expect(await commitClipboardContent(saved, notify, t)).toBe(saved);
    expect(commitSession).not.toHaveBeenCalled();
  });

  it('取り込んだ中身を確定して、データの参照に置き換える', async () => {
    commitSession.mockResolvedValueOnce({ success: true, dataFileRef: 'c.json', savedAt: 5 });
    expect(await commitClipboardContent(captured, notify, t)).toMatchObject({
      clipboardDataRef: 'c.json',
      clipboardSavedAt: 5,
      clipboardSessionId: undefined,
    });
  });

  it('確定に失敗したら知らせて null を返す', async () => {
    commitSession.mockResolvedValueOnce({ success: false, error: '書けませんでした' });
    expect(await commitClipboardContent(captured, notify, t)).toBeNull();
    expect(notify.showError).toHaveBeenCalledWith('書けませんでした');
  });
});
