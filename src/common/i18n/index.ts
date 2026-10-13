import i18next, { type i18n, type InitOptions, type TFunction } from 'i18next';

import { en } from './locales/en';
import { ja } from './locales/ja';
import { FALLBACK_LANGUAGE, type AppLanguage } from './languages';

export * from './languages';
export { flattenMessages, type LocaleMessages } from './messages';

/** i18next に渡す辞書（名前空間は translation 1 つ） */
export const I18N_RESOURCES = {
  ja: { translation: ja },
  en: { translation: en },
} as const;

/** main と renderer で共通の初期化オプション */
export function createI18nOptions(language: AppLanguage): InitOptions {
  return {
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    resources: I18N_RESOURCES,
    // React も main の文言（トースト・メニュー）も HTML として扱わないので、差し込みをエスケープしない
    interpolation: { escapeValue: false },
    returnNull: false,
    // 辞書は同梱なので同期で初期化する（init 直後から t() が使える）
    initAsync: false,
  };
}

/**
 * main プロセス・テスト用に、独立した i18next のインスタンスを作る（同期で初期化される）
 */
export function createI18n(language: AppLanguage): i18n {
  const instance = i18next.createInstance();
  void instance.init(createI18nOptions(language));
  return instance;
}

let fallbackT: TFunction | undefined;

/**
 * 正本の言語の t（t を渡されなかった common の関数の既定。テストや、言語を決める前の呼び出し用）
 */
export function getFallbackT(): TFunction {
  fallbackT ??= createI18n(FALLBACK_LANGUAGE).t;
  return fallbackT;
}
