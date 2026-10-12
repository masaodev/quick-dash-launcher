import type { ElectronApplication } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 画面が QDL の HTML の外へ移らない（main の installNavigationGuard）
 *
 * 止めた移動は Playwright の側で「移動中」のまま残り、ページへのロケーターが待ち続けるので、
 * 確かめるのはメインプロセスから webContents に直接聞く
 */
async function mainPageState(
  electronApp: ElectronApplication
): Promise<{ url: string; itemCount: number }> {
  return electronApp.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'QuickDashLauncher');
    if (!win) return { url: '', itemCount: 0 };
    const itemCount = await win.webContents.executeJavaScript(
      'document.querySelectorAll(".item").length'
    );
    return { url: win.webContents.getURL(), itemCount };
  });
}

test.describe('QuickDashLauncher - ナビゲーションの制御', () => {
  test('メインウィンドウから外部のページへは移らない', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const before = await mainPageState(electronApp);
    expect(before.itemCount).toBeGreaterThan(0);

    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'QuickDashLauncher');
      void win?.webContents.executeJavaScript("window.location.href = 'https://example.com/'");
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const after = await mainPageState(electronApp);
    expect(after.url).toBe(before.url);
    expect(after.itemCount).toBe(before.itemCount);
  });
});
