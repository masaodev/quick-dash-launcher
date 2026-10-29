import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TFunction } from 'i18next';
import type { RegisterItem } from '@common/types';

import {
  commitClipboardContent,
  normalizePathInput,
  resolvePathChange,
  validateItemForm,
  withNormalizedPath,
} from './itemFormActions';

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

describe('normalizePathInput', () => {
  it.each([
    ['"C:\\Program Files\\a.exe"', 'C:\\Program Files\\a.exe'],
    ['  C:\\Windows\\notepad.exe   ', 'C:\\Windows\\notepad.exe'],
    ['   https://example.com/', 'https://example.com/'],
    [' " C:\\a b " ', 'C:\\a b'],
    ['C:\\a "b".txt', 'C:\\a "b".txt'],
    // 引数までパス欄に入れたものは、どこまでがパスか分からないので触らない
    ['"C:\\a.exe" "arg"', '"C:\\a.exe" "arg"'],
    // 全角スペースで終わるフォルダ名は Windows で作れるので残す
    ['C:\\メモ\u3000', 'C:\\メモ\u3000'],
    ['""', '""'],
    ['', ''],
  ])('%j は %j', (input, expected) => {
    expect(normalizePathInput(input)).toBe(expected);
  });
});

describe('withNormalizedPath', () => {
  it('パスを整える。変わらなければ同じオブジェクトを返す', () => {
    expect(withNormalizedPath({ ...baseItem, path: '"C:\\x.exe"' }).path).toBe('C:\\x.exe');
    expect(withNormalizedPath(baseItem)).toBe(baseItem);
  });

  it('クリップボードは触らない', () => {
    const clip = { ...baseItem, itemCategory: 'clipboard' as const, path: ' x ' };
    expect(withNormalizedPath(clip)).toBe(clip);
  });
});

describe('resolvePathChange', () => {
  it('引用符・空白付きのパスは整えて欄にも入れ、整えたパスで種別を決める', async () => {
    const apply = await resolvePathChange({ ...baseItem, path: '  https://example.com  ' });
    expect(apply?.(baseItem)).toMatchObject({ path: 'https://example.com', type: 'url' });
  });

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
