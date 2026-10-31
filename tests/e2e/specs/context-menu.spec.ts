import * as fs from 'fs';
import * as path from 'path';

import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { IPC_CHANNELS } from '../../../src/common/ipcChannels';
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

  test('右クリックの「編集」と F2 で、選択中のアイテムの編集画面が開く', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);

    await test.step('編集メニュー操作で編集モーダルが開く', async () => {
      const googleItem = mainWindow.locator('.item .item-name', { hasText: 'Google' });
      await expect(googleItem).toBeVisible({ timeout: 5000 });

      await menuHelper.simulateLauncherMenu('edit', {
        id: 'google-test-id',
        displayName: 'Google',
        path: 'https://www.google.com',
        type: 'url',
      });

      // 編集は独立した子ウィンドウで開く（ランチャーは動かさない）
      const editor = await utils.waitForRegisterWindow(electronApp);
      await expect(editor.locator('.register-modal h2')).toContainText('アイテムの編集');
      await expect(editor).toHaveTitle('アイテムの編集');

      await utils.pressEscapeToCloseRegisterModal();
      expect(editor.isClosed()).toBe(true);
    });

    await test.step('F2 で選択中のアイテムの編集画面が開く（右クリックの「編集」と同じ）', async () => {
      await utils.searchFor('Google');
      await expect(mainWindow.locator('.item.selected .item-name')).toHaveText('Google');
      await mainWindow.locator('input[type="text"]').first().focus();
      await mainWindow.keyboard.press('F2');

      const editor = await utils.waitForRegisterWindow(electronApp);
      await expect(editor.locator('.register-modal h2')).toContainText('アイテムの編集');
      await expect(editor.locator('input[value="Google"]').first()).toBeVisible();

      await utils.pressEscapeToCloseRegisterModal();
      expect(editor.isClosed()).toBe(true);
    });
  });

  test('パス・親フォルダのパス・ショートカットのリンク先パスをコピーできる', async ({
    electronApp,
    mainWindow,
  }) => {
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);
    const readClipboard = (): Promise<string> =>
      electronApp.evaluate(async ({ clipboard }) => clipboard.readText());
    const notepadItem = {
      id: 'test-notepad',
      name: 'メモ帳',
      path: 'C:\\Windows\\System32\\notepad.exe',
      type: 'app',
    };

    await test.step('パスをコピーメニュー操作でクリップボードにコピーされる', async () => {
      await menuHelper.simulateLauncherMenu('copyPath', notepadItem);
      // コピーは非同期なので、書き換わるまで待つ（前の step の値が残っていることがある）
      await expect.poll(readClipboard).toBe('C:\\Windows\\System32\\notepad.exe');
    });

    await test.step('親フォルダのパスをコピーメニュー操作', async () => {
      await menuHelper.simulateLauncherMenu('copyParentPath', notepadItem);
      await expect.poll(readClipboard).toBe('C:\\Windows\\System32');
    });

    await test.step('ショートカットのリンク先パスをコピー', async () => {
      const shortcutItem = mainWindow.locator('.item', { hasText: 'テストショートカット' });
      await expect(shortcutItem).toBeVisible({ timeout: 5000 });

      await menuHelper.simulateLauncherMenu('copyShortcutPath', {
        id: 'test-shortcut',
        name: 'テストショートカット',
        path: shortcutPath,
        type: 'app',
        originalPath: 'C:\\Windows\\System32\\notepad.exe',
      });
      // 前の step の値（C:\Windows\System32）と見分けるため、リンク先の exe 名まで待つ
      await expect.poll(async () => (await readClipboard()).toLowerCase()).toContain('notepad.exe');
    });
  });
});

/**
 * 管理ウィンドウのコンテキストメニューテスト
 */
