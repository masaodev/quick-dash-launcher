import path from 'path';

import { test, expect } from '../fixtures/electron-app';
import { ConfigFileHelper } from '../helpers/config-file-helper';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - アイテムのタブ変更テスト', () => {
  let configHelper: ConfigFileHelper;

  test.beforeEach(async ({ mainWindow }) => {
    const configDir = path.join(process.cwd(), 'tests', 'fixtures', 'e2e', 'default');
    configHelper = new ConfigFileHelper(configDir);

    // テンプレートから強制的に復元して初期状態を保証
    configHelper.restoreDataFromTemplate('base');
    configHelper.restoreData2FromTemplate('data2-base');
    configHelper.loadSettingsTemplate('with-tabs');

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await mainWindow.reload();
    await utils.waitForPageLoad();
  });

  test.afterEach(async () => {
    // テンプレートから復元して次のテストのために初期状態に戻す
    configHelper.restoreDataFromTemplate('base');
    configHelper.restoreData2FromTemplate('data2-base');
  });

  test('アイテムの編集で保存先タブを変更すると別のタブに移動する', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('メインタブにアイテムが存在することを確認', async () => {
      // メインタブがアクティブであることを確認
      const mainTab = mainWindow.locator('.file-tab.active', { hasText: 'メイン' });
      await expect(mainTab).toBeVisible();

      // GitHubアイテムが表示されていることを確認
      const githubItem = mainWindow.locator('.item', { hasText: 'GitHub' });
      await expect(githubItem).toBeVisible();

      await utils.attachScreenshot(testInfo, '初期状態（メインタブ）');
    });

    await test.step('GitHubアイテムを右クリックして編集モーダルを開く', async () => {
      await utils.editItemByRightClick('GitHub');
      await utils.wait(300);

      const isModalVisible = await utils.isRegisterModalVisible();
      expect(isModalVisible).toBe(true);

      await utils.attachScreenshot(testInfo, '編集モーダル表示');
    });

    await test.step('保存先をサブ1タブに変更して更新', async () => {
      // 保存先セレクトボックスを直接操作してdata2.txtを選択
      const tabSelect = mainWindow.locator('.register-modal select').last();
      await tabSelect.selectOption({ value: 'data2.txt' });

      await utils.wait(300);
      await utils.attachScreenshot(testInfo, '保存先変更後');

      // 更新ボタンをクリック
      await utils.clickRegisterButton();
      await utils.wait(500);

      await utils.attachScreenshot(testInfo, '更新後');
    });

    await test.step('メインタブからGitHubアイテムが消えたことを確認', async () => {
      // ページをリロード
      await mainWindow.reload();
      await utils.waitForPageLoad();

      // メインタブがアクティブであることを確認
      const mainTab = mainWindow.locator('.file-tab.active', { hasText: 'メイン' });
      await expect(mainTab).toBeVisible();

      // GitHubアイテムが表示されなくなったことを確認
      const githubItem = mainWindow.locator('.item', { hasText: 'GitHub' });
      await expect(githubItem).not.toBeVisible({ timeout: 3000 });

      await utils.attachScreenshot(testInfo, 'メインタブ確認');
    });

    await test.step('サブ1タブに切り替えてGitHubアイテムが存在することを確認', async () => {
      // サブ1タブをクリック
      const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await subTab1.click();
      await utils.wait(500);

      // サブ1タブがアクティブになったことを確認
      const activeTab = mainWindow.locator('.file-tab.active', { hasText: 'サブ1' });
      await expect(activeTab).toBeVisible();

      // GitHubアイテムがサブ1タブに表示されることを確認
      const githubItem = mainWindow.locator('.item', { hasText: 'GitHub' });
      await expect(githubItem).toBeVisible({ timeout: 5000 });

      await utils.attachScreenshot(testInfo, 'サブ1タブ確認');
    });

    await test.step('data.txtとdata2.txtの内容を確認', async () => {
      // data.txtにGitHubが含まれていないことを確認
      const dataContent = configHelper.readData();
      expect(dataContent).not.toContain('GitHub');

      // data2.txtにGitHubが含まれていることを確認
      const data2Content = configHelper.readData2();
      expect(data2Content).toContain('GitHub');
    });
  });
});
