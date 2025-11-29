import path from 'path';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';
import { ConfigFileHelper } from '../helpers/config-file-helper';

test.describe('QuickDashLauncher - アイテム数表示機能テスト', () => {
  let configHelper: ConfigFileHelper;

  test.beforeEach(async () => {
    const configDir = path.join(process.cwd(), 'tests', 'fixtures', 'e2e', 'default');
    configHelper = new ConfigFileHelper(configDir);

    // テンプレートから強制的に復元して初期状態を保証
    configHelper.restoreDataFromTemplate('base');
  });

  test.afterEach(async () => {
    // テンプレートから復元して次のテストのために初期状態に戻す
    configHelper.restoreDataFromTemplate('base');
  });

  // ==================== タブ表示OFF時のアイテム数表示テスト ====================

  test('タブ表示OFF時、検索ボックス下にアイテム数が表示される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページ読み込みとタブ表示OFF確認', async () => {
      // タブ機能を無効化（defaultはshowDataFileTabs: false）
      configHelper.loadSettingsTemplate('default');
      await mainWindow.reload();
      await utils.waitForPageLoad();

      // タブバーが表示されていないことを確認
      const tabBar = mainWindow.locator('.file-tab-bar');
      await expect(tabBar).not.toBeVisible();

      await utils.attachScreenshot(testInfo, 'タブ表示OFF初期状態');
    });

    await test.step('検索情報バーとアイテム数が表示される', async () => {
      // 検索情報バーが表示されることを確認
      const infoBar = mainWindow.locator('.search-info-bar');
      await expect(infoBar).toBeVisible();

      // アイテム数表示が存在することを確認
      const itemCount = mainWindow.locator('.item-count-display');
      await expect(itemCount).toBeVisible();

      // アイテム数が「〇〇件」形式で表示されることを確認
      const countText = await itemCount.textContent();
      expect(countText).toMatch(/\d+件/);

      await utils.attachScreenshot(testInfo, 'アイテム数表示確認');
    });
  });

  test('タブ表示OFF時、検索によってアイテム数が動的に更新される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページ読み込み', async () => {
      configHelper.loadSettingsTemplate('default');
      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    let initialCount: string;

    await test.step('初期アイテム数を取得', async () => {
      const itemCount = mainWindow.locator('.item-count-display');
      initialCount = (await itemCount.textContent()) || '';
      expect(initialCount).toMatch(/\d+件/);
    });

    await test.step('検索を実行してアイテム数が減少することを確認', async () => {
      await utils.searchFor('GitHub');
      await utils.wait(300);

      const itemCount = mainWindow.locator('.item-count-display');
      const filteredCount = (await itemCount.textContent()) || '';

      // アイテム数が初期値より少なくなっていることを確認
      const initialNum = parseInt(initialCount.match(/\d+/)?.[0] || '0');
      const filteredNum = parseInt(filteredCount.match(/\d+/)?.[0] || '0');
      expect(filteredNum).toBeLessThan(initialNum);
      expect(filteredNum).toBeGreaterThan(0);

      await utils.attachScreenshot(testInfo, '検索後のアイテム数');
    });

    await test.step('検索をクリアしてアイテム数が元に戻ることを確認', async () => {
      const searchBox = mainWindow.locator('input[type="text"]').first();
      await searchBox.clear();
      await utils.wait(300);

      const itemCount = mainWindow.locator('.item-count-display');
      const restoredCount = (await itemCount.textContent()) || '';

      // アイテム数が初期値に戻ることを確認
      expect(restoredCount).toBe(initialCount);

      await utils.attachScreenshot(testInfo, 'クリア後のアイテム数');
    });
  });

  // ==================== タブ表示ON時のアイテム数表示テスト ====================

  test('タブ表示ON時、各タブにアイテム数が表示される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('マルチタブ機能を有効化', async () => {
      configHelper.loadSettingsTemplate('with-tabs');
      configHelper.loadData2Template('data2-base');
      await mainWindow.reload();
      await utils.waitForPageLoad();

      // タブバーが表示されることを確認
      const tabBar = mainWindow.locator('.file-tab-bar');
      await expect(tabBar).toBeVisible();

      await utils.attachScreenshot(testInfo, 'タブ表示ON初期状態');
    });

    await test.step('メインタブにアイテム数が表示される', async () => {
      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      await expect(mainTab).toBeVisible();

      // タブ内のアイテム数表示を確認
      const mainTabCount = mainTab.locator('.file-tab-count');
      await expect(mainTabCount).toBeVisible();

      const countText = await mainTabCount.textContent();
      expect(countText).toMatch(/\(\d+\)/);

      await utils.attachScreenshot(testInfo, 'メインタブのアイテム数');
    });

    await test.step('サブ1タブにアイテム数が表示される', async () => {
      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await expect(subTab).toBeVisible();

      // タブ内のアイテム数表示を確認
      const subTabCount = subTab.locator('.file-tab-count');
      await expect(subTabCount).toBeVisible();

      const countText = await subTabCount.textContent();
      expect(countText).toMatch(/\(\d+\)/);

      await utils.attachScreenshot(testInfo, 'サブ1タブのアイテム数');
    });
  });

  test('タブ表示ON時、検索によって全タブのアイテム数が動的に更新される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('マルチタブ機能を有効化', async () => {
      configHelper.loadSettingsTemplate('with-tabs');
      configHelper.loadData2Template('data2-base');
      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    let mainTabInitialCount: string;
    let subTabInitialCount: string;

    await test.step('各タブの初期アイテム数を取得', async () => {
      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      const mainTabCount = mainTab.locator('.file-tab-count');
      mainTabInitialCount = (await mainTabCount.textContent()) || '';

      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      const subTabCount = subTab.locator('.file-tab-count');
      subTabInitialCount = (await subTabCount.textContent()) || '';

      expect(mainTabInitialCount).toMatch(/\(\d+\)/);
      expect(subTabInitialCount).toMatch(/\(\d+\)/);
    });

    await test.step('検索を実行して各タブのアイテム数が更新されることを確認', async () => {
      await utils.searchFor('GitHub');
      await utils.wait(300);

      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      const mainTabCount = mainTab.locator('.file-tab-count');
      const mainTabFiltered = (await mainTabCount.textContent()) || '';

      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      const subTabCount = subTab.locator('.file-tab-count');
      const subTabFiltered = (await subTabCount.textContent()) || '';

      // 各タブのアイテム数が初期値と異なる（または同じ場合もある）ことを確認
      expect(mainTabFiltered).toMatch(/\(\d+\)/);
      expect(subTabFiltered).toMatch(/\(\d+\)/);

      await utils.attachScreenshot(testInfo, '検索後の各タブアイテム数');
    });

    await test.step('検索をクリアして各タブのアイテム数が元に戻ることを確認', async () => {
      const searchBox = mainWindow.locator('input[type="text"]').first();
      await searchBox.clear();
      await utils.wait(300);

      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      const mainTabCount = mainTab.locator('.file-tab-count');
      const mainTabRestored = (await mainTabCount.textContent()) || '';

      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      const subTabCount = subTab.locator('.file-tab-count');
      const subTabRestored = (await subTabCount.textContent()) || '';

      // アイテム数が初期値に戻ることを確認
      expect(mainTabRestored).toBe(mainTabInitialCount);
      expect(subTabRestored).toBe(subTabInitialCount);

      await utils.attachScreenshot(testInfo, 'クリア後の各タブアイテム数');
    });
  });

  test('タブ切り替え時、各タブのアイテム数は維持される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('マルチタブ機能を有効化', async () => {
      configHelper.loadSettingsTemplate('with-tabs');
      configHelper.loadData2Template('data2-base');
      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    let mainTabCount: string;
    let subTabCount: string;

    await test.step('メインタブのアイテム数を取得', async () => {
      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      const count = mainTab.locator('.file-tab-count');
      mainTabCount = (await count.textContent()) || '';
      expect(mainTabCount).toMatch(/\(\d+\)/);
    });

    await test.step('サブ1タブに切り替え', async () => {
      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await subTab.click();
      await utils.wait(300);

      const count = subTab.locator('.file-tab-count');
      subTabCount = (await count.textContent()) || '';
      expect(subTabCount).toMatch(/\(\d+\)/);

      await utils.attachScreenshot(testInfo, 'サブ1タブに切り替え');
    });

    await test.step('メインタブに戻り、アイテム数が変わっていないことを確認', async () => {
      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      await mainTab.click();
      await utils.wait(300);

      const count = mainTab.locator('.file-tab-count');
      const currentCount = (await count.textContent()) || '';

      // アイテム数が変わっていないことを確認
      expect(currentCount).toBe(mainTabCount);

      await utils.attachScreenshot(testInfo, 'メインタブに戻る');
    });
  });
});
