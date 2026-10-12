import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/** メインプロセス側でスタブが記録する起動呼び出しの状態 */
type LaunchStubState = {
  calls: string[];
  resolved: number;
};

declare global {
  var __e2eLaunchStub: LaunchStubState | undefined;
  var __e2eOpenItemCalls: number | undefined;
  var __e2eShownInFolder: string[] | undefined;
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

test.describe('QuickDashLauncher - 実行に失敗したときのエラーダイアログ', () => {
  test('エラーのダイアログが出ているときの Enter はダイアログを閉じるだけで、アイテムを実行し直さない', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.locator('.item').first().waitFor({ state: 'visible', timeout: 10000 });

    // アイテムを開く処理を「必ず失敗する」スタブに差し替え、呼ばれた回数を数える
    await electronApp.evaluate(({ ipcMain }) => {
      globalThis.__e2eOpenItemCalls = 0;
      ipcMain.removeHandler('open-item');
      ipcMain.handle('open-item', () => {
        globalThis.__e2eOpenItemCalls = (globalThis.__e2eOpenItemCalls ?? 0) + 1;
        throw new Error('E2E の起動失敗');
      });
    });
    const openItemCalls = () => electronApp.evaluate(() => globalThis.__e2eOpenItemCalls ?? 0);

    await utils.searchFor('GitHub');
    await expect(mainWindow.locator('.item', { hasText: 'GitHub' })).toBeVisible();
    await mainWindow.keyboard.press('Enter');

    const alertDialog = mainWindow.getByTestId('alert-dialog');
    await expect(alertDialog).toBeVisible({ timeout: 5000 });
    expect(await openItemCalls()).toBe(1);

    await mainWindow.keyboard.press('Enter');

    await expect(alertDialog).not.toBeVisible();
    expect(await openItemCalls()).toBe(1);
  });
});

/**
 * Shift+Enter（親フォルダを開く）
 * 実際にエクスプローラーを開かないよう shell.showItemInFolder を差し替え、渡したパスを記録する
 */
test.describe('QuickDashLauncher - Shift+Enter で親フォルダを開く', () => {
  test('ファイル名だけで登録したアプリは PATH から探し、見つからないパスはトーストで知らせる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    configHelper.addItemToFile('data.json', {
      id: 'e2epar01',
      type: 'item',
      displayName: 'E2Eメモ帳',
      path: 'notepad.exe',
    });
    configHelper.addItemToFile('data.json', {
      id: 'e2epar02',
      type: 'item',
      displayName: 'E2E存在しないファイル',
      path: 'C:\\E2E存在しないフォルダ\\none.txt',
    });
    configHelper.addItemToFile('data.json', {
      id: 'e2epar03',
      type: 'item',
      displayName: 'E2E環境変数のパス',
      path: '%WINDIR%\\win.ini',
    });
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();

    await electronApp.evaluate(({ shell }) => {
      globalThis.__e2eShownInFolder = [];
      shell.showItemInFolder = (fullPath: string) => {
        globalThis.__e2eShownInFolder!.push(fullPath);
      };
    });

    await test.step('ファイル名だけのアプリは PATH から探したフルパスで開く', async () => {
      await utils.searchFor('E2Eメモ帳');
      await expect(mainWindow.locator('.item', { hasText: 'E2Eメモ帳' })).toBeVisible();
      await mainWindow.keyboard.press('Shift+Enter');
      await expect
        .poll(() => electronApp.evaluate(() => globalThis.__e2eShownInFolder ?? []))
        .toEqual([expect.stringMatching(/\\notepad\.exe$/i)]);
    });

    await test.step('環境変数を含むパスは展開して開く', async () => {
      await utils.searchFor('E2E環境変数のパス');
      await expect(mainWindow.locator('.item', { hasText: 'E2E環境変数のパス' })).toBeVisible();
      await mainWindow.keyboard.press('Shift+Enter');
      await expect
        .poll(() => electronApp.evaluate(() => globalThis.__e2eShownInFolder?.[1] ?? ''))
        .toMatch(/^[A-Z]:\\Windows\\win\.ini$/i);
    });

    await test.step('見つからないパスは開かずにトーストで知らせる', async () => {
      await utils.searchFor('E2E存在しないファイル');
      await expect(mainWindow.locator('.item', { hasText: 'E2E存在しないファイル' })).toBeVisible();
      await mainWindow.keyboard.press('Shift+Enter');
      await expect
        .poll(
          async () => {
            for (const win of electronApp.windows()) {
              if (win.isClosed() || (await win.locator('#toast').count()) === 0) continue;
              return win.locator('#toast').innerText();
            }
            return '';
          },
          { timeout: 5000 }
        )
        .toMatch(/E2E存在しないファイル[\s\S]*親フォルダが見つかりませんでした/);
      // 見つからないパスでは開かない（前の 2 ステップの分だけ）
      expect(await electronApp.evaluate(() => globalThis.__e2eShownInFolder?.length)).toBe(2);
    });
  });
});
