import path from 'path';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';
import { ConfigFileHelper } from '../helpers/config-file-helper';

/**
 * 設定タブE2Eテスト
 *
 * 設定タブは別ウィンドウ（管理ウィンドウ）で開かれるため、
 * electronApp.waitForEvent('window')を使用して新しいウィンドウを取得します。
 */
test.describe('QuickDashLauncher - 設定タブ機能テスト', () => {
  let configHelper: ConfigFileHelper;

  test.beforeEach(async ({ mainWindow }) => {
    const configDir = path.join(process.cwd(), 'tests', 'fixtures', 'e2e', 'default');
    configHelper = new ConfigFileHelper(configDir);

    // テンプレートから強制的に復元して初期状態を保証
    configHelper.restoreDataFromTemplate('base');
    configHelper.restoreSettingsFromTemplate('base');
    configHelper.deleteData2();

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
  });

  test.afterEach(async () => {
    // テンプレートから復元して次のテストのために初期状態に戻す
    configHelper.restoreDataFromTemplate('base');
    configHelper.restoreSettingsFromTemplate('base');
    configHelper.deleteData2();
  });

  // ==================== 設定タブ表示テスト ====================

  test('設定タブが表示され、各セクションが存在する', async ({
    electronApp,
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('初期状態を確認', async () => {
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('設定タブが表示されていることを確認', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '設定タブ表示');
        const settingsTab = adminWindow.locator('.settings-tab');
        await expect(settingsTab).toBeVisible();
      });

      await test.step('各セクションが表示されていることを確認', async () => {
        // ホットキーセクション
        const hotkeySection = adminWindow.locator('.settings-section', { hasText: 'ホットキー' });
        await expect(hotkeySection).toBeVisible();

        // ウィンドウサイズセクション
        const windowSizeSection = adminWindow.locator('.settings-section', {
          hasText: 'ウィンドウサイズ',
        });
        await expect(windowSizeSection).toBeVisible();

        // システムセクション
        const systemSection = adminWindow.locator('.settings-section', { hasText: 'システム' });
        await expect(systemSection).toBeVisible();

        // バックアップセクション
        const backupSection = adminWindow.locator('.settings-section', { hasText: 'バックアップ' });
        await expect(backupSection).toBeVisible();

        // タブ表示セクション
        const tabSection = adminWindow.locator('.settings-section', { hasText: 'タブ表示' });
        await expect(tabSection).toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== UI要素表示確認テスト ====================

  test('各設定の入力フィールドとボタンが表示される', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      await test.step('設定タブに切り替え', async () => {
        await new TestUtils(adminWindow).wait(500);
      });

      await test.step('ホットキー入力フィールドの確認', async () => {
        const hotkeyInput = adminWindow.locator('.hotkey-input').first();
        await expect(hotkeyInput).toBeVisible();
      });

      await test.step('ウィンドウサイズ入力フィールドの確認', async () => {
        // 通常時の幅
        const widthInput = adminWindow.locator('#windowWidth');
        await expect(widthInput).toBeVisible();

        // 通常時の高さ
        const heightInput = adminWindow.locator('#windowHeight');
        await expect(heightInput).toBeVisible();

        // アイテム管理時の幅
        const editWidthInput = adminWindow.locator('#editModeWidth');
        await expect(editWidthInput).toBeVisible();

        // アイテム管理時の高さ
        const editHeightInput = adminWindow.locator('#editModeHeight');
        await expect(editHeightInput).toBeVisible();
      });

      await test.step('リセットボタンの確認', async () => {
        const resetButton = adminWindow.locator('button.reset-button', { hasText: 'リセット' });
        await expect(resetButton).toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== チェックボックス設定テスト ====================

  test('チェックボックス設定を変更できる', async ({ electronApp, mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('設定タブに切り替え', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '設定タブ表示');
      });

      await test.step('自動起動設定をON/OFFできる', async () => {
        const autoLaunchLabel = adminWindow.locator('label', { hasText: '起動時に自動実行' });
        const autoLaunchCheckbox = autoLaunchLabel.locator('input[type="checkbox"]');
        const initialState = await autoLaunchCheckbox.isChecked();

        await autoLaunchLabel.click();
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, '自動起動設定変更後');

        const settings = configHelper.readSettings();
        expect(settings.autoLaunch).toBeDefined();
        expect(settings.autoLaunch).toBe(!initialState);
      });

      await test.step('バックアップ機能を有効化できる', async () => {
        const backupLabel = adminWindow.locator('label', {
          hasText: 'バックアップ機能を有効にする',
        });
        await backupLabel.click();
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, 'バックアップ機能有効化');

        // バックアップオプションが表示されることを確認
        const backupOnStartLabel = adminWindow.locator('label', {
          hasText: 'アプリ起動時にバックアップを作成',
        });
        await expect(backupOnStartLabel).toBeVisible();

        // settings.jsonに保存されたことを確認
        const settings = configHelper.readSettings();
        expect(settings.backupEnabled).toBeDefined();
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== タブ管理機能テスト ====================

  test('複数タブの表示・追加・カスタマイズができる', async ({
    electronApp,
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('設定タブに切り替え', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '設定タブ表示');
      });

      await test.step('複数タブ表示を有効化', async () => {
        const showTabsLabel = adminWindow.locator('label', { hasText: '複数タブを表示' });
        await showTabsLabel.click();
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '複数タブ表示有効化');

        // タブ管理セクションが表示されることを確認
        const tabManagement = adminWindow.locator('.data-file-manager');
        await expect(tabManagement).toBeVisible();

        // 行追加ボタンが表示されることを確認
        const addButton = adminWindow.locator('button', { hasText: '行追加' });
        await expect(addButton).toBeVisible();
      });

      await test.step('タブ追加前のファイル数を確認', async () => {
        const fileRows = adminWindow.locator('.data-file-table-row');
        const initialCount = await fileRows.count();
        expect(initialCount).toBeGreaterThanOrEqual(1); // 少なくともdata.txtは存在する
      });

      await test.step('新しいタブを追加', async () => {
        const addButton = adminWindow.locator('button', { hasText: '行追加' });
        await addButton.click();
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '行追加後');

        // 新しいファイル行が追加されたことを確認
        const fileRows = adminWindow.locator('.data-file-table-row');
        const newCount = await fileRows.count();
        expect(newCount).toBeGreaterThanOrEqual(2);

        // data2.txtが追加されたことを確認
        const data2Row = adminWindow.locator('.data-file-name', { hasText: 'data2.txt' });
        await expect(data2Row).toBeVisible();
      });

      await test.step('タブ名をカスタマイズ', async () => {
        // data2.txtのタブ名入力フィールドを探す
        const data2Row = adminWindow
          .locator('.data-file-table-row')
          .filter({ has: adminWindow.locator('.data-file-name', { hasText: 'data2.txt' }) });
        const tabNameInput = data2Row.locator('.tab-name-input');

        await tabNameInput.fill('カスタムタブ');
        await tabNameInput.blur();
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, 'タブ名変更後');
      });

      await test.step('settings.jsonに保存されたことを確認', async () => {
        const settings = configHelper.readSettings();
        expect(settings.showDataFileTabs).toBe(true);
        expect(settings.dataFileTabs).toBeDefined();
        const data2Tab = settings.dataFileTabs?.find((tab) => tab.file === 'data2.txt');
        expect(data2Tab?.name).toBe('カスタムタブ');
      });
    } finally {
      await adminWindow.close();
    }
  });
});
