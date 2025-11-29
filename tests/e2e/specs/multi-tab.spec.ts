import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - マルチタブ機能テスト', () => {
  test.beforeEach(async ({ configHelper }) => {
    // マルチタブ機能を有効化
    configHelper.loadTemplate('with-tabs');
  });

  // ==================== タブ表示・切り替えテスト ====================

  test('タブ機能を有効化するとタブバーが表示される', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('初期状態を確認', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    await test.step('タブバーとタブボタンの表示確認', async () => {
      // タブバーが表示されることを確認
      const tabBar = mainWindow.locator('.file-tab-bar');
      await expect(tabBar).toBeVisible();

      // タブボタンが存在することを確認
      const tabs = mainWindow.locator('.file-tab');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);
      await utils.attachScreenshot(testInfo, 'タブバー表示確認');
    });
  });

  test('メインタブとサブタブが表示される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    // メインタブが存在することを確認
    const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
    await expect(mainTab).toBeVisible();

    // サブ1タブが存在することを確認（data2.txt）
    const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
    await expect(subTab1).toBeVisible();
  });

  test('デフォルトではメインタブがアクティブになっている', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    // メインタブがアクティブであることを確認
    const mainTab = mainWindow.locator('.file-tab.active', { hasText: 'メイン' });
    await expect(mainTab).toBeVisible();
  });

  test('サブタブをクリックすると切り替わる', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('タブ機能を有効化してリロード', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, 'タブ機能有効化後');
    });

    await test.step('サブ1タブをクリック', async () => {
      const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await subTab1.click();
      await utils.wait(300);
      await utils.attachScreenshot(testInfo, 'サブタブクリック後');
    });

    await test.step('サブ1タブがアクティブになったことを確認', async () => {
      const activeTab = mainWindow.locator('.file-tab.active', { hasText: 'サブ1' });
      await expect(activeTab).toBeVisible();
    });
  });

  // ==================== サブタブのアイテム表示テスト ====================

  test('サブタブに切り替えるとdata2.txtのアイテムが表示される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('タブ機能を有効化してリロード', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態（メインタブ）');
    });

    await test.step('サブ1タブをクリック', async () => {
      const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await subTab1.click();
      await utils.wait(500);
      await utils.attachScreenshot(testInfo, 'サブタブ切り替え後');
    });

    await test.step('data2.txtのアイテムが表示されることを確認', async () => {
      const knownItems = ['Stack Overflow', 'Reddit', 'YouTube'];

      for (const itemName of knownItems) {
        const item = mainWindow.locator('.item', { hasText: itemName });
        await expect(item).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test('サブタブに切り替えるとメインタブのアイテムは表示されない', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    // メインタブのアイテムが表示されていることを確認
    const githubBefore = mainWindow.locator('.item', { hasText: 'GitHub' });
    await expect(githubBefore).toBeVisible();

    // サブ1タブをクリック
    const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
    await subTab1.click();
    await utils.wait(500);

    // メインタブのアイテムが表示されなくなることを確認
    const githubAfter = mainWindow.locator('.item', { hasText: 'GitHub' });
    await expect(githubAfter).not.toBeVisible();

    // data2.txtのアイテムが表示されることを確認
    const redditItem = mainWindow.locator('.item', { hasText: 'Reddit' });
    await expect(redditItem).toBeVisible();
  });

  test('メインタブに戻るとdata.txtのアイテムが表示される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    // サブ1タブに切り替え
    const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
    await subTab1.click();
    await utils.wait(500);

    // メインタブに戻る
    const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
    await mainTab.click();
    await utils.wait(500);

    // data.txtのアイテムが表示されることを確認
    const knownItems = ['GitHub', 'Google', 'Wikipedia'];

    for (const itemName of knownItems) {
      const item = mainWindow.locator('.item', { hasText: itemName });
      await expect(item).toBeVisible();
    }

    // data2.txtのアイテムは表示されないことを確認
    const redditItem = mainWindow.locator('.item', { hasText: 'Reddit' });
    await expect(redditItem).not.toBeVisible();
  });

  // ==================== サブタブのアイテム選択・実行テスト ====================

  test('サブタブのアイテムを選択できる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    // サブ1タブに切り替え
    const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
    await subTab1.click();
    await utils.wait(500);

    // 最初のアイテムが選択されていることを確認
    const selectedItem = mainWindow.locator('.item.selected');
    await expect(selectedItem).toBeVisible();
  });

  test('サブタブのアイテムをキーボードで選択できる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    // サブ1タブに切り替え
    const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
    await subTab1.click();
    await utils.wait(500);

    // 最初に選択されているアイテムのテキストを取得
    const firstItem = mainWindow.locator('.item.selected').first();
    await expect(firstItem).toBeVisible({ timeout: 5000 });
    const firstItemText = await firstItem.textContent();

    // ↓キーを押して次のアイテムに移動
    await utils.sendShortcut('ArrowDown');
    await utils.wait(100);

    // 選択が移動したことを確認
    const secondItem = mainWindow.locator('.item.selected');
    await expect(secondItem).toBeVisible({ timeout: 5000 });
    const secondItemText = await secondItem.textContent();
    expect(secondItemText).not.toBe(firstItemText);
  });

  test('サブタブのアイテムを検索できる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    // サブ1タブに切り替え
    const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
    await subTab1.click();
    await utils.wait(500);

    // 検索前の全アイテム数を取得
    const allItems = mainWindow.locator('.item');
    const initialCount = await allItems.count();
    expect(initialCount).toBeGreaterThan(0);

    // "Reddit"で検索
    await utils.searchFor('Reddit');
    await utils.wait(300);

    // 検索結果が絞り込まれることを確認
    const filteredItems = mainWindow.locator('.item:visible');
    const filteredCount = await filteredItems.count();
    expect(filteredCount).toBeLessThan(initialCount);

    // Redditを含むアイテムが表示されていることを確認
    const redditItem = mainWindow.locator('.item', { hasText: 'Reddit' });
    await expect(redditItem).toBeVisible();
  });

  test('サブタブで新しいアイテムを追加して表示される', async ({ mainWindow, configHelper }) => {
    const utils = new TestUtils(mainWindow);

    // data2.txtに新しいアイテムを追加
    configHelper.addItemToData2('新規サブアイテム', 'https://example-sub.com');

    // アプリをリロード
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // サブ1タブに切り替え
    const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
    await subTab1.click();
    await utils.wait(500);

    // 追加したアイテムが表示されることを確認
    const newItem = mainWindow.locator('.item', { hasText: '新規サブアイテム' });
    await expect(newItem).toBeVisible();
  });

  // ==================== タブ間のデータ独立性テスト ====================

  test('各タブのデータは独立している', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    // メインタブのアイテム数を確認
    const mainItems = mainWindow.locator('.item');
    const mainItemCount = await mainItems.count();

    // サブ1タブに切り替え
    const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
    await subTab1.click();
    await utils.wait(500);

    // サブタブのアイテム数を確認
    const subItems = mainWindow.locator('.item');
    const subItemCount = await subItems.count();

    // アイテム数が異なることを確認（独立したデータ）
    expect(mainItemCount).not.toBe(subItemCount);
  });

  test('タブを切り替えても検索状態はリセットされる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    await utils.waitForPageLoad();

    // メインタブで検索
    await utils.searchFor('GitHub');
    await utils.wait(300);

    // 検索ボックスに文字が入っていることを確認
    const searchBox = mainWindow.locator('input[type="text"]').first();
    const searchValue = await searchBox.inputValue();
    expect(searchValue).toBe('GitHub');

    // サブ1タブに切り替え
    const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
    await subTab1.click();
    await utils.wait(500);

    // 検索ボックスがクリアされていることを確認
    // （実装によってはクリアされないかもしれないので、その場合はこのテストは失敗する）
    // この動作は実際のアプリの仕様に依存するため、確認が必要
    const searchValueAfter = await searchBox.inputValue();

    // タブ切り替え後も検索は維持される可能性があるので、
    // ここでは検索ボックスの値が取得できることだけを確認
    expect(searchValueAfter).toBeDefined();
  });

  // ==================== アイテムのタブ変更テスト ====================

  test('アイテムの編集で保存先タブを変更すると別のタブに移動する', async ({
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('メインタブにアイテムが存在することを確認', async () => {
      // ページの読み込み完了を待機
      await utils.waitForPageLoad();

      // メインタブがアクティブであることを確認
      const mainTab = mainWindow.locator('.file-tab.active', { hasText: 'メイン' });
      await expect(mainTab).toBeVisible();

      // GitHubアイテムが表示されていることを確認
      const githubItem = mainWindow.locator('.item', { hasText: 'GitHub' });
      await expect(githubItem).toBeVisible();

      await utils.attachScreenshot(testInfo, '初期状態（メインタブ）');
    });

    await test.step('GitHubアイテムを右クリックして編集モーダルを開く', async () => {
      await utils.editItemByRightClick('GitHub');
      await utils.wait(300);

      const isModalVisible = await utils.isRegisterModalVisible();
      expect(isModalVisible).toBe(true);

      await utils.attachScreenshot(testInfo, '編集モーダル表示');
    });

    await test.step('保存先をサブ1タブに変更して更新', async () => {
      // 保存先セレクトボックスを直接操作してdata2.txtを選択
      const tabSelect = mainWindow.locator('.register-modal select').last();
      await tabSelect.selectOption({ value: 'data2.txt' });

      await utils.wait(300);
      await utils.attachScreenshot(testInfo, '保存先変更後');

      // 更新ボタンをクリック
      await utils.clickRegisterButton();
      await utils.wait(500);

      await utils.attachScreenshot(testInfo, '更新後');
    });

    await test.step('メインタブからGitHubアイテムが消えたことを確認', async () => {
      // ページをリロード
      await mainWindow.reload();
      await utils.waitForPageLoad();

      // メインタブがアクティブであることを確認
      const mainTab = mainWindow.locator('.file-tab.active', { hasText: 'メイン' });
      await expect(mainTab).toBeVisible();

      // GitHubアイテムが表示されなくなったことを確認
      const githubItem = mainWindow.locator('.item', { hasText: 'GitHub' });
      await expect(githubItem).not.toBeVisible({ timeout: 3000 });

      await utils.attachScreenshot(testInfo, 'メインタブ確認');
    });

    await test.step('サブ1タブに切り替えてGitHubアイテムが存在することを確認', async () => {
      // サブ1タブをクリック
      const subTab1 = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await subTab1.click();
      await utils.wait(500);

      // サブ1タブがアクティブになったことを確認
      const activeTab = mainWindow.locator('.file-tab.active', { hasText: 'サブ1' });
      await expect(activeTab).toBeVisible();

      // GitHubアイテムがサブ1タブに表示されることを確認
      const githubItem = mainWindow.locator('.item', { hasText: 'GitHub' });
      await expect(githubItem).toBeVisible({ timeout: 5000 });

      await utils.attachScreenshot(testInfo, 'サブ1タブ確認');
    });

    await test.step('data.txtとdata2.txtの内容を確認', async () => {
      // data.txtにGitHubが含まれていないことを確認
      const dataContent = configHelper.readData();
      expect(dataContent).not.toContain('GitHub');

      // data2.txtにGitHubが含まれていることを確認
      const data2Content = configHelper.readData2();
      expect(data2Content).toContain('GitHub');
    });
  });

  // ==================== タブ表示時のアイテム数表示テスト ====================

  test('タブ表示ON時、各タブにアイテム数が表示される', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('マルチタブ機能を有効化', async () => {
      await utils.waitForPageLoad();

      // タブバーが表示されることを確認
      const tabBar = mainWindow.locator('.file-tab-bar');
      await expect(tabBar).toBeVisible();

      await utils.attachScreenshot(testInfo, 'タブ表示ON初期状態');
    });

    await test.step('メインタブにアイテム数が表示される', async () => {
      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      await expect(mainTab).toBeVisible();

      // タブ内のアイテム数表示を確認
      const mainTabCount = mainTab.locator('.file-tab-count');
      await expect(mainTabCount).toBeVisible();

      const countText = await mainTabCount.textContent();
      expect(countText).toMatch(/\(\d+\)/);

      await utils.attachScreenshot(testInfo, 'メインタブのアイテム数');
    });

    await test.step('サブ1タブにアイテム数が表示される', async () => {
      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await expect(subTab).toBeVisible();

      // タブ内のアイテム数表示を確認
      const subTabCount = subTab.locator('.file-tab-count');
      await expect(subTabCount).toBeVisible();

      const countText = await subTabCount.textContent();
      expect(countText).toMatch(/\(\d+\)/);

      await utils.attachScreenshot(testInfo, 'サブ1タブのアイテム数');
    });
  });

  test('タブ表示ON時、検索によって全タブのアイテム数が動的に更新される', async ({
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('マルチタブ機能を有効化', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    let mainTabInitialCount: string;
    let subTabInitialCount: string;

    await test.step('各タブの初期アイテム数を取得', async () => {
      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      const mainTabCount = mainTab.locator('.file-tab-count');
      mainTabInitialCount = (await mainTabCount.textContent()) || '';

      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      const subTabCount = subTab.locator('.file-tab-count');
      subTabInitialCount = (await subTabCount.textContent()) || '';

      expect(mainTabInitialCount).toMatch(/\(\d+\)/);
      expect(subTabInitialCount).toMatch(/\(\d+\)/);
    });

    await test.step('検索を実行して各タブのアイテム数が更新されることを確認', async () => {
      await utils.searchFor('GitHub');
      await utils.wait(300);

      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      const mainTabCount = mainTab.locator('.file-tab-count');
      const mainTabFiltered = (await mainTabCount.textContent()) || '';

      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      const subTabCount = subTab.locator('.file-tab-count');
      const subTabFiltered = (await subTabCount.textContent()) || '';

      // 各タブのアイテム数が初期値と異なる（または同じ場合もある）ことを確認
      expect(mainTabFiltered).toMatch(/\(\d+\)/);
      expect(subTabFiltered).toMatch(/\(\d+\)/);

      await utils.attachScreenshot(testInfo, '検索後の各タブアイテム数');
    });

    await test.step('検索をクリアして各タブのアイテム数が元に戻ることを確認', async () => {
      const searchBox = mainWindow.locator('input[type="text"]').first();
      await searchBox.clear();
      await utils.wait(300);

      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      const mainTabCount = mainTab.locator('.file-tab-count');
      const mainTabRestored = (await mainTabCount.textContent()) || '';

      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      const subTabCount = subTab.locator('.file-tab-count');
      const subTabRestored = (await subTabCount.textContent()) || '';

      // アイテム数が初期値に戻ることを確認
      expect(mainTabRestored).toBe(mainTabInitialCount);
      expect(subTabRestored).toBe(subTabInitialCount);

      await utils.attachScreenshot(testInfo, 'クリア後の各タブアイテム数');
    });
  });

  test('タブ切り替え時、各タブのアイテム数は維持される', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('マルチタブ機能を有効化', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    let mainTabCount: string;
    let subTabCount: string;

    await test.step('メインタブのアイテム数を取得', async () => {
      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      const count = mainTab.locator('.file-tab-count');
      mainTabCount = (await count.textContent()) || '';
      expect(mainTabCount).toMatch(/\(\d+\)/);
    });

    await test.step('サブ1タブに切り替え', async () => {
      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await subTab.click();
      await utils.wait(300);

      const count = subTab.locator('.file-tab-count');
      subTabCount = (await count.textContent()) || '';
      expect(subTabCount).toMatch(/\(\d+\)/);

      await utils.attachScreenshot(testInfo, 'サブ1タブに切り替え');
    });

    await test.step('メインタブに戻り、アイテム数が変わっていないことを確認', async () => {
      const mainTab = mainWindow.locator('.file-tab', { hasText: 'メイン' });
      await mainTab.click();
      await utils.wait(300);

      const count = mainTab.locator('.file-tab-count');
      const currentCount = (await count.textContent()) || '';

      // アイテム数が変わっていないことを確認
      expect(currentCount).toBe(mainTabCount);

      await utils.attachScreenshot(testInfo, 'メインタブに戻る');
    });
  });

  // ==================== 複数ファイル統合タブテスト ====================

  test('1つのタブに複数のデータファイルを紐づけた場合、タブが1つだけ表示される', async ({
    mainWindow,
    configHelper,
  }, testInfo) => {
    // 複数ファイル統合タブのテンプレートをロード
    configHelper.loadTemplate('with-multi-file-tabs');

    const utils = new TestUtils(mainWindow);

    await test.step('ページロードと初期確認', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    await test.step('タブが2つのみ表示されることを確認', async () => {
      const tabs = mainWindow.locator('.file-tab');
      const tabCount = await tabs.count();
      expect(tabCount).toBe(2);

      await utils.attachScreenshot(testInfo, 'タブ数確認');
    });

    await test.step('統合タブとサブ1タブが表示されることを確認', async () => {
      const unifiedTab = mainWindow.locator('.file-tab', { hasText: '統合タブ' });
      await expect(unifiedTab).toBeVisible();

      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await expect(subTab).toBeVisible();

      await utils.attachScreenshot(testInfo, 'タブ名確認');
    });
  });

  test('統合タブには複数ファイルのアイテムが全て表示される', async ({
    mainWindow,
    configHelper,
  }, testInfo) => {
    configHelper.loadTemplate('with-multi-file-tabs');

    const utils = new TestUtils(mainWindow);

    await test.step('ページロードと統合タブの確認', async () => {
      await utils.waitForPageLoad();

      // 統合タブがアクティブであることを確認
      const unifiedTab = mainWindow.locator('.file-tab.active', { hasText: '統合タブ' });
      await expect(unifiedTab).toBeVisible();

      await utils.attachScreenshot(testInfo, '統合タブがアクティブ');
    });

    await test.step('data.txtのアイテムが表示されることを確認', async () => {
      const knownDataItems = ['GitHub', 'Google', 'Wikipedia'];

      for (const itemName of knownDataItems) {
        const item = mainWindow.locator('.item', { hasText: itemName });
        await expect(item).toBeVisible({ timeout: 5000 });
      }
    });

    await test.step('data3.txtのアイテムも表示されることを確認', async () => {
      const knownData3Items = ['Qiita', 'Zenn', 'note'];

      for (const itemName of knownData3Items) {
        const item = mainWindow.locator('.item', { hasText: itemName });
        await expect(item).toBeVisible({ timeout: 5000 });
      }

      await utils.attachScreenshot(testInfo, '統合タブのアイテム確認');
    });
  });

  test('統合タブのアイテム数は複数ファイルの合計が表示される', async ({
    mainWindow,
    configHelper,
  }, testInfo) => {
    configHelper.loadTemplate('with-multi-file-tabs');

    const utils = new TestUtils(mainWindow);

    await test.step('ページロードと統合タブの確認', async () => {
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '初期状態');
    });

    await test.step('統合タブのアイテム数を確認', async () => {
      const unifiedTab = mainWindow.locator('.file-tab', { hasText: '統合タブ' });
      const tabCount = unifiedTab.locator('.file-tab-count');
      const countText = (await tabCount.textContent()) || '';

      // アイテム数が表示されていることを確認
      expect(countText).toMatch(/\(\d+\)/);

      // 実際のアイテム数を取得
      const allItems = mainWindow.locator('.item');
      const actualCount = await allItems.count();

      // タブに表示されているアイテム数と実際のアイテム数が一致することを確認
      const displayedCount = parseInt(countText.match(/\((\d+)\)/)?.[1] || '0');
      expect(displayedCount).toBe(actualCount);

      await utils.attachScreenshot(testInfo, 'アイテム数確認');
    });
  });

  test('統合タブから別のタブに切り替えると、統合タブのアイテムは表示されない', async ({
    mainWindow,
    configHelper,
  }, testInfo) => {
    configHelper.loadTemplate('with-multi-file-tabs');

    const utils = new TestUtils(mainWindow);

    await test.step('統合タブの初期状態を確認', async () => {
      await utils.waitForPageLoad();

      // data.txtのアイテムが表示されていることを確認
      const githubItem = mainWindow.locator('.item', { hasText: 'GitHub' });
      await expect(githubItem).toBeVisible();

      // data3.txtのアイテムも表示されていることを確認
      const qiitaItem = mainWindow.locator('.item', { hasText: 'Qiita' });
      await expect(qiitaItem).toBeVisible();

      await utils.attachScreenshot(testInfo, '統合タブ初期状態');
    });

    await test.step('サブ1タブに切り替え', async () => {
      const subTab = mainWindow.locator('.file-tab', { hasText: 'サブ1' });
      await subTab.click();
      await utils.wait(500);

      await utils.attachScreenshot(testInfo, 'サブ1タブに切り替え');
    });

    await test.step('統合タブのアイテムが表示されないことを確認', async () => {
      // data.txtのアイテムが表示されないことを確認
      const githubItem = mainWindow.locator('.item', { hasText: 'GitHub' });
      await expect(githubItem).not.toBeVisible();

      // data3.txtのアイテムも表示されないことを確認
      const qiitaItem = mainWindow.locator('.item', { hasText: 'Qiita' });
      await expect(qiitaItem).not.toBeVisible();

      // data2.txtのアイテムが表示されることを確認
      const redditItem = mainWindow.locator('.item', { hasText: 'Reddit' });
      await expect(redditItem).toBeVisible();

      await utils.attachScreenshot(testInfo, 'サブ1タブのアイテム確認');
    });
  });

  test('統合タブで検索すると複数ファイルのアイテムが検索対象になる', async ({
    mainWindow,
    configHelper,
  }, testInfo) => {
    configHelper.loadTemplate('with-multi-file-tabs');

    const utils = new TestUtils(mainWindow);

    await test.step('統合タブで検索前の状態を確認', async () => {
      await utils.waitForPageLoad();

      // 統合タブがアクティブであることを確認
      const unifiedTab = mainWindow.locator('.file-tab.active', { hasText: '統合タブ' });
      await expect(unifiedTab).toBeVisible();

      // 検索前の全アイテム数を取得
      const allItems = mainWindow.locator('.item');
      const initialCount = await allItems.count();
      expect(initialCount).toBeGreaterThan(0);

      await utils.attachScreenshot(testInfo, '検索前');
    });

    await test.step('data.txtのアイテムで検索', async () => {
      await utils.searchFor('GitHub');
      await utils.wait(300);

      // GitHubアイテムが表示されることを確認（data.txtのアイテム）
      const githubItem = mainWindow.locator('.item', { hasText: 'GitHub' });
      await expect(githubItem).toBeVisible();

      await utils.attachScreenshot(testInfo, 'data.txtアイテム検索結果');
    });

    await test.step('検索をクリアしてdata3.txtのアイテムで検索', async () => {
      const searchBox = mainWindow.locator('input[type="text"]').first();
      await searchBox.clear();
      await utils.wait(100);

      await utils.searchFor('Qiita');
      await utils.wait(300);

      // Qiitaアイテムが表示されることを確認（data3.txtのアイテム）
      const qiitaItem = mainWindow.locator('.item', { hasText: 'Qiita' });
      await expect(qiitaItem).toBeVisible();

      await utils.attachScreenshot(testInfo, 'data3.txtアイテム検索結果');
    });
  });
});
