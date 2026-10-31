import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/first-launch-app';
import { TestUtils } from '../helpers/test-utils';

const LAUNCH_HOTKEY_INPUT = '.launch-hotkey-section .hotkey-input';

/** ようこそ → ホットキーへ進む */
async function goToHotkeyStep(mainWindow: Page): Promise<void> {
  await mainWindow.getByRole('button', { name: '次へ' }).click();
  await expect(mainWindow.locator('.first-launch-title')).toHaveText('ホットキーを決めましょう');
}

/** ホットキー → 試してみるへ進む（「次へ」でホットキーを登録する） */
async function goToTryStep(mainWindow: Page): Promise<void> {
  await mainWindow.getByRole('button', { name: '次へ' }).click();
  await expect(mainWindow.locator('.first-launch-title')).toHaveText('準備ができました');
}

/**
 * 試してみるで起動ホットキーを押したことにする（E2E では本物のホットキーを登録しないので、メインプロセスの知らせを直接送る）
 */
async function simulateHotkeyPressed(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('first-launch-hotkey-pressed'));
  });
}

/** ホットキーを押したことにして「使いはじめる」を押す */
async function pressHotkeyAndStart(
  electronApp: ElectronApplication,
  mainWindow: Page
): Promise<void> {
  await simulateHotkeyPressed(electronApp);
  await expect(mainWindow.locator('.first-launch-try-ok')).toBeVisible();
  await mainWindow.getByRole('button', { name: '使いはじめる' }).click();
}

