import * as fs from 'fs';
import * as path from 'path';

import { isJsonLauncherItem } from '@common/types';
import type { Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/** backup/ 配下の変更前スナップショット（*_pre-external）フォルダ名 */
function listPreExternalSnapshots(configDir: string): string[] {
  const backupDir = path.join(configDir, 'backup');
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir).filter((name) => name.endsWith('_pre-external'));
}

/**
 * データファイルを QDL の外（人・AI）で直接編集したときの挙動
 * - F5 で反映される
 * - id 欠落は採番して書き戻す、不正アイテムはスキップして他を生かす
 * - 変更前の内容が backup/*_pre-external/ に残る（backupEnabled のとき）
 */
test.describe('QuickDashLauncher - 外部編集への対応', () => {
  test('外部で編集したデータファイルが F5 で反映され、変更前スナップショットが残る', async ({
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);

    // このテストでは変更前スナップショットも確認したいので有効化しておく
    // （settings.json は取得のたびに読まれるため、起動後の書き換えで足りる）
    configHelper.updateSettings({ backupEnabled: true });

    await test.step('初期表示を待つ', async () => {
      await utils.waitForPageLoad();
      await mainWindow.locator('.item').first().waitFor({ state: 'visible', timeout: 10000 });
      await expect(mainWindow.locator('.item', { hasText: 'GitHub' })).toBeVisible();
    });

    const originalRaw = configHelper.readDataFileRaw('data.json');

    await test.step('QDL の外でデータファイルを書き換える（id なし・不正・正常を混ぜる）', async () => {
      const data = JSON.parse(originalRaw);
      data.items.push(
        // id なし → 採番されるはず
        { type: 'item', displayName: '外部追加アイテム', path: 'https://example.com/external' },
        // path なし → スキップされるがファイルには残るはず
        { id: 'brokenit', type: 'item', displayName: '不正アイテム' }
      );
      configHelper.writeDataFileRaw('data.json', JSON.stringify(data, null, 2));
    });

    await test.step('F5 で再読込すると外部追加アイテムが表示される', async () => {
      // F5 の前は反映されていない（監視していない）
      await expect(mainWindow.locator('.item', { hasText: '外部追加アイテム' })).toHaveCount(0);

      await utils.reloadWithF5();
      await expect(mainWindow.locator('.item', { hasText: '外部追加アイテム' })).toBeVisible({
        timeout: 10000,
      });
      await expect(mainWindow.locator('.item', { hasText: '不正アイテム' })).toHaveCount(0);
      await expect(mainWindow.locator('.item', { hasText: 'GitHub' })).toBeVisible();
    });

    await test.step('id が採番されて書き戻され、不正アイテムはファイルに残る', async () => {
      const data = configHelper.readDataFile('data.json');
      const added = data.items.find(
        (item) => isJsonLauncherItem(item) && item.displayName === '外部追加アイテム'
      );
      expect(added).toBeDefined();
      expect(added?.id).toMatch(/^[A-Za-z0-9]{8}$/);

      const broken = data.items.find((item) => item.id === 'brokenit');
      expect(broken).toBeDefined();
    });

    await test.step('変更前の内容が backup/*_pre-external/ に残る', async () => {
      const snapshots = listPreExternalSnapshots(configHelper.getConfigDir());
      expect(snapshots).toHaveLength(1);
      const snapshotFile = path.join(
        configHelper.getConfigDir(),
        'backup',
        snapshots[0],
        'datafiles',
        'data.json'
      );
      expect(fs.readFileSync(snapshotFile, 'utf8')).toBe(originalRaw);
    });

    await test.step('もう一度 F5 しても外部変更としては扱われない', async () => {
      await utils.reloadWithF5();
      await expect(mainWindow.locator('.item', { hasText: '外部追加アイテム' })).toBeVisible({
        timeout: 10000,
      });
      // 書き戻し後の内容は QDL 自身の書き込みとして記憶されているので、スナップショットは増えない
      await mainWindow.waitForTimeout(500);
      expect(listPreExternalSnapshots(configHelper.getConfigDir())).toHaveLength(1);
    });
  });

  test('外部で書いた単一アイテムの windowConfig は、F5 で新しいキーに変換して書き戻す', async ({
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const configDir = configHelper.getConfigDir();

    await test.step('初期表示を待つ', async () => {
      await utils.waitForPageLoad();
      await mainWindow.locator('.item').first().waitFor({ state: 'visible', timeout: 10000 });
    });

    await test.step('QDL の外で windowConfig を持つアイテムを書き足す', async () => {
      const data = JSON.parse(configHelper.readDataFileRaw('data.json'));
      data.items.push({
        id: 'winCfg01',
        type: 'item',
        displayName: '旧ウィンドウ設定メモ',
        path: 'notepad.exe',
        windowConfig: {
          title: 'メモ.txt - メモ帳',
          processName: 'notepad.exe',
          x: 10,
          y: 20,
          width: 800,
          height: 600,
        },
      });
      configHelper.writeDataFileRaw('data.json', JSON.stringify(data, null, 2));
    });

    await test.step('F5 で読み直すと新しいキーに書き換わり、変換前のスナップショットが残る', async () => {
      await utils.reloadWithF5();
      const row = mainWindow.locator('.item', { hasText: '旧ウィンドウ設定メモ' });
      await expect(row).toBeVisible({ timeout: 10000 });
      await expect(row.locator('.window-title-badge')).toBeVisible();

      await expect
        .poll(() => configHelper.dataFileContains('data.json', 'windowConfig'), { timeout: 10000 })
        .toBe(false);
      const item = configHelper.getItemByDisplayName('data.json', '旧ウィンドウ設定メモ');
      expect(item).toMatchObject({
        window: { processName: 'notepad.exe', title: 'メモ.txt - メモ帳' },
        placement: { x: 10, y: 20, width: 800, height: 600 },
        activateWindow: true,
      });
      const backupDir = path.join(configDir, 'backup');
      expect(
        fs.readdirSync(backupDir).filter((name) => name.endsWith('_pre-window-migration'))
      ).toHaveLength(1);
    });
  });

  test('編集画面を開いた後に外部で変更されたファイルは、保存時に上書きせず再読込する', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    await test.step('編集画面の読み込みを待つ', async () => {
      await expect(adminWindow.locator('.raw-item-row', { hasText: 'GitHub' })).toBeVisible();
    });

    await test.step('編集画面を開いたまま、QDL の外でアイテムを追加する', async () => {
      configHelper.addSimpleItem('data.json', '外部で追加', 'https://example.com/outside');
    });

    await test.step('編集画面でセルを編集して保存すると競合として拒否される', async () => {
      const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
      await githubRow.locator('.name-column .editable-cell').click();
      const nameInput = githubRow.locator('.name-column .edit-input');
      await nameInput.fill('GitHub編集後');
      await nameInput.press('Enter');

      await adminWindow.locator('button:has-text("変更を保存")').click();
      const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
      await expect(confirmButton).toBeVisible();
      await confirmButton.click();

      const alertDialog = adminWindow.locator('[data-testid="alert-dialog"]');
      await expect(alertDialog).toBeVisible({ timeout: 10000 });
      await expect(alertDialog).toContainText('QDL の外で変更');
      await adminWindow.locator('[data-testid="alert-dialog-ok-button"]').click();
    });

    await test.step('外部で追加したアイテムは消えず、編集内容は保存されていない', async () => {
      expect(configHelper.hasItemByDisplayName('data.json', '外部で追加')).toBe(true);
      expect(configHelper.hasItemByDisplayName('data.json', 'GitHub編集後')).toBe(false);
      expect(configHelper.hasItemByDisplayName('data.json', 'GitHub')).toBe(true);

      // 再読込されて外部追加分が編集画面に現れる
      await expect(adminWindow.locator('.raw-item-row', { hasText: '外部で追加' })).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step('再読込後は通常どおり保存できる', async () => {
      const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' }).first();
      await githubRow.locator('.name-column .editable-cell').click();
      const nameInput = githubRow.locator('.name-column .edit-input');
      await nameInput.fill('GitHub編集後');
      await nameInput.press('Enter');

      await adminWindow.locator('button:has-text("変更を保存")').click();
      const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
      await expect(confirmButton).toBeVisible();
      await confirmButton.click();

      await expect
        .poll(() => configHelper.hasItemByDisplayName('data.json', 'GitHub編集後'))
        .toBe(true);
      expect(configHelper.hasItemByDisplayName('data.json', '外部で追加')).toBe(true);
    });
  });
});

/**
 * データファイルを読むのは F5 だけではない（ワークスペースからのセットの起動も読み直す）。
 * どの経路で読んでも、外部変更の検知と変更前スナップショットを取りこぼさない
 */
test.describe('QuickDashLauncher - 外部変更の検知（F5 以外の読み込み）', () => {
  test('ワークスペースからセットを起動しても、変更前スナップショットが残る', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const configDir = configHelper.getConfigDir();
    configHelper.updateSettings({ backupEnabled: true });

    await test.step('初期表示を待つ', async () => {
      await utils.waitForPageLoad();
      await mainWindow.locator('.item').first().waitFor({ state: 'visible', timeout: 10000 });
    });

    const originalRaw = configHelper.readDataFileRaw('data.json');

    await test.step('QDL の外でデータファイルを書き換える', async () => {
      configHelper.addSimpleItem('data.json', '外部で追加', 'https://example.com/outside');
    });

    await test.step('ワークスペースからセットを起動する（参照先が無いので何も起動しない）', async () => {
      const isWorkspace = async (win: Page) =>
        (await win.title()) === 'Workspace' || win.url().includes('workspace.html');
      let workspaceWindow: Page | undefined;
      for (const win of electronApp.windows()) {
        if (await isWorkspace(win)) workspaceWindow = win;
      }
      workspaceWindow ??= await electronApp.waitForEvent('window', {
        predicate: isWorkspace,
        timeout: 10000,
      });
      await workspaceWindow.waitForLoadState('domcontentloaded');
      await workspaceWindow.evaluate(() =>
        window.electronAPI.workspaceAPI.launchItem({
          id: 'e2egroup',
          type: 'set',
          displayName: 'E2Eセット',
          entries: [{ itemId: 'zzzzzzzz' }],
          workspaceId: 'default',
          order: 0,
          addedAt: Date.now(),
        })
      );
    });

    await test.step('変更前の内容がスナップショットに残る', async () => {
      await expect.poll(() => listPreExternalSnapshots(configDir).length).toBe(1);
      const snapshotFile = path.join(
        configDir,
        'backup',
        listPreExternalSnapshots(configDir)[0],
        'datafiles',
        'data.json'
      );
      expect(fs.readFileSync(snapshotFile, 'utf8')).toBe(originalRaw);
    });

    await test.step('その後の F5 で外部追加分が表示され、二重には検知しない', async () => {
      await utils.reloadWithF5();
      await expect(mainWindow.locator('.item', { hasText: '外部で追加' })).toBeVisible({
        timeout: 10000,
      });
      await mainWindow.waitForTimeout(500);
      expect(listPreExternalSnapshots(configDir)).toHaveLength(1);
    });
  });
});
