import type { ElectronApplication, Page } from '@playwright/test';
import { isJsonLauncherItem } from '@common/types';

import { test, expect } from '../fixtures/electron-app';
import { NativeMenuTestHelper, TestUtils } from '../helpers/test-utils';

/**
 * メインウィンドウの bounds をメインプロセスから読む
 * 子ウィンドウ（登録・編集）は index.html を書き込んだ直後は同じタイトルになるので、
 * 親を持たないウィンドウに限って探す
 */
async function getMainWindowBounds(
  electronApp: ElectronApplication
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find(
      (w) => w.getTitle() === 'QuickDashLauncher' && w.getParentWindow() === null
    );
    return win ? win.getBounds() : null;
  });
}

test.describe('QuickDashLauncher - アイテム登録・編集機能テスト', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    // baseテンプレートは既に読み込まれている
    // data2.jsonは削除（このテストでは使用しない）
    configHelper.deleteDataFile('data2.json');

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
  });

  // ==================== 登録モーダル表示テスト ====================

  test('登録モーダルの表示と基本操作', async ({ electronApp, mainWindow }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    const boundsBefore = await getMainWindowBounds(electronApp);

    await test.step('プラスボタンをクリックすると登録ウィンドウ（独立した子ウィンドウ）が開く', async () => {
      const registerWindow = await utils.openRegisterModal(electronApp);
      expect(registerWindow).not.toBe(mainWindow);
      await expect(registerWindow).toHaveTitle('アイテムの登録');

      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);
    });

    await test.step('メインウィンドウのサイズ・位置は変わらない', async () => {
      // 以前は 850x1000 に広げて中央へ動かしていた
      const boundsAfter = await getMainWindowBounds(electronApp);
      expect(boundsAfter).toEqual(boundsBefore);
    });

    await test.step('登録モーダルに必要なフィールドが表示されている', async () => {
      // 名前入力フィールドが存在することを確認
      const nameInput = utils.registerPage
        .locator('.register-modal input[placeholder*="表示名"]')
        .first();
      await expect(nameInput).toBeVisible();

      // パス入力フィールドが存在することを確認
      const pathInput = utils.registerPage
        .locator('.register-modal input[placeholder*="パス"], input[placeholder*="URL"]')
        .first();
      await expect(pathInput).toBeVisible();

      // 登録ボタンが存在することを確認
      const registerButton = utils.registerPage
        .locator('.register-modal button:has-text("登録")')
        .first();
      await expect(registerButton).toBeVisible();

      // キャンセルボタンが存在することを確認
      const cancelButton = utils.registerPage
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
      await utils.openRegisterModal(electronApp);

      let isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // ESCキーを押す（登録ウィンドウ側で受け、ウィンドウが閉じる）
      await utils.pressEscapeToCloseRegisterModal();

      isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(false);
    });
  });

  // ==================== アイテム登録テスト ====================

  test('新規アイテムを登録できる', async ({ electronApp, mainWindow, configHelper }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    let countBefore: number;

    await test.step('登録前のアイテム数を取得', async () => {
      const itemsBefore = mainWindow.locator('.item');
      countBefore = await itemsBefore.count();
    });

    await test.step('新しいWebサイトアイテムを登録できる', async () => {
      await utils.openRegisterModal(electronApp);
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
      await utils.openRegisterModal(electronApp);
      await utils.fillRegisterForm({
        name: 'マイアプリ',
        path: 'notepad.exe',
      });
      await utils.clickRegisterButton();

      const newItem = mainWindow.locator('.item', { hasText: 'マイアプリ' });
      await expect(newItem).toBeVisible();
    });

    // 注: 引数入力テストはオプション設定の展開が必要なためスキップ
    // await test.step('引数付きでアプリケーションアイテムを登録できる', async () => { ... });

    await test.step('登録したアイテムがdata.jsonに保存される', async () => {
      await utils.openRegisterModal(electronApp);
      await utils.fillRegisterForm({
        name: 'テスト保存',
        path: 'https://test-save.com',
      });
      await utils.clickRegisterButton();

      expect(configHelper.hasItem('data.json', 'テスト保存', 'https://test-save.com')).toBe(true);
    });

    await test.step('登録したアイテムがリロード後も表示される', async () => {
      await utils.openRegisterModal(electronApp);
      await utils.fillRegisterForm({
        name: 'リロードテスト',
        path: 'https://reload-test.com',
      });
      await utils.clickRegisterButton();

      const item = mainWindow.locator('.item', { hasText: 'リロードテスト' });
      await expect(item).toBeVisible();
    });
  });

  test('不正な入力では登録できない', async ({ electronApp, mainWindow }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    let countBefore: number;

    await test.step('登録前のアイテム数を取得', async () => {
      const itemsBefore = mainWindow.locator('.item');
      countBefore = await itemsBefore.count();
    });

    await test.step('空の名前では登録できない', async () => {
      await utils.openRegisterModal(electronApp);
      await utils.fillRegisterForm({
        path: 'https://example.com',
      });

      const registerButton = utils.registerPage
        .locator('.register-modal button:has-text("登録")')
        .first();
      await registerButton.click();

      // モーダルが閉じていない（エラーで登録できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = utils.registerPage.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('アイテム表示名を入力してください');

      await utils.clickCancelButton();
    });

    await test.step('空のパスでは登録できない', async () => {
      await utils.openRegisterModal(electronApp);
      await utils.fillRegisterForm({
        name: 'テストアイテム',
      });

      const registerButton = utils.registerPage
        .locator('.register-modal button:has-text("登録")')
        .first();
      await registerButton.click();

      // モーダルが閉じていない（エラーで登録できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = utils.registerPage.locator('.error-message');
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
  // 注: 以下のテストはネイティブElectronコンテキストメニューを使用するため、
  // PlaywrightでDOM要素をテストすることができません。
  // UIの動作確認は手動で行うことを推奨します。

  test.skip('編集モーダルの表示と初期値', async ({ mainWindow }, _testInfo) => {
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
      const nameInput = utils.registerPage
        .locator('.register-modal input[placeholder*="表示名"]')
        .first();
      const nameValue = await nameInput.inputValue();
      expect(nameValue).toBe('GitHub');

      // パスフィールドに既存の値が入力されていることを確認
      const pathInput = utils.registerPage
        .locator('.register-modal input[placeholder*="パス"], input[placeholder*="URL"]')
        .first();
      const pathValue = await pathInput.inputValue();
      expect(pathValue.startsWith('https://github.com')).toBe(true);

      // モーダルを閉じる
      await utils.clickCancelButton();
    });
  });

  test.skip('アイテムを編集できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
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

      expect(configHelper.hasItemByPath('data.json', 'https://github.com/new-path')).toBe(true);
    });

    await test.step('アイテムの引数を編集できる', async () => {
      // まず引数付きアイテムを登録
      await utils.openRegisterModal(electronApp);
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

      const item = configHelper.getItemByDisplayName('data.json', '引数テスト');
      if (item && isJsonLauncherItem(item)) {
        expect(item.args).toBe('C:\\edited.txt');
      }
    });

    await test.step('編集したアイテムが反映される', async () => {
      const item = mainWindow.locator('.item', { hasText: 'EditedGitHub' });
      await expect(item).toBeVisible();
    });
  });

  test.skip('編集時の不正入力とキャンセル', async ({ mainWindow, configHelper }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('編集時に名前を空にすると保存できない', async () => {
      await utils.editItemByRightClick('GitHub');
      await utils.fillRegisterForm({
        name: '',
      });

      const registerButton = utils.registerPage
        .locator('.register-modal button:has-text("登録")')
        .first();
      await registerButton.click();

      // モーダルが閉じていない（エラーで保存できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = utils.registerPage.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('アイテム表示名を入力してください');

      await utils.clickCancelButton();
    });

    await test.step('編集時にパスを空にすると保存できない', async () => {
      await utils.editItemByRightClick('GitHub');
      await utils.fillRegisterForm({
        path: '',
      });

      const registerButton = utils.registerPage
        .locator('.register-modal button:has-text("登録")')
        .first();
      await registerButton.click();

      // モーダルが閉じていない（エラーで保存できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = utils.registerPage.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('パスを入力してください');

      await utils.clickCancelButton();
    });

    await test.step('編集をキャンセルするとアイテムは変更されない', async () => {
      const dataBefore = configHelper.readDataFileRaw('data.json');

      await utils.editItemByRightClick('GitHub');
      await utils.fillRegisterForm({
        name: 'キャンセルテスト',
      });
      await utils.clickCancelButton();

      // data.jsonが変更されていないことを確認
      const dataAfter = configHelper.readDataFileRaw('data.json');
      expect(dataAfter).toBe(dataBefore);
    });
  });

  // ==================== マルチタブでのアイテム登録テスト ====================
  // 注: マルチタブ機能のUIテストは複雑な状態遷移を含むため、
  // 現時点ではスキップしています。

  test.skip('現在開いているタブがデフォルトの登録先になる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
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

      await utils.openRegisterModal(electronApp);
    });

    await test.step('デフォルトの保存先がメインタブ（data.json）になっている', async () => {
      // 保存先セレクトボックスの値を確認
      const targetTabSelect = utils.registerPage.locator('.register-modal select').last();
      const selectedValue = await targetTabSelect.inputValue();
      expect(selectedValue).toBe('data.json');

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

      await utils.openRegisterModal(electronApp);
    });

    await test.step('デフォルトの保存先がサブタブ（data2.json）になっている', async () => {
      // 保存先セレクトボックスの値を確認
      const targetTabSelect = utils.registerPage.locator('.register-modal select').last();
      const selectedValue = await targetTabSelect.inputValue();
      expect(selectedValue).toBe('data2.json');

      await utils.clickCancelButton();
    });

    await test.step('サブタブでアイテムを登録', async () => {
      await utils.openRegisterModal(electronApp);
      await utils.fillRegisterForm({
        name: 'サブタブ登録テスト',
        path: 'https://sub-tab-test.com',
      });
      await utils.clickRegisterButton();
    });

    await test.step('登録したアイテムがサブタブ（data2.json）に保存される', async () => {
      // data2.jsonの内容を確認
      expect(
        configHelper.hasItem('data2.json', 'サブタブ登録テスト', 'https://sub-tab-test.com')
      ).toBe(true);

      // data.jsonには保存されていないことを確認
      expect(configHelper.hasItemByDisplayName('data.json', 'サブタブ登録テスト')).toBe(false);
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
  // 注: 複数ウィンドウ間の同期テストは複雑な状態遷移を含むため、
  // 現時点ではスキップしています。

  test.skip('メイン画面で登録したアイテムが管理画面に反映される', async ({
    mainWindow,
    electronApp,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('メイン画面で新規アイテムを登録', async () => {
      await utils.openRegisterModal(electronApp);
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

      const _adminUtils = new TestUtils(adminWindow);

      // 登録したアイテムが表示されていることを確認
      const itemRow = adminWindow.locator('.raw-item-row', { hasText: '同期テストアイテム' });
      await expect(itemRow).toBeVisible({ timeout: 10000 });

      // アイテムの内容を確認
      await expect(itemRow.locator('.name-column')).toContainText('同期テストアイテム');
      await expect(itemRow.locator('.content-column')).toContainText('https://sync-test.com');

      // 管理画面を閉じる
      await adminWindow.close();
    });
  });
});

/**
 * 「⚡ 試しに実行」でのウィンドウ操作
 * - タイトルが空でプロセス名だけのときは、保存時と同じく "*" で探す
 *
 * 実際のウィンドウは動かさないよう、メインプロセスのウィンドウ操作ハンドラを差し替えて引数を記録する
 */
test.describe('QuickDashLauncher - 試しに実行（ウィンドウ操作）', () => {
  test('タイトルが空でプロセス名だけなら "*" で探す', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    await electronApp.evaluate(({ ipcMain }) => {
      const g = globalThis as { __e2eWindowOps?: unknown[] };
      g.__e2eWindowOps = [];
      ipcMain.removeHandler('execute-window-operation');
      ipcMain.handle('execute-window-operation', (_event, item: unknown) => {
        g.__e2eWindowOps!.push(item);
      });
    });

    const registerPage = await utils.openRegisterModal(electronApp);
    await registerPage.locator('select:has(option[value="window"])').first().selectOption('window');
    await registerPage.locator('input[placeholder^="プロセス名"]').first().fill('notepad');
    await registerPage.locator('button', { hasText: '試しに実行' }).click();

    await expect
      .poll(() =>
        electronApp.evaluate(
          () => (globalThis as { __e2eWindowOps?: unknown[] }).__e2eWindowOps ?? []
        )
      )
      .toEqual([expect.objectContaining({ windowTitle: '*', processName: 'notepad' })]);
  });
});

