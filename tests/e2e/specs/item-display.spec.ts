import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - アイテム表示・選択テスト', () => {
  test('data.txtから読み込んだアイテムが表示される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // アイテムリストが表示されることを確認
    const hasItemList = await utils.elementExists('.item-list');
    expect(hasItemList).toBe(true);

    // アイテムが表示されることを確認
    const items = mainWindow.locator('.item');
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThan(0);

    // E2Eテスト用data.txtには最低でも10個程度のアイテムがあることを確認
    // (GitHub, Google, Wikipedia, メモ帳, 電卓, デスクトップ, ドキュメント, VS Code, Test Item 1-3)
    expect(itemCount).toBeGreaterThanOrEqual(10);
  });

  test('各アイテムにアイコンとラベルが表示される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

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

  test('特定のアイテムが正しく表示される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // E2Eテスト用data.txtに含まれる既知のアイテムが表示されることを確認
    const knownItems = ['GitHub', 'Google', 'メモ帳', '電卓'];

    for (const itemName of knownItems) {
      const item = mainWindow.locator('.item', { hasText: itemName });
      await expect(item).toBeVisible();
    }
  });

  test('キーボード（↓キー）でアイテム選択が移動する', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // 最初のアイテムが選択されていることを確認
    const firstItem = mainWindow.locator('.item.selected').first();
    await expect(firstItem).toBeVisible();

    // 最初に選択されているアイテムのテキストを取得
    const firstItemText = await firstItem.textContent();

    // ↓キーを押す
    await utils.sendShortcut('ArrowDown');
    await utils.wait(100);

    // 選択が移動したことを確認
    const selectedItem = mainWindow.locator('.item.selected');
    await expect(selectedItem).toBeVisible();

    // 選択されたアイテムのテキストが最初と異なることを確認
    const selectedItemText = await selectedItem.textContent();
    expect(selectedItemText).not.toBe(firstItemText);
  });

  test('キーボード（↑キー）でアイテム選択が移動する', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // ↓キーを数回押して選択を下に移動
    await utils.sendShortcut('ArrowDown');
    await utils.wait(100);
    await utils.sendShortcut('ArrowDown');
    await utils.wait(100);

    // 現在選択されているアイテムのテキストを取得
    const currentItem = mainWindow.locator('.item.selected');
    const currentItemText = await currentItem.textContent();

    // ↑キーを押す
    await utils.sendShortcut('ArrowUp');
    await utils.wait(100);

    // 選択が上に移動したことを確認
    const selectedItem = mainWindow.locator('.item.selected');
    await expect(selectedItem).toBeVisible();

    // 選択されたアイテムのテキストが異なることを確認
    const selectedItemText = await selectedItem.textContent();
    expect(selectedItemText).not.toBe(currentItemText);
  });

  test('マウスホバーでアイテム選択が変わる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // 2番目のアイテムにマウスホバー
    const secondItem = mainWindow.locator('.item').nth(1);
    await secondItem.hover();
    await utils.wait(100);

    // ホバーしたアイテムが選択されていることを確認
    await expect(secondItem).toHaveClass(/selected/);
  });
});
