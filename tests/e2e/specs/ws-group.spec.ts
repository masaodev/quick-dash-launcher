import type { ElectronApplication } from '@playwright/test';
import type { JsonItem } from '@common/types';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/** 指定したグループの切り離しウィンドウが開いているか（window.name が detached-group:<id>） */
async function hasDetachedWindow(electronApp: ElectronApplication, groupId: string) {
  for (const page of electronApp.windows()) {
    const name = await page.evaluate(() => window.name).catch(() => '');
    if (name === `detached-group:${groupId}`) return true;
  }
  return false;
}

async function isMainWindowVisible(electronApp: ElectronApplication) {
  return electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some(
      (win) => win.getTitle() === 'QuickDashLauncher' && win.isVisible()
    )
  );
}

/**
 * WSグループ: ワークスペースのグループをランチャーの一覧と検索に並べ、選ぶと切り離しウィンドウで開く
 */
test.describe('QuickDashLauncher - WSグループ', () => {
  test('アイテム管理の ▼ から追加し、ランチャーで選ぶと切り離しウィンドウが開き、メインは残る', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    const [work, hobby] = await test.step('ワークスペースにグループを 3 つ作る', async () =>
      mainWindow.evaluate(async () => {
        const api = window.electronAPI.workspaceAPI;
        const created = [];
        for (const name of ['E2E 仕事', 'E2E 趣味', 'E2E 予備']) {
          created.push(await api.createGroup(name));
        }
        return created.map((group) => group.id);
      }));

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    try {
      await test.step('▼ の「ワークスペースのグループを検索に出す」でダイアログが開く', async () => {
        await adminWindow.locator('.toolbar-split-toggle').click();
        await adminWindow.getByTestId('add-ws-group').click();
        await expect(adminWindow.getByTestId('ws-group-modal')).toBeVisible();
        await expect(adminWindow.getByTestId('ws-group-list')).toContainText('E2E 予備');
        // 既定は「すべてのグループ」
        await expect(adminWindow.getByTestId('ws-group-scope-all')).toBeChecked();
        // 「選んだグループ」で何も選んでいなければ追加できない
        await adminWindow.getByTestId('ws-group-scope-selected').check();
        await expect(adminWindow.getByTestId('ws-group-confirm')).toBeDisabled();
      });

      await test.step('2 つ選び、前に付ける文字を入れると、見え方に出る', async () => {
        await adminWindow.getByTestId(`ws-group-check-${hobby}`).check();
        await adminWindow.getByTestId(`ws-group-check-${work}`).check();
        await adminWindow.getByTestId('ws-group-prefix').fill('WS: ');
        const preview = adminWindow.getByTestId('ws-group-preview');
        // 並びは選んだ順でなくワークスペースの順
        await expect(preview.locator('li')).toHaveText(['WS: E2E 仕事', 'WS: E2E 趣味']);
        await new TestUtils(adminWindow).attachScreenshot(testInfo, 'WSグループのダイアログ');
      });

      await test.step('追加すると一覧に WSグループの行が出て、保存するとデータファイルに書かれる', async () => {
        await adminWindow.getByTestId('ws-group-confirm').click();
        await expect(adminWindow.getByTestId('ws-group-modal')).toHaveCount(0);
        await expect(adminWindow.locator('.type-fixed').first()).toHaveText('WSグループ');
        await expect(adminWindow.getByText('選んだグループ 2 件')).toBeVisible();
        await expect(adminWindow.getByText('選んだワークスペースグループ（2 件）')).toBeVisible();

        await adminWindow.locator('button:has-text("変更を保存")').click();
        await adminWindow.getByTestId('confirm-dialog-confirm-button').click();
        await expect
          .poll(() =>
            configHelper
              .readDataFile('data.json')
              .items.find((item: JsonItem) => item.type === 'wsgroup')
          )
          .toMatchObject({
            type: 'wsgroup',
            scope: 'selected',
            // 選んだ順でなく、ワークスペースの順で書く
            groupIds: [work, hobby],
            options: { prefix: 'WS: ' },
          });
      });
    } finally {
      await adminWindow.close();
    }

    await test.step('ランチャーで検索すると、窓の形のアイコン（上の帯がグループの色）で並ぶ', async () => {
      await utils.searchFor('E2E');
      const items = mainWindow.locator('.item', { hasText: 'WS: E2E' });
      await expect(items).toHaveCount(2);
      await expect(items.first().locator('.ws-group-item-icon')).toBeVisible();
      // ワークスペースのグループだと分かる札
      await expect(items.first().locator('.ws-group-badge')).toHaveText('ワークスペースグループ');
      // 選んでいないグループは並ばない
      await expect(mainWindow.locator('.item', { hasText: 'E2E 予備' })).toHaveCount(0);
    });

    await test.step('Enter で切り離しウィンドウが開き、ランチャーは隠れない', async () => {
      // 管理ウィンドウを開いたときにランチャーは隠れているので、出し直す
      await electronApp.evaluate(({ BrowserWindow }) => {
        const main = BrowserWindow.getAllWindows().find(
          (w) => w.getTitle() === 'QuickDashLauncher'
        );
        main?.show();
        main?.focus();
      });
      await expect.poll(() => isMainWindowVisible(electronApp)).toBe(true);
      await utils.searchFor('WS: E2E 仕事');
      await expect(mainWindow.locator('.item.selected')).toContainText('WS: E2E 仕事');
      await mainWindow.keyboard.press('Enter');
      await expect.poll(() => hasDetachedWindow(electronApp, work), { timeout: 10000 }).toBe(true);
      expect(await isMainWindowVisible(electronApp)).toBe(true);
    });

    await test.step('グループを改名すると、ランチャーの名前も変わる', async () => {
      await mainWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.updateGroup(id, { displayName: 'E2E 副業' }),
        hobby
      );
      await utils.searchFor('E2E');
      await expect(mainWindow.locator('.item', { hasText: 'WS: E2E 副業' })).toHaveCount(1);
      await expect(mainWindow.locator('.item', { hasText: 'WS: E2E 趣味' })).toHaveCount(0);
    });
  });
});
