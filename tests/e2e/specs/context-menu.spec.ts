import * as fs from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils, NativeMenuTestHelper } from '../helpers/test-utils';

/**
 * コンテキストメニュー機能テスト
 *
 * Electronのネイティブメニュー（Menu.popup()）はPlaywrightから直接アクセスできないため、
 * IPCイベントを直接送信してメニュー項目のクリックをシミュレートします。
 */
test.describe('QuickDashLauncher - コンテキストメニュー機能テスト', () => {
  let shortcutPath: string = '';

  test.beforeEach(async ({ configHelper, mainWindow }) => {
    const testDir = configHelper.getConfigDir();
    shortcutPath = path.join(testDir, 'test-shortcut.lnk');

    // ショートカットファイルを作成（notepad.exeへのリンク）
    const { execSync } = require('child_process');
    const psScriptPath = path.join(testDir, 'create-shortcut.ps1');
    const psScriptContent = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
$Shortcut.TargetPath = "notepad.exe"
$Shortcut.Save()
`;
    fs.writeFileSync(psScriptPath, psScriptContent, 'utf-8');

    try {
      execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { encoding: 'utf-8' });
    } catch (error) {
      console.error('ショートカット作成エラー:', error);
      throw error;
    }

    if (!fs.existsSync(shortcutPath)) {
      throw new Error(`ショートカットファイルが作成されませんでした: ${shortcutPath}`);
    }

    configHelper.addSimpleItem('data.json', 'テストショートカット', shortcutPath);

    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();
  });

  test.afterEach(async () => {
    if (shortcutPath && fs.existsSync(shortcutPath)) {
      try {
        fs.unlinkSync(shortcutPath);
      } catch {
        // クリーンアップエラーは無視
      }
    }
    if (shortcutPath) {
      const psScriptPath = path.join(path.dirname(shortcutPath), 'create-shortcut.ps1');
      if (fs.existsSync(psScriptPath)) {
        try {
          fs.unlinkSync(psScriptPath);
        } catch {
          // クリーンアップエラーは無視
        }
      }
    }
  });

  test('編集メニュー操作で編集モーダルが開く', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);

    const googleItem = mainWindow.locator('.item .item-name', { hasText: 'Google' });
    await expect(googleItem).toBeVisible({ timeout: 5000 });

    await menuHelper.simulateLauncherMenu('edit', {
      id: 'google-test-id',
      displayName: 'Google',
      path: 'https://www.google.com',
      type: 'url',
    });

    await mainWindow.waitForSelector('.register-modal', { state: 'visible', timeout: 5000 });
    await expect(mainWindow.locator('.register-modal')).toBeVisible();

    await mainWindow.keyboard.press('Escape');
    await utils.wait(300);
  });

  test('パスをコピーメニュー操作でクリップボードにコピーされる', async ({
    electronApp,
    mainWindow,
  }) => {
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);

    const itemData = {
      id: 'test-notepad',
      name: 'メモ帳',
      path: 'C:\\Windows\\System32\\notepad.exe',
      type: 'app',
    };

    await menuHelper.simulateLauncherMenu('copyPath', itemData);

    const clipboardText = await electronApp.evaluate(async ({ clipboard }) => {
      return clipboard.readText();
    });

    expect(clipboardText).toBe('C:\\Windows\\System32\\notepad.exe');
  });

  test('親フォルダーのパスをコピーメニュー操作', async ({ electronApp, mainWindow }) => {
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);

    const itemData = {
      id: 'test-notepad',
      name: 'メモ帳',
      path: 'C:\\Windows\\System32\\notepad.exe',
      type: 'app',
    };

    await menuHelper.simulateLauncherMenu('copyParentPath', itemData);

    const clipboardText = await electronApp.evaluate(async ({ clipboard }) => {
      return clipboard.readText();
    });

    expect(clipboardText).toBe('C:\\Windows\\System32');
  });

  test('ショートカットのリンク先パスをコピー', async ({ electronApp, mainWindow }) => {
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);

    const shortcutItem = mainWindow.locator('.item', { hasText: 'テストショートカット' });
    await expect(shortcutItem).toBeVisible({ timeout: 5000 });

    await menuHelper.simulateLauncherMenu('copyShortcutPath', {
      id: 'test-shortcut',
      name: 'テストショートカット',
      path: shortcutPath,
      type: 'app',
      originalPath: 'C:\\Windows\\System32\\notepad.exe',
    });

    const clipboardText = await electronApp.evaluate(async ({ clipboard }) => {
      return clipboard.readText();
    });

    expect(clipboardText.toLowerCase()).toContain('notepad.exe');
  });

  test('ワークスペースに追加メニュー操作', async ({ electronApp, mainWindow }) => {
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);
    const utils = new TestUtils(mainWindow);

    await menuHelper.simulateLauncherMenu('addToWorkspace', {
      id: 'google-id',
      name: 'Google',
      path: 'https://www.google.com',
      type: 'url',
    });

    await utils.wait(500);
  });
});

/**
 * 管理ウィンドウのコンテキストメニューテスト
 */
test.describe('QuickDashLauncher - 管理ウィンドウのコンテキストメニュー', () => {
  test('管理ウィンドウへのIPC送信が正常に行われる', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');

    const menuHelper = new NativeMenuTestHelper(electronApp, adminWindow);

    await adminWindow.waitForSelector('.raw-item-row', { state: 'visible', timeout: 10000 });

    const firstRow = adminWindow.locator('.raw-item-row').first();
    const checkbox = firstRow.locator('input[type="checkbox"]');
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    await menuHelper.simulateAdminMenu('duplicate');
    await menuHelper.simulateAdminMenu('edit');
    await adminWindow.waitForTimeout(100);

    await adminWindow.close();
  });
});
