import path from 'path';

import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { stubBrowsers } from '../helpers/fake-browsers';
import { TestUtils } from '../helpers/test-utils';

const IMPORT_MODAL = '.bookmark-import-modal';

/** ネイティブのファイル選択ダイアログの代わりに、固定のファイルを返す */
async function stubOpenDialog(electronApp: ElectronApplication, filePath: string): Promise<void> {
  await electronApp.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [p],
    })) as typeof dialog.showOpenDialog;
  }, filePath);
}

/** ランチャーの ➕ から「ブラウザのブックマークから追加」を選び、開いた管理ウィンドウを返す */
async function openBookmarkImportFromLauncher(
  electronApp: ElectronApplication,
  mainWindow: Page
): Promise<Page> {
  await mainWindow.getByTestId('register-menu-button').click();
  const [adminWindow] = await Promise.all([
    electronApp.waitForEvent('window', {
      predicate: (window) => window.url().includes('admin.html'),
      timeout: 10000,
    }),
    mainWindow.getByTestId('register-menu-bookmarks').click(),
  ]);
  await adminWindow.waitForLoadState('domcontentloaded');
  return adminWindow;
}

async function isVisible(electronApp: ElectronApplication, page: Page): Promise<boolean> {
  const win = await electronApp.browserWindow(page);
  return win.evaluate((w) => w.isVisible());
}

async function hideWindow(electronApp: ElectronApplication, page: Page): Promise<void> {
  const win = await electronApp.browserWindow(page);
  await win.evaluate((w) => w.hide());
}

/** 管理ウィンドウの × と同じ（未保存の確認はレンダラーが行い、よければ隠す） */
async function closeWindow(electronApp: ElectronApplication, page: Page): Promise<void> {
  const win = await electronApp.browserWindow(page);
  await win.evaluate((w) => w.close());
}

/**
 * ランチャーの ➕ の取込の入口（A3-237）
 * - 下の 2 つ（ブックマーク・アプリ）は管理ウィンドウで開くので、見出し「アイテム管理が開きます」で分ける
 * - 隠れていた管理ウィンドウをこの入口で開いたら、閉じたときにランチャーを出す。
 *   取り込んで保存していれば、ランチャーでそのタブを選ぶ
 */
test.describe('QuickDashLauncher - 取込の入口から管理ウィンドウを開いて戻る', () => {
  test('➕ の下 2 つの上に「アイテム管理が開きます」の見出しと説明が付く', async ({
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.getByTestId('register-menu-button').click();

    await expect(mainWindow.getByTestId('register-menu-item-manager-section')).toHaveText(
      'アイテム管理が開きます'
    );
    for (const id of ['register-menu-bookmarks', 'register-menu-apps']) {
      await expect(mainWindow.getByTestId(id)).toHaveAttribute(
        'title',
        'アイテム管理を開きます。取り込んだアイテムは一覧で確かめてから「変更を保存」で確定します'
      );
    }
    // 上の 2 つ（その場で登録してランチャーに戻る）には付けない
    await expect(mainWindow.getByTestId('register-menu-quick-add')).not.toHaveAttribute(
      'title',
      /アイテム管理/
    );
  });

  test('取り込んで保存してから閉じると、ランチャーが取込先のタブで出る', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await stubBrowsers(electronApp);
    await stubOpenDialog(
      electronApp,
      path.join(process.cwd(), 'tests', 'e2e', 'fixtures', 'bookmarks-sample.html')
    );

    const adminWindow = await openBookmarkImportFromLauncher(electronApp, mainWindow);
    const modal = adminWindow.locator(IMPORT_MODAL);

    await test.step('新しいタブ「ブックマーク」に取り込んで保存する', async () => {
      await modal.waitFor({ state: 'visible', timeout: 10000 });
      await modal.getByLabel('取込先のタブ').selectOption({ label: '＋ 新しいタブ' });
      await modal.locator('.import-dest-field input').fill('ブックマーク');
      await modal.locator('select[aria-label="取込元"]').selectOption('html');
      await modal.locator('button', { hasText: 'ファイルを選択' }).click();
      await modal
        .locator('.bookmark-import-row.folder', { hasText: '開発' })
        .locator('input[type="checkbox"]')
        .check({ timeout: 10000 });
      await modal.locator('.import-footer button', { hasText: '取り込む' }).click();
      // テスト用のデータはタブを出していないので、新しいタブを作るとタブを出すかを聞かれる
      await adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]').click();
      await expect(modal).toHaveCount(0, { timeout: 10000 });
      await adminWindow.locator('button:has-text("変更を保存")').click();
      await adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]').click();
      await expect(adminWindow.locator('.unsaved-changes')).toHaveCount(0, { timeout: 10000 });
    });

    await test.step('ランチャーが隠れた状態で管理ウィンドウを閉じると、ランチャーが出て取込先のタブが選ばれる', async () => {
      await hideWindow(electronApp, mainWindow);
      await closeWindow(electronApp, adminWindow);
      await expect.poll(() => isVisible(electronApp, adminWindow)).toBe(false);
      await expect.poll(() => isVisible(electronApp, mainWindow)).toBe(true);
      await expect(
        mainWindow.locator('.tab-button.active', { hasText: 'ブックマーク' })
      ).toBeVisible({ timeout: 10000 });
      await expect(mainWindow.locator('.item', { hasText: 'GitHub Docs' })).toBeVisible();
    });
  });

  test('保存せずに閉じたときも、ランチャーが出る', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    const adminWindow = await openBookmarkImportFromLauncher(electronApp, mainWindow);
    await adminWindow.locator(IMPORT_MODAL).waitFor({ state: 'visible', timeout: 10000 });
    await hideWindow(electronApp, mainWindow);
    await closeWindow(electronApp, adminWindow);

    await expect.poll(() => isVisible(electronApp, mainWindow)).toBe(true);
  });

  test('前から開いていた管理ウィンドウなら、閉じてもランチャーは出さない', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    // 開いたままの管理ウィンドウに、ランチャーの ➕ から取込を頼む（管理ウィンドウを開いたときに隠れたランチャーを出す）
    const mainBw = await electronApp.browserWindow(mainWindow);
    await mainBw.evaluate((w) => w.show());
    await mainWindow.getByTestId('register-menu-button').click();
    await mainWindow.getByTestId('register-menu-bookmarks').click();
    await adminWindow.locator(IMPORT_MODAL).waitFor({ state: 'visible', timeout: 10000 });

    await hideWindow(electronApp, mainWindow);
    await closeWindow(electronApp, adminWindow);
    await expect.poll(() => isVisible(electronApp, adminWindow)).toBe(false);
    // ランチャーを出す処理は非同期なので、少し待ってから隠れたままかを見る
    await mainWindow.waitForTimeout(1000);
    expect(await isVisible(electronApp, mainWindow)).toBe(false);
  });
});
