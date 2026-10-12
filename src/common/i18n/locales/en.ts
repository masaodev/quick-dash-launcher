import type { LocaleMessages } from '../messages';

/**
 * 英語の辞書（ja.ts の訳）
 *
 * キーの形は ja.ts と同じでなければ型エラーになる（足りない・余分なキーを止める）。
 * 書き方は Microsoft Writing Style Guide に合わせる（sentence case など。docs/architecture/glossary.md）。
 */
export const en: LocaleMessages = {
  launcher: {
    search: {
      placeholder: 'Search...',
      clear: 'Clear search',
      modeNormal: 'Normal search',
      modeWindow: '🪟 Window search',
      refreshWindows: 'Refresh',
      reloadData: 'Reload data',
      toggleMode: 'Switch mode',
    },
  },
  settings: {
    language: {
      heading: 'Language',
      label: 'Display language:',
      description:
        'The language used in QuickDashLauncher. Changes apply right away to all open windows.',
      options: {
        auto: 'Automatic (match the Windows display language)',
        ja: '日本語',
        en: 'English',
      },
    },
  },
};
