import i18next, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  createI18nOptions,
  FALLBACK_LANGUAGE,
  setFallbackT,
  type AppLanguage,
  type LocaleMessages,
} from '@common/i18n';

/**
 * 辞書は言語ごとに別のチャンクにして、使う言語の分だけ読む（全ウィンドウが読む共通のチャンクに、
 * 使わない言語の辞書を入れない。A3-254 M2）
 */
const LOCALE_LOADERS: Record<AppLanguage, () => Promise<LocaleMessages>> = {
  ja: () => import('@common/i18n/locales/ja').then((m) => m.ja),
  en: () => import('@common/i18n/locales/en').then((m) => m.en),
};

/** 表示する言語と、訳が無いときの正本の言語の辞書を読む */
async function loadResources(language: AppLanguage): Promise<Resource> {
  const languages = [...new Set([language, FALLBACK_LANGUAGE])];
  const entries = await Promise.all(
    languages.map(async (lang) => [lang, { translation: await LOCALE_LOADERS[lang]() }] as const)
  );
  return Object.fromEntries(entries);
}

/** main が決めた今の表示言語（取れなければ正本の言語） */
async function fetchLanguage(): Promise<AppLanguage> {
  try {
    return await window.electronAPI.getLanguage();
  } catch {
    return FALLBACK_LANGUAGE;
  }
}

function applyDocumentLanguage(language: AppLanguage): void {
  document.documentElement.lang = language;
}

/**
 * ウィンドウごとに i18next を初期化する（各入口で描画の前に呼ぶ）
 *
 * 設定が変わったら言語を取り直し、変わっていれば切り替える（useTranslation を使う部品が描き直される）。
 * 切り替え先の辞書をまだ読んでいなければ、読んでから切り替える。
 */
export async function initRendererI18n(): Promise<void> {
  const language = await fetchLanguage();
  await i18next.use(initReactI18next).init({
    ...createI18nOptions(language, await loadResources(language)),
    react: { useSuspense: false },
  });
  setFallbackT(i18next.getFixedT(FALLBACK_LANGUAGE));
  applyDocumentLanguage(language);

  window.electronAPI.onSettingsChanged(() => {
    void fetchLanguage().then(async (next) => {
      if (next === i18next.language) return;
      if (!i18next.hasResourceBundle(next, 'translation')) {
        i18next.addResourceBundle(next, 'translation', await LOCALE_LOADERS[next]());
      }
      await i18next.changeLanguage(next);
      applyDocumentLanguage(next);
    });
  });
}
