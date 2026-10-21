import * as fs from 'fs';
import * as path from 'path';

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

  test('見出しの ▾ で種類・名前・メモを絞り込み、条件はチップで外せる。取込元の列に「手動」と出る', async ({
    electronApp,
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    const rows = adminWindow.locator('.raw-item-row');
    const filterMenu = adminWindow.getByTestId('admin-column-filter');
    const chips = adminWindow.getByTestId('item-filter-chips');

    try {
      await expect(rows.first()).toBeVisible();
      const total = await rows.count();

      await test.step('取込元の列に「手動」と出る', async () => {
        await expect(
          adminWindow.locator('.raw-item-row', { hasText: 'GitHub' }).locator('.source-column')
        ).toHaveText('手動');
      });

      await test.step('種類の ▾ で URL だけにする', async () => {
        await adminWindow.locator('th.type-column .column-filter-button').click();
        await filterMenu.getByRole('menuitemcheckbox', { name: /単一アイテム（URL）/ }).click();
        await new TestUtils(adminWindow).attachScreenshot(testInfo, '種類の絞り込み');
        await adminWindow.keyboard.press('Escape');
        await expect(filterMenu).toHaveCount(0);
        await expect(rows).toHaveCount(3); // GitHub・Google・Wikipedia
        await expect(chips).toContainText('種類: 単一アイテム（URL）');
      });

      await test.step('名前の ▾ で「goo」を含むものに絞る（種類と AND）', async () => {
        await adminWindow.locator('th.name-column .column-filter-button').click();
        await filterMenu.getByPlaceholder('含む文字').fill('goo');
        await adminWindow.keyboard.press('Escape');
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText('Google');
        await expect(adminWindow.locator('th.name-column .column-filter-button')).toHaveClass(
          /is-active/
        );
      });

      await test.step('「すべて外す」で全件に戻る', async () => {
        await chips.getByRole('button', { name: 'すべて外す' }).click();
        await expect(chips).toHaveCount(0);
        await expect(rows).toHaveCount(total);
      });

      await test.step('メモの ▾ の「空でない」で、メモのある行だけにする', async () => {
        const github = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await github.locator('.memo-column .memo-cell').click();
        await github.locator('.memo-column textarea').fill('メモあり');
        await github.locator('.memo-column textarea').press('Control+Enter');

        await adminWindow.locator('th.memo-column .column-filter-button').click();
        await filterMenu.getByRole('menuitemradio', { name: '空でない' }).click();
        await adminWindow.keyboard.press('Escape');
        await expect(rows).toHaveCount(1);
        await expect(chips).toContainText('メモ: 空でない');
        await chips.getByRole('button', { name: '「メモ: 空でない」の絞り込みを外す' }).click();
        await expect(rows).toHaveCount(total);
      });

      await test.step('▾ の「降順に並べる」で名前の降順になる', async () => {
        await adminWindow.locator('th.name-column .column-filter-button').click();
        await filterMenu.getByRole('menuitemradio', { name: '▼ 降順に並べる' }).click();
        await adminWindow.keyboard.press('Escape');
        await expect(adminWindow.locator('th.name-column')).toHaveAttribute(
          'aria-sort',
          'descending'
        );
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('メイン画面で起動すると、最終起動の列に日時が出て、起動回数を数え、記録の無い行に絞り込める', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    await test.step('ブラウザを開かないよう差し替えて、GitHub を 2 回起動する', async () => {
      await electronApp.evaluate(({ shell }) => {
        shell.openExternal = async () => {};
      });
      for (let i = 0; i < 2; i++) {
        await electronApp.evaluate(({ BrowserWindow }) => {
          const main = BrowserWindow.getAllWindows().find(
            (w) => w.getTitle() === 'QuickDashLauncher'
          );
          main?.show();
        });
        await utils.searchFor('GitHub');
        await expect(mainWindow.locator('.item', { hasText: 'GitHub' })).toBeVisible();
        await mainWindow.keyboard.press('Enter');
        await expect
          .poll(() => {
            try {
              const usage = JSON.parse(
                fs.readFileSync(path.join(configHelper.getConfigDir(), 'item-usage.json'), 'utf8')
              );
              return Object.values(usage.byId as Record<string, { count: number }>)[0]?.count ?? 0;
            } catch {
              return 0;
            }
          })
          .toBe(i + 1);
      }
    });

    // 起動するとメイン画面は隠れるので、管理ウィンドウを開く前に出し直す
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'QuickDashLauncher')
        ?.show();
    });
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    try {
      await test.step('最終起動の列に日時が出て、起動回数の列を出すと 2 回', async () => {
        const github = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(github.locator('td.last-launched-column')).not.toHaveText('-');
        await expect(
          adminWindow
            .locator('.raw-item-row', { hasText: 'Google' })
            .locator('td.last-launched-column')
        ).toHaveText('-');

        await adminWindow.locator('th.name-column').click({ button: 'right' });
        await adminWindow
          .getByTestId('admin-column-menu')
          .getByRole('menuitemcheckbox', { name: /起動回数/ })
          .click();
        await adminWindow.keyboard.press('Escape');
        await expect(github.locator('td.launch-count-column')).toHaveText('2');
      });

      await test.step('最終起動の ▾ の「記録なし」で、起動していない行だけになる', async () => {
        const total = await adminWindow.locator('.raw-item-row').count();
        await adminWindow.locator('th.last-launched-column .column-filter-button').click();
        const menu = adminWindow.getByTestId('admin-column-filter');
        await expect(menu).toContainText('記録は');
        await menu.getByRole('menuitemradio', { name: '記録なし', exact: true }).click();
        await adminWindow.keyboard.press('Escape');
        await expect(adminWindow.locator('.raw-item-row')).toHaveCount(total - 1);
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'GitHub' })).toHaveCount(0);
      });
    } finally {
      await adminWindow.close();
    }
  });
});
