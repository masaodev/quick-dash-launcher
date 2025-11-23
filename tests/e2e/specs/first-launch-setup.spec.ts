import { test, expect } from '../fixtures/first-launch-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - 初回起動設定画面テスト', () => {
  test('初回起動時に設定画面が自動表示される', async ({ electronApp, mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アプリケーションが起動していることを確認', async () => {
      expect(electronApp).toBeTruthy();
      expect(mainWindow).toBeTruthy();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初回起動画面');
    });

    await test.step('初回設定画面のタイトルが表示されていることを確認', async () => {
      const titleExists = await utils.elementExists('.first-launch-title');
      expect(titleExists).toBe(true);

      // タイトルのテキストを確認
      const titleText = await utils.getElementText('.first-launch-title');
      expect(titleText).toContain('QuickDash Launcher');
    });
  });

  test('初回設定画面に必要な要素が表示されている', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    await test.step('必要な要素が表示されていることを確認', async () => {
      // 説明文が表示されていることを確認
      const descriptionExists = await utils.elementExists('.first-launch-description');
      expect(descriptionExists).toBe(true);

      // ホットキー入力セクションが表示されていることを確認
      const hotkeySectionExists = await utils.elementExists('.hotkey-setup-section');
      expect(hotkeySectionExists).toBe(true);

      // ホットキーラベルが表示されていることを確認
      const hotkeyLabelExists = await utils.elementExists('.hotkey-label');
      expect(hotkeyLabelExists).toBe(true);

      // ホットキー入力フィールドが表示されていることを確認
      const hotkeyInputExists = await utils.elementExists('.hotkey-input');
      expect(hotkeyInputExists).toBe(true);

      // ヒントテキストが表示されていることを確認
      const hintExists = await utils.elementExists('.hotkey-hint');
      expect(hintExists).toBe(true);

      // 完了ボタンが表示されていることを確認
      const completeButtonExists = await utils.elementExists('.complete-button');
      expect(completeButtonExists).toBe(true);

      await utils.attachScreenshot(testInfo, '全要素確認');
    });
  });

  test('デフォルトのホットキーが入力されている', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
      await utils.waitForElement('.hotkey-input');
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    await test.step('デフォルトのホットキーが表示されていることを確認', async () => {
      const hotkeyValue = await mainWindow.inputValue('.hotkey-input');
      expect(hotkeyValue).toBe('Alt+Space');
    });
  });

  test('完了ボタンが表示されている', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // 完了ボタンが有効であることを確認（デフォルト値が valid）
    await utils.waitForElement('.complete-button');
    const buttonExists = await utils.elementExists('.complete-button');
    expect(buttonExists).toBe(true);

    // デフォルトのホットキーが valid なので、完了ボタンが有効
    const isDisabled = await mainWindow.isDisabled('.complete-button');
    expect(isDisabled).toBe(false);
  });

  test('初回設定画面はESCキーを押しても閉じない', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // 初回設定画面が表示されていることを確認
    const titleExists = await utils.elementExists('.first-launch-title');
    expect(titleExists).toBe(true);

    // ESCキーを押す
    await mainWindow.keyboard.press('Escape');

    // 少し待機
    await utils.wait(500);

    // 初回設定画面が依然として表示されていることを確認
    const titleStillExists = await utils.elementExists('.first-launch-title');
    expect(titleStillExists).toBe(true);
  });
});
