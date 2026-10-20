import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * アイテム管理の一覧の列（表示・幅の保存）
 */
test.describe('QuickDashLauncher - アイテム管理の列', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    configHelper.deleteDataFile('data2.json');
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
  });

  test('見出しの右クリックで列を隠すと設定に残り、読み直しても隠れたまま。既定に戻せる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    await test.step('更新日の列を隠す', async () => {
      await expect(adminWindow.locator('th.updated-at-column')).toBeVisible();
      await adminWindow.locator('th.name-column').click({ button: 'right' });
      const menu = adminWindow.getByTestId('admin-column-menu');
      await expect(menu).toBeVisible();
      await menu.getByRole('menuitemcheckbox', { name: /更新日/ }).click();
      await expect(adminWindow.locator('th.updated-at-column')).toHaveCount(0);
      await expect(adminWindow.locator('td.updated-at-column')).toHaveCount(0);
      await new TestUtils(adminWindow).attachScreenshot(testInfo, '更新日を隠した');
      await adminWindow.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
    });

    await test.step('設定に保存され、読み直しても隠れたまま', async () => {
      await expect
        .poll(() => configHelper.readSettings().adminItemColumns?.visible?.updatedAt)
        .toBe(false);
      // 管理ウィンドウは閉じても隠すだけなので、読み直して設定から復元されることを確かめる
      await adminWindow.reload();
      await expect(adminWindow.locator('.raw-item-row').first()).toBeVisible();
      await expect(adminWindow.locator('th.updated-at-column')).toHaveCount(0);
    });

    await test.step('既定に戻すと出る', async () => {
      await adminWindow.locator('th.name-column').click({ button: 'right' });
      await adminWindow
        .getByTestId('admin-column-menu')
        .getByRole('button', { name: '列の表示と幅を既定に戻す' })
        .click();
      await expect(adminWindow.locator('th.updated-at-column')).toBeVisible();
      await expect
        .poll(() => configHelper.readSettings().adminItemColumns)
        .toEqual({ visible: {}, widths: {} });
    });

    await adminWindow.close();
  });

  test('見出しの右端をドラッグすると幅が変わり、設定に残る', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const header = adminWindow.locator('th.type-column');
      const before = (await header.boundingBox())!;
      const handle = header.locator('.column-resize-handle');
      const box = (await handle.boundingBox())!;
      await adminWindow.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await adminWindow.mouse.down();
      await adminWindow.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
        steps: 5,
      });
      await adminWindow.mouse.up();

      const after = (await header.boundingBox())!;
      expect(after.width).toBeGreaterThan(before.width + 40);
      await expect
        .poll(() => configHelper.readSettings().adminItemColumns?.widths?.type ?? 0)
        .toBeGreaterThan(before.width + 40);
    } finally {
      await adminWindow.close();
    }
  });

  test('メモ列で複数行のメモを書いて保存でき、1 行目だけが表に出る', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });

      await test.step('メモのセルをクリックし、Enter で改行して Ctrl+Enter で確定する', async () => {
        await githubRow.locator('.memo-column .memo-cell').click();
        const textarea = githubRow.locator('.memo-column textarea');
        await expect(textarea).toBeFocused();
        await textarea.pressSequentially('仕事用のアカウント');
        await textarea.press('Enter');
        await textarea.pressSequentially('2 段階認証あり');
        await new TestUtils(adminWindow).attachScreenshot(testInfo, 'メモを入力中');
        await textarea.press('Control+Enter');
        await expect(textarea).toHaveCount(0);

        const cell = githubRow.locator('.memo-column .memo-cell');
        await expect(cell).toContainText('仕事用のアカウント');
        await expect(cell).not.toContainText('2 段階認証あり');
        await expect(cell.locator('.memo-more')).toBeVisible();
        await expect(githubRow).toHaveClass(/changed/);
      });

      await test.step('保存するとデータファイルに複数行のまま書かれる', async () => {
        await adminWindow.locator('button:has-text("変更を保存")').click();
        await adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]').click();
        await expect
          .poll(() => configHelper.getItemByDisplayName('data.json', 'GitHub')?.memo)
          .toBe('仕事用のアカウント\n2 段階認証あり');
      });

      await test.step('メモを空にして保存すると、メモの項目が消える', async () => {
        await githubRow.locator('.memo-column .memo-cell').click();
        const textarea = githubRow.locator('.memo-column textarea');
        await textarea.fill('');
        await textarea.press('Control+Enter');
        await adminWindow.locator('button:has-text("変更を保存")').click();
        await adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]').click();
        await expect
          .poll(() => 'memo' in (configHelper.getItemByDisplayName('data.json', 'GitHub') ?? {}))
          .toBe(false);
      });
    } finally {
      await adminWindow.close();
    }
  });
});
