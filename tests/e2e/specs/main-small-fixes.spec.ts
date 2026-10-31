import fs from 'fs';
import os from 'os';
import path from 'path';

import type { ElectronApplication } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * ランチャーまわりの小さな直し（A3-158・A3-159・A3-162）
 * - フォルダ取込で並んだアイテムの右クリック「この取込から外す…」で、元の取込の編集画面を除外フィルタ入りで開く
 * - クリップボード・ドロップから開いた登録画面でも、パスを書き換えられる
 * - 「複数タブを表示」を切り替えたら最初のタブに戻り、タブが複数あるときにオフにするなら確認を出す
 */

/** 次に出るネイティブメニューで、指定の項目を押す（押せなければラベルの一覧を返す） */
async function clickNextMenuItem(electronApp: ElectronApplication, label: string): Promise<void> {
  await electronApp.evaluate(({ Menu }, target) => {
    const g = globalThis as { __e2eMenuLabels?: string[] | null };
    g.__e2eMenuLabels = null;
    Menu.prototype.popup = function (this: {
      items: Array<{ type: string; label: string; click: () => void }>;
    }) {
      g.__e2eMenuLabels = this.items.filter((i) => i.type !== 'separator').map((i) => i.label);
      this.items.find((i) => i.label === target)?.click();
    };
  }, label);
}

async function readMenuLabels(electronApp: ElectronApplication): Promise<string[]> {
  return electronApp.evaluate(
    () => (globalThis as { __e2eMenuLabels?: string[] | null }).__e2eMenuLabels ?? []
  );
}

test.describe('QuickDashLauncher - ランチャーの小さな直し', () => {
  let workDir: string;

  test.beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-exclude-'));
    fs.writeFileSync(path.join(workDir, 'keep.txt'), 'keep');
    fs.writeFileSync(path.join(workDir, 'drop me,1.txt'), 'drop');
  });

  test.afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  test('並んだアイテムの「この取込から外す…」で、除外フィルタに名前を足した編集画面が開く（保存はしない）', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    configHelper.addItemToFile('data.json', {
      id: 'dirEXC01',
      type: 'dir',
      path: workDir,
      options: { depth: 0, types: 'file', exclude: '*.tmp' },
    });
    await utils.waitForPageLoad();
    await utils.reloadWithF5();
    const row = mainWindow.locator('.item', { hasText: 'drop me,1.txt' });
    await expect(row).toBeVisible();
    const before = configHelper.readDataFileRaw('data.json');

    await clickNextMenuItem(electronApp, '🚫 この取込から外す…');
    await row.click({ button: 'right' });
    const labels = await readMenuLabels(electronApp);
    expect(labels).toContain('🚫 この取込から外す…');
    expect(labels).not.toContain('🗑️ 削除…');

    const register = await utils.waitForRegisterWindow(electronApp);
    await expect(register.getByPlaceholder('例: temp*')).toHaveValue('{*.tmp,drop me\\,1.txt}');
    await expect(register.locator('.path-input-group input').first()).toHaveValue(workDir);

    await utils.pressEscapeToCloseRegisterModal();
    expect(configHelper.readDataFileRaw('data.json')).toBe(before);
  });

  test('クリップボードから開いた登録画面でも、パスを書き換えられる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await electronApp.evaluate(({ clipboard }) => {
      clipboard.writeText('C:\\Windows\\System32\\notepad.exe');
    });
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('index.html'))
        ?.webContents.send('launcher-blank-menu-register-from-clipboard');
    });
    const register = await utils.waitForRegisterWindow(electronApp);
    const pathInput = register.locator('.path-input-group input').first();
    await expect(pathInput).toHaveValue('C:\\Windows\\System32\\notepad.exe');
    await expect(pathInput).toBeEditable();
    await pathInput.fill('C:\\Windows\\System32\\calc.exe');
    await expect(pathInput).toHaveValue('C:\\Windows\\System32\\calc.exe');
    await utils.pressEscapeToCloseRegisterModal();
  });

  test('「複数タブを表示」をオフにすると最初のタブに戻り、まとめたファイルも出る', async ({
    mainWindow,
    configHelper,
  }) => {
    // 統合タブ（data.json・data3.json）とサブ1（data2.json）
    configHelper.loadTemplate('with-multi-file-tabs');
    await mainWindow.reload();
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    await mainWindow.keyboard.press('Tab');
    await expect(mainWindow.locator('.item', { hasText: 'Stack Overflow' })).toBeVisible();

    await mainWindow.evaluate(() =>
      window.electronAPI.setMultipleSettings({ showDataFileTabs: false })
    );
    await expect(mainWindow.locator('.item', { hasText: 'Stack Overflow' })).toHaveCount(0);
    await expect(mainWindow.locator('.item', { hasText: 'GitHub' })).toBeVisible();
    await expect(mainWindow.locator('.item', { hasText: 'Qiita' })).toBeVisible();
  });

  test('タブが複数あるときに「複数タブを表示」をオフにするなら、確認を出す', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    configHelper.loadTemplate('with-multi-file-tabs');
    await mainWindow.reload();
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');
    try {
      await adminWindow.locator('.menu-item', { hasText: '基本設定' }).click();
      const showTabs = adminWindow.locator('label', { hasText: '複数タブを表示' }).locator('input');
      await expect(showTabs).toBeChecked();

      await showTabs.click();
      const dialog = adminWindow.getByTestId('confirm-dialog');
      await expect(dialog).toContainText('最初のタブ「統合タブ」');
      await dialog.getByRole('button', { name: 'キャンセル' }).click();
      await expect(showTabs).toBeChecked();
      expect(configHelper.readSettings().showDataFileTabs).toBe(true);

      await showTabs.click();
      await adminWindow.getByTestId('confirm-dialog-confirm-button').click();
      await expect(showTabs).not.toBeChecked();
      await expect.poll(() => configHelper.readSettings().showDataFileTabs).toBe(false);
    } finally {
      await adminWindow.close();
    }
  });
});
