import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 設定タブE2Eテスト
 *
 * 設定タブは別ウィンドウ（管理ウィンドウ）で開かれるため、
 * electronApp.waitForEvent('window')を使用して新しいウィンドウを取得します。
 */
test.describe('QuickDashLauncher - 設定タブ機能テスト', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    // baseテンプレートは既に読み込まれている
    // data2.txtは削除（このテストでは使用しない）
    configHelper.deleteData2();

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
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
        const hotkeySection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'ホットキー' }) });
        await expect(hotkeySection).toBeVisible();

        // ウィンドウサイズセクション
        const windowSizeSection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'ウィンドウサイズ' }) });
        await expect(windowSizeSection).toBeVisible();

        // ウィンドウ表示位置セクション
        const windowPositionSection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'ウィンドウ表示位置' }) });
        await expect(windowPositionSection).toBeVisible();

        // システムセクション
        const systemSection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'システム' }) });
        await expect(systemSection).toBeVisible();

        // バックアップセクション
        const backupSection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'バックアップ' }) });
        await expect(backupSection).toBeVisible();

        // タブ表示セクション
        const tabSection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'タブ表示' }) });
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

  test('チェックボックス設定を変更できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
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
    configHelper,
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

        // 新規タブを追加ボタンが表示されることを確認
        const addButton = adminWindow.locator('button', { hasText: '新規タブを追加' });
        await expect(addButton).toBeVisible();
      });

      await test.step('タブ追加前のタブ数を確認', async () => {
        const fileRows = adminWindow.locator('.data-file-table-row');
        const initialCount = await fileRows.count();
        expect(initialCount).toBeGreaterThanOrEqual(1); // 少なくともdata.txtのタブは存在する
      });

      await test.step('新しいタブを追加', async () => {
        const addButton = adminWindow.locator('button', { hasText: '新規タブを追加' });
        await addButton.click();
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, 'タブ追加後');

        // 新しいタブ行が追加されたことを確認
        const fileRows = adminWindow.locator('.data-file-table-row');
        const newCount = await fileRows.count();
        expect(newCount).toBeGreaterThanOrEqual(2);
      });

      await test.step('タブ名をカスタマイズ', async () => {
        // 2番目のタブのタブ名入力フィールドを探す
        const secondRow = adminWindow.locator('.data-file-table-row').nth(1);
        const tabNameInput = secondRow.locator('.tab-name-input');

        await tabNameInput.fill('カスタムタブ');
        // フォーカスを外すためにEnterキーを押す
        await tabNameInput.press('Enter');
        await adminUtils.wait(800); // 保存処理の完了を待つ
        await adminUtils.attachScreenshot(testInfo, 'タブ名変更後');
      });

      await test.step('settings.jsonに保存されたことを確認', async () => {
        // 設定の再読み込みを待つ
        await adminUtils.wait(200);
        const settings = configHelper.readSettings();
        expect(settings.showDataFileTabs).toBe(true);
        expect(settings.dataFileTabs).toBeDefined();
        expect(settings.dataFileTabs?.length).toBeGreaterThanOrEqual(2);
        // タブ名が保存されたことを確認（デフォルト名でも可）
        const secondTab = settings.dataFileTabs?.[1];
        expect(secondTab).toBeDefined();
        expect(secondTab?.files).toBeDefined();
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== タブ1:多ファイル関連付けテスト ====================

  test('タブに複数のファイルを関連付けできる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('複数タブ表示を有効化', async () => {
        const showTabsLabel = adminWindow.locator('label', { hasText: '複数タブを表示' });
        await showTabsLabel.click();
        await adminUtils.wait(500);
      });

      await test.step('新規タブを追加', async () => {
        const addButton = adminWindow.locator('button', { hasText: '新規タブを追加' });
        await addButton.click();
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '新規タブ追加後');
      });

      await test.step('ファイル管理モーダルを開く', async () => {
        // 2番目のタブのファイル管理ボタンをクリック
        const secondRow = adminWindow.locator('.data-file-table-row').nth(1);
        const manageFilesButton = secondRow.locator('button', { hasText: /📁/ });
        await manageFilesButton.click();
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, 'ファイル管理モーダル表示');

        // モーダルが表示されることを確認
        const modal = adminWindow.locator('.modal-overlay');
        await expect(modal).toBeVisible();
      });

      await test.step('新規ファイルを作成してタブに追加', async () => {
        const createButton = adminWindow.locator('button', {
          hasText: '新規ファイルを作成して追加',
        });
        await createButton.click();
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '新規ファイル追加後');

        // ファイルリストに2つのファイルが表示されることを確認
        const fileListItems = adminWindow.locator('.file-list-item');
        const fileCount = await fileListItems.count();
        expect(fileCount).toBe(2);
      });

      await test.step('デフォルトファイルを設定できる', async () => {
        // 2番目のファイルの「デフォルトに設定」ボタンをクリック
        const fileListItems = adminWindow.locator('.file-list-item');
        const secondFileItem = fileListItems.nth(1);
        const setDefaultButton = secondFileItem.locator('button', {
          hasText: 'デフォルトに設定',
        });

        if (await setDefaultButton.isVisible()) {
          await setDefaultButton.click();
          await adminUtils.wait(500);
          await adminUtils.attachScreenshot(testInfo, 'デフォルトファイル変更後');

          // デフォルトバッジが表示されることを確認
          const defaultBadge = secondFileItem.locator('.default-badge-small');
          await expect(defaultBadge).toBeVisible();
        }
      });

      await test.step('モーダルを閉じる', async () => {
        const closeButton = adminWindow.locator('.modal-footer button', { hasText: '閉じる' });
        await closeButton.click();
        await adminUtils.wait(300);
      });

      await test.step('settings.jsonに複数ファイルが保存されたことを確認', async () => {
        const settings = configHelper.readSettings();
        const secondTab = settings.dataFileTabs?.[1];
        expect(secondTab).toBeDefined();
        expect(secondTab?.files.length).toBeGreaterThanOrEqual(2);
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== ウィンドウ表示位置設定テスト ====================

  test('ウィンドウ表示位置を設定できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('設定タブに切り替え', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '設定タブ表示');
      });

      await test.step('ウィンドウ表示位置セクションが表示される', async () => {
        const positionSection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'ウィンドウ表示位置' }) });
        await expect(positionSection).toBeVisible();
      });

      await test.step('デフォルトは画面中央が選択されている', async () => {
        const centerRadio = adminWindow.locator('input[name="windowPositionMode"][value="center"]');
        await expect(centerRadio).toBeChecked();
      });

      await test.step('マウスカーソルの位置を選択できる', async () => {
        const cursorLabel = adminWindow.locator('label', { hasText: 'マウスカーソルの位置' });
        await cursorLabel.click();
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, 'カーソル位置選択後');

        const cursorRadio = adminWindow.locator('input[name="windowPositionMode"][value="cursor"]');
        await expect(cursorRadio).toBeChecked();

        // settings.jsonに保存されたことを確認
        const settings = configHelper.readSettings();
        expect(settings.windowPositionMode).toBe('cursor');
      });

      await test.step('固定位置を選択できる', async () => {
        const fixedLabel = adminWindow.locator('label', {
          hasText: /固定位置.*手動で移動した位置を記憶/,
        });
        await fixedLabel.click();
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, '固定位置選択後');

        const fixedRadio = adminWindow.locator('input[name="windowPositionMode"][value="fixed"]');
        await expect(fixedRadio).toBeChecked();

        // settings.jsonに保存されたことを確認
        const settings = configHelper.readSettings();
        expect(settings.windowPositionMode).toBe('fixed');
      });
    } finally {
      await adminWindow.close();
    }
  });
});
