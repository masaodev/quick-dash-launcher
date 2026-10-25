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
 * - 基本設定: 表示言語、ホットキー、システム、表示
 * - ウィンドウ: メインウィンドウ・ワークスペースウィンドウ・切り離しウィンドウ・その他の節（どれも畳まずに出す）
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

    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
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

        // メインウィンドウ・ワークスペースウィンドウ・切り離しウィンドウ・その他の節
        for (const heading of [
          'メインウィンドウ',
          'ワークスペースウィンドウ',
          '切り離しウィンドウ',
          'その他',
        ]) {
          const section = adminWindow
            .locator('.settings-section')
            .filter({ has: adminWindow.locator('h3', { hasText: heading }) });
          await expect(section).toBeVisible();
        }
      });

      await test.step('バックアップカテゴリに切り替えてセクションを確認', async () => {
        // バックアップメニューをクリック
        const backupMenu = adminWindow.locator('.menu-item', { hasText: 'バックアップ' });
        await backupMenu.click();

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
      await test.step('基本設定カテゴリでホットキー入力フィールドの確認', async () => {
        // デフォルトで基本設定が選択されている
        const hotkeyInput = adminWindow.locator('.hotkey-input').first();
        await expect(hotkeyInput).toBeVisible();
      });

      await test.step('ウィンドウカテゴリに切り替えてサイズ入力フィールドの確認', async () => {
        // ウィンドウメニューをクリック
        const windowMenu = adminWindow.locator('.menu-item', { hasText: 'ウィンドウ' });
        await windowMenu.click();

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

      await test.step('既定値に戻すボタンの確認（枠ごとの見出しの右にあり、既定値のままなら押せない）', async () => {
        for (const section of ['mainWindow', 'workspaceWindow', 'detachedWindow', 'windowOther']) {
          await expect(adminWindow.getByTestId(`settings-reset-${section}`)).toBeVisible();
        }
        // base テンプレートはメインウィンドウ・切り離しウィンドウを既定値のままにしている
        // （ワークスペースのディスプレイと管理ウィンドウの高さは既定値と違う）
        await expect(adminWindow.getByTestId('settings-reset-mainWindow')).toBeDisabled();
        await expect(adminWindow.getByTestId('settings-reset-detachedWindow')).toBeDisabled();
        await expect(adminWindow.getByTestId('settings-reset-windowOther')).toBeEnabled();
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
      await test.step('基本設定カテゴリで自動起動設定をON/OFFできる', async () => {
        // デフォルトで基本設定が選択されている
        const autoLaunchLabel = adminWindow.locator('label', {
          hasText: 'Windows へのサインイン時に起動する',
        });
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

        const backupLabel = adminWindow.locator('label', {
          hasText: 'バックアップ機能を有効にする',
        });
        await backupLabel.click();

        // バックアップオプションが表示されることを確認
        const backupRetentionLabel = adminWindow.locator('label', {
          hasText: 'バックアップ保存件数',
        });
        await expect(backupRetentionLabel).toBeVisible();

        // settings.jsonに有効として保存されたことを確認
        await expect.poll(() => configHelper.readSettings().backupEnabled).toBe(true);
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

  // ==================== メインウィンドウの表示する場所の設定テスト ====================

  test('メインウィンドウの表示する場所を設定できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      await test.step('ウィンドウカテゴリに切り替え', async () => {
        const windowMenu = adminWindow.locator('.menu-item', { hasText: 'ウィンドウ' });
        await windowMenu.click();
      });

      await test.step('メインウィンドウの節が表示される', async () => {
        const positionSection = adminWindow
          .locator('.settings-section')
          .filter({ has: adminWindow.locator('h3', { hasText: 'メインウィンドウ' }) });
        await expect(positionSection).toBeVisible();
      });

      const positionSelect = adminWindow.locator('#windowPositionMode');

      await test.step('既定はマウスカーソルのあるディスプレイの中央が選択されている', async () => {
        await expect(positionSelect).toHaveValue('cursorMonitorCenter');
      });

      await test.step('プライマリディスプレイの中央を選択できる', async () => {
        await positionSelect.selectOption('center');
        await expect(positionSelect).toHaveValue('center');

        // settings.jsonに保存されたことを確認
        await expect.poll(() => configHelper.readSettings().windowPositionMode).toBe('center');
      });

      await test.step('マウスカーソルの近くを選択できる', async () => {
        await positionSelect.selectOption('cursor');
        await expect(positionSelect).toHaveValue('cursor');

        // settings.jsonに保存されたことを確認
        await expect.poll(() => configHelper.readSettings().windowPositionMode).toBe('cursor');
      });

      await test.step('最後に置いた場所を選択できる', async () => {
        await positionSelect.selectOption('fixed');
        await expect(positionSelect).toHaveValue('fixed');

        // settings.jsonに保存されたことを確認
        await expect.poll(() => configHelper.readSettings().windowPositionMode).toBe('fixed');
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('既定値に戻すは、その枠の設定だけを戻す', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      await test.step('ウィンドウカテゴリでメインウィンドウとワークスペースウィンドウの設定を変える', async () => {
        await adminWindow.locator('.menu-item', { hasText: 'ウィンドウ' }).click();

        await adminWindow.locator('#windowPositionMode').selectOption('center');
        await adminWindow.locator('#workspacePositionMode').selectOption('displayLeft');

        await expect.poll(() => configHelper.readSettings().windowPositionMode).toBe('center');
        await expect
          .poll(() => configHelper.readSettings().workspacePositionMode)
          .toBe('displayLeft');
      });

      await test.step('変えた枠だけに印が付き、ボタンが押せるようになる', async () => {
        await expect(adminWindow.getByTestId('settings-changed-mainWindow')).toBeVisible();
        await expect(adminWindow.getByTestId('settings-changed-workspaceWindow')).toBeVisible();
        await expect(adminWindow.getByTestId('settings-changed-detachedWindow')).toHaveCount(0);
        await expect(adminWindow.getByTestId('settings-reset-workspaceWindow')).toBeEnabled();
        await expect(adminWindow.getByTestId('settings-reset-detachedWindow')).toBeDisabled();
      });

      await test.step('確認ダイアログに、変わる設定が「今 → 既定値」で出る', async () => {
        await adminWindow.getByTestId('settings-reset-workspaceWindow').click();

        const dialog = adminWindow.getByTestId('confirm-dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('「ワークスペースウィンドウ」を既定値に戻す');
        const details = adminWindow.getByTestId('confirm-dialog-details');
        await expect(details).toContainText('表示する場所');
        await expect(details).toContainText('左端');
        await expect(details).toContainText('右端（既定）');
        // 既定値と同じ設定（不透明度など）は出さない
        await expect(details).not.toContainText('不透明度');
      });

      await test.step('戻すと、ワークスペースウィンドウだけが既定値になり、メインウィンドウは残る', async () => {
        await adminWindow.getByTestId('confirm-dialog-confirm-button').click();
        await expect(adminWindow.getByTestId('confirm-dialog')).toHaveCount(0);

        await expect(adminWindow.locator('#workspacePositionMode')).toHaveValue('displayRight');
        await expect(adminWindow.locator('#windowPositionMode')).toHaveValue('center');
        await expect(adminWindow.getByTestId('settings-changed-workspaceWindow')).toHaveCount(0);
        await expect(adminWindow.getByTestId('settings-reset-workspaceWindow')).toBeDisabled();
        await expect(adminWindow.getByTestId('settings-changed-mainWindow')).toBeVisible();

        const settings = configHelper.readSettings();
        expect(settings.workspacePositionMode).toBe('displayRight');
        expect(settings.windowPositionMode).toBe('center');
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
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('管理ウィンドウ'));
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
    ).toHaveText('Alt+Space');
    await expect(
      shortcuts.locator('.shortcut-item', { hasText: 'ウィンドウ検索で起動' }).locator('kbd')
    ).toHaveText('Ctrl+Alt+Q');
    await expect(shortcuts).not.toContainText('Ctrl+Alt+W');
  });
});
