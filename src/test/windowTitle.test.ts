import { describe, it, expect } from 'vitest';
import { createTitleMatcher, normalizeWindowTitleForProcessOnly } from '@common/utils/windowTitle';

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
});

describe('createTitleMatcher', () => {
  it('ワイルドカードが無ければ、大文字小文字を区別しない完全一致', () => {
    const matches = createTitleMatcher('Google Chrome');
    expect(matches('google chrome')).toBe(true);
    expect(matches('Google Chrome - New Tab')).toBe(false);
  });

  it('* は任意の文字列、? は任意の 1 文字', () => {
    expect(createTitleMatcher('*Chrome*')('New Tab - Google Chrome')).toBe(true);
    expect(createTitleMatcher('Note?')('Notes')).toBe(true);
    expect(createTitleMatcher('Note?')('Notepad')).toBe(false);
  });

  it('正規表現の特殊文字はそのままの文字として扱う', () => {
    expect(createTitleMatcher('a.b (1)*')('a.b (1) - x')).toBe(true);
    expect(createTitleMatcher('a.b*')('axb')).toBe(false);
  });
});
