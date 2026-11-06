import type { i18n } from 'i18next';
import { FALLBACK_LANGUAGE, setFallbackT } from '@common/i18n';
import { createI18n } from '@common/i18n/resources';

/**
 * main プロセスの i18next（右クリックメニュー・トレイ・ダイアログ・トースト・CLI の応答を `mainI18n.t()` で訳す）
 *
 * 起動直後は正本の言語で作り、i18nService.ts の applyLanguageSetting() が設定に合わせて切り替える。
 * 他のサービスから import しても循環しないよう、ほかのモジュールに依存しないこのファイルに置く。
 * 言語が変わったときに作り直すもの（トレイのメニューなど）は `mainI18n.on('languageChanged', …)` で受ける。
 */
export const mainI18n: i18n = createI18n(FALLBACK_LANGUAGE);

// t を渡されなかった common の関数（データファイル・ワークスペースの解析）が使う、正本の言語の t
// （言語を切り替えても正本の言語で引けるよう、同じインスタンスの言語を固定した t を渡す）
setFallbackT(mainI18n.getFixedT(FALLBACK_LANGUAGE));
