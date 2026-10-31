import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 読めなかったデータファイルのタブ（A3-209 提案 6）
 * 空のタブの「まだアイテムがありません」の代わりに、読めなかったことと直し方を出す
 */
test.describe('QuickDashLauncher - 読めなかったデータファイルのタブ', () => {
  test('壊れたデータファイルのタブには読めなかったと出し、直して F5 で元に戻る', async ({
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const empty = mainWindow.locator('.item-list-empty');

    await test.step('壊れていると、追加の入口の代わりに直し方と設定フォルダのボタンを出す', async () => {
      configHelper.writeDataFileRaw('data.json', '{ "version": 1, "items": [ { "id": ');
      await utils.reloadWithF5();
      await expect(empty).toContainText('datafiles/data.json を読めませんでした');
      await expect(empty).toContainText('F5');
      await expect(empty.getByRole('button', { name: '📂 設定フォルダを開く' })).toBeVisible();
      await expect(empty.getByRole('button', { name: '📄 アイテムを追加' })).toHaveCount(0);
    });

    await test.step('検索中は今までどおりの「合うアイテムはありません」', async () => {
      await utils.searchFor('なにか');
      await expect(empty).toContainText('に合うアイテムはありません');
      await utils.searchFor('');
    });

    await test.step('直して F5 を押すと、案内が消えてアイテムが出る', async () => {
      configHelper.writeDataFile('data.json', {
        version: '1.0',
        items: [
          {
            id: 'e2ecor01',
            type: 'item',
            displayName: '直したアイテム',
            path: 'https://example.com/',
          },
        ],
      });
      await utils.reloadWithF5();
      await expect(mainWindow.locator('.item', { hasText: '直したアイテム' })).toBeVisible();
      await expect(empty).toHaveCount(0);
    });
  });
});
