import type { Page } from '@playwright/test';

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
      await mainWindow.getByRole('button', { name: '使いはじめる' }).click();
      await expect(mainWindow.locator('.first-launch-title')).toHaveCount(0);
    });

    await test.step('設定ファイルに正しい内容が保存されている', async () => {
      expect(configHelper.fileExists('settings.json')).toBe(true);
      const settings = configHelper.readSettings();
      expect(settings.hotkey).toBe('Alt+Space');
      expect(settings.autoLaunch).toBe(true);
    });
  });

  test('ホットキーを変更して完了すると変更内容が保存される', async ({
    configHelper,
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
    await mainWindow.getByRole('button', { name: '使いはじめる' }).click();
    await expect(mainWindow.locator('.first-launch-title')).toHaveCount(0);

    const settings = configHelper.readSettings();
    expect(settings.hotkey).toBe('Ctrl+Shift+A');
  });

  test('自動起動をオフにして完了すると設定ファイルにfalseが保存される', async ({
    configHelper,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await goToHotkeyStep(mainWindow);
    await goToTryStep(mainWindow);

    await mainWindow.click('.auto-launch-checkbox');
    expect(await mainWindow.isChecked('.auto-launch-checkbox')).toBe(false);

    await mainWindow.getByRole('button', { name: '使いはじめる' }).click();
    await expect(mainWindow.locator('.first-launch-title')).toHaveCount(0);

    const settings = configHelper.readSettings();
    expect(settings.autoLaunch).toBe(false);
  });
});
