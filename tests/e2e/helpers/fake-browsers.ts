import type { ElectronApplication } from '@playwright/test';

/**
 * ブックマーク取込のテスト・画面イメージ用の、固定のブラウザとブックマーク
 *
 * 実行環境のブラウザ（本人のブックマーク）に依存しないよう、ブラウザ検出とブックマークの読み込みを
 * この結果に差し替える。Chrome に「個人」「仕事」の 2 プロファイル、Edge は無し
 */
export const FAKE_PROFILES = [
  { id: 'Default', displayName: '個人', bookmarkPath: 'fake://Default' },
  { id: 'Profile 1', displayName: '仕事', bookmarkPath: 'fake://Profile 1' },
];

type FakeBookmark = { displayName: string; url: string; folderPath: string };

export const FAKE_BOOKMARKS: Record<string, FakeBookmark[]> = {
  'fake://Default': [
    { displayName: 'Gmail', url: 'https://mail.google.com/', folderPath: 'bookmark_bar' },
    { displayName: 'GitHub', url: 'https://github.com/', folderPath: 'bookmark_bar/開発' },
    {
      displayName: 'MDN Web Docs',
      url: 'https://developer.mozilla.org/ja/',
      folderPath: 'bookmark_bar/開発',
    },
    {
      displayName: 'Electron ドキュメント',
      url: 'https://www.electronjs.org/ja/docs/latest',
      folderPath: 'bookmark_bar/開発',
    },
    { displayName: 'React', url: 'https://ja.react.dev/', folderPath: 'bookmark_bar/開発/React' },
    { displayName: '☆Vite', url: 'https://ja.vite.dev/', folderPath: 'bookmark_bar/開発/React' },
    { displayName: '☆Zenn', url: 'https://zenn.dev/', folderPath: 'bookmark_bar/読み物' },
    { displayName: 'Qiita', url: 'https://qiita.com/', folderPath: 'bookmark_bar/読み物' },
    {
      displayName: 'Yahoo!天気',
      url: 'https://weather.yahoo.co.jp/',
      folderPath: 'bookmark_bar/生活',
    },
    {
      displayName: '☆Google カレンダー',
      url: 'https://calendar.google.com/',
      folderPath: 'other',
    },
  ],
  'fake://Profile 1': [
    { displayName: '勤怠', url: 'https://kintai.example.com/', folderPath: 'bookmark_bar/社内' },
    { displayName: '社内 Wiki', url: 'https://wiki.example.com/', folderPath: 'bookmark_bar/社内' },
  ],
};

/** ブラウザ検出とブックマークの読み込みを、上の固定の結果に差し替える */
export async function stubBrowsers(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(
    ({ ipcMain }, { profiles, bookmarks }) => {
      ipcMain.removeHandler('detect-installed-browsers');
      ipcMain.handle('detect-installed-browsers', () => [
        { id: 'chrome', displayName: 'Google Chrome', installed: true, profiles },
        { id: 'edge', displayName: 'Microsoft Edge', installed: false, profiles: [] },
      ]);
      ipcMain.removeHandler('bookmark-auto-import:get-bookmarks-with-folders');
      ipcMain.handle(
        'bookmark-auto-import:get-bookmarks-with-folders',
        (_event, bookmarkPath: string) => bookmarks[bookmarkPath] ?? []
      );
    },
    { profiles: FAKE_PROFILES, bookmarks: FAKE_BOOKMARKS }
  );
}
