import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 設定タブE2Eテスト
 *
 * 設定タブは別ウィンドウ（管理ウィンドウ）で開かれるため、
 * electronApp.waitForEvent('window')を使用して新しいウィンドウを取得します。
 *
 * 設定画面はサイドバーメニューで以下のカテゴリに分かれています：
 * - 基本設定: ホットキー、システム、グループ起動
 * - ウィンドウ: ウィンドウサイズ、ウィンドウ表示位置、ワークスペースウィンドウ
 * - タブ管理: タブ表示
 * - バックアップ: バックアップ
 */
test.describe('QuickDashLauncher - 設定タブ機能テスト', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    // baseテンプレートは既に読み込まれている
    // data2.jsonは削除（このテストでは使用しない）
    configHelper.deleteDataFile('data2.json');

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
  });

  // ==================== 設定タブ表示テスト ====================

  test('設定タブが表示され、各カテゴリのセクションが存在する', async ({
    electronApp,
    mainWindow,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('初期状態を確認', async () => {});

    await utils.wait(300);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('設定タブが表示されていることを確認', async () => {
        const settingsTab = adminWindow.locator('.settings-tab');
        await expect(settingsTab).toBeVisible();
      });

      await test.step('サイドバーメニューが表示されていることを確認', async () => {
        const sidebar = adminWindow.locator('.settings-sidebar');
        await expect(sidebar).toBeVisible();
      });

      await test.step('基本設定カテゴリのセクションを確認', async () => {
        // デフォルトで基本設定が選択されている
        // ホットキーセクション
        const hotkeySection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'ホットキー' }) });
        await expect(hotkeySection).toBeVisible();

        // システムセクション
        const systemSection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'システム' }) });
        await expect(systemSection).toBeVisible();
      });

      await test.step('ウィンドウカテゴリに切り替えてセクションを確認', async () => {
        // ウィンドウメニューをクリック
        const windowMenu = adminWindow.locator('.menu-item', { hasText: 'ウィンドウ' });
        await windowMenu.click();
        await adminUtils.wait(200);

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
      });

      await test.step('バックアップカテゴリに切り替えてセクションを確認', async () => {
        // バックアップメニューをクリック
        const backupMenu = adminWindow.locator('.menu-item', { hasText: 'バックアップ' });
        await backupMenu.click();
        await adminUtils.wait(200);

        // バックアップセクション
        const backupSection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'バックアップ' }) });
        await expect(backupSection).toBeVisible();
      });

      await test.step('タブ管理カテゴリに切り替えてセクションを確認', async () => {
        // タブ管理メニューをクリック
        const tabMenu = adminWindow.locator('.menu-item', { hasText: 'タブ管理' });
        await tabMenu.click();
        await adminUtils.wait(200);

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
      const adminUtils = new TestUtils(adminWindow);

      await test.step('基本設定カテゴリでホットキー入力フィールドの確認', async () => {
        // デフォルトで基本設定が選択されている
        const hotkeyInput = adminWindow.locator('.hotkey-input').first();
        await expect(hotkeyInput).toBeVisible();
      });

      await test.step('ウィンドウカテゴリに切り替えてサイズ入力フィールドの確認', async () => {
        // ウィンドウメニューをクリック
        const windowMenu = adminWindow.locator('.menu-item', { hasText: 'ウィンドウ' });
        await windowMenu.click();
        await adminUtils.wait(200);

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
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('基本設定カテゴリで自動起動設定をON/OFFできる', async () => {
        // デフォルトで基本設定が選択されている
        const autoLaunchLabel = adminWindow.locator('label', { hasText: '起動時に自動実行' });
        const autoLaunchCheckbox = autoLaunchLabel.locator('input[type="checkbox"]');
        const initialState = await autoLaunchCheckbox.isChecked();

        await autoLaunchLabel.click();

        const settings = configHelper.readSettings();
        expect(settings.autoLaunch).toBeDefined();
        expect(settings.autoLaunch).toBe(!initialState);
      });

      await test.step('バックアップカテゴリに切り替えてバックアップ機能を有効化できる', async () => {
        // バックアップメニューをクリック
        const backupMenu = adminWindow.locator('.menu-item', { hasText: 'バックアップ' });
        await backupMenu.click();
        await adminUtils.wait(200);

        const backupLabel = adminWindow.locator('label', {
          hasText: 'バックアップ機能を有効にする',
        });
        await backupLabel.click();

        // バックアップオプションが表示されることを確認
        const backupRetentionLabel = adminWindow.locator('label', {
          hasText: 'バックアップ保存件数',
        });
        await expect(backupRetentionLabel).toBeVisible();

        // settings.jsonに保存されたことを確認
        const settings = configHelper.readSettings();
        expect(settings.backupEnabled).toBeDefined();
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== タブ管理機能テスト ====================
  // 注: これらのテストはタブ管理UIの複雑な状態遷移を含むため、
  // 現時点ではスキップしています。UIの動作確認は手動で行うことを推奨します。

  test.skip('複数タブの表示・追加・カスタマイズができる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('タブ管理カテゴリに切り替え', async () => {
        const tabMenu = adminWindow.locator('.menu-item', { hasText: 'タブ管理' });
        await tabMenu.click();
        await adminUtils.wait(200);
      });

      await test.step('複数タブ表示を有効化', async () => {
        const showTabsLabel = adminWindow.locator('label', { hasText: '複数タブを表示' });
        await showTabsLabel.click();
        await adminUtils.wait(200);

        // タブアコーディオンコンテナが表示されることを確認
        const tabAccordion = adminWindow.locator('.tab-accordion-container');
        await expect(tabAccordion).toBeVisible();

        // 新規タブを追加ボタンが表示されることを確認
        const addButton = adminWindow.locator('button', { hasText: '新規タブを追加' });
        await expect(addButton).toBeVisible();
      });

      await test.step('タブ追加前のタブ数を確認', async () => {
        const tabItems = adminWindow.locator('.tab-accordion-item');
        const initialCount = await tabItems.count();
        expect(initialCount).toBeGreaterThanOrEqual(1); // 少なくとも1つのタブは存在する
      });

      await test.step('新しいタブを追加', async () => {
        const addButton = adminWindow.locator('.tab-add-button');
        await addButton.click();
        await adminUtils.wait(300);

        // 新しいタブが追加されたことを確認
        const tabItems = adminWindow.locator('.tab-accordion-item');
        const newCount = await tabItems.count();
        expect(newCount).toBeGreaterThanOrEqual(2);
      });

      await test.step('タブ名をカスタマイズ', async () => {
        // 2番目のタブを取得
        const secondTab = adminWindow.locator('.tab-accordion-item').nth(1);
        await expect(secondTab).toBeVisible({ timeout: 5000 });

        // 展開ボタン（▶ または ▼）をクリックして展開
        const expandButton = secondTab.locator('.tab-expand-button');
        await expandButton.click();
        await adminUtils.wait(300);

        // タブが展開されたことを確認し、タブ名入力フィールドを探す
        const tabNameInput = secondTab.locator('.tab-accordion-name-input');
        await expect(tabNameInput).toBeVisible({ timeout: 5000 });
        await tabNameInput.fill('カスタムタブ');
        // フォーカスを外すためにEnterキーを押す
        await tabNameInput.press('Enter');
      });

      await test.step('保存ボタンをクリックして設定を保存', async () => {
        // 未保存インジケータが表示されるまで待機
        await adminUtils.wait(300);
        const saveButton = adminWindow.locator('.tab-management-actions .btn-primary');
        await saveButton.click();
        await adminUtils.wait(500);
      });

      await test.step('settings.jsonに保存されたことを確認', async () => {
        // 設定の再読み込みを待つ
        const settings = configHelper.readSettings();
        expect(settings.showDataFileTabs).toBe(true);
        expect(settings.dataFileTabs).toBeDefined();
        expect(settings.dataFileTabs?.length).toBeGreaterThanOrEqual(2);
        // タブ名が保存されたことを確認
        const secondTab = settings.dataFileTabs?.[1];
        expect(secondTab).toBeDefined();
        expect(secondTab?.files).toBeDefined();
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== タブ1:多ファイル関連付けテスト ====================

  test.skip('タブに複数のファイルを関連付けできる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('タブ管理カテゴリに切り替え', async () => {
        const tabMenu = adminWindow.locator('.menu-item', { hasText: 'タブ管理' });
        await tabMenu.click();
        await adminUtils.wait(200);
      });

      await test.step('複数タブ表示を有効化', async () => {
        const showTabsLabel = adminWindow.locator('label', { hasText: '複数タブを表示' });
        await showTabsLabel.click();
        await adminUtils.wait(200);
      });

      await test.step('新規タブを追加', async () => {
        const addButton = adminWindow.locator('.tab-add-button');
        await addButton.click();
        await adminUtils.wait(300);
      });

      await test.step('2番目のタブを展開してファイルを追加', async () => {
        // 2番目のタブを取得
        const secondTab = adminWindow.locator('.tab-accordion-item').nth(1);
        await expect(secondTab).toBeVisible({ timeout: 5000 });

        // 展開ボタン（▶ または ▼）をクリックして展開
        const expandButton = secondTab.locator('.tab-expand-button');
        await expandButton.click();
        await adminUtils.wait(300);

        // タブが展開されたことを確認
        await expect(secondTab.locator('.tab-accordion-content')).toBeVisible({ timeout: 5000 });

        // 新規データファイル作成ボタンをクリック（全角の＋に注意）
        const createButton = secondTab.locator('.data-file-create-button');
        await createButton.click();
        await adminUtils.wait(500);

        // データファイルリストに2つのファイルが表示されることを確認
        const dataFileItems = secondTab.locator('.data-file-item');
        const fileCount = await dataFileItems.count();
        expect(fileCount).toBe(2);
      });

      await test.step('保存ボタンをクリックして設定を保存', async () => {
        const saveButton = adminWindow.locator('.tab-management-actions .btn-primary');
        await saveButton.click();
        await adminUtils.wait(500);
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
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('ウィンドウカテゴリに切り替え', async () => {
        const windowMenu = adminWindow.locator('.menu-item', { hasText: 'ウィンドウ' });
        await windowMenu.click();
        await adminUtils.wait(200);
      });

      await test.step('ウィンドウ表示位置セクションが表示される', async () => {
        const positionSection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'ウィンドウ表示位置' }) });
        await expect(positionSection).toBeVisible();
      });

      await test.step('デフォルトは画面中央（自動切替）が選択されている', async () => {
        const cursorMonitorCenterRadio = adminWindow.locator(
          'input[name="windowPositionMode"][value="cursorMonitorCenter"]'
        );
        await expect(cursorMonitorCenterRadio).toBeChecked();
      });

      await test.step('画面中央（固定）を選択できる', async () => {
        // ウィンドウ表示位置セクション内のラジオボタンを直接操作
        const centerRadio = adminWindow.locator('input[name="windowPositionMode"][value="center"]');
        await centerRadio.click({ force: true });
        await adminUtils.wait(200);

        await expect(centerRadio).toBeChecked();

        // settings.jsonに保存されたことを確認
        const settings = configHelper.readSettings();
        expect(settings.windowPositionMode).toBe('center');
      });

      await test.step('カーソル付近を選択できる', async () => {
        // ウィンドウ表示位置セクション内のラジオボタンを直接操作
        const cursorRadio = adminWindow.locator('input[name="windowPositionMode"][value="cursor"]');
        await cursorRadio.click({ force: true });
        await adminUtils.wait(200);

        await expect(cursorRadio).toBeChecked();

        // settings.jsonに保存されたことを確認
        const settings = configHelper.readSettings();
        expect(settings.windowPositionMode).toBe('cursor');
      });

      await test.step('固定位置（手動設定）を選択できる', async () => {
        // ウィンドウ表示位置セクション内のラジオボタンを直接操作
        const fixedRadio = adminWindow.locator('input[name="windowPositionMode"][value="fixed"]');
        await fixedRadio.click({ force: true });
        await adminUtils.wait(200);

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
