import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('AlertDialog', () => {
  test('data.txt削除試行時に警告ダイアログが表示される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アプリケーションが正常に起動している', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('設定画面を開く', async () => {
      const settingsButton = mainWindow.locator('[title="基本設定"]');
      if ((await settingsButton.count()) > 0) {
        await settingsButton.click();
      }
    });

    await test.step('タブ表示を有効にする', async () => {
      const checkbox = mainWindow
        .locator('input[type="checkbox"]')
        .filter({ hasText: '複数タブを表示' })
        .first();
      if ((await checkbox.count()) > 0) {
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
          await checkbox.check();
        }
      }
    });

    await test.step('data.txtの削除を試みて警告ダイアログを表示', async () => {
      const manageFileButtons = mainWindow.locator('button[title="ファイルを管理"]');
      if ((await manageFileButtons.count()) > 0) {
        await manageFileButtons.first().click();

        const fileDeleteButtons = mainWindow.locator('.file-actions button:has-text("削除")');
        if ((await fileDeleteButtons.count()) > 0) {
          await fileDeleteButtons.first().click();

          // AlertDialogが表示されることを確認
          const alertDialog = mainWindow.locator('[data-testid="alert-dialog"]');
          await expect(alertDialog).toBeVisible({ timeout: 2000 });

          // メッセージ内容を確認
          const message = alertDialog.locator('.alert-body p');
          await expect(message).toContainText('data.txtは削除できません');

          // OKボタンで閉じる
          const okButton = mainWindow.locator('[data-testid="alert-dialog-ok-button"]');
          await okButton.click();

          // ダイアログが閉じたことを確認
          await expect(alertDialog).not.toBeVisible();
        }
      }
    });
  });

  test('ESCキーで閉じる', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アプリケーションが正常に起動している', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('警告ダイアログを表示', async () => {
      const settingsButton = mainWindow.locator('[title="基本設定"]');
      if ((await settingsButton.count()) > 0) {
        await settingsButton.click();
      }

      const checkbox = mainWindow
        .locator('input[type="checkbox"]')
        .filter({ hasText: '複数タブを表示' })
        .first();
      if ((await checkbox.count()) > 0) {
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
          await checkbox.check();
        }
      }

      const manageFileButtons = mainWindow.locator('button[title="ファイルを管理"]');
      if ((await manageFileButtons.count()) > 0) {
        await manageFileButtons.first().click();

        const fileDeleteButtons = mainWindow.locator('.file-actions button:has-text("削除")');
        if ((await fileDeleteButtons.count()) > 0) {
          await fileDeleteButtons.first().click();

          const alertDialog = mainWindow.locator('[data-testid="alert-dialog"]');
          await expect(alertDialog).toBeVisible({ timeout: 2000 });

          // ESCキーを押す
          await mainWindow.keyboard.press('Escape');

          // ダイアログが閉じたことを確認
          await expect(alertDialog).not.toBeVisible();
        }
      }
    });
  });
});

test.describe('ConfirmDialog', () => {
  test('行削除時に確認ダイアログが表示される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アプリケーションが正常に起動している', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('アイテム管理画面を開く', async () => {
      await mainWindow.keyboard.press('Escape');
    });

    await test.step('行を選択して削除ボタンをクリック', async () => {
      const firstCheckbox = mainWindow.locator('.checkbox-column input[type="checkbox"]').first();
      if ((await firstCheckbox.count()) > 0) {
        await firstCheckbox.check();

        const deleteButton = mainWindow.locator('button.delete-lines-button');
        if ((await deleteButton.count()) > 0) {
          await deleteButton.click();

          // ConfirmDialogが表示されることを確認
          const confirmDialog = mainWindow.locator('[data-testid="confirm-dialog"]');
          await expect(confirmDialog).toBeVisible({ timeout: 2000 });

          // メッセージ内容を確認
          const message = confirmDialog.locator('.confirm-body p');
          await expect(message).toContainText('行を削除しますか？');

          // キャンセルボタンで閉じる
          const cancelButton = mainWindow.locator('[data-testid="confirm-dialog-cancel-button"]');
          await cancelButton.click();

          // ダイアログが閉じたことを確認
          await expect(confirmDialog).not.toBeVisible();
        }
      }
    });
  });

  test('ESCキーで閉じる', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アプリケーションが正常に起動している', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('アイテム管理画面を開く', async () => {
      await mainWindow.keyboard.press('Escape');
    });

    await test.step('確認ダイアログを表示してESCキーで閉じる', async () => {
      const firstCheckbox = mainWindow.locator('.checkbox-column input[type="checkbox"]').first();
      if ((await firstCheckbox.count()) > 0) {
        await firstCheckbox.check();

        const deleteButton = mainWindow.locator('button.delete-lines-button');
        if ((await deleteButton.count()) > 0) {
          await deleteButton.click();

          const confirmDialog = mainWindow.locator('[data-testid="confirm-dialog"]');
          await expect(confirmDialog).toBeVisible({ timeout: 2000 });

          // ESCキーを押す
          await mainWindow.keyboard.press('Escape');

          // ダイアログが閉じたことを確認
          await expect(confirmDialog).not.toBeVisible();
        }
      }
    });
  });

  test('ENTERキーで確認実行される', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アプリケーションが正常に起動している', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('アイテム管理画面を開く', async () => {
      await mainWindow.keyboard.press('Escape');
    });

    await test.step('確認ダイアログを表示してENTERキーで確認', async () => {
      // 最初の行の数を記録
      const rowsBefore = await mainWindow.locator('.raw-item-row').count();

      const firstCheckbox = mainWindow.locator('.checkbox-column input[type="checkbox"]').first();
      if ((await firstCheckbox.count()) > 0) {
        await firstCheckbox.check();

        const deleteButton = mainWindow.locator('button.delete-lines-button');
        if ((await deleteButton.count()) > 0) {
          await deleteButton.click();

          const confirmDialog = mainWindow.locator('[data-testid="confirm-dialog"]');
          await expect(confirmDialog).toBeVisible({ timeout: 2000 });

          // ENTERキーを押す
          await mainWindow.keyboard.press('Enter');

          // ダイアログが閉じたことを確認
          await expect(confirmDialog).not.toBeVisible();

          // 行が削除されたことを確認
          const rowsAfter = await mainWindow.locator('.raw-item-row').count();
          expect(rowsAfter).toBeLessThan(rowsBefore);
        }
      }
    });
  });
});
