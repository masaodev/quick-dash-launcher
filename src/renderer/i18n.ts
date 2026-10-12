import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { createI18nOptions, FALLBACK_LANGUAGE, type AppLanguage } from '@common/i18n';

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
 */
export async function initRendererI18n(): Promise<void> {
  const language = await fetchLanguage();
  await i18next.use(initReactI18next).init({
    ...createI18nOptions(language),
    react: { useSuspense: false },
  });
  applyDocumentLanguage(language);

  window.electronAPI.onSettingsChanged(() => {
    void fetchLanguage().then(async (next) => {
      if (next === i18next.language) return;
      await i18next.changeLanguage(next);
      applyDocumentLanguage(next);
    });
  });
}
