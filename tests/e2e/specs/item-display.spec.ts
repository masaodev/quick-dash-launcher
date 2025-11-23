import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - アイテム表示・選択テスト', () => {
  test('data.txtから読み込んだアイテムが表示され、アイコンとラベルが正しく表示される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
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

      await utils.attachScreenshot(testInfo, 'アイコン・ラベル確認');
    });

    await test.step('既知のアイテムが表示されることを確認', async () => {
      // E2Eテスト用data.txtに含まれる既知のアイテムが表示されることを確認
      const knownItems = ['GitHub', 'Google', 'メモ帳', '電卓'];

      for (const itemName of knownItems) {
        const item = mainWindow.locator('.item', { hasText: itemName });
        await expect(item).toBeVisible();
      }
      await utils.attachScreenshot(testInfo, '既知アイテム確認');
    });
  });

  test('キーボード（矢印キー）でアイテム選択が移動する', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    let firstItemText: string | null;

    await test.step('ページの読み込み完了を待機', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    await test.step('最初のアイテムが選択されていることを確認', async () => {
      const firstItem = mainWindow.locator('.item.selected').first();
      await expect(firstItem).toBeVisible();

      // 最初に選択されているアイテムのテキストを取得
      firstItemText = await firstItem.textContent();
    });

    await test.step('↓キーを押して選択を移動', async () => {
      await utils.sendShortcut('ArrowDown');
      await utils.wait(100);
      await utils.attachScreenshot(testInfo, '↓キー押下後');

      const selectedItem = mainWindow.locator('.item.selected');
      await expect(selectedItem).toBeVisible();

      // 選択されたアイテムのテキストが最初と異なることを確認
      const selectedItemText = await selectedItem.textContent();
      expect(selectedItemText).not.toBe(firstItemText);
    });

    await test.step('さらに↓キーを押して選択を移動', async () => {
      await utils.sendShortcut('ArrowDown');
      await utils.wait(100);
      await utils.attachScreenshot(testInfo, '↓キー2回押下後');
    });

    let currentItemText: string | null;

    await test.step('現在選択されているアイテムのテキストを取得', async () => {
      const currentItem = mainWindow.locator('.item.selected');
      currentItemText = await currentItem.textContent();
    });

    await test.step('↑キーを押して選択が上に移動することを確認', async () => {
      await utils.sendShortcut('ArrowUp');
      await utils.wait(100);
      await utils.attachScreenshot(testInfo, '↑キー押下後');

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
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    await test.step('2番目のアイテムにマウスホバー', async () => {
      const secondItem = mainWindow.locator('.item').nth(1);
      await secondItem.hover();
      await utils.wait(100);
      await utils.attachScreenshot(testInfo, 'ホバー後');
    });

    await test.step('ホバーしたアイテムが選択されていることを確認', async () => {
      const secondItem = mainWindow.locator('.item').nth(1);
      await expect(secondItem).toHaveClass(/selected/);
    });
  });
});
