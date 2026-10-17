import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * ウィンドウ位置の図（ミニマップ）の E2E
 *
 * 画面の並びはテストを流す PC のものなので、図の中身（画面の数・位置）は確かめず、
 * 出る場所・マウスを乗せたときの大きな図・セット全体の図の濃淡だけを確かめる
 */
test.use({ configTemplate: 'with-set-placements' });

test.describe('QuickDashLauncher - ウィンドウ位置の図', () => {
  test('単一アイテムの編集で、記録したウィンドウ位置の図が出て、乗せると大きな図が出る', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    try {
      const adminUtils = new TestUtils(adminWindow);
      await adminWindow
        .locator('.raw-item-row', { hasText: 'メモ帳' })
        .locator('button.detail-edit-button')
        .click();
      const register = await adminUtils.waitForRegisterWindow(electronApp);
      await register.locator('.options-toggle', { hasText: 'ウィンドウ' }).click();

      const field = register.locator('.set-placement-with-map');
      await expect(field.locator('svg.placement-minimap-small')).toBeVisible();
      await expect(field.locator('.pm-window')).toHaveCount(1);
      await expect(field.locator('.set-placement-text')).toContainText('📍');

      await field.locator('.placement-minimap-trigger').hover();
      const popover = register.locator('.placement-minimap-popover');
      await expect(popover.locator('svg.placement-minimap-large')).toBeVisible();
      await expect(popover.locator('.placement-minimap-caption')).not.toBeEmpty();
      await register.mouse.move(0, 0);
      await expect(popover).toHaveCount(0);
    } finally {
      await adminWindow.close();
    }
  });

  test('セットの編集で、行に極小の図、上にセット全体の図が出て、乗せた行だけが濃くなる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    try {
      const adminUtils = new TestUtils(adminWindow);
      await adminWindow
        .locator('.raw-item-row', { hasText: '位置つきセット' })
        .locator('button.detail-edit-button')
        .click();
      const register = await adminUtils.waitForRegisterWindow(electronApp);
      const rows = register.locator('.set-editor-row');
      await expect(rows).toHaveCount(3);

      await test.step('位置のある行だけに極小の図と行番号が出る', async () => {
        await expect(rows.nth(0).locator('svg.placement-minimap-tiny')).toBeVisible();
        await expect(rows.nth(1).locator('svg.placement-minimap-tiny')).toHaveCount(0);
        await expect(rows.nth(2).locator('svg.placement-minimap-tiny')).toBeVisible();
        await expect(rows.nth(2).locator('.set-row-number')).toHaveText('3');
      });

      const map = register.locator('.set-editor-map');
      await test.step('セット全体の図に、位置のある 2 行が番号つきで出る', async () => {
        await expect(map.locator('.pm-window-number')).toHaveText(['1', '3']);
        await expect(map.locator('.pm-dim')).toHaveCount(0);
      });

      await test.step('行に乗せると、ほかの行の位置が薄くなる', async () => {
        await rows.nth(0).hover();
        await expect(map.locator('.pm-dim')).toHaveCount(1);
        await expect(map.locator('g:not(.pm-dim) > .pm-window-number')).toHaveText('1');
      });

      await test.step('行の極小の図に乗せると大きな図が出る', async () => {
        await rows.nth(2).locator('.placement-minimap-trigger').hover();
        await expect(register.locator('.placement-minimap-popover svg')).toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });
});
