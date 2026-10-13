import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 表示言語の切り替え
 * - settings.json の language を変えて F5 すると、メインウィンドウ（検索欄・ヒント行）がその言語になる
 * - 設定タブの「表示言語」で変えると、開いているメインウィンドウ・管理ウィンドウにその場で反映される
 */
test.describe('QuickDashLauncher - 表示言語', () => {
  test('言語を切り替えると、開いているウィンドウにその場で反映される', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const searchBox = mainWindow.locator('input.search-box');

    await test.step('E2E のひな形は日本語で始まる', async () => {
      await utils.waitForPageLoad();
      await expect(searchBox).toHaveAttribute('placeholder', '検索...');
      await expect(mainWindow.locator('html')).toHaveAttribute('lang', 'ja');
    });

    await test.step('settings.json を English にして F5 すると英語になる', async () => {
      configHelper.updateSettings({ language: 'en' });
      await utils.reloadWithF5();
      await expect(searchBox).toHaveAttribute('placeholder', 'Search...');
      await expect(mainWindow.locator('.search-mode-label')).toHaveText('Normal search');
      await expect(mainWindow.locator('html')).toHaveAttribute('lang', 'en');
      // メインウィンドウの他の文言（ヒント行）も英語になる
      await expect(mainWindow.getByTestId('keyboard-hint-bar')).toContainText(
        'Shift+Enter:Open containing folder'
      );
    });

    await test.step('設定タブの表示言語で日本語に戻すと、メインウィンドウも戻る', async () => {
      const adminWindow = await utils.openAdminWindow(electronApp, 'settings');
      const select = adminWindow.locator('select#language');
      // 管理ウィンドウも英語で開く
      await expect(adminWindow.locator('label[for="language"]')).toHaveText('Display language:');
      await expect(adminWindow.locator('.tab-button').first()).toHaveText('⚙️ Settings');
      await expect(adminWindow.locator('.settings-menu .menu-item').first()).toHaveText(
        '⚙️ General'
      );
      // アイテム管理も英語になる
      await adminWindow.locator('.tab-button').nth(1).click();
      await expect(adminWindow.locator('.tab-button').nth(1)).toHaveText('✏️ Item Manager');
      await expect(adminWindow.locator('th.name-column')).toContainText('Name');
      await expect(adminWindow.locator('.total-count')).toContainText('Total:');
      // ヘルプも英語になる
      await adminWindow.locator('.tab-button').nth(2).click();
      await expect(adminWindow.locator('.help-section-shortcuts h3')).toHaveText(
        '⌨️ Keyboard shortcuts'
      );
      await adminWindow.locator('.tab-button').first().click();
      await select.selectOption('ja');

      await expect(adminWindow.locator('label[for="language"]')).toHaveText('表示言語:');
      await expect(adminWindow.locator('.tab-button').first()).toHaveText('⚙️ 設定');
      await expect(adminWindow.locator('.settings-menu .menu-item').first()).toHaveText(
        '⚙️ 基本設定'
      );
      await expect(searchBox).toHaveAttribute('placeholder', '検索...');
      expect(configHelper.readSettings().language).toBe('ja');
    });
  });
});
