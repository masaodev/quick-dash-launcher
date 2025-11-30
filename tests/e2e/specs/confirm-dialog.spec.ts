import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('ConfirmDialog', () => {
  test('アイテム管理画面で行削除時に確認ダイアログが表示される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アプリケーションが正常に起動している', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, 'アプリ起動');
    });

    await test.step('アイテム管理画面を開く', async () => {
      // ESCキーでアイテム管理画面を開く
      await mainWindow.keyboard.press('Escape');
      await mainWindow.waitForTimeout(500);
      await utils.attachScreenshot(testInfo, 'アイテム管理画面表示');
    });

    await test.step('行を選択して削除ボタンをクリック', async () => {
      // 最初の行のチェックボックスを選択
      const firstCheckbox = mainWindow.locator('.checkbox-column input[type="checkbox"]').first();
      if ((await firstCheckbox.count()) > 0) {
        await firstCheckbox.check();
        await mainWindow.waitForTimeout(300);
        await utils.attachScreenshot(testInfo, '行選択');

        // 削除ボタンをクリック
        const deleteButton = mainWindow.locator('button.delete-lines-button');
        if ((await deleteButton.count()) > 0) {
          await deleteButton.click();
          await mainWindow.waitForTimeout(500);

          // ConfirmDialogが表示されることを確認
          const confirmDialog = mainWindow.locator('[data-testid="confirm-dialog"]');
          await expect(confirmDialog).toBeVisible({ timeout: 2000 });
          await utils.attachScreenshot(testInfo, 'ConfirmDialog表示');

          // メッセージ内容を確認
          const message = confirmDialog.locator('.confirm-body p');
          await expect(message).toContainText('行を削除しますか？');

          // キャンセルボタンで閉じる
          const cancelButton = mainWindow.locator('[data-testid="confirm-dialog-cancel-button"]');
          await cancelButton.click();
          await mainWindow.waitForTimeout(300);

          // ダイアログが閉じたことを確認
          await expect(confirmDialog).not.toBeVisible();
          await utils.attachScreenshot(testInfo, 'ダイアログ閉鎖');
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
      await mainWindow.waitForTimeout(500);
    });

    await test.step('確認ダイアログを表示してESCキーで閉じる', async () => {
      const firstCheckbox = mainWindow.locator('.checkbox-column input[type="checkbox"]').first();
      if ((await firstCheckbox.count()) > 0) {
        await firstCheckbox.check();
        await mainWindow.waitForTimeout(300);

        const deleteButton = mainWindow.locator('button.delete-lines-button');
        if ((await deleteButton.count()) > 0) {
          await deleteButton.click();
          await mainWindow.waitForTimeout(500);

          const confirmDialog = mainWindow.locator('[data-testid="confirm-dialog"]');
          await expect(confirmDialog).toBeVisible({ timeout: 2000 });
          await utils.attachScreenshot(testInfo, 'ESCキーテスト前');

          // ESCキーを押す
          await mainWindow.keyboard.press('Escape');
          await mainWindow.waitForTimeout(300);

          // ダイアログが閉じたことを確認
          await expect(confirmDialog).not.toBeVisible();
          await utils.attachScreenshot(testInfo, 'ESCキーでダイアログ閉鎖');
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
      await mainWindow.waitForTimeout(500);
    });

    await test.step('確認ダイアログを表示してENTERキーで確認', async () => {
      // 最初の行の数を記録
      const rowsBefore = await mainWindow.locator('.raw-item-row').count();

      const firstCheckbox = mainWindow.locator('.checkbox-column input[type="checkbox"]').first();
      if ((await firstCheckbox.count()) > 0) {
        await firstCheckbox.check();
        await mainWindow.waitForTimeout(300);

        const deleteButton = mainWindow.locator('button.delete-lines-button');
        if ((await deleteButton.count()) > 0) {
          await deleteButton.click();
          await mainWindow.waitForTimeout(500);

          const confirmDialog = mainWindow.locator('[data-testid="confirm-dialog"]');
          await expect(confirmDialog).toBeVisible({ timeout: 2000 });
          await utils.attachScreenshot(testInfo, 'ENTERキーテスト前');

          // ENTERキーを押す
          await mainWindow.keyboard.press('Enter');
          await mainWindow.waitForTimeout(500);

          // ダイアログが閉じたことを確認
          await expect(confirmDialog).not.toBeVisible();

          // 行が削除されたことを確認
          const rowsAfter = await mainWindow.locator('.raw-item-row').count();
          expect(rowsAfter).toBeLessThan(rowsBefore);
          await utils.attachScreenshot(testInfo, 'ENTERキーで削除実行');
        }
      }
    });
  });
});
