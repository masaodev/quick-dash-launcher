import type { InitOptions, Resource, TFunction } from 'i18next';

import { FALLBACK_LANGUAGE, type AppLanguage } from './languages';

export * from './languages';
export { flattenMessages, type LocaleMessages } from './messages';

/**
 * main と renderer で共通の初期化オプション
 * @param resources 読み込んだ辞書（main・テストは `./resources` の I18N_RESOURCES、画面は使う言語の分だけ）
 */
export function createI18nOptions(language: AppLanguage, resources: Resource): InitOptions {
  return {
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    resources,
    // React も main の文言（トースト・メニュー）も HTML として扱わないので、差し込みをエスケープしない
    interpolation: { escapeValue: false },
    returnNull: false,
    // 辞書は読み込んでから渡すので同期で初期化する（init 直後から t() が使える）
    initAsync: false,
  };
}

let fallbackT: TFunction | undefined;

/**
 * 正本の言語の t を登録する（t を渡されなかった common の関数の既定）
 *
 * このモジュールは辞書を読まない（画面の共通のチャンクに両方の辞書を入れないため）ので、
 * main（`mainI18n.ts`）・画面（`initRendererI18n`）・テストの準備が、それぞれの i18next から登録する
 */
export function setFallbackT(t: TFunction): void {
  fallbackT = t;
}

/**
 * 正本の言語の t（t を渡されなかった common の関数の既定。テストや、言語を決める前の呼び出し用）
 */
export function getFallbackT(): TFunction {
  if (!fallbackT) {
    // 呼び出し元は画面に出さない内部の誤りなので、内部向けの英語にする（setFallbackT を先に呼ぶ）
    throw new Error('fallback t is not registered (call setFallbackT first)');
  }
  return fallbackT;
}
