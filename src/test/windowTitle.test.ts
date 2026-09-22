import { describe, it, expect } from 'vitest';
import { convertRegisterItemToJsonItem } from '@common/utils/dataConverters';
import { normalizeWindowTitleForProcessOnly } from '@common/utils/windowTitle';

describe('normalizeWindowTitleForProcessOnly', () => {
  it('タイトルが空（空白のみ・未指定）でプロセス名があれば "*" を返すこと', () => {
    expect(normalizeWindowTitleForProcessOnly('', 'chrome.exe')).toBe('*');
    expect(normalizeWindowTitleForProcessOnly('  ', 'chrome.exe')).toBe('*');
    expect(normalizeWindowTitleForProcessOnly(undefined, 'chrome.exe')).toBe('*');
  });

  it('タイトルがある、またはプロセス名も無ければ正規化しないこと', () => {
    expect(normalizeWindowTitleForProcessOnly('Chrome', 'chrome.exe')).toBeUndefined();
    expect(normalizeWindowTitleForProcessOnly('', '')).toBeUndefined();
    expect(normalizeWindowTitleForProcessOnly('', undefined)).toBeUndefined();
    // 文字列でない値は救済せず検証に任せる
    expect(normalizeWindowTitleForProcessOnly(123, 'chrome.exe')).toBeUndefined();
    expect(normalizeWindowTitleForProcessOnly(null, 'chrome.exe')).toBeUndefined();
  });

  it('登録フォームからの変換（convertRegisterItemToJsonItem）でも "*" になること', () => {
    const json = convertRegisterItemToJsonItem({
      displayName: 'メモ帳',
      path: '',
      type: 'app',
      itemCategory: 'window',
      windowOperationConfig: { displayName: 'メモ帳', windowTitle: '', processName: 'notepad.exe' },
    } as Parameters<typeof convertRegisterItemToJsonItem>[0]);
    expect(json).toMatchObject({ type: 'window', windowTitle: '*', processName: 'notepad.exe' });
  });
});
