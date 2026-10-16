import * as fs from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 廃止した種別「ウィンドウ操作」（type: 'window'）の読み込み時の変換
 * - 同じ id のパスの無い単一アイテムになる（表示名・メモはそのまま、位置は placement に）
 * - 書き換える前に backup/*_pre-window-migration/ に変換前のファイルが残る
 * - id は変わらないので、セットの行はそのまま変換後のアイテムを指す
 */
test.describe('QuickDashLauncher - ウィンドウ操作の変換', () => {
  test('data.json のウィンドウ操作は、読み込むとパスの無い単一アイテムになる', async ({
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);

    await test.step('data.json にウィンドウ操作と、それを指すセットを置いて読み直す', async () => {
      const data = JSON.parse(configHelper.readDataFileRaw('data.json'));
      data.items.push(
        {
          id: 'winOld01',
          type: 'window',
          displayName: 'E2E旧ウィンドウ操作',
          windowTitle: '*',
          processName: 'notepad.exe',
          x: 10,
          y: 20,
          width: 800,
          height: 600,
          moveToActiveMonitorCenter: true,
          activateWindow: false,
          memo: '変換しても残るメモ',
        },
        {
          id: 'setOld01',
          type: 'set',
          displayName: 'E2E旧ウィンドウ操作のセット',
          entries: [{ itemId: 'winOld01' }],
        }
      );
      configHelper.writeDataFileRaw('data.json', JSON.stringify(data, null, 2));
      await mainWindow.reload();
      await utils.waitForPageLoad();
    });

    await test.step('メイン画面に出て、data.json はパスの無い単一アイテムに書き換わる', async () => {
      await expect(
        mainWindow.locator('.item', { hasText: 'E2E旧ウィンドウ操作' }).first()
      ).toBeVisible({
        timeout: 10000,
      });
      await expect
        .poll(() => configHelper.getItemByDisplayName('data.json', 'E2E旧ウィンドウ操作'), {
          timeout: 10000,
        })
        .toEqual({
          id: 'winOld01',
          type: 'item',
          displayName: 'E2E旧ウィンドウ操作',
          path: '',
          memo: '変換しても残るメモ',
          window: { processName: 'notepad.exe' },
          placement: { x: 10, y: 20, width: 800, height: 600 },
          activateWindow: false,
        });
      // セットの行は id のまま変換後のアイテムを指す
      expect(
        configHelper.getItemByDisplayName('data.json', 'E2E旧ウィンドウ操作のセット')
      ).toMatchObject({ entries: [{ itemId: 'winOld01' }] });
    });

    await test.step('変換前のスナップショットが backup に残る', async () => {
      const backupDir = path.join(configHelper.getConfigDir(), 'backup');
      const snapshots = fs
        .readdirSync(backupDir)
        .filter((name) => name.endsWith('_pre-window-migration'));
      expect(snapshots).toHaveLength(1);
      const before = fs.readFileSync(
        path.join(backupDir, snapshots[0], 'datafiles', 'data.json'),
        'utf8'
      );
      expect(before).toContain('"type": "window"');
    });
  });
});
