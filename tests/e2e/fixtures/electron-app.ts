import path from 'path';

import { test as base, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';

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
  electronApp: async (_, use) => {
    // アプリケーションのメインファイルパス
    const electronAppPath = path.join(process.cwd(), 'dist', 'main', 'main.js');

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
