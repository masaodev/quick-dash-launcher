import path from 'path';
import fs from 'fs';

import { test as base, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';

// Electronアプリとメインウィンドウを提供するフィクスチャの型定義
type ElectronFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
};

/**
 * 初回起動テスト用のElectronアプリケーションフィクスチャ
 *
 * このフィクスチャは以下を提供します：
 * - electronApp: Electronアプリケーションインスタンス
 * - mainWindow: メインウィンドウページ
 *
 * 通常のフィクスチャとの違い：
 * - 専用の設定フォルダ（e2e/first-launch）を使用して他のテストと分離
 * - テスト前に設定ファイル（settings.json）を削除して初回起動状態を再現
 * - テスト後も設定ファイルを削除して次回のテストに備える
 */
export const test = base.extend<ElectronFixtures>({
  // Electronアプリケーションを起動するフィクスチャ
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    // アプリケーションのメインファイルパス
    const electronAppPath = path.join(process.cwd(), 'dist', 'main', 'main.js');

    // 初回起動テスト専用の設定フォルダパス（他のテストと分離）
    const testConfigDir = path.join(process.cwd(), 'tests', 'e2e', 'configs', 'first-launch');

    // テスト用の設定フォルダが存在しない場合は作成
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }

    const settingsFilePath = path.join(testConfigDir, 'settings.json');

    // 既存の設定ファイルが存在する場合は削除（初回起動状態を再現）
    if (fs.existsSync(settingsFilePath)) {
      fs.unlinkSync(settingsFilePath);
    }

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

    // テスト完了後、次回の初回起動テストのために設定ファイルを削除
    if (fs.existsSync(settingsFilePath)) {
      fs.unlinkSync(settingsFilePath);
    }
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
