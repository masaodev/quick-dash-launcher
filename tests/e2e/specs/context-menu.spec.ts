import * as fs from 'fs';
import * as path from 'path';

import type { ElectronApplication, Page } from '@playwright/test';

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

  test('ショートカット（.lnk）のアイテムでも id・メモが保たれる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    configHelper.addItemToFile('data.json', {
      id: 'e2elnk01',
      type: 'item',
      displayName: 'メモつきショートカット',
      path: shortcutPath,
      memo: 'ショートカットのメモ',
    });
    await mainWindow.reload();
    await new TestUtils(mainWindow).waitForPageLoad();
    await expect(mainWindow.locator('.item', { hasText: 'メモつきショートカット' })).toBeVisible();

    const loaded = await mainWindow.evaluate(async () => {
      const items = await window.electronAPI.loadDataFiles('internal');
      return items.find((i) => 'displayName' in i && i.displayName === 'メモつきショートカット');
    });
    expect(loaded).toMatchObject({ id: 'e2elnk01', memo: 'ショートカットのメモ' });
    expect(loaded).toHaveProperty('originalPath', expect.stringMatching(/notepad\.exe$/i));

    await electronApp.evaluate(({ Menu }) => {
      const g = globalThis as { __e2eMenuLabels?: string[] | null };
      g.__e2eMenuLabels = null;
      Menu.prototype.popup = function (this: { items: Array<{ type: string; label: string }> }) {
        g.__e2eMenuLabels = this.items.filter((i) => i.type !== 'separator').map((i) => i.label);
      };
    });
    await mainWindow
      .locator('.item', { hasText: 'メモつきショートカット' })
      .click({ button: 'right' });
    await expect
      .poll(() =>
        electronApp.evaluate(
          () => (globalThis as { __e2eMenuLabels?: string[] | null }).__e2eMenuLabels ?? []
        )
      )
      .toContain('📝 メモを表示');
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

    // 編集は独立した子ウィンドウで開く（メインウィンドウは動かさない）
    const editor = await utils.waitForRegisterWindow(electronApp);
    await expect(editor.locator('.register-modal h2')).toHaveText('アイテムの編集');
    await expect(editor).toHaveTitle('アイテムの編集');

    await utils.pressEscapeToCloseRegisterModal();
    expect(editor.isClosed()).toBe(true);
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

/**
 * 右クリックメニューに出る項目（パスを持たないアイテムにはパス系の項目を出さない）
 *
 * ネイティブメニューの中身は Playwright から見えないため、メインプロセスの Menu.popup を
 * 差し替えて、組み立てたメニューの項目名を記録する
 */
test.describe('QuickDashLauncher - 右クリックメニューの項目', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    configHelper.addItemToFile('data.json', {
      id: 'e2ewin01',
      type: 'window',
      displayName: 'E2Eウィンドウ操作',
      windowTitle: 'E2E存在しないウィンドウ',
    });
    configHelper.addItemToFile('data.json', {
      id: 'e2elay01',
      type: 'layout',
      displayName: 'E2Eウィンドウ配置',
      entries: [{ windowTitle: 'E2E存在しないウィンドウ', launchApp: false }],
    });
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();
  });

  /** 右クリックして、組み立てられたメニューの項目名（区切り線を除く）を返す */
  async function captureMenuLabels(
    electronApp: ElectronApplication,
    mainWindow: Page,
    itemName: string
  ): Promise<string[]> {
    await electronApp.evaluate(({ Menu }) => {
      const g = globalThis as { __e2eMenuLabels?: string[] | null };
      g.__e2eMenuLabels = null;
      Menu.prototype.popup = function (this: { items: Array<{ type: string; label: string }> }) {
        g.__e2eMenuLabels = this.items.filter((i) => i.type !== 'separator').map((i) => i.label);
      };
    });
    await mainWindow.locator('.item', { hasText: itemName }).click({ button: 'right' });
    await expect
      .poll(() =>
        electronApp.evaluate(
          () => (globalThis as { __e2eMenuLabels?: string[] | null }).__e2eMenuLabels ?? null
        )
      )
      .not.toBeNull();
    return (await electronApp.evaluate(
      () => (globalThis as { __e2eMenuLabels?: string[] | null }).__e2eMenuLabels
    )) as string[];
  }

  test('通常アイテムにはパス系の項目が出る', async ({ electronApp, mainWindow }) => {
    const labels = await captureMenuLabels(electronApp, mainWindow, 'メモ帳');
    expect(labels).toContain('📋 パスをコピー');
    expect(labels).toContain('📂 親フォルダーを開く');
  });

  for (const name of ['E2Eウィンドウ操作', 'E2Eウィンドウ配置']) {
    test(`${name}にはパス系の項目が出ない`, async ({ electronApp, mainWindow }) => {
      const labels = await captureMenuLabels(electronApp, mainWindow, name);
      expect(labels).toEqual(['✏️ 編集', '⭐ ワークスペースに追加']);
    });
  }
});
