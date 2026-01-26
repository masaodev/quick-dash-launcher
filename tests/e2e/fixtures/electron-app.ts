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
 * Electronアプリケーション用のPlaywrightフィクスチャ
 *
 * このフィクスチャは以下を提供します：
 * - configHelper: 設定ファイル操作ヘルパー
 * - electronApp: Electronアプリケーションインスタンス
 * - mainWindow: メインウィンドウページ
 *
 * 一時ディレクトリを使用してテストを実行し、成功時のみクリーンアップします。
 */
export const test = base.extend<ElectronFixtures>({
  // 設定ファイルヘルパーフィクスチャ（一時ディレクトリを作成）
  // eslint-disable-next-line no-empty-pattern
  configHelper: async ({}, use, testInfo) => {
    // 一時ディレクトリを作成してbaseテンプレートを読み込み
    const configHelper = ConfigFileHelper.createTempConfigDir(testInfo.testId, 'base');
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

    // トレースを停止して保存（アプリが既に終了している場合はスキップ）
    try {
      // アプリケーションがまだ実行中か確認
      if (!electronApp.process()?.killed) {
        await context.tracing.stop({
          path: path.join(process.cwd(), 'test-results', 'traces', `trace-${Date.now()}.zip`),
        });
      }
    } catch (error) {
      // トレース停止でエラーが発生しても続行
      console.warn('トレース停止中にエラーが発生しましたが、続行します:', error);
    }

    // テスト完了後にアプリケーションを終了（まだ実行中の場合のみ）
    try {
      if (!electronApp.process()?.killed) {
        await electronApp.close();
      }
    } catch (error) {
      console.warn('アプリケーション終了中にエラーが発生しましたが、続行します:', error);
    }
  },

  // メインウィンドウを取得するフィクスチャ
  mainWindow: async ({ electronApp }, use) => {
    // メインウィンドウを探す関数（非同期）
    const findMainWindow = async (windows: Page[]): Promise<Page | undefined> => {
      // タイトルで判定（QuickDashLauncherがメインウィンドウ）
      for (const win of windows) {
        const title = await win.title();
        if (title === 'QuickDashLauncher') {
          return win;
        }
      }

      // フォールバック: URLで判定
      for (const win of windows) {
        const url = win.url();
        const isMainWindow =
          url.includes('index.html') &&
          !url.includes('workspace.html') &&
          !url.includes('admin.html') &&
          !url.includes('splash.html');
        if (isMainWindow) {
          return win;
        }
      }

      return undefined;
    };

    // メインウィンドウが見つかるまで最大10秒待機（ポーリング）
    let mainWindow: Page | undefined;
    const maxAttempts = 20; // 20回 × 500ms = 10秒
    const delayMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
      const windows = electronApp.windows();
      mainWindow = await findMainWindow(windows);
      if (mainWindow) {
        break;
      }

      // メインウィンドウが見つからない場合は少し待つ
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (!mainWindow) {
      throw new Error('メインウィンドウが見つかりません');
    }

    // テストでウィンドウを使用
    await use(mainWindow);
  },
});

export { expect } from '@playwright/test';
