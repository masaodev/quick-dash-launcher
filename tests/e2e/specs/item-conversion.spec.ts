import type { ElectronApplication, Page } from '@playwright/test';
import { isJsonLauncherItem } from '@common/types';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

const CHROME_EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'https://example.com/';
const SP_EXCEL = 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/book.xlsx';

/**
 * 既定のブラウザを Chrome、.md の関連付けを Chrome、それ以外の拡張子を関連付けなしとして返す
 * （試す PC の設定に左右されないように）。
 * 変換メニューは既定のブラウザ・関連付けを最初の 1 回だけ問い合わせるので、登録画面を開く前に差し替える
 */
async function stubDefaultBrowser(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ ipcMain }, exePath) => {
    ipcMain.removeHandler('browser:get-default');
    ipcMain.handle('browser:get-default', () => ({ exePath, name: 'Google Chrome' }));
    ipcMain.removeHandler('file:get-handler');
    ipcMain.handle('file:get-handler', (_event, extension: string) =>
      extension === '.md' ? { exePath, name: 'Google Chrome' } : null
    );
  }, CHROME_EXE);
}

function pathInput(page: Page) {
  return page.locator('.register-modal input[placeholder*="パス"]').first();
}

function argsInput(page: Page) {
  return page.locator('.register-modal input[placeholder*="引数"]').first();
}

function convertButton(page: Page) {
  return page.locator('.register-modal .item-converter-btn').first();
}

async function chooseConversion(page: Page, label: string): Promise<void> {
  await convertButton(page).click();
  await page.locator('.item-converter-option', { hasText: label }).first().click();
}

test.describe('QuickDashLauncher - 登録画面の変換', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    configHelper.deleteDataFile('data2.json');
    await new TestUtils(mainWindow).waitForPageLoad();
  });

  // 出す候補・引数の書き方・行き来は単体（tests/unit/itemConversions.test.ts）が確かめている。
  // ここでは登録画面のメニューから変換・戻す・保存できる配線を確かめる
  test('登録画面のメニューで形を変え、元に戻し、変換した形で保存できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await stubDefaultBrowser(electronApp);
    const page = await utils.openRegisterModal(electronApp);

    await test.step('変換できない入力ではボタンを押せない', async () => {
      await utils.fillRegisterForm({ name: 'メモ', path: 'C:\\Users\\me\\memo.txt' });
      await expect(convertButton(page)).toBeDisabled();
      await expect(convertButton(page)).toHaveAttribute(
        'title',
        'この入力に使える変換はありません'
      );
    });

    await test.step('SharePoint の Excel ではブラウザと Office の候補を出す', async () => {
      await utils.fillRegisterForm({ path: SP_EXCEL });
      await convertButton(page).click();
      await expect(page.locator('.item-converter-menu-header')).toHaveText([
        'ブラウザ（Google Chrome）',
        'SharePoint/OneDrive Excel',
      ]);
      await page.locator('.item-converter-option', { hasText: '読み取り専用' }).click();
      await expect(pathInput(page)).toHaveValue(`ms-excel:ofv|u|${SP_EXCEL}`);
    });

    await test.step('関連付けがブラウザのファイルを新しいウィンドウの形にすると知らせが出て、ファイルに戻せる', async () => {
      const mdPath = String.raw`C:\Users\me\tasks\全体ビュー.md`;
      await utils.fillRegisterForm({ path: mdPath });
      await chooseConversion(page, '新しいウィンドウで開く形にする');
      await expect(pathInput(page)).toHaveValue(CHROME_EXE);
      await expect(argsInput(page)).toHaveValue(
        '--new-window file:///C:/Users/me/tasks/全体ビュー.md'
      );
      await expect(page.getByText('Google Chrome で開く形に変換しました')).toBeVisible();

      await chooseConversion(page, 'ファイルに戻す');
      await expect(pathInput(page)).toHaveValue(mdPath);
      await expect(argsInput(page)).toHaveValue('');
    });

    await test.step('URL を新しいウィンドウの形にすると、パスと引数が書き換わる', async () => {
      await utils.fillRegisterForm({ name: '別ウィンドウ', path: URL });
      await chooseConversion(page, '新しいウィンドウで開く形にする');
      await expect(pathInput(page)).toHaveValue(CHROME_EXE);
      await expect(argsInput(page)).toBeVisible();
      await expect(argsInput(page)).toHaveValue(`--new-window ${URL}`);
    });

    await test.step('URL に戻せ、メニューを閉じられる', async () => {
      await chooseConversion(page, 'URL に戻す');
      await expect(pathInput(page)).toHaveValue(URL);
      await expect(argsInput(page)).toHaveValue('');
      await convertButton(page).click();
      await expect(page.locator('.item-converter-menu')).toBeVisible();
      await convertButton(page).click();
      await expect(page.locator('.item-converter-menu')).toHaveCount(0);
    });

    await test.step('変換した形で登録すると、パスと引数が保存される', async () => {
      await chooseConversion(page, '新しいウィンドウで開く形にする');
      await utils.clickRegisterButton();
      await expect(mainWindow.locator('.item', { hasText: '別ウィンドウ' })).toBeVisible();

      const saved = configHelper
        .readDataFile('data.json')
        .items.filter(isJsonLauncherItem)
        .find((item) => item.displayName === '別ウィンドウ');
      expect(saved?.path).toBe(CHROME_EXE);
      expect(saved?.args).toBe(`--new-window ${URL}`);
    });
  });
});
