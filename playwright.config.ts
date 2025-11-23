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

  // ワーカー数（CI環境では1、ローカルでは不定）
  workers: process.env.CI ? 1 : undefined,

  // レポーター設定
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['list'],
    process.env.CI ? ['github'] : ['dot'],
  ],

  // 全テストでの共通設定
  use: {
    // トレース設定（すべてのテストで記録、スクリーンショット・スナップショット含む）
    trace: {
      mode: 'on',
      screenshots: true,
      snapshots: true,
      sources: true,
    },

    // スクリーンショット（全テストで撮影）
    screenshot: 'on',

    // ビデオ録画（全テストで録画）
    video: 'on',

    // アクションのタイムアウト
    actionTimeout: 10000,

    // ナビゲーションのタイムアウト
    navigationTimeout: 30000,
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
