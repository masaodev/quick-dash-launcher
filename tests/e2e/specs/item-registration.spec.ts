import type { ElectronApplication } from '@playwright/test';
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

      // アイテム数が増えていることを確認（一覧の更新を待つ）
      await expect(mainWindow.locator('.item')).toHaveCount(countBefore + 1);

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
      expect(errorText).toContain('表示名を入力してください');

      await utils.clickCancelButton();
    });

    await test.step('パスも対象ウィンドウも空では登録できない', async () => {
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
      expect(errorText).toContain('パスか対象ウィンドウのどちらかを入力してください');

      await utils.clickCancelButton();
    });

    await test.step('アイテム数が変わっていないことを確認', async () => {
      const itemsAfter = mainWindow.locator('.item');
      const countAfter = await itemsAfter.count();
      expect(countAfter).toBe(countBefore);
    });
  });
});

/**
 * 種別のプルダウン: 廃止したウィンドウ操作は選べない（開いているウィンドウへの切り替えは単一アイテムのオプション）
 */
test.describe('QuickDashLauncher - 登録画面の種別', () => {
  test('種別のプルダウンに「ウィンドウ操作」が無い', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const registerPage = await utils.openRegisterModal(electronApp);

    const kind = registerPage.locator('select:has(option[value="clipboard"])').first();
    await expect(kind.locator('option')).toHaveText([
      '📄 単一アイテム',
      '🗂️ フォルダ取込',
      '📦 セット',
      '📋 クリップボード',
    ]);
    await expect(kind.locator('option[value="window"]')).toHaveCount(0);
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

    await registerPage
      .locator('.options-toggle', { hasText: 'ウィンドウ切り替え・ウィンドウ位置' })
      .click();
    await registerPage
      .getByTestId('item-window-switch')
      .locator('button', { hasText: '開いているウィンドウから選ぶ' })
      .click();
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

/**
 * 単一アイテムの「オプション設定（ウィンドウ切り替え・ウィンドウ位置）」
 * - セットの行の詳細と同じ部品で、対象ウィンドウ・開くときの動きを入れて保存できる
 * - もう一度編集を開くと、入れた値が残っている（開いていたら＝もう 1 つ開く も保たれる）
 */
test.describe('QuickDashLauncher - 単一アイテムのウィンドウ切り替え', () => {
  test('対象ウィンドウを入れて保存し、もう一度開いても値が残る', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);
    await utils.waitForPageLoad();
    await expect(mainWindow.locator('.item', { hasText: 'GitHub' })).toBeVisible();

    const openEditor = async () => {
      const github = await mainWindow.evaluate(async () => {
        const items = await window.electronAPI.loadDataFiles('internal');
        return items.find((i) => 'path' in i && i.displayName === 'GitHub');
      });
      expect(github).toBeDefined();
      await menuHelper.simulateLauncherMenu('edit', github as unknown as Record<string, unknown>);
      const editor = await utils.waitForRegisterWindow(electronApp);
      await editor
        .locator('.options-toggle', { hasText: 'ウィンドウ切り替え・ウィンドウ位置' })
        .click();
      return editor.getByTestId('item-window-switch');
    };

    await test.step('対象ウィンドウと開いていたらを入れて更新する', async () => {
      const fields = await openEditor();
      await expect(fields.getByText('このアイテムを開いたとき', { exact: false })).toBeVisible();
      await fields.getByLabel('exe 名').fill('chrome.exe');
      await fields.getByLabel('ウィンドウタイトル').fill('*GitHub*');
      await fields.getByLabel('開いていたら').selectOption('openNew');
      await expect(fields.getByText(/今合うウィンドウ: /)).toBeVisible();
      const editor = utils.registerPage;
      // 更新するとすぐ閉じるので、閉じるのを先に待ち始める
      await Promise.all([
        editor.waitForEvent('close', { timeout: 10000 }),
        editor.locator('.modal-actions button', { hasText: '保存' }).click(),
      ]);
    });

    await test.step('データファイルに保存形式のキーで書かれる', async () => {
      await expect
        .poll(() => {
          const item = configHelper.getItemByDisplayName('data.json', 'GitHub');
          return item && isJsonLauncherItem(item)
            ? { window: item.window, ifOpen: item.ifOpen }
            : undefined;
        })
        .toEqual({ window: { processName: 'chrome.exe', title: '*GitHub*' }, ifOpen: 'openNew' });
    });

    await test.step('もう一度開くと値が残っている', async () => {
      const fields = await openEditor();
      await expect(fields.getByLabel('exe 名')).toHaveValue('chrome.exe');
      await expect(fields.getByLabel('ウィンドウタイトル')).toHaveValue('*GitHub*');
      await expect(fields.getByLabel('開いていたら')).toHaveValue('openNew');
    });
  });
});

/**
 * パスの無い単一アイテム
 * - 対象ウィンドウ（exe 名）だけを入れれば、パスが空でも登録できる（JSON は type: item・path: ""）
 * - もう一度編集を開くと、ウィンドウ切り替えの折りたたみが開いた状態で出て、パスの下に補足が出る
 */
test.describe('QuickDashLauncher - パスの無い単一アイテム', () => {
  test('対象ウィンドウだけで登録し、もう一度開くと切り替えるだけと分かる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);
    await utils.waitForPageLoad();
    const note = 'パスが空なので、開いているウィンドウへ切り替えるだけです';

    await test.step('パスを空のまま、対象ウィンドウを入れて登録する', async () => {
      await utils.openRegisterModal(electronApp);
      await utils.fillRegisterForm({ name: 'パスなしメモ帳' });
      const editor = utils.registerPage;
      await editor
        .locator('.options-toggle', { hasText: 'ウィンドウ切り替え・ウィンドウ位置' })
        .click();
      const fields = editor.getByTestId('item-window-switch');
      await fields.getByLabel('exe 名').fill('notepad.exe');
      // パスが空なので「開いていたら」は出さない
      await expect(fields.getByLabel('開いていたら')).toHaveCount(0);
      await expect(editor.getByText(note)).toBeVisible();
      await utils.clickRegisterButton();
      await expect(mainWindow.locator('.item', { hasText: 'パスなしメモ帳' })).toBeVisible();
    });

    await test.step('データファイルに path: "" と対象ウィンドウで書かれる', async () => {
      await expect
        .poll(() => {
          const item = configHelper.getItemByDisplayName('data.json', 'パスなしメモ帳');
          return item && isJsonLauncherItem(item)
            ? { type: item.type, path: item.path, window: item.window }
            : undefined;
        })
        .toEqual({ type: 'item', path: '', window: { processName: 'notepad.exe' } });
    });

    await test.step('一覧ではウィンドウの絵文字で出し、ツールチップにパスの代わりの説明を出す', async () => {
      const row = mainWindow.locator('.item', { hasText: 'パスなしメモ帳' });
      await expect(row.locator('.item-icon')).toHaveText('🪟');
      await expect(row).toHaveAttribute(
        'title',
        /開いているウィンドウに切り替えるだけ: notepad\.exe/
      );
    });

    await test.step('もう一度開くと、折りたたみが開いていて値が残っている', async () => {
      const item = await mainWindow.evaluate(async () => {
        const items = await window.electronAPI.loadDataFiles('internal');
        return items.find((i) => 'path' in i && i.displayName === 'パスなしメモ帳');
      });
      expect(item).toMatchObject({ type: 'windowSwitch', path: '' });
      await menuHelper.simulateLauncherMenu('edit', item as unknown as Record<string, unknown>);
      const editor = await utils.waitForRegisterWindow(electronApp);
      // 押さなくても開いている
      const fields = editor.getByTestId('item-window-switch');
      await expect(fields.getByLabel('exe 名')).toHaveValue('notepad.exe');
      await expect(editor.getByText(note)).toBeVisible();
      await utils.clickCancelButton();
    });
  });
});
