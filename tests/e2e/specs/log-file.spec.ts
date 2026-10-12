import * as fs from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * ログを設定フォルダの logs/main.log にも残す（本番のポータブル版では標準出力が残らないため）
 */
test.describe('QuickDashLauncher - ログファイル', () => {
  test('起動するとメインプロセスのログが logs/main.log に書かれる', async ({
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    const logPath = path.join(configHelper.getConfigDir(), 'logs', 'main.log');
    await expect
      .poll(() => (fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''), {
        timeout: 10000,
      })
      .toContain('"name":"QuickDashLauncher"');
  });
});
