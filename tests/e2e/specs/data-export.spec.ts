import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { unzipSync, strFromU8 } from 'fflate';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 設定タブ「💾 バックアップ」の「すべて書き出す…」
 *
 * ネイティブの保存ダイアログは操作できないので、メインプロセスの dialog.showSaveDialog を差し替える
 */
test.describe('QuickDashLauncher - データの一括エクスポート', () => {
  test('バックアップ機能がオフでも、設定フォルダの中身を zip 1 つに書き出せる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    // 設定フォルダの外に書く（書き出しの対象に入らないように）
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
      await expect(adminWindow.getByText('個のファイルを書き出しました')).toBeVisible();

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
});
