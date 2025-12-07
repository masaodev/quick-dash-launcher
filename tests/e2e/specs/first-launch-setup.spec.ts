import { test, expect } from '../fixtures/first-launch-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - 初回起動設定画面テスト', () => {
  test('初回起動時に設定画面が自動表示され、必要な要素が全て表示される', async ({
    electronApp,
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('アプリケーションが起動していることを確認', async () => {
      expect(electronApp).toBeTruthy();
      expect(mainWindow).toBeTruthy();
      await utils.waitForPageLoad();
    });

    await test.step('初回設定画面のタイトルが表示されていることを確認', async () => {
      const titleExists = await utils.elementExists('.first-launch-title');
      expect(titleExists).toBe(true);

      const titleText = await utils.getElementText('.first-launch-title');
      expect(titleText).toContain('QuickDash Launcher');
    });

    await test.step('必要な要素が全て表示されていることを確認', async () => {
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
    });

    await test.step('デフォルトのホットキーが入力され、完了ボタンが有効であることを確認', async () => {
      await utils.waitForElement('.hotkey-input');
      const hotkeyValue = await mainWindow.inputValue('.hotkey-input');
      expect(hotkeyValue).toBe('Alt+Space');

      // デフォルトのホットキーが valid なので、完了ボタンが有効
      const isDisabled = await mainWindow.isDisabled('.complete-button');
      expect(isDisabled).toBe(false);
    });
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

    // 初回設定画面が依然として表示されていることを確認
    const titleStillExists = await utils.elementExists('.first-launch-title');
    expect(titleStillExists).toBe(true);
  });

  test('セキュリティ設定が適切に設定されている', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('Electronのセキュリティ設定をチェック', async () => {
      // Electronのセキュリティ設定をチェック
      const hasNodeIntegration = await mainWindow
        .evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return typeof (window as any).require !== 'undefined';
        })
        .catch(() => false);

      // セキュリティのため、レンダラープロセスでNode.jsのAPIは利用できないはず
      expect(hasNodeIntegration).toBe(false);
    });
  });

  test('デフォルト設定で完了するとsettings.jsonに正しく保存される', async ({
    configHelper,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('完了ボタンをクリック前の設定を確認', async () => {
      const settingsBefore = configHelper.readSettings();
      // 初回起動時は hotkey が未設定または空のはず
      expect(settingsBefore.hotkey || '').toBe('');

      // デフォルトのホットキー値を確認
      const hotkeyValue = await mainWindow.inputValue('.hotkey-input');
      expect(hotkeyValue).toBe('Alt+Space');
    });

    await test.step('完了ボタンをクリックして設定を保存', async () => {
      await utils.waitForElement('.complete-button');
      await mainWindow.click('.complete-button');

      // settings.jsonが存在し、設定が保存されたことを確認
      expect(configHelper.fileExists('settings.json')).toBe(true);
    });

    await test.step('設定ファイルに正しい内容が保存されていることを確認', async () => {
      const settings = configHelper.readSettings();
      expect(settings.hotkey).toBe('Alt+Space');
    });
  });

  test('ホットキーを変更してから完了ボタンをクリックすると変更内容が保存される', async ({
    configHelper,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // ホットキー入力フィールドを取得
    const hotkeyInput = mainWindow.locator('.hotkey-input');

    // フィールドをフォーカス
    await hotkeyInput.click();

    // Ctrl+Shift+Aを入力
    await mainWindow.keyboard.press('Control+Shift+A');

    // 変更されたホットキー値を確認
    const hotkeyValue = await hotkeyInput.inputValue();
    expect(hotkeyValue).toBe('Ctrl+Shift+A');

    // 完了ボタンをクリック
    await mainWindow.click('.complete-button');

    // 設定ファイルの内容を確認
    const settings = configHelper.readSettings();

    // 変更したホットキーが保存されていることを確認
    expect(settings.hotkey).toBe('Ctrl+Shift+A');
  });

  test('自動起動設定のチェックボックスが表示されている', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    const sectionExists = await utils.elementExists('.auto-launch-setup-section');
    expect(sectionExists).toBe(true);

    const checkboxExists = await utils.elementExists('.auto-launch-checkbox');
    expect(checkboxExists).toBe(true);

    const hintExists = await utils.elementExists('.auto-launch-hint');
    expect(hintExists).toBe(true);
  });

  test('自動起動のデフォルト値はfalse（無効）である', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();
    await utils.waitForElement('.auto-launch-checkbox');

    const isChecked = await mainWindow.isChecked('.auto-launch-checkbox');
    expect(isChecked).toBe(false);
  });

  test('自動起動のチェックボックスをクリックして状態を変更できる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    let isChecked = await mainWindow.isChecked('.auto-launch-checkbox');
    expect(isChecked).toBe(false);

    await mainWindow.click('.auto-launch-checkbox');

    isChecked = await mainWindow.isChecked('.auto-launch-checkbox');
    expect(isChecked).toBe(true);
  });

  test('自動起動を有効にして完了すると設定ファイルに保存される', async ({
    configHelper,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    await mainWindow.click('.auto-launch-checkbox');

    const isChecked = await mainWindow.isChecked('.auto-launch-checkbox');
    expect(isChecked).toBe(true);

    await mainWindow.click('.complete-button');

    const settings = configHelper.readSettings();
    expect(settings.autoLaunch).toBe(true);
    expect(settings.hotkey).toBe('Alt+Space');
  });

  test('自動起動を無効のまま完了すると設定ファイルにfalseが保存される', async ({
    configHelper,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    const isChecked = await mainWindow.isChecked('.auto-launch-checkbox');
    expect(isChecked).toBe(false);

    await mainWindow.click('.complete-button');

    const settings = configHelper.readSettings();
    expect(settings.autoLaunch).toBe(false);
  });
});
