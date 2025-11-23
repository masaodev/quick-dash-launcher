import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - 検索機能テスト', () => {
  test('検索ボックスが表示されている', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // 検索ボックスが存在することを確認
    const hasSearchBox = await utils.elementExists('input[type="text"]');
    expect(hasSearchBox).toBe(true);

    // 検索ボックスにフォーカスがあることを確認
    const searchBox = mainWindow.locator('input[type="text"]').first();
    await expect(searchBox).toBeFocused();
  });

  test('検索語を入力してアイテムが絞り込まれる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // 検索前の全アイテム数を取得
    const allItems = mainWindow.locator('.item, [class*="item"]');
    const initialCount = await allItems.count();
    expect(initialCount).toBeGreaterThan(0);

    // "GitHub"で検索
    await utils.searchFor('GitHub');

    // 少し待機して検索結果が反映されるのを待つ
    await utils.wait(300);

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

  test('検索語をクリアすると全アイテムが表示される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // 検索前の全アイテム数を取得
    const allItems = mainWindow.locator('.item, [class*="item"]');
    const initialCount = await allItems.count();

    // 検索を実行
    await utils.searchFor('Test');
    await utils.wait(300);

    // 検索ボックスをクリア
    const searchBox = mainWindow.locator('input[type="text"]').first();
    await searchBox.clear();
    await utils.wait(300);

    // 全アイテムが再び表示されることを確認
    const restoredCount = await allItems.count();
    expect(restoredCount).toBe(initialCount);
  });

  test('複数キーワードでAND検索ができる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // 検索前の全アイテム数を取得
    const allItems = mainWindow.locator('.item, [class*="item"]');
    const initialCount = await allItems.count();

    // スペース区切りで複数キーワードを入力（実際に存在するアイテムの一部を検索）
    await utils.searchFor('Git Hub');
    await utils.wait(300);

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
