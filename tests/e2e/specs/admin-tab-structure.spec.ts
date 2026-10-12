import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * アイテム管理画面のタブの列・データファイルの札の列
 * （タブ・データファイルの追加・名前の変更・削除をその場で確定する）
 */
test.describe('QuickDashLauncher - アイテム管理のタブとデータファイル', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    // 統合タブ（data.json・data3.json）とサブ1（data2.json）
    configHelper.loadTemplate('with-multi-file-tabs');
    await mainWindow.reload();
    await new TestUtils(mainWindow).waitForPageLoad();
  });

  test('タブと札でデータファイルを切り替えられる', async ({
    electronApp,
    mainWindow,
  }, testInfo) => {
    const adminWindow = await new TestUtils(mainWindow).openAdminWindow(electronApp, 'edit');
    const adminUtils = new TestUtils(adminWindow);

    try {
      const tabs = adminWindow.getByTestId('admin-tab');
      const fileBar = adminWindow.getByTestId('admin-file-bar');

      await test.step('複数ファイルのタブでは札の列が出る', async () => {
        await expect(tabs).toHaveCount(2);
        await expect(tabs.nth(0)).toHaveClass(/active/);
        await expect(fileBar).toBeVisible();
        await expect(fileBar.getByTestId('admin-file-chip')).toHaveCount(2);
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'GitHub' })).toBeVisible();
        await adminUtils.attachScreenshot(testInfo, '統合タブ');
      });

      await test.step('札で data3.json に切り替える', async () => {
        await fileBar.getByTestId('admin-file-chip').nth(1).click();
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'Qiita' })).toBeVisible();
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'GitHub' })).toHaveCount(0);
      });

      await test.step('1 ファイルのタブでは札の列が出ない', async () => {
        await tabs.nth(1).click();
        await expect(fileBar).toHaveCount(0);
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'Reddit' })).toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('タブを追加・名前の変更・削除できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const adminWindow = await new TestUtils(mainWindow).openAdminWindow(electronApp, 'edit');
    const adminUtils = new TestUtils(adminWindow);
    const tabNames = () => (configHelper.readSettings().dataFileTabs ?? []).map((t) => t.name);

    try {
      const tabs = adminWindow.getByTestId('admin-tab');

      await test.step('＋ で名前を入れて Enter するとタブとデータファイルができる', async () => {
        await adminWindow.getByTestId('admin-tab-add').click();
        const input = adminWindow.getByTestId('admin-tab-new-input');
        await input.fill('趣味');
        await adminUtils.attachScreenshot(testInfo, 'タブ名の入力');
        await input.press('Enter');

        await expect(tabs).toHaveCount(3);
        await expect(tabs.nth(2)).toHaveClass(/active/);
        await expect(tabs.nth(2)).toContainText('趣味');
        await expect.poll(tabNames).toEqual(['統合タブ', 'サブ1', '趣味']);
        expect(configHelper.fileExists('data4.json')).toBe(true);
      });

      await test.step('Esc で取り消すとタブは増えない', async () => {
        await adminWindow.getByTestId('admin-tab-add').click();
        await adminWindow.getByTestId('admin-tab-new-input').press('Escape');
        await expect(tabs).toHaveCount(3);
      });

      await test.step('右クリックから名前を変える', async () => {
        await tabs.nth(2).click({ button: 'right' });
        await adminUtils.attachScreenshot(testInfo, 'タブの右クリック');
        await adminWindow.getByTestId('admin-tab-rename').click();
        const input = adminWindow.getByTestId('admin-tab-name-input');
        await input.fill('趣味のリンク');
        await input.press('Enter');
        await expect.poll(tabNames).toEqual(['統合タブ', 'サブ1', '趣味のリンク']);
      });

      await test.step('右クリックから削除するとデータファイルも消える', async () => {
        await tabs.nth(2).click({ button: 'right' });
        await adminWindow.getByTestId('admin-tab-delete').click();
        await adminUtils.attachScreenshot(testInfo, 'タブ削除の確認');
        await adminWindow.getByTestId('confirm-dialog-confirm-button').click();

        await expect(tabs).toHaveCount(2);
        await expect.poll(tabNames).toEqual(['統合タブ', 'サブ1']);
        await expect.poll(() => configHelper.fileExists('data4.json')).toBe(false);
      });

      await test.step('data.json だけが入ったタブは削除できない', async () => {
        await tabs.nth(1).click({ button: 'right' });
        await expect(adminWindow.getByTestId('admin-tab-delete')).toBeEnabled();
        await adminWindow.keyboard.press('Escape');
        await tabs.nth(0).click({ button: 'right' });
        await expect(adminWindow.getByTestId('admin-tab-delete')).toBeDisabled();
        await adminWindow.keyboard.press('Escape');
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('タブにデータファイルを追加・名前の変更・削除できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const adminWindow = await new TestUtils(mainWindow).openAdminWindow(electronApp, 'edit');
    const adminUtils = new TestUtils(adminWindow);
    const filesOfTab = (index: number) =>
      configHelper.readSettings().dataFileTabs?.[index]?.files ?? [];

    try {
      const tabs = adminWindow.getByTestId('admin-tab');
      const fileBar = adminWindow.getByTestId('admin-file-bar');
      const chips = fileBar.getByTestId('admin-file-chip');

      await test.step('1 ファイルのタブに右クリックから 2 つ目のファイルを作る', async () => {
        await tabs.nth(1).click();
        await tabs.nth(1).click({ button: 'right' });
        await adminWindow.getByTestId('admin-file-create').click();

        await expect(chips).toHaveCount(2);
        await expect(chips.nth(1)).toHaveClass(/active/);
        await expect
          .poll(() => filesOfTab(1))
          .toEqual(['datafiles/data2.json', 'datafiles/data4.json']);
        expect(configHelper.fileExists('data4.json')).toBe(true);
        await adminUtils.attachScreenshot(testInfo, 'ファイルを追加した後');
      });

      await test.step('札の右クリックから名前を変える', async () => {
        await chips.nth(1).click({ button: 'right' });
        await adminWindow.getByTestId('admin-file-rename').click();
        const input = adminWindow.getByTestId('admin-file-name-input');
        await input.fill('お気に入り');
        await input.press('Enter');
        await expect(chips.nth(1)).toHaveText('お気に入り');
        await expect
          .poll(() => configHelper.readSettings().dataFileLabels?.['datafiles/data4.json'])
          .toBe('お気に入り');
      });

      await test.step('札の右クリックから削除する', async () => {
        await chips.nth(1).click({ button: 'right' });
        await adminWindow.getByTestId('admin-file-delete').click();
        await adminWindow.getByTestId('confirm-dialog-confirm-button').click();

        await expect(fileBar).toHaveCount(0);
        await expect.poll(() => filesOfTab(1)).toEqual(['datafiles/data2.json']);
        await expect.poll(() => configHelper.fileExists('data4.json')).toBe(false);
      });

      await test.step('＋ ファイル から既存のファイルを入れると、外すだけでファイルは残る', async () => {
        await tabs.nth(0).click();
        await fileBar.getByTestId('admin-file-add').click();
        await adminWindow
          .getByTestId('admin-tab-popup-menu')
          .getByRole('menuitem', { name: /data2\.json/ })
          .click();
        await expect(chips).toHaveCount(3);

        await chips.nth(2).click({ button: 'right' });
        await adminWindow.getByTestId('admin-file-remove').click();
        await adminWindow.getByTestId('confirm-dialog-confirm-button').click();
        await expect(chips).toHaveCount(2);
        expect(configHelper.fileExists('data2.json')).toBe(true);
      });
    } finally {
      await adminWindow.close();
    }
  });
});
