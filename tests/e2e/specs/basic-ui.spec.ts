import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - 基本UI機能テスト', () => {
  // ==================== アイテム表示テスト ====================

  test('data.txtから読み込んだアイテムが表示され、アイコンとラベルが正しく表示される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('アイテムリストとアイテムの表示確認', async () => {
      // アイテムリストが表示されることを確認
      const hasItemList = await utils.elementExists('.item-list');
      expect(hasItemList).toBe(true);

      // アイテムが表示されることを確認
      const items = mainWindow.locator('.item');
      const itemCount = await items.count();
      expect(itemCount).toBeGreaterThan(0);

      // E2Eテスト用data.txtには最低でも7個のアイテムがあることを確認
      // (GitHub, Google, Wikipedia, メモ帳, 電卓, デスクトップ, ドキュメント)
      expect(itemCount).toBeGreaterThanOrEqual(7);
    });

    await test.step('最初のアイテムのアイコンとラベルを確認', async () => {
      // 最初のアイテムを取得
      const firstItem = mainWindow.locator('.item').first();
      await expect(firstItem).toBeVisible();

      // アイコンが表示されていることを確認
      const icon = firstItem.locator('.item-icon');
      await expect(icon).toBeVisible();

      // ラベルが表示されていることを確認
      const name = firstItem.locator('.item-name');
      await expect(name).toBeVisible();

      // ラベルにテキストがあることを確認
      const nameText = await name.textContent();
      expect(nameText).toBeTruthy();
      expect(nameText?.length).toBeGreaterThan(0);
    });

    await test.step('既知のアイテムが表示されることを確認', async () => {
      // E2Eテスト用data.txtに含まれる既知のアイテムが表示されることを確認
      const knownItems = ['GitHub', 'Google', 'メモ帳', '電卓'];

      for (const itemName of knownItems) {
        const item = mainWindow.locator('.item', { hasText: itemName });
        await expect(item).toBeVisible();
      }
    });
  });

  // ==================== アイテム選択テスト ====================

  test('キーボード（矢印キー）でアイテム選択が移動する', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    let firstItemText: string | null;

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('最初のアイテムが選択されていることを確認', async () => {
      const firstItem = mainWindow.locator('.item.selected').first();
      await expect(firstItem).toBeVisible();

      // 最初に選択されているアイテムのテキストを取得
      firstItemText = await firstItem.textContent();
    });

    await test.step('↓キーを押して選択を移動', async () => {
      await utils.sendShortcut('ArrowDown');

      const selectedItem = mainWindow.locator('.item.selected');
      await expect(selectedItem).toBeVisible();

      // 選択されたアイテムのテキストが最初と異なることを確認
      const selectedItemText = await selectedItem.textContent();
      expect(selectedItemText).not.toBe(firstItemText);
    });

    await test.step('さらに↓キーを押して選択を移動', async () => {
      await utils.sendShortcut('ArrowDown');
    });

    let currentItemText: string | null;

    await test.step('現在選択されているアイテムのテキストを取得', async () => {
      const currentItem = mainWindow.locator('.item.selected');
      currentItemText = await currentItem.textContent();
    });

    await test.step('↑キーを押して選択が上に移動することを確認', async () => {
      await utils.sendShortcut('ArrowUp');

      const selectedItem = mainWindow.locator('.item.selected');
      await expect(selectedItem).toBeVisible();

      // 選択されたアイテムのテキストが異なることを確認
      const selectedItemText = await selectedItem.textContent();
      expect(selectedItemText).not.toBe(currentItemText);
    });
  });

  test('マウスホバーでアイテム選択が変わる', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('2番目のアイテムにマウスホバー', async () => {
      const secondItem = mainWindow.locator('.item').nth(1);
      await secondItem.hover();
    });

    await test.step('ホバーしたアイテムが選択されていることを確認', async () => {
      const secondItem = mainWindow.locator('.item').nth(1);
      await expect(secondItem).toHaveClass(/selected/);
    });
  });

  // ==================== 検索機能テスト ====================

  test('検索ボックスが表示され、検索によってアイテムが絞り込まれる', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    let initialCount: number;

    await test.step('ページ読み込みと検索ボックスの確認', async () => {
      await utils.waitForPageLoad();

      // 検索ボックスが存在することを確認
      const hasSearchBox = await utils.elementExists('input[type="text"]');
      expect(hasSearchBox).toBe(true);

      // 検索ボックスにフォーカスがあることを確認
      const searchBox = mainWindow.locator('input[type="text"]').first();
      await expect(searchBox).toBeFocused();
    });

    await test.step('検索前の全アイテム数を取得', async () => {
      const allItems = mainWindow.locator('.item, [class*="item"]');
      initialCount = await allItems.count();
      expect(initialCount).toBeGreaterThan(0);
    });

    await test.step('"GitHub"で検索して絞り込みを確認', async () => {
      await utils.searchFor('GitHub');

      // 検索後のアイテム数を取得
      const filteredItems = mainWindow.locator('.item, [class*="item"]:visible');
      const filteredCount = await filteredItems.count();

      // 絞り込まれていることを確認（アイテム数が減っている）
      expect(filteredCount).toBeLessThan(initialCount);
      expect(filteredCount).toBeGreaterThan(0);

      // GitHubを含むアイテムが表示されていることを確認
      const hasGitHub = await mainWindow.locator('text=GitHub').isVisible();
      expect(hasGitHub).toBe(true);
    });
  });

  test('検索語をクリアすると全アイテムが表示される', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    let initialCount: number;

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('検索前の全アイテム数を取得', async () => {
      const allItems = mainWindow.locator('.item, [class*="item"]');
      initialCount = await allItems.count();
    });

    await test.step('検索を実行', async () => {
      await utils.searchFor('Test');
    });

    await test.step('検索ボックスをクリア', async () => {
      const searchBox = mainWindow.locator('input[type="text"]').first();
      await searchBox.clear();
    });

    await test.step('全アイテムが再び表示されることを確認', async () => {
      const allItems = mainWindow.locator('.item, [class*="item"]');
      const restoredCount = await allItems.count();
      expect(restoredCount).toBe(initialCount);
    });
  });

  test('複数キーワードでAND検索ができる', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    let initialCount: number;

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('検索前の全アイテム数を取得', async () => {
      const allItems = mainWindow.locator('.item, [class*="item"]');
      initialCount = await allItems.count();
    });

    await test.step('複数キーワードで検索', async () => {
      // スペース区切りで複数キーワードを入力（実際に存在するアイテムの一部を検索）
      await utils.searchFor('Git Hub');
    });

    await test.step('検索結果を確認', async () => {
      // 結果が絞り込まれることを確認
      const filteredItems = mainWindow.locator('.item, [class*="item"]:visible');
      const filteredCount = await filteredItems.count();

      // GitHubアイテムがマッチするはず
      expect(filteredCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThanOrEqual(initialCount);

      // GitHubアイテムが表示されていることを確認
      const githubElement = mainWindow.locator('.item', { hasText: 'GitHub' });
      await expect(githubElement).toBeVisible();
    });
  });

  // ==================== アイテム数表示テスト（タブ表示OFF時） ====================

  test('タブ表示OFF時、検索ボックス下にアイテム数が表示される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページ読み込みとタブ表示OFF確認', async () => {
      // デフォルトテンプレート（base）を使用（showDataFileTabs: false）
      await utils.waitForPageLoad();

      // タブバーが表示されていないことを確認
      const tabBar = mainWindow.locator('.file-tab-bar');
      await expect(tabBar).not.toBeVisible();
    });

    await test.step('検索情報バーとアイテム数が表示される', async () => {
      // 検索情報バーが表示されることを確認
      const infoBar = mainWindow.locator('.search-info-bar');
      await expect(infoBar).toBeVisible();

      // アイテム数表示が存在することを確認
      const itemCount = mainWindow.locator('.item-count-display');
      await expect(itemCount).toBeVisible();

      // アイテム数が「〇〇件」形式で表示されることを確認
      const countText = await itemCount.textContent();
      expect(countText).toMatch(/\d+件/);
    });
  });

  test('タブ表示OFF時、検索によってアイテム数が動的に更新される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページ読み込み', async () => {
      await utils.waitForPageLoad();
    });

    let initialCount: string;

    await test.step('初期アイテム数を取得', async () => {
      const itemCount = mainWindow.locator('.item-count-display');
      initialCount = (await itemCount.textContent()) || '';
      expect(initialCount).toMatch(/\d+件/);
    });

    await test.step('検索を実行してアイテム数が減少することを確認', async () => {
      await utils.searchFor('GitHub');

      const itemCount = mainWindow.locator('.item-count-display');
      const filteredCount = (await itemCount.textContent()) || '';

      // アイテム数が初期値より少なくなっていることを確認
      const initialNum = parseInt(initialCount.match(/\d+/)?.[0] || '0');
      const filteredNum = parseInt(filteredCount.match(/\d+/)?.[0] || '0');
      expect(filteredNum).toBeLessThan(initialNum);
      expect(filteredNum).toBeGreaterThan(0);
    });

    await test.step('検索をクリアしてアイテム数が元に戻ることを確認', async () => {
      const searchBox = mainWindow.locator('input[type="text"]').first();
      await searchBox.clear();

      const itemCount = mainWindow.locator('.item-count-display');
      const restoredCount = (await itemCount.textContent()) || '';

      // アイテム数が初期値に戻ることを確認
      expect(restoredCount).toBe(initialCount);
    });
  });
});
