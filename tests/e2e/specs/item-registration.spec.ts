import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - アイテム登録・編集機能テスト', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    // baseテンプレートは既に読み込まれている
    // data2.txtは削除（このテストでは使用しない）
    configHelper.deleteData2();

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
  });

  // ==================== 登録モーダル表示テスト ====================

  test('登録モーダルの表示と基本操作', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('プラスボタンをクリックすると登録モーダルが開く', async () => {
      await utils.attachScreenshot(testInfo, '初期状態');
      await utils.openRegisterModal();
      await utils.attachScreenshot(testInfo, 'モーダル表示');

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

      await utils.attachScreenshot(testInfo, 'フィールド確認完了');
    });

    await test.step('キャンセルボタンを押すとモーダルが閉じる', async () => {
      await utils.clickCancelButton();
      await utils.wait(300);

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
      await utils.wait(500);

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
      await utils.attachScreenshot(testInfo, '登録前の状態');
    });

    await test.step('新しいWebサイトアイテムを登録できる', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: '新規Webサイト',
        path: 'https://example.com',
      });
      await utils.clickRegisterButton();
      await utils.wait(500);

      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, 'Webサイト登録後');

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
      await utils.wait(500);

      await mainWindow.reload();
      await utils.waitForPageLoad();

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
      await utils.wait(500);

      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '引数付きアイテム登録後');

      // 新しいアイテムが表示されていることを確認
      const newItem = mainWindow.locator('.item', { hasText: 'メモ帳（引数あり）' });
      await expect(newItem).toBeVisible();

      // data.txtに引数が保存されていることを確認
      const dataContent = configHelper.readData();
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
      await utils.wait(500);

      const dataAfter = configHelper.readData();
      expect(dataAfter).toContain('テスト保存,https://test-save.com');
    });

    await test.step('登録したアイテムがリロード後も表示される', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: 'リロードテスト',
        path: 'https://reload-test.com',
      });
      await utils.clickRegisterButton();
      await utils.wait(500);

      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, 'リロード後も表示確認');

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
      await utils.wait(500);

      // モーダルが閉じていない（エラーで登録できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = mainWindow.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('名前を入力してください');

      await utils.clickCancelButton();
      await utils.attachScreenshot(testInfo, '空の名前エラー確認');
    });

    await test.step('空のパスでは登録できない', async () => {
      await utils.openRegisterModal();
      await utils.fillRegisterForm({
        name: 'テストアイテム',
      });

      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();
      await utils.wait(500);

      // モーダルが閉じていない（エラーで登録できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = mainWindow.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('パスを入力してください');

      await utils.clickCancelButton();
      await utils.attachScreenshot(testInfo, '空のパスエラー確認');
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
      await utils.attachScreenshot(testInfo, '初期状態');
      await utils.rightClickItem('GitHub');
      await utils.wait(300);
      await utils.attachScreenshot(testInfo, '右クリックメニュー表示');

      const editMenuItem = mainWindow.locator('.context-menu-item', { hasText: '編集' });
      await expect(editMenuItem).toBeVisible();
    });

    await test.step('編集メニューから編集を選択すると登録モーダルが開く', async () => {
      await utils.editItemByRightClick('GitHub');
      await utils.attachScreenshot(testInfo, '編集モーダル表示');

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

      await utils.attachScreenshot(testInfo, '既存値確認完了');

      // モーダルを閉じる
      await utils.clickCancelButton();
    });
  });

  test('アイテムを編集できる', async ({ mainWindow, configHelper }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アイテムの名前を編集できる', async () => {
      await utils.attachScreenshot(testInfo, '編集前');
      await utils.editItemByRightClick('GitHub');
      await utils.fillRegisterForm({
        name: 'EditedGitHub',
      });
      await utils.clickRegisterButton();
      await utils.wait(500);

      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '名前編集後リロード');

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
      await utils.wait(500);

      const dataContent = configHelper.readData();
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
      await utils.wait(500);

      await mainWindow.reload();
      await utils.waitForPageLoad();

      // 登録したアイテムを右クリックして編集
      await utils.editItemByRightClick('引数テスト');
      await utils.fillRegisterForm({
        args: 'C:\\edited.txt',
      });
      await utils.clickRegisterButton();
      await utils.wait(500);
      await utils.attachScreenshot(testInfo, '引数編集後');

      const dataContent = configHelper.readData();
      expect(dataContent).toContain('C:\\edited.txt');
    });

    await test.step('編集したアイテムがリロード後も反映される', async () => {
      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, 'リロード後も編集反映確認');

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
      await utils.wait(500);

      // モーダルが閉じていない（エラーで保存できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = mainWindow.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('名前を入力してください');

      await utils.clickCancelButton();
      await utils.attachScreenshot(testInfo, '空の名前エラー確認');
    });

    await test.step('編集時にパスを空にすると保存できない', async () => {
      await utils.editItemByRightClick('GitHub');
      await utils.fillRegisterForm({
        path: '',
      });

      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();
      await utils.wait(500);

      // モーダルが閉じていない（エラーで保存できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = mainWindow.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('パスを入力してください');

      await utils.clickCancelButton();
      await utils.attachScreenshot(testInfo, '空のパスエラー確認');
    });

    await test.step('編集をキャンセルするとアイテムは変更されない', async () => {
      const dataBefore = configHelper.readData();
      await utils.attachScreenshot(testInfo, '編集前');

      await utils.editItemByRightClick('GitHub');
      await utils.fillRegisterForm({
        name: 'キャンセルテスト',
      });
      await utils.clickCancelButton();
      await utils.wait(500);
      await utils.attachScreenshot(testInfo, 'キャンセル後');

      // data.txtが変更されていないことを確認
      const dataAfter = configHelper.readData();
      expect(dataAfter).toBe(dataBefore);
    });
  });
});
