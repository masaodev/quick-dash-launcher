import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * ブックマークの手動取込と自動取込のあいだの導線
 * - 一括取込メニューに「ブックマーク自動取込の設定…」がある
 * - 手動取込モーダルの案内から、設定タブの「ブックマーク自動取込」カテゴリを直接開ける（モーダルは閉じる）
 * - 自動取込の設定から「手動で取り込む」で、アイテム管理タブの手動取込モーダルが開く
 */
test.describe('QuickDashLauncher - ブックマーク取込の導線', () => {
  test('手動取込 → 自動取込の設定 → 手動取込 と行き来できる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');

    try {
      await test.step('一括取込メニューに自動取込の設定がある', async () => {
        await adminWindow
          .locator('.dropdown-trigger-btn', { hasText: 'アイテムを一括取り込み' })
          .first()
          .click();
        await expect(
          adminWindow.locator('.dropdown-item', { hasText: 'ブックマーク自動取込の設定' })
        ).toBeVisible();
        await adminWindow
          .locator('.dropdown-item', { hasText: 'ブラウザのブックマークを追加' })
          .click();
        await adminWindow
          .locator('.bookmark-import-modal')
          .waitFor({ state: 'visible', timeout: 10000 });
      });

      await test.step('手動取込モーダルの案内から設定の該当カテゴリを開く', async () => {
        await expect(adminWindow.locator('.import-hint-bar')).toContainText('自動取込');
        await adminWindow
          .locator('.import-hint-bar .btn', { hasText: '自動取込の設定を開く' })
          .click();
        await expect(
          adminWindow.locator('.menu-item.active', { hasText: 'ブックマーク自動取込' })
        ).toBeVisible({ timeout: 5000 });
        await expect(adminWindow.locator('.bookmark-import-modal')).toHaveCount(0);
      });

      await test.step('自動取込の設定から手動取込モーダルを開く', async () => {
        await adminWindow.locator('.auto-import-hint .btn', { hasText: '手動で取り込む' }).click();
        await adminWindow
          .locator('.bookmark-import-modal')
          .waitFor({ state: 'visible', timeout: 10000 });
        await expect(
          adminWindow.locator('.tab-button.active', { hasText: 'アイテム管理' })
        ).toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });
});
