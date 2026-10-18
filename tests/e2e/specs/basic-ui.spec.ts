import * as fs from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - 基本UI機能テスト', () => {
  // ==================== アイテム表示・選択テスト ====================

  test('アイテム一覧が正しく表示され、キーボード・マウスで選択できる', async ({
    mainWindow,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    let firstItemText: string | null;
    let currentItemText: string | null;

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
    });

    await test.step('アイテムリストとアイテムの表示確認', async () => {
      // アイテムリストが表示されることを確認
      const hasItemList = await utils.elementExists('.item-list');
      expect(hasItemList).toBe(true);

      // アイテムが表示されるまで待機（データ読み込み完了を待つ）
      const items = mainWindow.locator('.item');
      await items.first().waitFor({ state: 'visible', timeout: 10000 });

      // アイテムが表示されることを確認
      const itemCount = await items.count();
      expect(itemCount).toBeGreaterThan(0);

      // E2Eテスト用data.jsonには最低でも7個のアイテムがあることを確認
      expect(itemCount).toBeGreaterThanOrEqual(7);
    });

    await test.step('最初のアイテムのアイコンとラベルを確認', async () => {
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
      const knownItems = ['GitHub', 'Google', 'メモ帳', '電卓'];
      for (const itemName of knownItems) {
        const item = mainWindow.locator('.item', { hasText: itemName });
        await expect(item).toBeVisible();
      }
    });

    await test.step('キーボード（矢印キー）でアイテム選択が移動する', async () => {
      // 最初のアイテムが選択されていることを確認
      const firstItem = mainWindow.locator('.item.selected').first();
      await expect(firstItem).toBeVisible();
      firstItemText = await firstItem.textContent();

      // ↓キーを押して選択を移動
      await utils.sendShortcut('ArrowDown');
      const selectedItem = mainWindow.locator('.item.selected');
      await expect(selectedItem).toBeVisible();

      // 選択されたアイテムのテキストが最初と異なることを確認
      const selectedItemText = await selectedItem.textContent();
      expect(selectedItemText).not.toBe(firstItemText);

      // さらに↓キーを押して選択を移動
      await utils.sendShortcut('ArrowDown');
      const currentItem = mainWindow.locator('.item.selected');
      currentItemText = await currentItem.textContent();

      // ↑キーを押して選択が上に移動することを確認
      await utils.sendShortcut('ArrowUp');
      const backSelectedItem = mainWindow.locator('.item.selected');
      await expect(backSelectedItem).toBeVisible();
      const backSelectedItemText = await backSelectedItem.textContent();
      expect(backSelectedItemText).not.toBe(currentItemText);
    });

    await test.step('検索欄からフォーカスが外れていても矢印キーで選択が移動する', async () => {
      // リストの行や余白をクリックしたときと同じく、フォーカスを body に移す
      await mainWindow.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await expect
        .poll(() => mainWindow.evaluate(() => document.activeElement === document.body))
        .toBe(true);
      const before = await mainWindow.locator('.item.selected').textContent();

      await utils.sendShortcut('ArrowDown');

      await expect(mainWindow.locator('.item.selected')).not.toHaveText(before ?? '');
      // 検索欄にフォーカスが戻るので、以後のキーは検索欄で受ける
      await expect(mainWindow.locator('input.search-box')).toBeFocused();
      await utils.sendShortcut('ArrowUp');
      await expect(mainWindow.locator('.item.selected')).toHaveText(before ?? '');
    });

    await test.step('マウスホバーでアイテム選択が変わる', async () => {
      const secondItem = mainWindow.locator('.item').nth(1);
      await secondItem.hover();
      await expect(secondItem).toHaveClass(/selected/);
    });
  });

  // ==================== 検索とアイテム数表示（タブ表示OFF時） ====================

  test('検索で絞り込み・AND 検索ができ、検索ボックス下のアイテム数も追従する', async ({
    mainWindow,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const searchBox = mainWindow.locator('input[type="text"]').first();
    const itemCount = mainWindow.locator('.item-count-display');
    let initialCount: number;
    let initialCountText: string;

    await test.step('ページ読み込みと検索ボックスの確認', async () => {
      await utils.waitForPageLoad();

      // 検索ボックスが存在することを確認
      const hasSearchBox = await utils.elementExists('input[type="text"]');
      expect(hasSearchBox).toBe(true);

      // 検索ボックスにフォーカスがあることを確認
      await expect(searchBox).toBeFocused();
    });

    await test.step('タブ表示OFFで、検索情報バーとアイテム数が表示される', async () => {
      // デフォルトテンプレート（base）を使用（showDataFileTabs: false）
      await expect(mainWindow.locator('.file-tab-bar')).not.toBeVisible();
      await expect(mainWindow.locator('.search-info-bar')).toBeVisible();
      await expect(itemCount).toBeVisible();

      // アイテム数が「〇〇 件」形式で表示されることを確認
      initialCountText = (await itemCount.textContent()) || '';
      expect(initialCountText).toMatch(/\d+ 件/);
    });

    await test.step('検索前の全アイテム数を取得', async () => {
      const allItems = mainWindow.locator('.item, [class*="item"]');
      initialCount = await allItems.count();
      expect(initialCount).toBeGreaterThan(0);
    });

    await test.step('"GitHub"で検索して絞り込みを確認し、アイテム数も減る', async () => {
      await utils.searchFor('GitHub');

      // 検索後のアイテム数を取得
      const filteredItems = mainWindow.locator('.item, [class*="item"]:visible');
      const filteredCount = await filteredItems.count();

      // 絞り込まれていることを確認
      expect(filteredCount).toBeLessThan(initialCount);
      expect(filteredCount).toBeGreaterThan(0);

      // GitHubを含むアイテムが表示されていることを確認
      // isVisible() は待たずに 1 回だけ見るので、描画が遅れると落ちる。表示されるまで待つ
      await expect(mainWindow.locator('text=GitHub').first()).toBeVisible();

      // アイテム数の表示が初期値より少なくなっていることを確認
      const filteredCountText = (await itemCount.textContent()) || '';
      const initialNum = parseInt(initialCountText.match(/\d+/)?.[0] || '0');
      const filteredNum = parseInt(filteredCountText.match(/\d+/)?.[0] || '0');
      expect(filteredNum).toBeLessThan(initialNum);
      expect(filteredNum).toBeGreaterThan(0);
    });

    await test.step('検索ボックスをクリアすると全アイテムとアイテム数が元に戻る', async () => {
      await searchBox.clear();

      // 全アイテムが再び表示されることを確認
      const allItems = mainWindow.locator('.item, [class*="item"]');
      const restoredCount = await allItems.count();
      expect(restoredCount).toBe(initialCount);

      // アイテム数が初期値に戻ることを確認
      expect((await itemCount.textContent()) || '').toBe(initialCountText);
    });

    await test.step('複数キーワードでAND検索ができる', async () => {
      // スペース区切りで複数キーワードを入力
      await utils.searchFor('Git Hub');

      // 結果が絞り込まれることを確認
      const filteredItems = mainWindow.locator('.item, [class*="item"]:visible');
      const filteredCount = await filteredItems.count();
      expect(filteredCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThanOrEqual(initialCount);

      // GitHubアイテムが表示されていることを確認
      await expect(mainWindow.locator('.item', { hasText: 'GitHub' })).toBeVisible();
    });
  });
});

/**
 * カスタムアイコン: SVG も表示できる（保存名は .png でも中身で見分ける）
 */
test.describe('QuickDashLauncher - カスタムアイコンの表示', () => {
  test('SVG のカスタムアイコンが描画される', async ({ mainWindow, configHelper }) => {
    const customDir = path.join(configHelper.getConfigDir(), 'icon-cache', 'custom');
    fs.mkdirSync(customDir, { recursive: true });
    fs.writeFileSync(
      path.join(customDir, 'e2esvg01.png'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="red"/></svg>'
    );
    configHelper.addItemToFile('data.json', {
      id: 'e2esvg01',
      type: 'item',
      displayName: 'SVGアイコンのアイテム',
      path: 'https://example.com/svg',
      customIcon: 'e2esvg01.png',
    });

    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();

    const img = mainWindow.locator('.item', { hasText: 'SVGアイコンのアイテム' }).locator('img');
    await expect(img).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/, { timeout: 10000 });
    await expect
      .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  });
});
