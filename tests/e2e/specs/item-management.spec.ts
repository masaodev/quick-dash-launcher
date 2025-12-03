import type { Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - アイテム管理機能テスト', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    // baseテンプレートは既に読み込まれている
    // data2.txtは削除（このテストでは使用しない）
    configHelper.deleteDataFile('data2.txt');

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
  });

  // ==================== 管理画面表示テスト ====================

  test('管理画面を開くとアイテム管理タブが表示される', async ({
    electronApp,
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('初期状態を確認', async () => {
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('管理画面が表示されることを確認', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '管理画面表示');

        // アイテム管理タブがアクティブであることを確認
        const editTab = adminWindow.locator('.tab-button.active', { hasText: 'アイテム管理' });
        await expect(editTab).toBeVisible();
      });

      await test.step('テーブルヘッダーが正しく表示されることを確認', async () => {
        // 行番号列
        const numberHeader = adminWindow.locator('th.line-number-column');
        await expect(numberHeader).toBeVisible();

        // 種類列
        const typeHeader = adminWindow.locator('th.type-column');
        await expect(typeHeader).toBeVisible();

        // 名前列
        const nameHeader = adminWindow.locator('th.name-column');
        await expect(nameHeader).toBeVisible();

        // パスと引数列
        const pathHeader = adminWindow.locator('th.content-column');
        await expect(pathHeader).toBeVisible();

        // 操作列
        const actionHeader = adminWindow.locator('th.actions-column');
        await expect(actionHeader).toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('管理画面にdata.txtのアイテムが表示される', async ({
    electronApp,
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('アイテムが表示されることを確認', async () => {
        await adminUtils.wait(500);

        // data.txtの既知のアイテムが表示されることを確認
        const knownItems = ['GitHub', 'Google', 'Wikipedia'];

        for (const itemName of knownItems) {
          const itemRow = adminWindow.locator('.raw-item-row', { hasText: itemName });
          await expect(itemRow).toBeVisible({ timeout: 5000 });
        }

        await adminUtils.attachScreenshot(testInfo, 'アイテム表示確認');
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== アイテム追加テスト ====================

  test('新規アイテムを追加できる', async ({ electronApp, mainWindow, configHelper }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('行を追加ボタンをクリック', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '初期状態');

        const addButton = adminWindow.locator('button.add-line-button');
        await addButton.click();
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, '行追加後');

        // 空行が追加されたことを確認
        const emptyRow = adminWindow.locator('.raw-item-row').last();
        await expect(emptyRow).toBeVisible();
      });

      await test.step('アイテム種別を選択（単一アイテム）', async () => {
        const lastRow = adminWindow.locator('.raw-item-row').last();
        const singleItemButton = lastRow.locator('button', { hasText: '📄 単一アイテム' });
        await singleItemButton.click();
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, 'アイテム種別選択後');
      });

      await test.step('セル編集で名前とパスを入力', async () => {
        const lastRow = adminWindow.locator('.raw-item-row').last();

        // 名前列をクリックして編集
        const nameCell = lastRow.locator('.name-column .editable-cell');
        await nameCell.click();
        await adminUtils.wait(100);
        const nameInput = lastRow.locator('.name-column .edit-input');
        await nameInput.fill('新規アイテム');
        await nameInput.press('Enter');
        await adminUtils.wait(300);

        // パスと引数列をクリックして編集
        const pathCell = lastRow.locator('.content-column .editable-cell');
        await pathCell.click();
        await adminUtils.wait(100);
        const pathInput = lastRow.locator('.content-column .edit-input');
        await pathInput.fill('https://new-item.com');
        await pathInput.press('Enter');
        await adminUtils.wait(300);

        await adminUtils.attachScreenshot(testInfo, 'セル編集完了');
      });

      await test.step('保存ボタンをクリック', async () => {
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);
        await adminUtils.attachScreenshot(testInfo, '保存後');

        // data.txtに保存されたことを確認
        const dataContent = configHelper.readDataFile('data.txt');
        expect(dataContent).toContain('新規アイテム,https://new-item.com');
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== アイテム編集テスト ====================

  test('セル編集でアイテムの名前を変更できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('GitHubアイテムの名前を編集', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '編集前');

        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        const nameCell = githubRow.locator('.name-column .editable-cell');
        await nameCell.click();
        await adminUtils.wait(100);

        const nameInput = githubRow.locator('.name-column .edit-input');
        await nameInput.fill('GitHub編集後');
        await nameInput.press('Enter');
        await adminUtils.wait(300);

        await adminUtils.attachScreenshot(testInfo, '名前編集後');
      });

      await test.step('保存して確認', async () => {
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);

        const dataContent = configHelper.readDataFile('data.txt');
        expect(dataContent).toContain('GitHub編集後');
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('詳細編集モーダルでアイテムを編集できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('GitHubアイテムの詳細編集ボタンをクリック', async () => {
        await adminUtils.wait(500);

        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        const editButton = githubRow.locator('button.detail-edit-button');
        await editButton.click();
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '詳細編集モーダル表示');

        // 登録モーダルが開いたことを確認
        const modal = adminWindow.locator('.register-modal');
        await expect(modal).toBeVisible();
      });

      await test.step('モーダルで名前と引数を編集', async () => {
        const nameInput = adminWindow
          .locator('.register-modal input[placeholder*="表示名"]')
          .first();
        await nameInput.fill('GitHub詳細編集');

        const argsInput = adminWindow.locator('.register-modal input[placeholder*="引数"]').first();
        await argsInput.fill('--test-args');
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, 'モーダル編集後');
      });

      await test.step('更新ボタンをクリック', async () => {
        const updateButton = adminWindow.locator('.register-modal button.primary').first();
        await updateButton.click();
        await adminUtils.wait(800);
        await adminUtils.attachScreenshot(testInfo, '更新後');

        // data.txtに保存されたことを確認
        const dataContent = configHelper.readDataFile('data.txt');
        expect(dataContent).toContain('GitHub詳細編集');
        expect(dataContent).toContain('--test-args');
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== アイテム削除テスト ====================

  test('アイテムを削除できる', async ({ electronApp, mainWindow, configHelper }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('GitHubアイテムを削除', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '削除前');

        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        const deleteButton = githubRow.locator('button.delete-button');

        // 削除ボタンをクリック（カスタムConfirmDialogが表示される）
        await deleteButton.click();
        await adminUtils.wait(300);

        // カスタムConfirmDialogの確認ボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();
        await adminUtils.wait(300);

        // ダイアログが閉じたことを確認
        const confirmDialog = adminWindow.locator('.confirm-dialog');
        await expect(confirmDialog).not.toBeVisible();

        await adminUtils.attachScreenshot(testInfo, '削除後');

        // GitHubアイテムが表示されなくなったことを確認
        const githubRowAfter = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRowAfter).not.toBeVisible();
      });

      await test.step('保存して確認', async () => {
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);

        const dataContent = configHelper.readDataFile('data.txt');
        expect(dataContent).not.toContain('GitHub');
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('チェックボックスで複数アイテムを選択して一括削除できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('GitHubとGoogleをチェック', async () => {
        await adminUtils.wait(500);

        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        const githubCheckbox = githubRow.locator('input[type="checkbox"]').first();
        await githubCheckbox.click();
        await adminUtils.wait(100);

        const googleRow = adminWindow.locator('.raw-item-row', { hasText: 'Google' });
        const googleCheckbox = googleRow.locator('input[type="checkbox"]').first();
        await googleCheckbox.click();
        await adminUtils.wait(100);

        await adminUtils.attachScreenshot(testInfo, 'チェック後');
      });

      await test.step('選択したアイテムを削除ボタンをクリック', async () => {
        const deleteSelectedButton = adminWindow.locator('button.delete-lines-button');

        // 削除ボタンをクリック（カスタムConfirmDialogが表示される）
        await deleteSelectedButton.click();
        await adminUtils.wait(300);

        // カスタムConfirmDialogの確認ボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();
        await adminUtils.wait(300);

        // ダイアログが閉じたことを確認
        const confirmDialog = adminWindow.locator('.confirm-dialog');
        await expect(confirmDialog).not.toBeVisible();

        await adminUtils.attachScreenshot(testInfo, '一括削除後');

        // アイテムが削除されたことを確認
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRow).not.toBeVisible();

        const googleRow = adminWindow.locator('.raw-item-row', { hasText: 'Google' });
        await expect(googleRow).not.toBeVisible();
      });

      await test.step('保存して確認', async () => {
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);

        const dataContent = configHelper.readDataFile('data.txt');
        expect(dataContent).not.toContain('GitHub');
        expect(dataContent).not.toContain('Google');
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== データ整列テスト ====================

  test('整列ボタンでアイテムを整列できる', async ({ electronApp, mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('整列前のアイテム順序を確認', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '整列前');

        // アイテム行を取得
        const rows = adminWindow.locator('.raw-item-row');
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
      });

      await test.step('整列ボタンをクリック', async () => {
        const sortButton = adminWindow.locator('button.sort-button');

        // 整列ボタンをクリック
        await sortButton.click();
        await adminUtils.wait(500);

        // 重複削除の確認ダイアログが表示された場合は閉じる
        const confirmDialog = adminWindow.locator('.confirm-dialog');
        const isDialogVisible = await confirmDialog.isVisible().catch(() => false);
        if (isDialogVisible) {
          // OKボタンをクリックして重複削除を実行
          const confirmButton = adminWindow.locator(
            '[data-testid="confirm-dialog-confirm-button"]'
          );
          await confirmButton.click();
          await adminUtils.wait(300);
        }

        await adminUtils.attachScreenshot(testInfo, '整列後');

        // 未保存状態になったことを確認
        const saveButton = adminWindow.locator('button.save-changes-button');
        await expect(saveButton).toBeEnabled();
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== 検索機能テスト ====================

  test('検索ボックスでアイテムを絞り込みできる', async ({ electronApp, mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('検索前の全アイテム数を確認', async () => {
        await adminUtils.wait(500);

        const allRows = adminWindow.locator('.raw-item-row');
        const initialCount = await allRows.count();
        expect(initialCount).toBeGreaterThan(0);

        await adminUtils.attachScreenshot(testInfo, '検索前');
      });

      await test.step('GitHubで検索', async () => {
        const searchInput = adminWindow.locator('input[type="text"]').first();
        await searchInput.fill('GitHub');
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, '検索後');

        // GitHubアイテムが表示されることを確認
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRow).toBeVisible();
      });

      await test.step('検索をクリアして全アイテムが再表示される', async () => {
        const searchInput = adminWindow.locator('input[type="text"]').first();
        await searchInput.clear();
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, '検索クリア後');

        // 全アイテムが再表示されることを確認
        const allRows = adminWindow.locator('.raw-item-row');
        const count = await allRows.count();
        expect(count).toBeGreaterThan(1);
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== メイン画面との同期テスト ====================

  test('管理画面でアイテムを編集するとメイン画面に即座に反映される', async ({
    electronApp,
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('管理画面でGitHubアイテムの名前を編集', async () => {
        await adminUtils.wait(500);

        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        const nameCell = githubRow.locator('.name-column .editable-cell');
        await nameCell.click();
        await adminUtils.wait(100);

        const nameInput = githubRow.locator('.name-column .edit-input');
        await nameInput.fill('GitHub同期テスト');
        await nameInput.press('Enter');
        await adminUtils.wait(300);

        // 保存
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);

        await adminUtils.attachScreenshot(testInfo, '管理画面保存後');
      });

      await test.step('メイン画面に変更が反映されたことを確認', async () => {
        // メイン画面を確認（リロード不要で反映されるはず）
        await utils.wait(500);
        await utils.attachScreenshot(testInfo, 'メイン画面確認');

        const updatedItem = mainWindow.locator('.item', { hasText: 'GitHub同期テスト' });
        await expect(updatedItem).toBeVisible({ timeout: 3000 });

        // 元の名前は表示されない
        const originalItem = mainWindow.locator('.item .item-name', { hasText: /^GitHub$/ });
        await expect(originalItem).not.toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== タブ選択テスト ====================

  test('マルチタブ環境でタブを選択してアイテムを編集できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('マルチタブ機能を有効化', async () => {
      configHelper.loadTemplate('with-tabs');
      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, 'マルチタブ有効化');
    });

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('タブ選択ドロップダウンが表示されることを確認', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '管理画面初期状態');

        const tabSelect = adminWindow.locator('select').first();
        await expect(tabSelect).toBeVisible();
      });

      await test.step('サブ1タブに切り替え', async () => {
        const tabSelect = adminWindow.locator('select').first();
        await tabSelect.selectOption({ value: '1' }); // インデックス1 = サブ1タブ
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, 'サブ1タブ選択後');

        // data2.txtのアイテムが表示されることを確認
        const redditRow = adminWindow.locator('.raw-item-row', { hasText: 'Reddit' });
        await expect(redditRow).toBeVisible({ timeout: 5000 });
      });

      await test.step('サブ1タブでアイテムを編集', async () => {
        const redditRow = adminWindow.locator('.raw-item-row', { hasText: 'Reddit' });
        const nameCell = redditRow.locator('.name-column .editable-cell');
        await nameCell.click();
        await adminUtils.wait(100);

        const nameInput = redditRow.locator('.name-column .edit-input');
        await nameInput.fill('Reddit編集');
        await nameInput.press('Enter');
        await adminUtils.wait(300);

        // 保存
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);

        // data2.txtに保存されたことを確認
        const data2Content = configHelper.readDataFile('data2.txt');
        expect(data2Content).toContain('Reddit編集');
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== フォルダ取込アイテムテスト ====================

  test('フォルダ取込アイテムを追加できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('行を追加', async () => {
        await adminUtils.wait(500);

        const addButton = adminWindow.locator('button.add-line-button');
        await addButton.click();
        await adminUtils.wait(300);
      });

      await test.step('フォルダ取込アイテムを選択', async () => {
        const lastRow = adminWindow.locator('.raw-item-row').last();
        const folderButton = lastRow.locator('button.type-select-button.folder-button');
        await folderButton.click();
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, 'フォルダ取込選択後');
      });

      await test.step('パスを入力', async () => {
        const lastRow = adminWindow.locator('.raw-item-row').last();
        const pathCell = lastRow.locator('.content-column .editable-cell');
        await pathCell.click();
        await adminUtils.wait(100);

        const pathInput = lastRow.locator('.content-column .edit-input');
        await pathInput.fill('C:\\TestFolder');
        await pathInput.press('Enter');
        await adminUtils.wait(300);
        await adminUtils.attachScreenshot(testInfo, 'パス入力後');
      });

      await test.step('保存して確認', async () => {
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);

        const dataContent = configHelper.readDataFile('data.txt');
        expect(dataContent).toContain('dir,C:\\TestFolder');
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== 複数ファイルタブテスト ====================

  test('複数ファイルを持つタブでファイルを切り替えて編集できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('複数ファイルタブ機能を有効化', async () => {
      configHelper.loadTemplate('with-multi-file-tabs');
      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '複数ファイルタブ有効化');
    });

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('タブとファイル選択ドロップダウンが表示される', async () => {
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, '管理画面初期状態');

        // タブ選択ドロップダウン
        const tabSelect = adminWindow.locator('select').first();
        await expect(tabSelect).toBeVisible();

        // ファイル選択ドロップダウン（統合タブは複数ファイルを持つ）
        const fileSelect = adminWindow.locator('select').nth(1);
        await expect(fileSelect).toBeVisible();
      });

      await test.step('data.txtのアイテムが表示される', async () => {
        // デフォルトでdata.txtが選択されているはず
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRow).toBeVisible({ timeout: 5000 });
      });

      await test.step('data3.txtに切り替え', async () => {
        // ファイル選択ドロップダウンでdata3.txtを選択
        const fileSelect = adminWindow.locator('select').nth(1);
        await fileSelect.selectOption({ label: 'data3.txt' });
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, 'data3.txt選択後');

        // data3.txtのアイテムが表示されることを確認
        const qiitaRow = adminWindow.locator('.raw-item-row', { hasText: 'Qiita' });
        await expect(qiitaRow).toBeVisible({ timeout: 5000 });

        // data.txtのアイテムは表示されない
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRow).not.toBeVisible();
      });

      await test.step('data3.txtでアイテムを編集', async () => {
        const qiitaRow = adminWindow.locator('.raw-item-row', { hasText: 'Qiita' });
        const nameCell = qiitaRow.locator('.name-column .editable-cell');
        await nameCell.click();
        await adminUtils.wait(100);

        const nameInput = qiitaRow.locator('.name-column .edit-input');
        await nameInput.fill('Qiita編集');
        await nameInput.press('Enter');
        await adminUtils.wait(300);

        // 保存
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);

        // data3.txtに保存されたことを確認
        const data3Content = configHelper.readDataFile('data3.txt');
        expect(data3Content).toContain('Qiita編集');
      });

      await test.step('data.txtに戻って編集', async () => {
        // data.txtに戻る
        const fileSelect = adminWindow.locator('select').nth(1);
        await fileSelect.selectOption({ label: 'data.txt' });
        await adminUtils.wait(500);

        // GitHubアイテムを編集
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        const nameCell = githubRow.locator('.name-column .editable-cell');
        await nameCell.click();
        await adminUtils.wait(100);

        const nameInput = githubRow.locator('.name-column .edit-input');
        await nameInput.fill('GitHub統合タブ');
        await nameInput.press('Enter');
        await adminUtils.wait(300);

        // 保存
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);

        // data.txtに保存されたことを確認
        const dataContent = configHelper.readDataFile('data.txt');
        expect(dataContent).toContain('GitHub統合タブ');
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('複数ファイルタブでサブタブに切り替えて編集できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('複数ファイルタブ機能を有効化', async () => {
      configHelper.loadTemplate('with-multi-file-tabs');
      await mainWindow.reload();
      await utils.waitForPageLoad();
    });

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('サブ1タブに切り替え', async () => {
        await adminUtils.wait(500);

        // タブ選択ドロップダウンでサブ1を選択
        const tabSelect = adminWindow.locator('select').first();
        await tabSelect.selectOption({ value: '1' }); // インデックス1 = サブ1タブ
        await adminUtils.wait(500);
        await adminUtils.attachScreenshot(testInfo, 'サブ1タブ選択後');

        // サブ1は単一ファイル（data2.txt）なので、ファイル選択ドロップダウンは表示されない
        const fileSelects = adminWindow.locator('select');
        const count = await fileSelects.count();
        expect(count).toBe(1); // タブ選択のみ

        // data2.txtのアイテムが表示される
        const redditRow = adminWindow.locator('.raw-item-row', { hasText: 'Reddit' });
        await expect(redditRow).toBeVisible({ timeout: 5000 });
      });

      await test.step('サブ1タブでアイテムを編集', async () => {
        const redditRow = adminWindow.locator('.raw-item-row', { hasText: 'Reddit' });
        const nameCell = redditRow.locator('.name-column .editable-cell');
        await nameCell.click();
        await adminUtils.wait(100);

        const nameInput = redditRow.locator('.name-column .edit-input');
        await nameInput.fill('Reddit複数ファイルタブ');
        await nameInput.press('Enter');
        await adminUtils.wait(300);

        // 保存
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);

        // data2.txtに保存されたことを確認
        const data2Content = configHelper.readDataFile('data2.txt');
        expect(data2Content).toContain('Reddit複数ファイルタブ');
      });

      await test.step('統合タブに戻る', async () => {
        const tabSelect = adminWindow.locator('select').first();
        await tabSelect.selectOption({ value: '0' }); // インデックス0 = 統合タブ
        await adminUtils.wait(500);

        // ファイル選択ドロップダウンが再表示される
        const fileSelect = adminWindow.locator('select').nth(1);
        await expect(fileSelect).toBeVisible();

        // data.txtのアイテムが表示される
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRow).toBeVisible({ timeout: 5000 });
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('複数ファイルタブでアイテムを追加すると正しいファイルに保存される', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('複数ファイルタブ機能を有効化', async () => {
      configHelper.loadTemplate('with-multi-file-tabs');
      await mainWindow.reload();
      await utils.waitForPageLoad();
    });

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('data3.txtに切り替え', async () => {
        await adminUtils.wait(500);

        const fileSelect = adminWindow.locator('select').nth(1);
        await fileSelect.selectOption({ label: 'data3.txt' });
        await adminUtils.wait(500);
      });

      await test.step('data3.txtに新規アイテムを追加', async () => {
        const addButton = adminWindow.locator('button.add-line-button');
        await addButton.click();
        await adminUtils.wait(300);

        // 種別選択
        const lastRow = adminWindow.locator('.raw-item-row').last();
        const singleItemButton = lastRow.locator('button', { hasText: '📄 単一アイテム' });
        await singleItemButton.click();
        await adminUtils.wait(300);

        // 名前入力
        const nameCell = lastRow.locator('.name-column .editable-cell');
        await nameCell.click();
        await adminUtils.wait(100);
        const nameInput = lastRow.locator('.name-column .edit-input');
        await nameInput.fill('新規data3アイテム');
        await nameInput.press('Enter');
        await adminUtils.wait(300);

        // パス入力
        const pathCell = lastRow.locator('.content-column .editable-cell');
        await pathCell.click();
        await adminUtils.wait(100);
        const pathInput = lastRow.locator('.content-column .edit-input');
        await pathInput.fill('https://example3.com');
        await pathInput.press('Enter');
        await adminUtils.wait(300);

        // 保存
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();
        await adminUtils.wait(800);

        // data3.txtに保存されたことを確認
        const data3Content = configHelper.readDataFile('data3.txt');
        expect(data3Content).toContain('新規data3アイテム,https://example3.com');

        // data.txtには保存されていないことを確認
        const dataContent = configHelper.readDataFile('data.txt');
        expect(dataContent).not.toContain('新規data3アイテム');
      });
    } finally {
      await adminWindow.close();
    }
  });
});
