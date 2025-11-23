import path from 'path';

import { test as base, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { ConfigFileHelper } from '../helpers/config-file-helper';

// Electronアプリとメインウィンドウを提供するフィクスチャの型定義
type ElectronFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
};

/**
 * Electronアプリケーション用のPlaywrightフィクスチャ
 *
 * このフィクスチャは以下を提供します：
 * - electronApp: Electronアプリケーションインスタンス
 * - mainWindow: メインウィンドウページ
 */
export const test = base.extend<ElectronFixtures>({
  // Electronアプリケーションを起動するフィクスチャ
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    // アプリケーションのメインファイルパス
    const electronAppPath = path.join(process.cwd(), 'dist', 'main', 'main.js');

    // テスト用の設定フォルダパス（tests/fixtures/e2e/default）
    const testConfigDir = path.join(process.cwd(), 'tests', 'fixtures', 'e2e', 'default');

    // ConfigFileHelperでバックアップ
    const configHelper = new ConfigFileHelper(testConfigDir);
    configHelper.backupAll();

    // テスト用のElectronアプリケーション設定
    const electronApp = await electron.launch({
      args: [electronAppPath],
      // テスト環境であることを示すフラグを設定
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        // テスト実行時はグローバルホットキーを無効化
        DISABLE_GLOBAL_HOTKEY: '1',
        // テスト実行時はウィンドウを自動表示
        SHOW_WINDOW_ON_STARTUP: '1',
        // テスト実行時はスプラッシュウィンドウをスキップ
        SKIP_SPLASH_WINDOW: '1',
        // テスト用の設定パスを指定（本番環境の設定に影響しない）
        QUICK_DASH_CONFIG_DIR: testConfigDir,
      },
      // Electronアプリのコンソール出力をテストコンソールに転送
      executablePath: undefined, // システムにインストールされたElectronを使用
    });

    // Electronアプリのcontextを取得してトレースを開始
    const context = electronApp.context();
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });

    // テストでアプリケーションを使用
    await use(electronApp);

    // トレースを停止して保存（テスト名を含むパスに保存）
    await context.tracing.stop({
      path: path.join(process.cwd(), 'test-results', 'traces', `trace-${Date.now()}.zip`),
    });

    // テスト完了後にアプリケーションを終了
    await electronApp.close();

    // 設定ファイルを復元
    configHelper.restoreAll();
  },

  // メインウィンドウを取得するフィクスチャ
  mainWindow: async ({ electronApp }, use) => {
    // 最初のウィンドウを取得（メインウィンドウ）
    const mainWindow = await electronApp.firstWindow();

    // ウィンドウが完全に読み込まれるまで待機
    await mainWindow.waitForLoadState('domcontentloaded');

    // テストでメインウィンドウを使用
    await use(mainWindow);
  },
});

// expectをそのまま再エクスポート
export { expect } from '@playwright/test';
