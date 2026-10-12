/**
 * 日本語の辞書（正本）
 *
 * 画面に出す文言はここに書き、英語は en.ts に同じ形で書く（en.ts は型でこの形に縛られる）。
 * キーは英語の意味名で、領域ごとに分ける。用語は docs/architecture/glossary.md にそろえる。
 * 差し込みは {{name}} で書く（i18next の書式）。
 */
export const ja = {
  launcher: {
    search: {
      placeholder: '検索...',
      clear: '検索をクリア',
      modeNormal: '通常検索モード',
      modeWindow: '🪟 ウィンドウ検索モード',
      refreshWindows: '更新',
      reloadData: 'データ再読込',
      toggleMode: 'モード切り替え',
    },
  },
  settings: {
    language: {
      heading: '言語',
      label: '表示言語:',
      description:
        '画面に使う言語です。変えるとすぐに、開いているすべてのウィンドウに反映されます。',
      options: {
        auto: '自動（Windows の表示言語に合わせる）',
        ja: '日本語',
        en: 'English',
      },
    },
  },
} as const;
