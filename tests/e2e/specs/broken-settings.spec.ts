import * as fs from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * settings.json を手で直して JSON を壊しても起動できる
 *
 * 以前は electron-store が例外を投げて起動が止まり、画面もトレイも出なかった（A3-209）
 */
test.describe('QuickDashLauncher - 壊れた settings.json', () => {
  test.use({ configTemplate: 'broken-settings' });

  test('壊れた settings.json は別名で退避し、既定値で起動したことをトーストで知らせる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    // 既定値は起動ホットキーが空なので、初回設定の画面でホットキーを決め直してもらう
    await expect(mainWindow.locator('.first-launch-title')).toBeVisible();

    const configDir = configHelper.getConfigDir();
    const broken = fs.readdirSync(configDir).filter((f) => /^settings\.broken-.+\.json$/.test(f));
    expect(broken).toHaveLength(1);
    // 退避したファイルは元の中身のまま（元に戻す手がかり）
    expect(fs.readFileSync(path.join(configDir, broken[0]), 'utf8')).toContain('"hotkey"');
    // 新しい settings.json は読める JSON
    expect(() =>
      JSON.parse(fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8'))
    ).not.toThrow();

    // 初回設定の画面が出る理由と元のファイルの名前を、トーストで知らせる
    // トーストの窓は about:blank に HTML を書き込んで作るので、#toast を持つ窓を探す
    const toastText = async () => {
      for (const win of electronApp.windows()) {
        const toast = win.locator('#toast');
        if ((await toast.count()) > 0) return (await toast.textContent()) ?? '';
      }
      return '';
    };
    await expect.poll(toastText, { timeout: 10000 }).toContain(broken[0]);
  });
});

/**
 * 起動した後に settings.json を壊して F5 を押しても、既定値で自動起動・CLI・ホットキーを
 * 書き換えない（読むたびに失敗して既定値が返るため、以前はそのまま適用し直していた。A3-221）
 */
test.describe('QuickDashLauncher - 起動後に壊れた settings.json', () => {
  test('F5 では設定を適用し直さず、読めなかったことをトーストで知らせる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    const settingsPath = configHelper.getSettingsPath();
    const original = fs.readFileSync(settingsPath, 'utf8');
    fs.writeFileSync(settingsPath, original.replace(/\}\s*$/, ''));
    await utils.reloadWithF5();

    const toastText = async () => {
      for (const win of electronApp.windows()) {
        const toast = win.locator('#toast');
        if ((await toast.count()) > 0) return (await toast.textContent()) ?? '';
      }
      return '';
    };
    await expect
      .poll(toastText, { timeout: 10000 })
      .toContain('settings.json を読めないため、設定を読み直しませんでした');
    // 壊れたファイルは退避も上書きもせず、そのまま残す（直してもらう）
    expect(fs.readFileSync(settingsPath, 'utf8')).toBe(original.replace(/\}\s*$/, ''));
  });
});
