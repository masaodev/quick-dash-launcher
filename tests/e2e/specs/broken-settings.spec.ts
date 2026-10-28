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

  test('壊れた settings.json は別名で退避し、既定値で起動する', async ({
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
  });
});
