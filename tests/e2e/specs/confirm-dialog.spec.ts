import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('ConfirmDialog', () => {
  test('アイテム管理画面で行削除時に確認ダイアログが表示される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アプリケーションが正常に起動している', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('アイテム管理画面を開く', async () => {
      // ESCキーでアイテム管理画面を開く
      await mainWindow.keyboard.press('Escape');
    });

    await test.step('行を選択して削除ボタンをクリック', async () => {
      // 最初の行のチェックボックスを選択
      const firstCheckbox = mainWindow.locator('.checkbox-column input[type="checkbox"]').first();
      if ((await firstCheckbox.count()) > 0) {
        await firstCheckbox.check();

        // 削除ボタンをクリック
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

  test('ConfirmDialogがESCキーで閉じる', async ({ mainWindow }, testInfo) => {
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

  test('ConfirmDialogがENTERキーで確認実行される', async ({ mainWindow }, testInfo) => {
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
