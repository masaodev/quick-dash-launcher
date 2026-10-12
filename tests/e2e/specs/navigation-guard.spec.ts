import type { ElectronApplication } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 画面がページ側から別の URL へ移らない（main の installNavigationGuard）
 *
 * 止めた移動は Playwright の側で「移動中」のまま残り、ページへのロケーターが待ち続けるので、
 * メインプロセスから webContents に直接聞く。ガードが壊れていれば、通信できなくてもエラーページが
 * 開いて URL が変わるので落ちる（about:blank への移動は Electron が通知を出さず止められないので試さない）
 */
async function mainWindowUrl(electronApp: ElectronApplication): Promise<string> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'QuickDashLauncher');
    return win?.webContents.getURL() ?? '';
  });
}

async function runInMainWindow(electronApp: ElectronApplication, script: string): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }, js) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'QuickDashLauncher');
    void win?.webContents.executeJavaScript(js);
  }, script);
}

test.describe('QuickDashLauncher - ナビゲーションの制御', () => {
  test('メインウィンドウはページ側から外部のページへ移らない', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const before = await mainWindowUrl(electronApp);
    expect(before).toMatch(/index\.html$/);

    await runInMainWindow(electronApp, "window.location.href = 'https://example.com/'");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await mainWindowUrl(electronApp)).toBe(before);
  });
});
