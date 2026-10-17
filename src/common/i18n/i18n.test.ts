import { describe, it, expect } from 'vitest';

import { en } from './locales/en';
import { ja } from './locales/ja';

import { createI18n, flattenMessages, isLanguageSetting, resolveLanguage } from './index';

describe('resolveLanguage', () => {
  it('ja・en を指定したらそのまま使うこと', () => {
    expect(resolveLanguage('ja', ['en-US'])).toBe('ja');
    expect(resolveLanguage('en', ['ja-JP'])).toBe('en');
  });

  it('auto は OS の最初の表示言語が日本語なら ja、それ以外は en にすること', () => {
    expect(resolveLanguage('auto', ['ja-JP', 'en-US'])).toBe('ja');
    expect(resolveLanguage('auto', ['ja'])).toBe('ja');
    expect(resolveLanguage('auto', ['en-US', 'ja-JP'])).toBe('en');
    expect(resolveLanguage('auto', ['fr-FR'])).toBe('en');
    expect(resolveLanguage('auto', [])).toBe('en');
  });

  it('不正な設定値は auto とみなすこと', () => {
    expect(resolveLanguage('xx', ['ja-JP'])).toBe('ja');
    expect(resolveLanguage(undefined, ['de-DE'])).toBe('en');
  });

  it('isLanguageSetting は auto・ja・en だけを受け付けること', () => {
    expect(['auto', 'ja', 'en'].every(isLanguageSetting)).toBe(true);
    expect(isLanguageSetting('fr')).toBe(false);
    expect(isLanguageSetting(1)).toBe(false);
  });
});

describe('辞書', () => {
  const jaMessages = flattenMessages(ja);
  const enMessages = flattenMessages(en);

  it('ja と en のキーが一致すること', () => {
    expect(Object.keys(enMessages).sort()).toEqual(Object.keys(jaMessages).sort());
  });

  it('訳が空でないこと', () => {
    const empty = Object.entries(enMessages).filter(([, text]) => text.trim() === '');
    expect(empty).toEqual([]);
  });

  it('差し込み（{{name}}）が ja と en で一致すること', () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{\{\s*(\w+)/g)].map((m) => m[1]).sort();
    const mismatched = Object.keys(jaMessages).filter(
      (key) =>
        JSON.stringify(placeholders(jaMessages[key])) !==
        JSON.stringify(placeholders(enMessages[key]))
    );
    expect(mismatched).toEqual([]);
  });
});

describe('createI18n', () => {
  it('言語ごとの文言を返し、切り替えられること', async () => {
    const i18n = createI18n('ja');
    expect(i18n.t('launcher.search.placeholder')).toBe('アイテムを検索…');
    await i18n.changeLanguage('en');
    expect(i18n.t('launcher.search.placeholder')).toBe('Search items…');
  });
});
