import type { ElectronApplication } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * メインウィンドウのキー（A3-148）
 * - Ctrl+C: 選んでいるアイテムのパスをコピー（検索欄で文字を選んでいるときは文字のコピー）
 * - Ctrl+Shift+C: 親フォルダのパスをコピー
 * - Shift+F10・アプリケーションキー: 選んでいる行の右クリックメニュー（検索欄の文字のメニューは出さない）
 */

async function readClipboard(electronApp: ElectronApplication): Promise<string> {
  return electronApp.evaluate(async ({ clipboard }) => await clipboard.readText());
}

/** 出たネイティブメニューを順に記録する（何個出たかも確かめるため） */
async function recordMenus(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ Menu }) => {
    const g = globalThis as { __e2eMenus?: string[][] };
    g.__e2eMenus = [];
    Menu.prototype.popup = function (this: { items: Array<{ type: string; label: string }> }) {
      g.__e2eMenus?.push(this.items.filter((i) => i.type !== 'separator').map((i) => i.label));
    };
  });
}

async function readMenus(electronApp: ElectronApplication): Promise<string[][]> {
  return electronApp.evaluate(() => (globalThis as { __e2eMenus?: string[][] }).__e2eMenus ?? []);
}

test.describe('QuickDashLauncher - メインウィンドウのコピーとメニューのキー', () => {
  test.beforeEach(async ({ mainWindow, configHelper }) => {
    configHelper.addItemToFile('data.json', {
      id: 'e2ekey01',
      type: 'item',
      displayName: 'キーで試すメモ帳',
      path: 'C:\\Windows\\System32\\notepad.exe',
    });
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();
  });

  test('Ctrl+C でパス、Ctrl+Shift+C で親フォルダのパスをコピーする', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.searchFor('キーで試す');
    await expect(mainWindow.locator('.item')).toHaveCount(1);
    const input = mainWindow.locator('input.search-box');

    await test.step('文字を選んでいないときの Ctrl+C はパスのコピー', async () => {
      await input.press('End');
      await input.press('Control+c');
      await expect
        .poll(() => readClipboard(electronApp))
        .toBe('C:\\Windows\\System32\\notepad.exe');
    });

    await test.step('Ctrl+Shift+C は親フォルダのパス', async () => {
      await input.press('Control+Shift+c');
      await expect.poll(() => readClipboard(electronApp)).toBe('C:\\Windows\\System32');
    });

    await test.step('検索欄で文字を選んでいるときの Ctrl+C は文字のコピー', async () => {
      await input.press('Control+a');
      await input.press('Control+c');
      await expect.poll(() => readClipboard(electronApp)).toBe('キーで試す');
    });
  });

  test('Shift+F10 とアプリケーションキーで、選んでいる行の右クリックメニューだけが出る', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.searchFor('キーで試す');
    await expect(mainWindow.locator('.item')).toHaveCount(1);
    const input = mainWindow.locator('input.search-box');

    for (const key of ['Shift+F10', 'ContextMenu']) {
      await recordMenus(electronApp);
      await input.press(key);
      await expect.poll(async () => (await readMenus(electronApp)).length).toBeGreaterThan(0);
      // 少し待って、検索欄の文字のメニューが後から出ないことも確かめる
      await mainWindow.waitForTimeout(500);
      const menus = await readMenus(electronApp);
      expect(menus).toHaveLength(1);
      expect(menus[0][0]).toBe('✏️ 編集');
      expect(menus[0]).toContain('📋 パスをコピー');
    }
  });
});
