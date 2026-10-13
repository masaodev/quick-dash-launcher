import type { ElectronApplication } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 設定タブE2Eテスト
 *
 * 設定タブは別ウィンドウ（管理ウィンドウ）で開かれるため、
 * electronApp.waitForEvent('window')を使用して新しいウィンドウを取得します。
 *
 * 設定画面はサイドバーメニューで以下のカテゴリに分かれています：
 * - 基本設定: ホットキー、システム、表示、グループ起動
 * - ウィンドウ: ウィンドウサイズ、ウィンドウ表示位置、ワークスペースウィンドウ
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
    configHelper,
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

      await test.step('「複数タブを表示」は基本設定にあり、タブ管理のカテゴリは無い', async () => {
        // タブとデータファイルの構成はアイテム管理で扱う
        await expect(adminWindow.locator('.menu-item', { hasText: 'タブ管理' })).toHaveCount(0);

        await adminWindow.locator('.menu-item', { hasText: '基本設定' }).click();
        const showTabs = adminWindow
          .locator('label', { hasText: '複数タブを表示' })
          .locator('input');
        await expect(showTabs).not.toBeChecked();
        await showTabs.check();
        await expect.poll(() => configHelper.readSettings().showDataFileTabs).toBe(true);
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

      await test.step('既定値に戻すボタンの確認（カテゴリの末尾にある）', async () => {
        const resetButton = adminWindow.locator('button.settings-reset-button', {
          hasText: 'ウィンドウを既定値に戻す',
        });
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

  test('「操作のヒントを表示」でメインウィンドウ下のヒントを出し入れできる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const hintBar = mainWindow.locator('[data-testid="keyboard-hint-bar"]');

    await test.step('既定ではメインウィンドウの下に通常モードのヒントが出る', async () => {
      await expect(hintBar).toBeVisible();
      await expect(hintBar).toContainText('F2:編集');
      await expect(hintBar).toContainText('Shift+Enter:親フォルダを開く');
    });

    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');
    try {
      const hintLabel = adminWindow.locator('label', { hasText: '操作のヒントを表示' });
      const hintCheckbox = hintLabel.locator('input[type="checkbox"]');

      await test.step('基本設定でオフにすると、ヒントが消えて設定に保存される', async () => {
        await expect(hintCheckbox).toBeChecked();
        await hintLabel.click();
        await expect(hintBar).toHaveCount(0);
        expect(configHelper.readSettings().showKeyboardHints).toBe(false);
      });

      await test.step('オンに戻すと、またヒントが出る', async () => {
        await hintLabel.click();
        await expect(hintBar).toBeVisible();
        expect(configHelper.readSettings().showKeyboardHints).toBe(true);
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

/**
 * 管理ウィンドウでの Escape はページに届く（セル編集の取り消し・確認ダイアログを閉じる）
 *
 * Playwright の keyboard.press は DevTools 経由でページに直接届き、メインプロセスの
 * before-input-event を通らない。実際のキー入力と同じ経路を通すため sendInputEvent で送る
 */
async function pressEscapeAsRealInput(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('設定・管理'));
    win?.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    win?.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  });
}

test.describe('QuickDashLauncher - 管理ウィンドウの Escape', () => {
  test('セル編集を Escape で取り消せる', async ({ electronApp, mainWindow, configHelper }) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' }).first();
    await expect(githubRow).toBeVisible();

    await githubRow.locator('.name-column .editable-cell').click();
    const nameInput = githubRow.locator('.name-column .edit-input');
    await nameInput.fill('取り消す名前');
    await pressEscapeAsRealInput(electronApp);

    await expect(nameInput).toHaveCount(0);
    await expect(adminWindow.locator('.raw-item-row', { hasText: '取り消す名前' })).toHaveCount(0);
    expect(configHelper.hasItemByDisplayName('data.json', 'GitHub')).toBe(true);
  });

  test('確認ダイアログを Escape で閉じられる', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' }).first();
    await expect(githubRow).toBeVisible();

    await githubRow.locator('.name-column .editable-cell').click();
    const nameInput = githubRow.locator('.name-column .edit-input');
    await nameInput.fill('GitHub編集後');
    await nameInput.press('Enter');
    await adminWindow.locator('button:has-text("変更を保存")').click();
    const confirm = adminWindow.locator('[data-testid="confirm-dialog-overlay"]');
    await expect(confirm).toBeVisible();

    await pressEscapeAsRealInput(electronApp);
    await expect(confirm).toHaveCount(0);
  });
});

/**
 * ヘルプタブのショートカット一覧は、設定のホットキーを表示する
 */
test.describe('QuickDashLauncher - ヘルプタブのショートカット一覧', () => {
  test('起動ホットキーとウィンドウ検索のホットキーを設定の値で表示する', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    configHelper.updateSettings({ itemSearchHotkey: 'Ctrl+Alt+Q' });
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');
    await adminWindow.locator('button', { hasText: '📖 ヘルプ' }).click();
    const shortcuts = adminWindow.locator('.shortcuts-grid');

    await expect(
      shortcuts
        .locator('.shortcut-item', { hasText: 'メインウィンドウの表示/非表示' })
        .locator('kbd')
    ).toHaveText('Alt + Space');
    await expect(
      shortcuts.locator('.shortcut-item', { hasText: 'ウィンドウ検索で起動' }).locator('kbd')
    ).toHaveText('Ctrl + Alt + Q');
    await expect(shortcuts).not.toContainText('Ctrl + Alt + W');
  });
});
