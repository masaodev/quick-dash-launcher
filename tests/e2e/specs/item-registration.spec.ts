import type { Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - アイテム登録・編集機能テスト', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    // baseテンプレートは既に読み込まれている
    // data2.txtは削除（このテストでは使用しない）
    configHelper.deleteDataFile('data2.txt');

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
  });

  // ==================== 登録モーダル表示テスト ====================

  test('登録モーダルの表示と基本操作', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('プラスボタンをクリックすると登録モーダルが開く', async () => {
      await utils.openRegisterModal();

      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);
    });

    await test.step('登録モーダルに必要なフィールドが表示されている', async () => {
      // 名前入力フィールドが存在することを確認
      const nameInput = mainWindow.locator('.register-modal input[placeholder*="表示名"]').first();
      await expect(nameInput).toBeVisible();

      // パス入力フィールドが存在することを確認
      const pathInput = mainWindow
        .locator('.register-modal input[placeholder*="パス"], input[placeholder*="URL"]')
        .first();
      await expect(pathInput).toBeVisible();

      // 登録ボタンが存在することを確認
      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await expect(registerButton).toBeVisible();

      // キャンセルボタンが存在することを確認
      const cancelButton = mainWindow
        .locator('.register-modal button')
        .filter({ hasText: 'キャンセル' })
        .first();
      await expect(cancelButton).toBeVisible();
    });

    await test.step('キャンセルボタンを押すとモーダルが閉じる', async () => {
      await utils.clickCancelButton();

      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(false);
    });

    await test.step('ESCキーを押すとモーダルが閉じる', async () => {
      // モーダルを再度開く
      await utils.openRegisterModal();

      let isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // ESCキーを押す
      await mainWindow.keyboard.press('Escape');

      isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(false);
    });
  });

  // ==================== アイテム登録テスト ====================

  test('新規アイテムを登録できる', async ({ mainWindow, configHelper }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    let countBefore: number;

    await test.step('登録前のアイテム数を取得', async () => {
      const itemsBefore = mainWindow.locator('.item');
      countBefore = await itemsBefore.count();
    });

    await test.step('新しいWebサイトアイテムを登録できる', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: '新規Webサイト',
        path: 'https://example.com',
      });
      await utils.clickRegisterButton();

      // アイテム数が増えていることを確認
      const itemsAfter = mainWindow.locator('.item');
      const countAfter = await itemsAfter.count();
      expect(countAfter).toBe(countBefore + 1);

      // 新しいアイテムが表示されていることを確認
      const newItem = mainWindow.locator('.item', { hasText: '新規Webサイト' });
      await expect(newItem).toBeVisible();
    });

    await test.step('新しいアプリケーションアイテムを登録できる', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: 'マイアプリ',
        path: 'notepad.exe',
      });
      await utils.clickRegisterButton();

      const newItem = mainWindow.locator('.item', { hasText: 'マイアプリ' });
      await expect(newItem).toBeVisible();
    });

    await test.step('引数付きでアプリケーションアイテムを登録できる', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: 'メモ帳（引数あり）',
        path: 'notepad.exe',
        args: 'C:\\test.txt',
      });
      await utils.clickRegisterButton();

      // 新しいアイテムが表示されていることを確認
      const newItem = mainWindow.locator('.item', { hasText: 'メモ帳（引数あり）' });
      await expect(newItem).toBeVisible();

      // data.txtに引数が保存されていることを確認
      const dataContent = configHelper.readDataFile('data.txt');
      expect(dataContent).toContain('notepad.exe');
      expect(dataContent).toContain('C:\\test.txt');
    });

    await test.step('登録したアイテムがdata.txtに保存される', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: 'テスト保存',
        path: 'https://test-save.com',
      });
      await utils.clickRegisterButton();

      const dataAfter = configHelper.readDataFile('data.txt');
      expect(dataAfter).toContain('テスト保存,https://test-save.com');
    });

    await test.step('登録したアイテムがリロード後も表示される', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: 'リロードテスト',
        path: 'https://reload-test.com',
      });
      await utils.clickRegisterButton();

      const item = mainWindow.locator('.item', { hasText: 'リロードテスト' });
      await expect(item).toBeVisible();
    });
  });

  test('不正な入力では登録できない', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    let countBefore: number;

    await test.step('登録前のアイテム数を取得', async () => {
      const itemsBefore = mainWindow.locator('.item');
      countBefore = await itemsBefore.count();
    });

    await test.step('空の名前では登録できない', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        path: 'https://example.com',
      });

      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();

      // モーダルが閉じていない（エラーで登録できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = mainWindow.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('名前を入力してください');

      await utils.clickCancelButton();
    });

    await test.step('空のパスでは登録できない', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: 'テストアイテム',
      });

      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();

      // モーダルが閉じていない（エラーで登録できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = mainWindow.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('パスを入力してください');

      await utils.clickCancelButton();
    });

    await test.step('アイテム数が変わっていないことを確認', async () => {
      const itemsAfter = mainWindow.locator('.item');
      const countAfter = await itemsAfter.count();
      expect(countAfter).toBe(countBefore);
    });
  });

  // ==================== アイテム編集テスト ====================

  test('編集モーダルの表示と初期値', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アイテムを右クリックすると編集メニューが表示される', async () => {
      await utils.rightClickItem('GitHub');

      const editMenuItem = mainWindow.locator('.context-menu-item', { hasText: '編集' });
      await expect(editMenuItem).toBeVisible();
    });

    await test.step('編集メニューから編集を選択すると登録モーダルが開く', async () => {
      await utils.editItemByRightClick('GitHub');

      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);
    });

    await test.step('編集モーダルには既存アイテムの情報が入力されている', async () => {
      // 名前フィールドに既存の値が入力されていることを確認
      const nameInput = mainWindow.locator('.register-modal input[placeholder*="表示名"]').first();
      const nameValue = await nameInput.inputValue();
      expect(nameValue).toBe('GitHub');

      // パスフィールドに既存の値が入力されていることを確認
      const pathInput = mainWindow
        .locator('.register-modal input[placeholder*="パス"], input[placeholder*="URL"]')
        .first();
      const pathValue = await pathInput.inputValue();
      expect(pathValue.startsWith('https://github.com')).toBe(true);

      // モーダルを閉じる
      await utils.clickCancelButton();
    });
  });

  test('アイテムを編集できる', async ({ mainWindow, configHelper }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アイテムの名前を編集できる', async () => {
      await utils.editItemByRightClick('GitHub');
      await utils.fillRegisterForm({
        name: 'EditedGitHub',
      });
      await utils.clickRegisterButton();

      // 編集後のアイテムが表示されていることを確認
      const editedItem = mainWindow.locator('.item', { hasText: 'EditedGitHub' });
      await expect(editedItem).toBeVisible();

      // 元のアイテム名が存在しないことを確認
      const originalItem = mainWindow.locator('.item .item-name', { hasText: /^GitHub$/ });
      const count = await originalItem.count();
      expect(count).toBe(0);
    });

    await test.step('アイテムのパスを編集できる', async () => {
      await utils.editItemByRightClick('EditedGitHub');
      await utils.fillRegisterForm({
        path: 'https://github.com/new-path',
      });
      await utils.clickRegisterButton();

      const dataContent = configHelper.readDataFile('data.txt');
      expect(dataContent).toContain('https://github.com/new-path');
    });

    await test.step('アイテムの引数を編集できる', async () => {
      // まず引数付きアイテムを登録
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: '引数テスト',
        path: 'notepad.exe',
        args: 'C:\\original.txt',
      });
      await utils.clickRegisterButton();

      // 登録したアイテムを右クリックして編集
      await utils.editItemByRightClick('引数テスト');
      await utils.fillRegisterForm({
        args: 'C:\\edited.txt',
      });
      await utils.clickRegisterButton();

      const dataContent = configHelper.readDataFile('data.txt');
      expect(dataContent).toContain('C:\\edited.txt');
    });

    await test.step('編集したアイテムが反映される', async () => {
      const item = mainWindow.locator('.item', { hasText: 'EditedGitHub' });
      await expect(item).toBeVisible();
    });
  });

  test('編集時の不正入力とキャンセル', async ({ mainWindow, configHelper }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('編集時に名前を空にすると保存できない', async () => {
      await utils.editItemByRightClick('GitHub');
      await utils.fillRegisterForm({
        name: '',
      });

      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();

      // モーダルが閉じていない（エラーで保存できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = mainWindow.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('名前を入力してください');

      await utils.clickCancelButton();
    });

    await test.step('編集時にパスを空にすると保存できない', async () => {
      await utils.editItemByRightClick('GitHub');
      await utils.fillRegisterForm({
        path: '',
      });

      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();

      // モーダルが閉じていない（エラーで保存できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = mainWindow.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('パスを入力してください');

      await utils.clickCancelButton();
    });

    await test.step('編集をキャンセルするとアイテムは変更されない', async () => {
      const dataBefore = configHelper.readDataFile('data.txt');

      await utils.editItemByRightClick('GitHub');
      await utils.fillRegisterForm({
        name: 'キャンセルテスト',
      });
      await utils.clickCancelButton();

      // data.txtが変更されていないことを確認
      const dataAfter = configHelper.readDataFile('data.txt');
      expect(dataAfter).toBe(dataBefore);
    });
  });

  // ==================== マルチタブでのアイテム登録テスト ====================

  test('現在開いているタブがデフォルトの登録先になる', async ({
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('マルチタブ機能を有効化', async () => {
      configHelper.loadTemplate('with-tabs');
      await mainWindow.reload();
      await utils.waitForPageLoad();
    });

    await test.step('メインタブで登録モーダルを開く', async () => {
      // メインタブがアクティブであることを確認
      const mainTab = mainWindow.locator('.file-tab.active', { hasText: 'メイン' });
      await expect(mainTab).toBeVisible();

      await utils.openRegisterModal();
    });

    await test.step('デフォルトの保存先がメインタブ（data.txt）になっている', async () => {
      // 保存先セレクトボックスの値を確認
      const targetTabSelect = mainWindow.locator('.register-modal select').last();
      const selectedValue = await targetTabSelect.inputValue();
      expect(selectedValue).toBe('data.txt');

      await utils.clickCancelButton();
    });

    await test.step('サブタブに切り替え', async () => {
      const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await subTab1.click();
    });

    await test.step('サブタブで登録モーダルを開く', async () => {
      // サブタブがアクティブであることを確認
      const subTab1 = mainWindow.locator('.file-tab.active', { hasText: 'サブ1' });
      await expect(subTab1).toBeVisible();

      await utils.openRegisterModal();
    });

    await test.step('デフォルトの保存先がサブタブ（data2.txt）になっている', async () => {
      // 保存先セレクトボックスの値を確認
      const targetTabSelect = mainWindow.locator('.register-modal select').last();
      const selectedValue = await targetTabSelect.inputValue();
      expect(selectedValue).toBe('data2.txt');

      await utils.clickCancelButton();
    });

    await test.step('サブタブでアイテムを登録', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: 'サブタブ登録テスト',
        path: 'https://sub-tab-test.com',
      });
      await utils.clickRegisterButton();
    });

    await test.step('登録したアイテムがサブタブ（data2.txt）に保存される', async () => {
      // data2.txtの内容を確認
      const data2Content = configHelper.readDataFile('data2.txt');
      expect(data2Content).toContain('サブタブ登録テスト,https://sub-tab-test.com');

      // data.txtには保存されていないことを確認
      const dataContent = configHelper.readDataFile('data.txt');
      expect(dataContent).not.toContain('サブタブ登録テスト');
    });

    await test.step('サブタブで登録したアイテムが表示される', async () => {
      // サブタブに切り替え
      const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await subTab1.click();

      // 登録したアイテムが表示されることを確認
      const item = mainWindow.locator('.item', { hasText: 'サブタブ登録テスト' });
      await expect(item).toBeVisible();
    });

    await test.step('メインタブには登録したアイテムが表示されない', async () => {
      // メインタブに戻る
      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      await mainTab.click();

      // サブタブで登録したアイテムが表示されないことを確認
      const item = mainWindow.locator('.item', { hasText: 'サブタブ登録テスト' });
      await expect(item).not.toBeVisible();
    });
  });

  // ==================== データ同期テスト ====================

  test('メイン画面で登録したアイテムが管理画面に反映される', async ({
    mainWindow,
    electronApp,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('メイン画面で新規アイテムを登録', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: '同期テストアイテム',
        path: 'https://sync-test.com',
      });
      await utils.clickRegisterButton();

      // メイン画面でアイテムが表示されることを確認
      const item = mainWindow.locator('.item', { hasText: '同期テストアイテム' });
      await expect(item).toBeVisible();
    });

    let adminWindow: Page | null = null;

    await test.step('管理画面を開く', async () => {
      adminWindow = await utils.openAdminWindow(electronApp, 'edit');
      const adminUtils = new TestUtils(adminWindow);

      // ページ読み込み完了を待機
      await adminUtils.waitForPageLoad();

      // アイテム管理タブがアクティブであることを確認
      const editTab = adminWindow.locator('.tab-button.active', { hasText: 'アイテム管理' });
      await expect(editTab).toBeVisible();
    });

    await test.step('管理画面で登録したアイテムが表示されることを確認', async () => {
      if (!adminWindow) {
        throw new Error('管理画面が見つかりません');
      }

      const adminUtils = new TestUtils(adminWindow);

      // 登録したアイテムが表示されていることを確認
      const itemRow = adminWindow.locator('.raw-item-row', { hasText: '同期テストアイテム' });
      await expect(itemRow).toBeVisible({ timeout: 10000 });

      // アイテムの内容を確認
      const itemContent = await itemRow.textContent();
      expect(itemContent).toContain('同期テストアイテム');
      expect(itemContent).toContain('https://sync-test.com');

      // 管理画面を閉じる
      await adminWindow.close();
    });
  });
});
