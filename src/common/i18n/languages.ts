/**
 * 表示言語の種類と決め方
 *
 * 設定（`language`）は auto・ja・en のどれか。auto のときは OS の表示言語で決め、
 * 日本語なら ja、それ以外は en にする。
 */

/** 画面に使う言語 */
export type AppLanguage = 'ja' | 'en';

/** 設定で選べる値（auto は OS の表示言語に合わせる） */
export type LanguageSetting = 'auto' | AppLanguage;

export const APP_LANGUAGES: readonly AppLanguage[] = ['ja', 'en'];

export const LANGUAGE_SETTINGS: readonly LanguageSetting[] = ['auto', 'ja', 'en'];

/** 設定の既定値 */
export const DEFAULT_LANGUAGE_SETTING: LanguageSetting = 'auto';

/** 辞書に訳が無いときに使う言語（日本語が正本） */
export const FALLBACK_LANGUAGE: AppLanguage = 'ja';

export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return typeof value === 'string' && (LANGUAGE_SETTINGS as readonly string[]).includes(value);
}

/**
 * 設定と OS の表示言語から、画面に使う言語を決める
 *
 * @param setting 設定の値（不正な値は auto とみなす）
 * @param osLanguages OS の表示言語（優先順。例: ['ja-JP', 'en-US']）
 */
export function resolveLanguage(setting: unknown, osLanguages: readonly string[]): AppLanguage {
  if (setting === 'ja' || setting === 'en') return setting;
  const first = osLanguages[0]?.toLowerCase() ?? '';
  return first === 'ja' || first.startsWith('ja-') ? 'ja' : 'en';
}
