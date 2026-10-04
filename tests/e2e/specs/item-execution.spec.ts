import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/** メインプロセス側でスタブが記録する起動呼び出しの状態 */
type LaunchStubState = {
  calls: string[];
  resolved: number;
};

declare global {
  var __e2eLaunchStub: LaunchStubState | undefined;
}

/** 起動処理をシミュレートする待機時間（ms） */
const LAUNCH_DELAY_MS = 2000;

test.describe('QuickDashLauncher - アイテム実行時のウィンドウ動作', () => {
  test('アイテム実行時、起動完了を待たずにメインウィンドウが即座に閉じる', async ({
    electronApp,
    mainWindow,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
      await mainWindow.locator('.item').first().waitFor({ state: 'visible', timeout: 10000 });
    });

    await test.step('URL起動処理を「時間のかかる起動」スタブに差し替え', async () => {
      // 実際にブラウザを開かないよう shell.openExternal を差し替える。
      // 起動に時間がかかるアプリを模擬し、呼び出し回数と完了回数を記録する。
      await electronApp.evaluate(({ shell }, delayMs) => {
        const state: LaunchStubState = { calls: [], resolved: 0 };
        globalThis.__e2eLaunchStub = state;
        shell.openExternal = async (url: string) => {
          state.calls.push(url);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          state.resolved += 1;
        };
      }, LAUNCH_DELAY_MS);
    });

    await test.step('実行前はメインウィンドウが表示されている', async () => {
      const visible = await electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some(
          (win) => win.getTitle() === 'QuickDashLauncher' && win.isVisible()
        )
      );
      expect(visible).toBe(true);
    });

    await test.step('GitHubを検索してEnterで実行', async () => {
      await utils.searchFor('GitHub');
      await expect(mainWindow.locator('.item', { hasText: 'GitHub' })).toBeVisible();
      await mainWindow.keyboard.press('Enter');
    });

    await test.step('起動処理が完了する前にメインウィンドウが非表示になる', async () => {
      // 起動スタブが完了する（LAUNCH_DELAY_MS）より十分に短い時間内に閉じることを確認
      await expect
        .poll(
          async () =>
            electronApp.evaluate(({ BrowserWindow }) =>
              BrowserWindow.getAllWindows().some(
                (win) => win.getTitle() === 'QuickDashLauncher' && win.isVisible()
              )
            ),
          { timeout: LAUNCH_DELAY_MS / 2, message: 'メインウィンドウが閉じませんでした' }
        )
        .toBe(false);

      // この時点で起動は要求済みだが、まだ完了していない
      const state = await electronApp.evaluate(() => globalThis.__e2eLaunchStub);
      expect(state?.calls).toEqual(['https://github.com/']);
      expect(state?.resolved).toBe(0);
    });

    await test.step('起動処理は1回だけ完了する', async () => {
      await expect
        .poll(async () => electronApp.evaluate(() => globalThis.__e2eLaunchStub?.resolved ?? 0), {
          timeout: LAUNCH_DELAY_MS * 2,
        })
        .toBe(1);

      const state = await electronApp.evaluate(() => globalThis.__e2eLaunchStub);
      expect(state?.calls).toHaveLength(1);
    });
  });
});

/**
 * ウィンドウ配置アイテムを実行したときのトースト（🖥️「ウィンドウ配置を実行します」）
 *
 * 実際の配置はしないよう、メインプロセスのウィンドウ配置ハンドラを差し替える
 */
test.describe('QuickDashLauncher - ウィンドウ配置の実行', () => {
  test('ウィンドウ配置用のアイコンと文言でトーストが出る', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    configHelper.addItemToFile('data.json', {
      id: 'e2elay01',
      type: 'layout',
      displayName: 'E2Eウィンドウ配置',
      entries: [{ windowTitle: 'E2E存在しないウィンドウ', launchApp: false }],
    });
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();

    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('execute-layout');
      ipcMain.handle('execute-layout', () => undefined);
    });

    await utils.searchFor('E2Eウィンドウ配置');
    await expect(mainWindow.locator('.item', { hasText: 'E2Eウィンドウ配置' })).toBeVisible();
    await mainWindow.keyboard.press('Enter');

    await expect
      .poll(
        async () => {
          // オーバーレイはメインのレンダラーから window.open で開く（URL では見分けられない）
          for (const win of electronApp.windows()) {
            if (win.isClosed() || (await win.locator('#toast').count()) === 0) continue;
            return win.locator('#toast').innerText();
          }
          return '';
        },
        { timeout: 5000 }
      )
      .toMatch(/🖥️[\s\S]*E2Eウィンドウ配置[\s\S]*ウィンドウ配置を実行します/);
  });
});
