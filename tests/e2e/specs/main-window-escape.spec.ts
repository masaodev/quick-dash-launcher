import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * Esc でメインウィンドウを隠す（メインプロセスの before-input-event）
 * - ウィンドウ検索で選んでいるあいだは、Esc をページに渡して選択を外すのに使い、隠さない
 */

async function isMainWindowVisible(electronApp: ElectronApplication): Promise<boolean> {
  return electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some(
      (win) => win.getTitle() === 'QuickDashLauncher' && win.isVisible()
    )
  );
}

async function expectMainWindowHidden(electronApp: ElectronApplication): Promise<void> {
  await expect
    .poll(() => isMainWindowVisible(electronApp), {
      timeout: 5000,
      message: 'メインウィンドウが隠れませんでした',
    })
    .toBe(false);
}

/**
 * Esc を OS のキー入力と同じ経路で送る。Playwright の keyboard.press はページに直接届き、
 * メインプロセスの before-input-event を通らないので、隠す処理を試せない
 */
async function pressEscape(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'QuickDashLauncher');
    win?.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    win?.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  });
}

/** Shift+Tab でウィンドウ検索モードに切り替え、OS のウィンドウの一覧が出るのを待つ */
async function enterWindowSearch(mainWindow: Page): Promise<number> {
  await mainWindow.keyboard.press('Shift+Tab');
  // 通常モードのアイテムと見分けるため、ウィンドウの行（.window-item）が出るのを待って数える
  await expect(mainWindow.locator('.window-item').first()).toBeVisible({ timeout: 10000 });
  return mainWindow.locator('.window-item').count();
}

test.describe('QuickDashLauncher - Esc でメインウィンドウを隠す', () => {
  test('通常モードの Esc で隠れる', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    expect(await isMainWindowVisible(electronApp)).toBe(true);

    await pressEscape(electronApp);

    await expectMainWindowHidden(electronApp);
  });

  test('ウィンドウ検索で何も選んでいなければ Esc で隠れる', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await enterWindowSearch(mainWindow);

    await pressEscape(electronApp);

    await expectMainWindowHidden(electronApp);
  });

  test('ウィンドウ検索で選んでいるときの Esc は選択を外すだけで、もう一度で隠れる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const count = await enterWindowSearch(mainWindow);
    // 範囲を選ぶには 2 行要る（一覧は実際に開いているウィンドウ）
    test.skip(count < 2, '開いているウィンドウが 2 つ未満');

    await mainWindow.keyboard.press('Shift+ArrowDown');
    await expect(mainWindow.locator('.item-mark')).toHaveCount(2);

    await test.step('1 回目の Esc: 選択が外れ、隠れない', async () => {
      await pressEscape(electronApp);
      await expect(mainWindow.locator('.item-mark')).toHaveCount(0);
      expect(await isMainWindowVisible(electronApp)).toBe(true);
    });

    await test.step('2 回目の Esc: 隠れる', async () => {
      await pressEscape(electronApp);
      await expectMainWindowHidden(electronApp);
    });
  });
});
