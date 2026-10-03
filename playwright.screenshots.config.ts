import { defineConfig } from '@playwright/test';

/**
 * 画面仕様書（docs/screens/）の画面イメージを撮る設定
 *
 * 通常の E2E（playwright.config.ts）とは別に、`npm run docs:screenshots` で手動実行する。
 * 撮った画像は docs/screens/images/ に上書き保存される
 */
export default defineConfig({
  testDir: './tests/screenshots',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    actionTimeout: 10000,
    trace: 'off',
    screenshot: 'off',
  },
  outputDir: 'test-results/screenshots-artifacts',
});
