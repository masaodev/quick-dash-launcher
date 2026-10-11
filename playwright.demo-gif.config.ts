import { defineConfig } from '@playwright/test';

/**
 * README のデモ GIF の素材と画面イメージを撮る設定
 *
 * `npm run docs:demo-gif` で手動実行する。撮った画像は test-results/demo-gif/ に置き、
 * scripts/make-demo-gif.mjs が docs/images/ の GIF にまとめる。
 * README の「画面」の画面イメージ（登録画面・管理画面）は `npm run docs:readme-images` で
 * docs/images/readme-*.png に直接保存する
 */
export default defineConfig({
  testDir: './tests/demo-gif',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    actionTimeout: 10000,
    trace: 'off',
    screenshot: 'off',
  },
  outputDir: 'test-results/demo-gif-artifacts',
});
