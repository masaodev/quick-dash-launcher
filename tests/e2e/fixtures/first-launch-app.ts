import path from 'path';

import { test as base, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';

import { ConfigFileHelper } from '../helpers/config-file-helper';

// Electronアプリとメインウィンドウを提供するフィクスチャの型定義
type ElectronFixtures = {
  configHelper: ConfigFileHelper;
  electronApp: ElectronApplication;
  mainWindow: Page;
};

/**
 * 初回起動テスト用のElectronアプリケーションフィクスチャ
 *
 * このフィクスチャは以下を提供します：
 * - configHelper: 設定ファイル操作ヘルパー
 * - electronApp: Electronアプリケーションインスタンス
 * - mainWindow: メインウィンドウページ
 *
 * 通常のフィクスチャとの違い：
 * - first-launchテンプレートを使用（settings.jsonなし）
 * - 一時ディレクトリを使用してテストを実行
 * - テスト成功時のみクリーンアップ
 */
export const test = base.extend<ElectronFixtures>({
  // 設定ファイルヘルパーフィクスチャ（一時ディレクトリを作成）
  // eslint-disable-next-line no-empty-pattern
  configHelper: async ({}, use, testInfo) => {
    // 一時ディレクトリを作成してfirst-launchテンプレートを読み込み
    const configHelper = ConfigFileHelper.createTempConfigDir(testInfo.testId, 'first-launch');
    await use(configHelper);

    // テスト成功時のみクリーンアップ（失敗時はデバッグ用に残す）
    if (testInfo.status === 'passed') {
      configHelper.cleanup();
    }
  },

  // Electronアプリケーションを起動するフィクスチャ
  electronApp: async ({ configHelper }, use) => {
    // アプリケーションのメインファイルパス
    const electronAppPath = path.join(process.cwd(), 'dist', 'main', 'main.js');

    // 一時ディレクトリのパスを取得
    const testConfigDir = configHelper.getConfigDir();

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

    // テストでアプリケーションを使用
    await use(electronApp);

    // テスト完了後にアプリケーションを終了
    await electronApp.close();
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