test.describe('QuickDashLauncher - 管理ウィンドウのコンテキストメニュー', () => {
  test('右クリックメニューの「複製」で行が増え、「編集」で詳細編集が開く', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');

    const menuHelper = new NativeMenuTestHelper(electronApp, adminWindow);
    const adminUtils = new TestUtils(adminWindow);

    // メニューの対象は右クリックで決まるので、右クリックしてからメニューの選択を送る。
    // 本物のネイティブメニューは出さない
    await electronApp.evaluate(({ Menu }) => {
      Menu.prototype.popup = function () {};
    });

    const rows = adminWindow.locator('.raw-item-row');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const countBefore = await rows.count();

    try {
      await test.step('「複製」で右クリックした行のすぐ下に複製が入る', async () => {
        await rows.first().click({ button: 'right' });
        await menuHelper.simulateAdminMenu('duplicate');
        await expect(rows).toHaveCount(countBefore + 1);
      });

      await test.step('「編集」で右クリックした行の詳細編集が開く', async () => {
        await rows.first().click({ button: 'right' });
        await menuHelper.simulateAdminMenu('edit');
        const detailWindow = await adminUtils.waitForRegisterWindow(electronApp);
        await expect(detailWindow.locator('.register-modal')).toBeVisible();
        await adminUtils.pressEscapeToCloseRegisterModal();
      });
    } finally {
      await adminWindow.close();
    }
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
      type: 'item',
      displayName: 'E2Eパスの無いアイテム',
      path: '',
      window: { title: 'E2E存在しないウィンドウ' },
    });
    configHelper.addItemToFile('data.json', {
      id: 'e2elay01',
      type: 'set',
      displayName: 'E2Eセット',
      entries: [{ window: { title: 'E2E存在しないウィンドウ' }, placement: { x: 0, y: 0 } }],
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
    expect(labels).toContain('📂 親フォルダを開く');
  });

  test('アプリには「管理者として実行」が出て、URL には出ない', async ({
    electronApp,
    mainWindow,
  }) => {
    const appLabels = await captureMenuLabels(electronApp, mainWindow, 'メモ帳');
    expect(appLabels.slice(0, 2)).toEqual(['✏️ 編集', '🛡️ 管理者として実行']);
    const urlLabels = await captureMenuLabels(electronApp, mainWindow, 'Google');
    expect(urlLabels).not.toContain('🛡️ 管理者として実行');
  });

  test('右クリックの「管理者として実行」と Ctrl+Shift+Enter は、選んだアプリを管理者として実行に渡す', async ({
    electronApp,
    mainWindow,
  }) => {
    // 本物の UAC を出さないよう、本体の「管理者として実行」の受け口を差し替えて、渡されたアイテムを記録する
    await electronApp.evaluate(({ ipcMain }, channel) => {
      const g = globalThis as { __e2eRunAsAdmin?: string[] };
      g.__e2eRunAsAdmin = [];
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, (_event, item: { displayName: string }) => {
        g.__e2eRunAsAdmin!.push(item.displayName);
      });
    }, IPC_CHANNELS.RUN_ITEM_AS_ADMIN);
    const recorded = () =>
      electronApp.evaluate(
        () => (globalThis as { __e2eRunAsAdmin?: string[] }).__e2eRunAsAdmin ?? []
      );
    const utils = new TestUtils(mainWindow);

    await test.step('右クリックの「管理者として実行」', async () => {
      await new NativeMenuTestHelper(electronApp, mainWindow).simulateLauncherMenu('runAsAdmin', {
        displayName: '電卓',
        path: 'calc.exe',
        type: 'app',
      });
      await expect.poll(recorded).toEqual(['電卓']);
    });

    await test.step('Ctrl+Shift+Enter（親フォルダは開かない）', async () => {
      await electronApp.evaluate(({ shell }) => {
        const g = globalThis as { __e2eShownInFolder?: string[] };
        g.__e2eShownInFolder = [];
        shell.showItemInFolder = (fullPath: string) => {
          g.__e2eShownInFolder!.push(fullPath);
        };
      });
      await utils.searchFor('メモ帳');
      await expect(mainWindow.locator('.item', { hasText: 'メモ帳' })).toBeVisible();
      await mainWindow.keyboard.press('Control+Shift+Enter');
      await expect.poll(recorded).toEqual(['電卓', 'メモ帳']);
      expect(
        await electronApp.evaluate(
          () => (globalThis as { __e2eShownInFolder?: string[] }).__e2eShownInFolder ?? []
        )
      ).toEqual([]);
    });
  });

  test('パスの無い単一アイテムにはパス系の項目が出ない', async ({ electronApp, mainWindow }) => {
    const labels = await captureMenuLabels(electronApp, mainWindow, 'E2Eパスの無いアイテム');
    expect(labels).toEqual([
      '✏️ 編集',
      '⭐ ワークスペースに追加',
      '📄 ワークスペースにコピーを追加',
      '🗑️ 削除…',
    ]);
  });

  test('置き場所のあるセットには「ウィンドウ位置を更新」が出て、パス系の項目は出ない', async ({
    electronApp,
    mainWindow,
  }) => {
    const labels = await captureMenuLabels(electronApp, mainWindow, 'E2Eセット');
    expect(labels).toEqual([
      '✏️ 編集',
      '📍 ウィンドウ位置を更新',
      '⭐ ワークスペースに追加',
      '📄 ワークスペースにコピーを追加',
      '🗑️ 削除…',
    ]);
  });
});