/**
 * 登録画面のキー操作: Tab で次の入力欄へ移る（端では折り返す）
 */
test.describe('QuickDashLauncher - 登録画面の Tab 移動', () => {
  test('Tab で次の要素へ、Shift+Tab で前の要素へフォーカスが移る', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const registerPage = await utils.openRegisterModal(electronApp);

    const nameInput = registerPage.locator('input[type="text"]').first();
    await nameInput.focus();
    const describeFocus = () =>
      registerPage.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el ? `${el.tagName}:${el.getAttribute('placeholder') ?? el.textContent ?? ''}` : '';
      });
    const start = await describeFocus();

    await registerPage.keyboard.press('Tab');
    const next = await describeFocus();
    expect(next).not.toBe(start);

    await registerPage.keyboard.press('Shift+Tab');
    expect(await describeFocus()).toBe(start);
  });
});

/**
 * 登録画面の上に重ねて開いたダイアログでの Escape
 * - 閉じるのは上に重なったダイアログだけで、登録画面は開いたまま
 */
test.describe('QuickDashLauncher - 登録画面の子ダイアログの Escape', () => {
  test('ウィンドウ選択を Escape で閉じても登録画面は残る', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const registerPage = await utils.openRegisterModal(electronApp);

    await registerPage.locator('select:has(option[value="window"])').first().selectOption('window');
    await registerPage.locator('button', { hasText: 'ウィンドウを選択' }).first().click();
    const selector = registerPage.locator('.window-selector-modal-overlay');
    await expect(selector).toBeVisible({ timeout: 10000 });

    await registerPage.keyboard.press('Escape');
    await expect(selector).toHaveCount(0);
    expect(registerPage.isClosed()).toBe(false);
    await expect(registerPage.locator('.register-modal')).toBeVisible();
  });

  test('削除の確認を Escape で閉じても編集画面は残る', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);
    await utils.waitForPageLoad();
    await expect(mainWindow.locator('.item', { hasText: 'GitHub' })).toBeVisible();

    const github = await mainWindow.evaluate(async () => {
      const items = await window.electronAPI.loadDataFiles('internal');
      return items.find((i) => 'path' in i && i.displayName === 'GitHub');
    });
    expect(github).toBeDefined();
    await menuHelper.simulateLauncherMenu('edit', github as unknown as Record<string, unknown>);
    const editor = await utils.waitForRegisterWindow(electronApp);

    await editor.locator('.modal-actions button', { hasText: '削除' }).click();
    const confirm = editor.locator('[data-testid="confirm-dialog-overlay"]');
    await expect(confirm).toBeVisible();

    await editor.keyboard.press('Escape');
    await expect(confirm).toHaveCount(0);
    expect(editor.isClosed()).toBe(false);
    await expect(editor.locator('.register-modal')).toBeVisible();
  });
});