test.describe('QuickDashLauncher - 初回起動設定画面テスト', () => {
  test('3 ステップの表示・ESC・自動起動のチェック・セキュリティ設定', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);

    await test.step('初回起動時に「ようこそ」が自動表示される', async () => {
      expect(electronApp).toBeTruthy();
      await utils.waitForPageLoad();

      await expect(mainWindow.locator('.first-launch-title')).toHaveText(
        'QuickDashLauncher へようこそ'
      );
      await expect(mainWindow.locator('.first-launch-description')).toContainText(
        'キーワードを打って開くランチャーです'
      );
      await expect(mainWindow.locator('.first-launch-feature')).toHaveCount(3);
      await expect(mainWindow.locator('.first-launch-step.current')).toContainText('ようこそ');
    });

    await test.step('初回設定画面はESCキーを押しても閉じない', async () => {
      await mainWindow.keyboard.press('Escape');
      await expect(mainWindow.locator('.first-launch-title')).toBeVisible();
    });

    await test.step('「ホットキー」では既定の Alt+Space が入り、「次へ」が押せる', async () => {
      await goToHotkeyStep(mainWindow);
      expect(await mainWindow.inputValue(LAUNCH_HOTKEY_INPUT)).toBe('Alt+Space');
      expect(await mainWindow.getByRole('button', { name: '次へ' }).isDisabled()).toBe(false);
    });

    await test.step('「試してみる」では自動起動が既定でオンになっている', async () => {
      await goToTryStep(mainWindow);
      await expect(mainWindow.locator('.first-launch-try-waiting')).toBeVisible();
      expect(await mainWindow.isChecked('.auto-launch-checkbox')).toBe(true);
      await expect(mainWindow.locator('.auto-launch-hint')).toBeVisible();
      // 更新の知らせも既定でオン（E2E は開発版なので Store 版の扱いにはならない）
      expect(await mainWindow.isChecked('[data-testid="first-launch-update-check"]')).toBe(true);
    });

    await test.step('ホットキーを押すまで「使いはじめる」は押せず、押すと ✓ が出て押せる', async () => {
      const start = mainWindow.getByRole('button', { name: '使いはじめる' });
      await expect(start).toBeDisabled();
      await simulateHotkeyPressed(electronApp);
      await expect(mainWindow.locator('.first-launch-try-ok')).toBeVisible();
      await expect(start).toBeEnabled();
    });

    await test.step('自動起動のチェックボックスをクリックして状態を変更できる', async () => {
      await mainWindow.click('.auto-launch-checkbox');
      expect(await mainWindow.isChecked('.auto-launch-checkbox')).toBe(false);
    });

    await test.step('「戻る」でホットキーへ戻れる', async () => {
      await mainWindow.getByRole('button', { name: '戻る' }).click();
      await expect(mainWindow.locator('.first-launch-title')).toHaveText(
        'ホットキーを決めましょう'
      );
    });

    await test.step('セキュリティ設定が適切に設定されている', async () => {
      const hasNodeIntegration = await mainWindow
        .evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return typeof (window as any).require !== 'undefined';
        })
        .catch(() => false);

      // セキュリティのため、レンダラープロセスでNode.jsのAPIは利用できないはず
      expect(hasNodeIntegration).toBe(false);
    });
  });

  test('デフォルト設定で完了するとsettings.jsonに正しく保存される', async ({
    configHelper,
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    await test.step('始める前はホットキーが未設定', async () => {
      const settingsBefore = configHelper.readSettings();
      expect(settingsBefore.hotkey || '').toBe('');
    });

    await test.step('既定のまま進めて「使いはじめる」を押す', async () => {
      await goToHotkeyStep(mainWindow);
      await goToTryStep(mainWindow);
      await pressHotkeyAndStart(electronApp, mainWindow);
      await expect(mainWindow.locator('.first-launch-title')).toHaveCount(0);
    });

    await test.step('設定ファイルに正しい内容が保存されている', async () => {
      expect(configHelper.fileExists('settings.json')).toBe(true);
      const settings = configHelper.readSettings();
      expect(settings.hotkey).toBe('Alt+Space');
      expect(settings.autoLaunch).toBe(true);
    });

    await test.step('ウィンドウが初回設定用の 700x600 から設定の大きさに戻る', async () => {
      const settings = configHelper.readSettings();
      await expect
        .poll(() =>
          electronApp.evaluate(({ BrowserWindow }) => {
            const win = BrowserWindow.getAllWindows().find(
              (w) => w.getTitle() === 'QuickDashLauncher' && w.getParentWindow() === null
            );
            const bounds = win?.getBounds();
            return bounds ? `${bounds.width}x${bounds.height}` : null;
          })
        )
        .toBe(`${settings.windowWidth ?? 600}x${settings.windowHeight ?? 400}`);
    });
  });

  test('ホットキーを変更して完了すると変更内容が保存される', async ({
    configHelper,
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await goToHotkeyStep(mainWindow);

    const hotkeyInput = mainWindow.locator(LAUNCH_HOTKEY_INPUT);
    await hotkeyInput.click();
    await mainWindow.keyboard.press('Control+Shift+A');
    expect(await hotkeyInput.inputValue()).toBe('Ctrl+Shift+A');
    await expect(mainWindow.locator('.first-launch-keys .first-launch-key')).toHaveText([
      'Ctrl',
      'Shift',
      'A',
    ]);

    await goToTryStep(mainWindow);
    await pressHotkeyAndStart(electronApp, mainWindow);
    await expect(mainWindow.locator('.first-launch-title')).toHaveCount(0);

    const settings = configHelper.readSettings();
    expect(settings.hotkey).toBe('Ctrl+Shift+A');
  });

  test('自動起動をオフにして完了すると設定ファイルにfalseが保存される', async ({
    configHelper,
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await goToHotkeyStep(mainWindow);
    await goToTryStep(mainWindow);

    await mainWindow.click('.auto-launch-checkbox');
    expect(await mainWindow.isChecked('.auto-launch-checkbox')).toBe(false);

    await pressHotkeyAndStart(electronApp, mainWindow);
    await expect(mainWindow.locator('.first-launch-title')).toHaveCount(0);

    const settings = configHelper.readSettings();
    expect(settings.autoLaunch).toBe(false);
  });

  test('保存に失敗したら初回設定画面に知らせ、ボタンを押せる状態に戻す', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await goToHotkeyStep(mainWindow);
    await goToTryStep(mainWindow);

    // 設定ファイルに書けないときと同じく、保存を失敗させる
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('settings:set-multiple');
      ipcMain.handle('settings:set-multiple', () => {
        throw new Error('EPERM: operation not permitted');
      });
    });
    await pressHotkeyAndStart(electronApp, mainWindow);

    await expect(mainWindow.getByRole('alert')).toHaveText(
      '設定を保存できませんでした。もう一度「使いはじめる」を押してください。'
    );
    await expect(mainWindow.locator('.first-launch-title')).toHaveText('準備ができました');
    await expect(mainWindow.getByRole('button', { name: '使いはじめる' })).toBeEnabled();
    await expect(mainWindow.getByRole('button', { name: '戻る' })).toBeEnabled();
    await expect(mainWindow.locator('.auto-launch-checkbox')).toBeEnabled();
  });

  test.describe('データファイルが無い状態から始める', () => {
    // ひな形 first-launch にはデータファイルがあるので、お試し用のアイテムは作られない。無いひな形で確かめる
    test.use({ configTemplate: 'first-launch-fresh' });

    test('お試し用のアイテムが「メイン」と「Web」の 2 つのタブに分かれて入る', async ({
      configHelper,
      electronApp,
      mainWindow,
    }) => {
      const utils = new TestUtils(mainWindow);
      await utils.waitForPageLoad();
      await goToHotkeyStep(mainWindow);
      await goToTryStep(mainWindow);
      await pressHotkeyAndStart(electronApp, mainWindow);
      await expect(mainWindow.locator('.first-launch-title')).toHaveCount(0);

      expect(configHelper.readSettings().dataFileTabs).toEqual([
        { files: ['datafiles/data.json'], name: 'メイン' },
        { files: ['datafiles/data2.json'], name: 'Web' },
      ]);
      expect(configHelper.fileExists('data2.json')).toBe(true);
      // 使い方は名前の頭の 📖 で、メインのタブの先頭に来る
      await expect(mainWindow.locator('.item-name').first()).toContainText(
        'QuickDashLauncher の使い方'
      );
    });

    test('ワークスペースにもお試し用のグループとアイテムが入る', async ({
      configHelper,
      mainWindow,
    }) => {
      const utils = new TestUtils(mainWindow);
      await utils.waitForPageLoad();

      const workspace = configHelper.readConfigJson<{
        groups: { displayName: string }[];
        items: { type: string; refItemId?: string }[];
      }>('workspace.json');
      expect(workspace?.groups.map((group) => group.displayName)).toEqual([
        'よく使う',
        '便利な使い方',
      ]);
      expect(workspace?.items.map((item) => item.type)).toEqual([
        'ref',
        'ref',
        'ref',
        'ref',
        'set',
        'clipboard',
        'item',
      ]);
      // 参照はメインウィンドウのお試しを指す
      const mainIds = [
        ...configHelper.readDataFile('data.json').items,
        ...configHelper.readDataFile('data2.json').items,
      ].map((item) => item.id);
      for (const item of workspace?.items.filter((i) => i.type === 'ref') ?? []) {
        expect(mainIds).toContain(item.refItemId);
      }
    });
  });

  test.describe('お試し用のアイテムのアイコンを裏で取る', () => {
    test.use({ configTemplate: 'first-launch-fresh' });

    test('取っている間は「アイコン未取得」の通知を出さない', async ({
      electronApp,
      mainWindow,
    }) => {
      const utils = new TestUtils(mainWindow);
      await utils.waitForPageLoad();
      await goToHotkeyStep(mainWindow);
      await goToTryStep(mainWindow);

      // 取得が終わらないようにして、取っている最中の画面を見る
      await electronApp.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('fetch-icons-combined');
        ipcMain.handle('fetch-icons-combined', () => new Promise(() => {}));
      });
      await pressHotkeyAndStart(electronApp, mainWindow);
      await expect(mainWindow.locator('.first-launch-title')).toHaveCount(0);
      await expect(mainWindow.locator('.item-name').first()).toBeVisible();

      // 前はここで「⚠ アイコン未取得: 6 件」と「取得」が出た
      await mainWindow.waitForTimeout(1000);
      await expect(mainWindow.locator('.missing-icon-notice')).toHaveCount(0);
    });
  });

  test.describe('初回設定の途中で終了して起動し直す', () => {
    // ホットキーを保存する前に終了すると、次の起動も初回起動になる。データファイルは前の起動で作ってある
    test.use({ configTemplate: 'first-launch-restart' });

    test('前の起動で作ったタブ（「メイン」と「Web」）を書き直さない', async ({
      configHelper,
      electronApp,
      mainWindow,
    }) => {
      const utils = new TestUtils(mainWindow);
      await utils.waitForPageLoad();
      expect(configHelper.readSettings().dataFileTabs).toEqual([
        { files: ['datafiles/data.json'], name: 'メイン' },
        { files: ['datafiles/data2.json'], name: 'Web' },
      ]);

      await goToHotkeyStep(mainWindow);
      await goToTryStep(mainWindow);
      await pressHotkeyAndStart(electronApp, mainWindow);
      await expect(mainWindow.locator('.first-launch-title')).toHaveCount(0);
      expect(configHelper.readSettings().dataFileTabs).toHaveLength(2);
    });
  });
});
