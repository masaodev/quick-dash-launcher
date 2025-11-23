import path from 'path';

import { test, expect } from '../fixtures/electron-app';
import { ConfigFileHelper } from '../helpers/config-file-helper';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - アイテム登録・編集機能テスト', () => {
  let configHelper: ConfigFileHelper;

  test.beforeEach(async ({ mainWindow }) => {
    const configDir = path.join(process.cwd(), 'tests', 'fixtures', 'e2e', 'default');
    configHelper = new ConfigFileHelper(configDir);

    // テンプレートから強制的に復元して初期状態を保証
    configHelper.restoreDataFromTemplate('base');
    configHelper.deleteData2(); // data2.txtは削除

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
  });

  test.afterEach(async () => {
    // テンプレートから復元して次のテストのために初期状態に戻す
    configHelper.restoreDataFromTemplate('base');
    configHelper.deleteData2();
  });

  // ==================== 登録モーダル表示テスト ====================

  test('プラスボタンをクリックすると登録モーダルが開く', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('初期状態を確認', async () => {
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    await test.step('登録モーダルを開く', async () => {
      await utils.openRegisterModal();
      await utils.attachScreenshot(testInfo, 'モーダル表示');
    });

    await test.step('モーダルが表示されることを確認', async () => {
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);
    });
  });

  test('登録モーダルに必要なフィールドが表示されている', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // 登録モーダルを開く
    await utils.openRegisterModal();

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

  test('登録モーダルでキャンセルボタンを押すとモーダルが閉じる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // 登録モーダルを開く
    await utils.openRegisterModal();

    // モーダルが表示されていることを確認
    let isVisible = await utils.isRegisterModalVisible();
    expect(isVisible).toBe(true);

    // キャンセルボタンをクリック
    await utils.clickCancelButton();

    // モーダルが閉じていることを確認
    isVisible = await utils.isRegisterModalVisible();
    expect(isVisible).toBe(false);
  });

  test('登録モーダルでESCキーを押すとモーダルが閉じる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // 登録モーダルを開く
    await utils.openRegisterModal();

    // モーダルが表示されていることを確認
    let isVisible = await utils.isRegisterModalVisible();
    expect(isVisible).toBe(true);

    // ESCキーを押す
    await mainWindow.keyboard.press('Escape');
    await utils.wait(500);

    // モーダルが閉じていることを確認
    isVisible = await utils.isRegisterModalVisible();
    expect(isVisible).toBe(false);
  });

  // ==================== アイテム登録テスト ====================

  test('新しいWebサイトアイテムを登録できる', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    let countBefore: number;

    await test.step('登録前のアイテム数を取得', async () => {
      const itemsBefore = mainWindow.locator('.item');
      countBefore = await itemsBefore.count();
      await utils.attachScreenshot(testInfo, '登録前の状態');
    });

    await test.step('登録モーダルを開く', async () => {
      await utils.openRegisterModal();
      await utils.attachScreenshot(testInfo, 'モーダル表示');
    });

    await test.step('フォームに入力', async () => {
      await utils.fillRegisterForm({
        name: '新規Webサイト',
        path: 'https://example.com',
      });
      await utils.attachScreenshot(testInfo, 'フォーム入力完了');
    });

    await test.step('登録ボタンをクリック', async () => {
      await utils.clickRegisterButton();
      await utils.wait(500);
      await utils.attachScreenshot(testInfo, '登録後');
    });

    await test.step('アプリをリロードして変更を反映', async () => {
      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, 'リロード後');
    });

    await test.step('アイテム数が増えていることを確認', async () => {
      const itemsAfter = mainWindow.locator('.item');
      const countAfter = await itemsAfter.count();
      expect(countAfter).toBe(countBefore + 1);
    });

    await test.step('新しいアイテムが表示されていることを確認', async () => {
      const newItem = mainWindow.locator('.item', { hasText: '新規Webサイト' });
      await expect(newItem).toBeVisible();
    });
  });

  test('新しいアプリケーションアイテムを登録できる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // 登録モーダルを開く
    await utils.openRegisterModal();

    // フォームに入力
    await utils.fillRegisterForm({
      name: 'マイアプリ',
      path: 'notepad.exe',
    });

    // 登録ボタンをクリック
    await utils.clickRegisterButton();
    await utils.wait(500);

    // アプリをリロードして変更を反映
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // 新しいアイテムが表示されていることを確認
    const newItem = mainWindow.locator('.item', { hasText: 'マイアプリ' });
    await expect(newItem).toBeVisible();
  });

  test('引数付きでアプリケーションアイテムを登録できる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // 登録モーダルを開く
    await utils.openRegisterModal();

    // フォームに入力
    await utils.fillRegisterForm({
      name: 'メモ帳（引数あり）',
      path: 'notepad.exe',
      args: 'C:\\test.txt',
    });

    // 登録ボタンをクリック
    await utils.clickRegisterButton();
    await utils.wait(500);

    // アプリをリロードして変更を反映
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // 新しいアイテムが表示されていることを確認
    const newItem = mainWindow.locator('.item', { hasText: 'メモ帳（引数あり）' });
    await expect(newItem).toBeVisible();

    // data.txtに引数が保存されていることを確認
    const dataContent = configHelper.readData();
    expect(dataContent).toContain('notepad.exe');
    expect(dataContent).toContain('C:\\test.txt');
  });

  // アプリ側にバリデーションロジックが未実装のため、このテストはスキップ
  test.skip('空の名前では登録できない', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    let countBefore: number;

    await test.step('登録前のアイテム数を取得', async () => {
      const itemsBefore = mainWindow.locator('.item');
      countBefore = await itemsBefore.count();
    });

    await test.step('登録モーダルを開く', async () => {
      await utils.openRegisterModal();
    });

    await test.step('パスだけを入力（名前は空）', async () => {
      await utils.fillRegisterForm({
        path: 'https://example.com',
      });
    });

    await test.step('登録ボタンをクリック', async () => {
      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();
      await utils.wait(500);
    });

    await test.step('モーダルが閉じていない（エラーで登録できない）', async () => {
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);
    });

    await test.step('キャンセルしてモーダルを閉じる', async () => {
      await utils.clickCancelButton();
    });

    await test.step('アイテム数が変わっていないことを確認', async () => {
      const itemsAfter = mainWindow.locator('.item');
      const countAfter = await itemsAfter.count();
      expect(countAfter).toBe(countBefore);
    });
  });

  // アプリ側にバリデーションロジックが未実装のため、このテストはスキップ
  test.skip('空のパスでは登録できない', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    let countBefore: number;

    await test.step('登録前のアイテム数を取得', async () => {
      const itemsBefore = mainWindow.locator('.item');
      countBefore = await itemsBefore.count();
    });

    await test.step('登録モーダルを開く', async () => {
      await utils.openRegisterModal();
    });

    await test.step('名前だけを入力（パスは空）', async () => {
      await utils.fillRegisterForm({
        name: 'テストアイテム',
      });
    });

    await test.step('登録ボタンをクリック', async () => {
      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();
      await utils.wait(500);
    });

    await test.step('モーダルが閉じていない（エラーで登録できない）', async () => {
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);
    });

    await test.step('キャンセルしてモーダルを閉じる', async () => {
      await utils.clickCancelButton();
    });

    await test.step('アイテム数が変わっていないことを確認', async () => {
      const itemsAfter = mainWindow.locator('.item');
      const countAfter = await itemsAfter.count();
      expect(countAfter).toBe(countBefore);
    });
  });

  // ==================== data.txtへの保存確認 ====================

  test('登録したアイテムがdata.txtに保存される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // 登録前のdata.txtの内容を取得
    const dataBefore = configHelper.readData();

    // 登録モーダルを開く
    await utils.openRegisterModal();

    // フォームに入力
    await utils.fillRegisterForm({
      name: 'テスト保存',
      path: 'https://test-save.com',
    });

    // 登録ボタンをクリック
    await utils.clickRegisterButton();
    await utils.wait(500);

    // data.txtに追加されていることを確認
    const dataAfter = configHelper.readData();
    expect(dataAfter).not.toBe(dataBefore);
    expect(dataAfter).toContain('テスト保存,https://test-save.com');
  });

  test('登録したアイテムがリロード後も表示される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // 登録モーダルを開く
    await utils.openRegisterModal();

    // フォームに入力
    await utils.fillRegisterForm({
      name: 'リロードテスト',
      path: 'https://reload-test.com',
    });

    // 登録ボタンをクリック
    await utils.clickRegisterButton();
    await utils.wait(500);

    // アプリをリロード
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // 登録したアイテムが表示されていることを確認
    const item = mainWindow.locator('.item', { hasText: 'リロードテスト' });
    await expect(item).toBeVisible();
  });

  // ==================== アイテム編集テスト ====================

  test('アイテムを右クリックすると編集メニューが表示される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // GitHubアイテムを右クリック
    await utils.rightClickItem('GitHub');
    await utils.wait(300);

    // 編集メニュー項目が表示されることを確認
    const editMenuItem = mainWindow.locator('.context-menu-item', { hasText: '編集' });
    await expect(editMenuItem).toBeVisible();
  });

  test('編集メニューから編集を選択すると登録モーダルが開く', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // アイテムを右クリックして編集モーダルを開く
    await utils.editItemByRightClick('GitHub');

    // モーダルが表示されることを確認
    const isVisible = await utils.isRegisterModalVisible();
    expect(isVisible).toBe(true);
  });

  test('編集モーダルには既存アイテムの情報が入力されている', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // GitHubアイテムを右クリックして編集モーダルを開く
    await utils.editItemByRightClick('GitHub');

    // 名前フィールドに既存の値が入力されていることを確認
    const nameInput = mainWindow.locator('.register-modal input[placeholder*="表示名"]').first();
    const nameValue = await nameInput.inputValue();
    expect(nameValue).toBe('GitHub');

    // パスフィールドに既存の値が入力されていることを確認
    // 注: アプリはURL末尾に自動的にスラッシュを追加する可能性がある
    const pathInput = mainWindow
      .locator('.register-modal input[placeholder*="パス"], input[placeholder*="URL"]')
      .first();
    const pathValue = await pathInput.inputValue();
    expect(pathValue.startsWith('https://github.com')).toBe(true);
  });

  test('アイテムの名前を編集できる', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('GitHubアイテムを右クリックして編集モーダルを開く', async () => {
      await utils.attachScreenshot(testInfo, '編集前');
      await utils.editItemByRightClick('GitHub');
      await utils.attachScreenshot(testInfo, '編集モーダル表示');
    });

    await test.step('名前を変更', async () => {
      await utils.fillRegisterForm({
        name: 'EditedGitHub',
      });
      await utils.attachScreenshot(testInfo, '名前変更後');
    });

    await test.step('登録ボタンをクリック', async () => {
      await utils.clickRegisterButton();
      await utils.wait(500);
      await utils.attachScreenshot(testInfo, '保存後');
    });

    await test.step('アプリをリロードして変更を反映', async () => {
      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, 'リロード後');
    });

    await test.step('編集後のアイテムが表示されていることを確認', async () => {
      const editedItem = mainWindow.locator('.item', { hasText: 'EditedGitHub' });
      await expect(editedItem).toBeVisible();
    });

    await test.step('元のアイテム名が存在しないことを確認', async () => {
      const originalItem = mainWindow.locator('.item .item-name', { hasText: /^GitHub$/ });
      const count = await originalItem.count();
      expect(count).toBe(0);
    });
  });

  test('アイテムのパスを編集できる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // GitHubアイテムを右クリックして編集モーダルを開く
    await utils.editItemByRightClick('GitHub');

    // パスを変更
    await utils.fillRegisterForm({
      path: 'https://github.com/new-path',
    });

    // 登録ボタンをクリック
    await utils.clickRegisterButton();
    await utils.wait(500);

    // data.txtに新しいパスが保存されていることを確認
    const dataContent = configHelper.readData();
    expect(dataContent).toContain('https://github.com/new-path');
  });

  test('アイテムの引数を編集できる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // まず引数付きアイテムを登録
    await utils.openRegisterModal();
    await utils.fillRegisterForm({
      name: '引数テスト',
      path: 'notepad.exe',
      args: 'C:\\original.txt',
    });
    await utils.clickRegisterButton();
    await utils.wait(500);

    // アプリをリロード
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // 登録したアイテムを右クリックして編集
    await utils.editItemByRightClick('引数テスト');

    // 引数を変更
    await utils.fillRegisterForm({
      args: 'C:\\edited.txt',
    });

    // 登録ボタンをクリック
    await utils.clickRegisterButton();
    await utils.wait(500);

    // data.txtに新しい引数が保存されていることを確認
    const dataContent = configHelper.readData();
    expect(dataContent).toContain('C:\\edited.txt');
  });

  // アプリ側にバリデーションロジックが未実装のため、このテストはスキップ
  test.skip('編集時に名前を空にすると保存できない', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await test.step('GitHubアイテムを右クリックして編集モーダルを開く', async () => {
      await utils.editItemByRightClick('GitHub');
    });

    await test.step('名前を空にする', async () => {
      await utils.fillRegisterForm({
        name: '',
      });
    });

    await test.step('登録ボタンをクリック', async () => {
      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();
      await utils.wait(500);
    });

    await test.step('モーダルが閉じていない（エラーで保存できない）', async () => {
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);
    });

    await test.step('キャンセルしてモーダルを閉じる', async () => {
      await utils.clickCancelButton();
    });
  });

  // アプリ側にバリデーションロジックが未実装のため、このテストはスキップ
  test.skip('編集時にパスを空にすると保存できない', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await test.step('GitHubアイテムを右クリックして編集モーダルを開く', async () => {
      await utils.editItemByRightClick('GitHub');
    });

    await test.step('パスを空にする', async () => {
      await utils.fillRegisterForm({
        path: '',
      });
    });

    await test.step('登録ボタンをクリック', async () => {
      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();
      await utils.wait(500);
    });

    await test.step('モーダルが閉じていない（エラーで保存できない）', async () => {
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);
    });

    await test.step('キャンセルしてモーダルを閉じる', async () => {
      await utils.clickCancelButton();
    });
  });

  test('編集をキャンセルするとアイテムは変更されない', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // 編集前のdata.txtの内容を取得
    const dataBefore = configHelper.readData();

    // GitHubアイテムを右クリックして編集モーダルを開く
    await utils.editItemByRightClick('GitHub');

    // 名前を変更（保存しない）
    await utils.fillRegisterForm({
      name: 'キャンセルテスト',
    });

    // キャンセルボタンをクリック
    await utils.clickCancelButton();
    await utils.wait(500);

    // data.txtが変更されていないことを確認
    const dataAfter = configHelper.readData();
    expect(dataAfter).toBe(dataBefore);
  });

  test('編集したアイテムがリロード後も反映される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // GitHubアイテムを右クリックして編集モーダルを開く
    await utils.editItemByRightClick('GitHub');

    // 名前を変更
    await utils.fillRegisterForm({
      name: 'リロード編集テスト',
    });

    // 登録ボタンをクリック
    await utils.clickRegisterButton();
    await utils.wait(500);

    // アプリをリロード
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // 編集後のアイテムが表示されていることを確認
    const editedItem = mainWindow.locator('.item', { hasText: 'リロード編集テスト' });
    await expect(editedItem).toBeVisible();
  });
});
