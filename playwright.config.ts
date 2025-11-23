import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // テストファイルのディレクトリ
  testDir: './tests/e2e/specs',

  // テスト実行のタイムアウト（30秒）
  timeout: 30000,

  // 期待値のタイムアウト（5秒）
  expect: {
    timeout: 5000,
  },

  // テストが失敗したときの挙動
  fullyParallel: false,

  // 失敗したテストのリトライ回数
  retries: process.env.CI ? 2 : 0,

  // ワーカー数（CI環境では1、ローカルでは2に制限してリソース競合を防ぐ）
  workers: process.env.CI ? 1 : 2,

  // レポーター設定
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['list'],
    process.env.CI ? ['github'] : ['dot'],
  ],

  // 全テストでの共通設定
  use: {
    // トレース設定（失敗時のみ記録に変更してパフォーマンス改善）
    trace: {
      mode: 'retain-on-failure',
      screenshots: true,
      snapshots: true,
      sources: true,
    },

    // スクリーンショット（失敗時のみに変更してパフォーマンス改善）
    screenshot: 'only-on-failure',

    // ビデオ録画（失敗時のみに変更してパフォーマンス改善）
    video: 'retain-on-failure',

    // アクションのタイムアウト
    actionTimeout: 10000,

    // ナビゲーションのタイムアウト
    navigationTimeout: 5000,
  },

  // プロジェクト設定
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: null, // Electronアプリでは不要
      },
    },
  ],

  // テスト結果の出力ディレクトリ
  outputDir: 'test-results/test-artifacts',

  // グローバルセットアップとティアダウン（必要に応じて追加）
  // globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  // globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
});
