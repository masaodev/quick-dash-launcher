/**
 * 日英の辞書を両方とも束ねたもの（main プロセスとテスト用）
 *
 * 画面（renderer）からは import しない。画面は使う言語の辞書だけを動的に読む（`src/renderer/i18n.ts`。
 * 全ウィンドウが読む共通のチャンクに、使わない言語の辞書まで入れないため。A3-254 M2）
 */
import i18next, { type i18n } from 'i18next';

import { en } from './locales/en';
import { ja } from './locales/ja';

import { createI18nOptions, type AppLanguage } from './index';

/** i18next に渡す辞書（名前空間は translation 1 つ） */
export const I18N_RESOURCES = {
  ja: { translation: ja },
  en: { translation: en },
} as const;

/**
 * main プロセス・テスト用に、独立した i18next のインスタンスを作る（同期で初期化される）
 */
export function createI18n(language: AppLanguage): i18n {
  const instance = i18next.createInstance();
  void instance.init(createI18nOptions(language, I18N_RESOURCES));
  return instance;
}
