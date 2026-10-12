import type { i18n } from 'i18next';
import { createI18n, FALLBACK_LANGUAGE } from '@common/i18n';

/**
 * main プロセスの i18next（右クリックメニュー・トレイ・ダイアログ・トースト・CLI の応答を `mainI18n.t()` で訳す）
 *
 * 起動直後は正本の言語で作り、i18nService.ts の applyLanguageSetting() が設定に合わせて切り替える。
 * 他のサービスから import しても循環しないよう、ほかのモジュールに依存しないこのファイルに置く。
 * 言語が変わったときに作り直すもの（トレイのメニューなど）は `mainI18n.on('languageChanged', …)` で受ける。
 */
export const mainI18n: i18n = createI18n(FALLBACK_LANGUAGE);
