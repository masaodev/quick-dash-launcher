import { test as base } from './electron-app';

/**
 * 初回起動テスト用のフィクスチャ
 *
 * 通常のフィクスチャ（electron-app.ts）との違い：
 * - first-launch テンプレート（settings.json なし）で起動する
 * - ランチャーは DOM の読み込みを待ってから渡す
 */
export const test = base.extend({
  configTemplate: 'first-launch',

  mainWindow: async ({ mainWindow }, use) => {
    await mainWindow.waitForLoadState('domcontentloaded');
    await use(mainWindow);
  },
});

export { expect } from '@playwright/test';
