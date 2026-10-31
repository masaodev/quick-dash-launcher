import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { unzipSync, strFromU8 } from 'fflate';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 設定タブ「💾 バックアップ」の「エクスポート…」「インポート…」
 *
 * ネイティブのダイアログは操作できないので、メインプロセスの dialog.showSaveDialog・showOpenDialog を差し替える。
 * インポートのあとの再起動（app.relaunch・app.exit）も、テストのアプリが終わらないよう記録だけにする
 */
test.describe('QuickDashLauncher - データのエクスポートとインポート', () => {
  test('バックアップ機能がオフでも、設定フォルダの中身を zip 1 つにエクスポートできる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    // 設定フォルダの外に書く（エクスポートの対象に入らないように）
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-export-e2e-'));
    const zipPath = path.join(outDir, 'export.zip');
    // 入れないもの（取り直せるアイコン）と入れるもの（自分で設定したアイコン）を置いておく
    const configDir = configHelper.getConfigDir();
    for (const [relPath, content] of [
      ['icon-cache/custom/my-icon.png', 'custom'],
      ['icon-cache/favicons/site.png', 'favicon'],
    ]) {
      fs.mkdirSync(path.dirname(path.join(configDir, relPath)), { recursive: true });
      fs.writeFileSync(path.join(configDir, relPath), content);
    }

    await electronApp.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as never;
    }, zipPath);

    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      await adminWindow.locator('.menu-item', { hasText: 'バックアップ' }).click();
      await expect(
        adminWindow.locator('label', { hasText: 'バックアップ機能を有効にする' }).locator('input')
      ).not.toBeChecked();

      await adminWindow.getByTestId('export-all-data').click();
      await expect(adminWindow.getByText('エクスポートしました')).toBeVisible();

      const entries = unzipSync(fs.readFileSync(zipPath));
      const names = Object.keys(entries);
      expect(names[0]).toBe('manifest.json');
      expect(names).toContain('settings.json');
      expect(names).toContain('datafiles/data.json');
      expect(names).toContain('icon-cache/custom/my-icon.png');
      expect(names).not.toContain('icon-cache/favicons/site.png');
      expect(names.some((name) => name.startsWith('backup/') || name.startsWith('logs/'))).toBe(
        false
      );

      const manifest = JSON.parse(strFromU8(entries['manifest.json']));
      expect(manifest).toMatchObject({ format: 'quick-dash-launcher-export', formatVersion: 1 });
      expect(manifest.files).toEqual(names.slice(1));
      expect(strFromU8(entries['datafiles/data.json'])).toBe(
        fs.readFileSync(path.join(configDir, 'datafiles', 'data.json'), 'utf8')
      );
    } finally {
      await adminWindow.close();
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  test('インポートすると、確認のあとにまるごと置き換えて再起動する', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-import-e2e-'));
    const zipPath = path.join(outDir, 'export.zip');
    const configDir = configHelper.getConfigDir();
    const dataPath = path.join(configDir, 'datafiles', 'data.json');
    const extraPath = path.join(configDir, 'datafiles', 'data3.json');

    await electronApp.evaluate(({ app, dialog }, p) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as never;
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never;
      const calls: string[] = [];
      (globalThis as { __restartCalls?: string[] }).__restartCalls = calls;
      app.relaunch = (() => calls.push('relaunch')) as never;
      app.exit = (() => calls.push('exit')) as never;
    }, zipPath);

    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    try {
      await adminWindow.locator('.menu-item', { hasText: 'バックアップ' }).click();
      await adminWindow.getByTestId('export-all-data').click();
      await expect(adminWindow.getByText('エクスポートしました')).toBeVisible();
      const exportedData = fs.readFileSync(dataPath, 'utf8');
      const exportedCount = JSON.parse(exportedData).items.length;

      await test.step('エクスポートしたあとにデータを変える（アイテムを減らし、データファイルを足す）', async () => {
        const data = JSON.parse(exportedData);
        data.items = data.items.slice(0, 1);
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        fs.writeFileSync(extraPath, JSON.stringify({ version: '1.0', items: [] }));
      });

      await test.step('確認ダイアログにエクスポートした版・アイテムの数（今 → インポートした後）を出す', async () => {
        await adminWindow.getByTestId('import-data').click();
        const dialog = adminWindow.getByTestId('confirm-dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('インポート');
        await expect(dialog).toContainText('エクスポートしたデータをインポートして、再起動します');
        await expect(adminWindow.getByTestId('confirm-dialog-warning')).toContainText(
          '今のデータはすべて置き換わります'
        );
        const details = adminWindow.getByTestId('confirm-dialog-details');
        await expect(details).toContainText('アイテム');
        await expect(
          details.locator('tr', { hasText: 'アイテム（今 → インポート後）' })
        ).toContainText(`1`);
        await expect(
          details.locator('tr', { hasText: 'アイテム（今 → インポート後）' })
        ).toContainText(`${exportedCount}`);
      });

      await test.step('「インポートして再起動」で置き換え、今のデータをスナップショットに残して再起動する', async () => {
        await adminWindow.getByRole('button', { name: 'インポートして再起動' }).click();
        await expect(adminWindow.getByText('インポートしました。再起動します')).toBeVisible();

        expect(fs.readFileSync(dataPath, 'utf8')).toBe(exportedData);
        expect(fs.existsSync(extraPath)).toBe(false);
        const snapshots = fs
          .readdirSync(path.join(configDir, 'backup'))
          .filter((name) => name.endsWith('_pre-import'));
        expect(snapshots).toHaveLength(1);
        expect(
          fs.existsSync(path.join(configDir, 'backup', snapshots[0], 'datafiles', 'data3.json'))
        ).toBe(true);
        const calls = await electronApp.evaluate(
          () => (globalThis as { __restartCalls?: string[] }).__restartCalls
        );
        expect(calls).toContain('exit');
      });
    } finally {
      await adminWindow.close();
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  test('QDL がエクスポートしたものでないファイルはインポートせず、今のデータを変えない', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-import-e2e-'));
    const notExport = path.join(outDir, 'not-export.zip');
    fs.writeFileSync(notExport, 'これは zip ではない');
    const dataPath = path.join(configHelper.getConfigDir(), 'datafiles', 'data.json');
    const before = fs.readFileSync(dataPath, 'utf8');
    await electronApp.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never;
    }, notExport);

    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');
    try {
      await adminWindow.locator('.menu-item', { hasText: 'バックアップ' }).click();
      await adminWindow.getByTestId('import-data').click();
      await expect(
        adminWindow.getByText(
          'QuickDashLauncher でエクスポートしたファイルではないため、インポートできません'
        )
      ).toBeVisible();
      await expect(adminWindow.getByTestId('confirm-dialog')).toHaveCount(0);
      expect(fs.readFileSync(dataPath, 'utf8')).toBe(before);
    } finally {
      await adminWindow.close();
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
