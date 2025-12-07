import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - グループアイテム登録・編集機能テスト', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    // with-groupsテンプレートを読み込む
    configHelper.loadTemplate('with-groups');

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await mainWindow.reload();
    await utils.waitForPageLoad();
  });

  // ==================== グループアイテム表示テスト ====================

  test('グループアイテムが正しく表示される', async ({ mainWindow }, _testInfo) => {
    const _utils = new TestUtils(mainWindow);

    await test.step('グループアイテムが表示されることを確認', async () => {
      // data.txtに含まれるグループアイテムが表示されることを確認
      const knownGroups = ['開発環境スタート', 'Web開発セット', 'ドキュメント作成'];

      for (const groupName of knownGroups) {
        const groupItem = mainWindow.locator('.item', { hasText: groupName });
        await expect(groupItem).toBeVisible({ timeout: 5000 });
      }
    });

    await test.step('グループアイテムにグループアイコンが表示される', async () => {
      const groupItem = mainWindow.locator('.item', { hasText: '開発環境スタート' });
      await expect(groupItem).toBeVisible();

      // グループアイコン（📦）が表示されることを確認
      const groupIcon = groupItem.locator('.item-icon');
      const iconText = await groupIcon.textContent();
      expect(iconText?.includes('📦')).toBe(true);
    });
  });

  // ==================== グループアイテム新規登録テスト ====================

  test('新規グループアイテムを登録できる', async ({ mainWindow, configHelper }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('登録モーダルを開く', async () => {
      await utils.openRegisterModal();

      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);
    });

    await test.step('種別選択でグループを選択', async () => {
      // 種別選択ドロップダウンを探す
      const typeSelect = mainWindow.locator('.register-modal select').first();
      await typeSelect.selectOption({ value: 'group' });

      // グループアイテム名入力フィールドが表示されることを確認
      const groupNameInput = mainWindow
        .locator('.register-modal input[placeholder*="グループ名を入力"]')
        .first();
      await expect(groupNameInput).toBeVisible();
    });

    await test.step('グループ名を入力', async () => {
      const groupNameInput = mainWindow
        .locator('.register-modal input[placeholder*="グループ名を入力"]')
        .first();
      await groupNameInput.fill('テストグループ');
    });

    await test.step('グループアイテムを追加', async () => {
      // グループアイテム追加ボタンをクリック
      const addItemButton = mainWindow.locator('.register-modal button', {
        hasText: 'アイテムを追加',
      });
      await addItemButton.click();

      // グループアイテム選択モーダルが表示されることを確認
      const selectorModal = mainWindow.locator('.group-item-selector-modal');
      await expect(selectorModal).toBeVisible();
    });

    await test.step('アイテムを選択してグループに追加', async () => {
      // 利用可能なアイテム（GitHub）をクリック
      const githubItem = mainWindow.locator('.group-item-selector-modal .item-row', {
        hasText: 'GitHub',
      });
      await githubItem.click();

      // モーダルが閉じていることを確認
      const selectorModal = mainWindow.locator('.group-item-selector-modal');
      await expect(selectorModal).not.toBeVisible();

      // 選択されたアイテムが表示されることを確認
      const selectedItem = mainWindow.locator('.register-modal .selected-items .item-chip', {
        hasText: 'GitHub',
      });
      await expect(selectedItem).toBeVisible();
    });

    await test.step('さらにアイテムを追加', async () => {
      // グループアイテム追加ボタンを再度クリック
      const addItemButton = mainWindow.locator('.register-modal button', {
        hasText: 'アイテムを追加',
      });
      await addItemButton.click();

      // Googleを選択
      const googleItem = mainWindow.locator('.group-item-selector-modal .item-row', {
        hasText: 'Google',
      });
      await googleItem.click();

      // 選択されたアイテムが表示されることを確認
      const selectedItem = mainWindow.locator('.register-modal .selected-items .item-chip', {
        hasText: 'Google',
      });
      await expect(selectedItem).toBeVisible();
    });

    await test.step('グループを登録', async () => {
      await utils.clickRegisterButton();

      // モーダルが閉じたことを確認
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(false);

      // 新しいグループアイテムが表示されていることを確認
      const newGroup = mainWindow.locator('.item', { hasText: 'テストグループ' });
      await expect(newGroup).toBeVisible();
    });

    await test.step('登録したグループがdata.txtに保存される', async () => {
      const dataContent = configHelper.readDataFile('data.txt');
      expect(dataContent).toContain('group,テストグループ,GitHub,Google');
    });

    await test.step('登録したグループが表示される', async () => {
      const group = mainWindow.locator('.item', { hasText: 'テストグループ' });
      await expect(group).toBeVisible();
    });
  });

  test('グループアイテム登録時のバリデーション', async ({ mainWindow }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('グループ名が空では登録できない', async () => {
      await utils.openRegisterModal();

      // 種別選択でグループを選択
      const typeSelect = mainWindow.locator('.register-modal select').first();
      await typeSelect.selectOption({ value: 'group' });

      // グループ名を空のままで登録を試みる
      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();

      // モーダルが閉じていない（エラーで登録できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = mainWindow.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('グループ名を入力してください');

      await utils.clickCancelButton();
    });

    await test.step('グループアイテムが空では登録できない', async () => {
      await utils.openRegisterModal();

      // 種別選択でグループを選択
      const typeSelect = mainWindow.locator('.register-modal select').first();
      await typeSelect.selectOption({ value: 'group' });

      // グループ名のみ入力
      const groupNameInput = mainWindow
        .locator('.register-modal input[placeholder*="グループ名を入力"]')
        .first();
      await groupNameInput.fill('空のグループ');

      // グループアイテムを追加せずに登録を試みる
      const registerButton = mainWindow.locator('.register-modal button.primary').first();
      await registerButton.click();

      // モーダルが閉じていない（エラーで登録できない）
      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);

      // エラーメッセージが表示されていることを確認
      const errorMessage = mainWindow.locator('.error-message');
      await expect(errorMessage.first()).toBeVisible();
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toContain('グループアイテムを追加してください');

      await utils.clickCancelButton();
    });
  });

  // ==================== グループアイテム編集テスト ====================

  test('グループアイテムを編集できる', async ({ mainWindow, configHelper }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('グループアイテムを右クリックして編集', async () => {
      await utils.editItemByRightClick('開発環境スタート');

      const isVisible = await utils.isRegisterModalVisible();
      expect(isVisible).toBe(true);
    });

    await test.step('編集モーダルに既存の情報が入力されている', async () => {
      // グループ名フィールドに既存の値が入力されていることを確認
      const groupNameInput = mainWindow
        .locator('.register-modal input[placeholder*="グループ名を入力"]')
        .first();
      const groupNameValue = await groupNameInput.inputValue();
      expect(groupNameValue).toBe('開発環境スタート');

      // 選択されたアイテムが表示されていることを確認
      const selectedItems = mainWindow.locator('.register-modal .selected-items .item-chip');
      const count = await selectedItems.count();
      expect(count).toBeGreaterThan(0);
    });

    await test.step('グループ名を編集', async () => {
      const groupNameInput = mainWindow
        .locator('.register-modal input[placeholder*="グループ名を入力"]')
        .first();
      await groupNameInput.fill('開発環境スタート編集');
    });

    await test.step('グループアイテムを削除', async () => {
      // 最初のアイテムの削除ボタンをクリック
      const removeButton = mainWindow
        .locator('.register-modal .selected-items .item-chip button')
        .first();
      await removeButton.click();
    });

    await test.step('新しいアイテムを追加', async () => {
      // グループアイテム追加ボタンをクリック
      const addItemButton = mainWindow.locator('.register-modal button', {
        hasText: 'アイテムを追加',
      });
      await addItemButton.click();

      // Wikipediaを選択
      const wikipediaItem = mainWindow.locator('.group-item-selector-modal .item-row', {
        hasText: 'Wikipedia',
      });
      await wikipediaItem.click();
    });

    await test.step('編集を保存', async () => {
      await utils.clickRegisterButton();

      // 編集後のグループアイテムが表示されていることを確認
      const editedGroup = mainWindow.locator('.item', { hasText: '開発環境スタート編集' });
      await expect(editedGroup).toBeVisible();
    });

    await test.step('編集がdata.txtに保存される', async () => {
      const dataContent = configHelper.readDataFile('data.txt');
      expect(dataContent).toContain('開発環境スタート編集');
      expect(dataContent).toContain('Wikipedia');
    });
  });

  test('グループアイテム編集をキャンセルできる', async ({
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('グループアイテムを編集してキャンセル', async () => {
      const dataBefore = configHelper.readDataFile('data.txt');

      await utils.editItemByRightClick('開発環境スタート');
      const groupNameInput = mainWindow
        .locator('.register-modal input[placeholder*="グループ名を入力"]')
        .first();
      await groupNameInput.fill('キャンセルテスト');

      await utils.clickCancelButton();

      // data.txtが変更されていないことを確認
      const dataAfter = configHelper.readDataFile('data.txt');
      expect(dataAfter).toBe(dataBefore);
    });
  });

  // ==================== グループアイテム選択モーダルテスト ====================

  test('グループアイテム選択モーダルの機能', async ({ mainWindow }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('登録モーダルを開いてグループを選択', async () => {
      await utils.openRegisterModal();

      const typeSelect = mainWindow.locator('.register-modal select').first();
      await typeSelect.selectOption({ value: 'group' });

      const groupNameInput = mainWindow
        .locator('.register-modal input[placeholder*="グループ名を入力"]')
        .first();
      await groupNameInput.fill('選択テスト');
    });

    await test.step('グループアイテム選択モーダルを開く', async () => {
      const addItemButton = mainWindow.locator('.register-modal button', {
        hasText: 'アイテムを追加',
      });
      await addItemButton.click();

      const selectorModal = mainWindow.locator('.group-item-selector-modal');
      await expect(selectorModal).toBeVisible();
    });

    await test.step('検索機能でアイテムを絞り込み', async () => {
      const searchInput = mainWindow.locator('.group-item-selector-modal input[type="text"]');
      await searchInput.fill('GitHub');

      // GitHubアイテムが表示されることを確認
      const githubItem = mainWindow.locator('.group-item-selector-modal .item-row', {
        hasText: 'GitHub',
      });
      await expect(githubItem).toBeVisible();

      // 検索にマッチしないアイテムは表示されない
      const allItems = mainWindow.locator('.group-item-selector-modal .item-row');
      const count = await allItems.count();
      expect(count).toBe(1);
    });

    await test.step('検索をクリアすると全アイテムが表示される', async () => {
      const searchInput = mainWindow.locator('.group-item-selector-modal input[type="text"]');
      await searchInput.fill('');

      const allItems = mainWindow.locator('.group-item-selector-modal .item-row');
      const count = await allItems.count();
      expect(count).toBeGreaterThan(1);
    });

    await test.step('アイコンが正しく表示される', async () => {
      // アイテム行にアイコンが表示されていることを確認
      const itemIcon = mainWindow
        .locator('.group-item-selector-modal .item-row .item-icon')
        .first();
      await expect(itemIcon).toBeVisible();
    });

    await test.step('ESCキーでモーダルを閉じる', async () => {
      await mainWindow.keyboard.press('Escape');

      const selectorModal = mainWindow.locator('.group-item-selector-modal');
      await expect(selectorModal).not.toBeVisible();
    });

    await test.step('登録をキャンセル', async () => {
      await utils.clickCancelButton();
    });
  });

  test('既に追加済みのアイテムは選択不可になる', async ({ mainWindow }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('グループを作成してアイテムを追加', async () => {
      await utils.openRegisterModal();

      const typeSelect = mainWindow.locator('.register-modal select').first();
      await typeSelect.selectOption({ value: 'group' });

      const groupNameInput = mainWindow
        .locator('.register-modal input[placeholder*="グループ名を入力"]')
        .first();
      await groupNameInput.fill('選択不可テスト');

      // GitHubを追加
      const addItemButton = mainWindow.locator('.register-modal button', {
        hasText: 'アイテムを追加',
      });
      await addItemButton.click();

      const githubItem = mainWindow.locator('.group-item-selector-modal .item-row', {
        hasText: 'GitHub',
      });
      await githubItem.click();
    });

    await test.step('再度アイテム追加モーダルを開く', async () => {
      const addItemButton = mainWindow.locator('.register-modal button', {
        hasText: 'アイテムを追加',
      });
      await addItemButton.click();
    });

    await test.step('既に追加したアイテムが選択不可になっている', async () => {
      // GitHubアイテムが excluded クラスを持っていることを確認
      const githubItem = mainWindow.locator('.group-item-selector-modal .item-row.excluded', {
        hasText: 'GitHub',
      });
      await expect(githubItem).toBeVisible();

      // 「追加済み」ラベルが表示されていることを確認
      const excludedLabel = githubItem.locator('.excluded-label');
      await expect(excludedLabel).toBeVisible();
      const labelText = await excludedLabel.textContent();
      expect(labelText).toContain('追加済み');
    });

    await test.step('追加済みアイテムはクリックできない', async () => {
      // GitHubアイテムをクリックしても何も起こらない
      const githubItem = mainWindow.locator('.group-item-selector-modal .item-row.excluded', {
        hasText: 'GitHub',
      });
      await githubItem.click();

      // モーダルが閉じていないことを確認
      const selectorModal = mainWindow.locator('.group-item-selector-modal');
      await expect(selectorModal).toBeVisible();
    });

    await test.step('キャンセル', async () => {
      await mainWindow.keyboard.press('Escape');
      await utils.clickCancelButton();
    });
  });

  // ==================== 管理画面でのグループアイテム編集テスト ====================

  test('管理画面でグループアイテムを編集できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('管理画面を開く', async () => {
        // アイテム管理タブがアクティブであることを確認
        const editTab = adminWindow.locator('.tab-button.active', { hasText: 'アイテム管理' });
        await expect(editTab).toBeVisible();
      });

      await test.step('グループアイテムが表示される', async () => {
        // グループアイテムが表示されることを確認
        const groupRow = adminWindow.locator('.raw-item-row', { hasText: '開発環境スタート' });
        await expect(groupRow).toBeVisible({ timeout: 5000 });

        // グループアイコン（📦）が表示されることを確認
        const groupIcon = groupRow.locator('.type-icon');
        const iconText = await groupIcon.textContent();
        expect(iconText?.includes('📦')).toBe(true);
      });

      await test.step('グループアイテムの詳細編集ボタンをクリック', async () => {
        const groupRow = adminWindow.locator('.raw-item-row', { hasText: '開発環境スタート' });
        const editButton = groupRow.locator('button.detail-edit-button');
        await editButton.click();

        // 登録モーダルが開いたことを確認
        const modal = adminWindow.locator('.register-modal');
        await expect(modal).toBeVisible();
      });

      await test.step('モーダルでグループ名を編集', async () => {
        const groupNameInput = adminWindow
          .locator('.register-modal input[placeholder*="グループ名を入力"]')
          .first();
        await groupNameInput.fill('開発環境スタート管理画面編集');
      });

      await test.step('更新ボタンをクリック', async () => {
        const updateButton = adminWindow.locator('.register-modal button.primary').first();
        await updateButton.click();

        // data.txtに保存されたことを確認
        const dataContent = configHelper.readDataFile('data.txt');
        expect(dataContent).toContain('開発環境スタート管理画面編集');
      });

      await test.step('メイン画面に変更が反映される', async () => {
        const updatedGroup = mainWindow.locator('.item', {
          hasText: '開発環境スタート管理画面編集',
        });
        await expect(updatedGroup).toBeVisible({ timeout: 3000 });
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('管理画面でグループアイテムを削除できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('グループアイテムを削除', async () => {
        const groupRow = adminWindow.locator('.raw-item-row', { hasText: '開発環境スタート' });
        const deleteButton = groupRow.locator('button.delete-button');

        // 削除ボタンをクリック（カスタムConfirmDialogが表示される）
        await deleteButton.click();

        // カスタムConfirmDialogの確認ボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // ダイアログが閉じたことを確認
        const confirmDialog = adminWindow.locator('.confirm-dialog');
        await expect(confirmDialog).not.toBeVisible();

        // グループアイテムが表示されなくなったことを確認
        const groupRowAfter = adminWindow.locator('.raw-item-row', { hasText: '開発環境スタート' });
        await expect(groupRowAfter).not.toBeVisible();
      });

      await test.step('保存して確認', async () => {
        const saveButton = adminWindow.locator('button.save-changes-button');
        await saveButton.click();

        const dataContent = configHelper.readDataFile('data.txt');
        expect(dataContent).not.toContain('開発環境スタート');
      });

      await test.step('メイン画面から削除される', async () => {
        const deletedGroup = mainWindow.locator('.item', { hasText: '開発環境スタート' });
        await expect(deletedGroup).not.toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });
});
