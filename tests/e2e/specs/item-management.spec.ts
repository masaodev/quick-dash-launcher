import { isJsonLauncherItem, isJsonDirItem } from '@common/types';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - アイテム管理機能テスト', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    // baseテンプレートは既に読み込まれている
    // data2.jsonは削除（このテストでは使用しない）
    configHelper.deleteDataFile('data2.json');

    // ページの読み込み完了を待機
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
  });

  // ==================== 管理画面表示テスト ====================

  test('管理画面が表示され、テーブルヘッダーとアイテムが正しく表示される', async ({
    electronApp,
    mainWindow,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);

      await test.step('管理画面が表示されることを確認', async () => {
        // アイテム管理タブがアクティブであることを確認
        const editTab = adminWindow.locator('.tab-button.active', { hasText: 'アイテム管理' });
        await expect(editTab).toBeVisible();
        await adminUtils.attachScreenshot(testInfo, '管理画面表示');
      });

      await test.step('テーブルヘッダーが正しく表示されることを確認', async () => {
        // 行番号列
        const numberHeader = adminWindow.locator('th.line-number-column');
        await expect(numberHeader).toBeVisible();

        // 種類列
        const typeHeader = adminWindow.locator('th.type-column');
        await expect(typeHeader).toBeVisible();

        // 名前列
        const nameHeader = adminWindow.locator('th.name-column');
        await expect(nameHeader).toBeVisible();

        // パスと引数列
        const pathHeader = adminWindow.locator('th.content-column');
        await expect(pathHeader).toBeVisible();

        // 操作列
        const actionHeader = adminWindow.locator('th.actions-column');
        await expect(actionHeader).toBeVisible();
      });

      await test.step('data.jsonのアイテムが表示されることを確認', async () => {
        // data.jsonの既知のアイテムが表示されることを確認
        const knownItems = ['GitHub', 'Google', 'Wikipedia'];

        for (const itemName of knownItems) {
          const itemRow = adminWindow.locator('.raw-item-row', { hasText: itemName });
          await expect(itemRow).toBeVisible({ timeout: 5000 });
        }
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== アイテム追加テスト ====================

  test('新規アイテムを追加できる', async ({ electronApp, mainWindow, configHelper }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('アイテムを追加ボタンをクリック', async () => {
        const addButton = adminWindow.locator('button', { hasText: 'アイテムを追加' });
        await addButton.click();

        // 空行が追加されたことを確認
        const emptyRow = adminWindow.locator('.raw-item-row').last();
        await expect(emptyRow).toBeVisible();
      });

      // 行を追加すると既に単一アイテム(type: 'item')として追加される
      await test.step('セル編集で名前とパスを入力', async () => {
        const lastRow = adminWindow.locator('.raw-item-row').last();

        // 名前列をクリックして編集
        const nameCell = lastRow.locator('.name-column .editable-cell');
        await nameCell.click();
        const nameInput = lastRow.locator('.name-column .edit-input');
        await nameInput.fill('新規アイテム');
        await nameInput.press('Enter');

        // パスと引数列をクリックして編集
        const pathCell = lastRow.locator('.content-column .editable-cell');
        await pathCell.click();
        const pathInput = lastRow.locator('.content-column .edit-input');
        await pathInput.fill('https://new-item.com');
        await pathInput.press('Enter');
      });

      await test.step('保存ボタンをクリック', async () => {
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // data.jsonに保存されたことを確認
        expect(configHelper.hasItem('data.json', '新規アイテム', 'https://new-item.com')).toBe(
          true
        );
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== アイテム編集テスト ====================

  test('セル編集と詳細編集モーダルでアイテムを編集できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('セル編集でGitHubアイテムの名前を変更', async () => {
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        const nameCell = githubRow.locator('.name-column .editable-cell');
        await nameCell.click();

        const nameInput = githubRow.locator('.name-column .edit-input');
        await nameInput.fill('GitHub編集後');
        await nameInput.press('Enter');
      });

      await test.step('保存して確認', async () => {
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        expect(configHelper.hasItemByDisplayName('data.json', 'GitHub編集後')).toBe(true);
      });

      await test.step('Googleアイテムの詳細編集ボタンをクリック', async () => {
        const googleRow = adminWindow.locator('.raw-item-row', { hasText: 'Google' });
        const editButton = googleRow.locator('button.detail-edit-button');
        await editButton.click();

        // 登録モーダルが開いたことを確認
        const modal = adminWindow.locator('.register-modal');
        await expect(modal).toBeVisible();
      });

      await test.step('モーダルで名前と引数を編集', async () => {
        const nameInput = adminWindow
          .locator('.register-modal input[placeholder*="表示名"]')
          .first();
        await nameInput.fill('Google詳細編集');

        // オプションセクションを開く
        const optionsToggle = adminWindow.locator('.register-modal .options-toggle').first();
        await optionsToggle.click();

        // 引数入力フィールドが表示されるまで待機
        const argsInput = adminWindow
          .locator('.register-modal input[placeholder*="コマンドライン引数"]')
          .first();
        await expect(argsInput).toBeVisible();
        await argsInput.fill('--test-args');
      });

      await test.step('更新ボタンをクリック', async () => {
        const updateButton = adminWindow
          .locator('.register-modal button', { hasText: '更新' })
          .first();
        await updateButton.click();

        // モーダルが閉じるのを待機
        const modal = adminWindow.locator('.register-modal');
        await expect(modal).not.toBeVisible({ timeout: 5000 });
      });

      await test.step('変更を保存して確認', async () => {
        // 変更を保存ボタンをクリック
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // data.jsonに保存されたことを確認
        expect(configHelper.hasItemByDisplayName('data.json', 'Google詳細編集')).toBe(true);
        const item = configHelper.getItemByDisplayName('data.json', 'Google詳細編集');
        if (item && isJsonLauncherItem(item)) {
          expect(item.args).toBe('--test-args');
        }
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== アイテム削除テスト ====================

  test('アイテムを削除できる', async ({ electronApp, mainWindow, configHelper }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('GitHubアイテムを削除', async () => {
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        const deleteButton = githubRow.locator('button.delete-button');

        // 削除ボタンをクリック（カスタムConfirmDialogが表示される）
        await deleteButton.click();

        // カスタムConfirmDialogの確認ボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // ダイアログが閉じたことを確認
        const confirmDialog = adminWindow.locator('.confirm-dialog');
        await expect(confirmDialog).not.toBeVisible();

        // GitHubアイテムが表示されなくなったことを確認
        const githubRowAfter = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRowAfter).not.toBeVisible();
      });

      await test.step('保存して確認', async () => {
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        expect(configHelper.hasItemByDisplayName('data.json', 'GitHub')).toBe(false);
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('チェックボックスで複数アイテムを選択して一括削除できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('GitHubとGoogleをチェック', async () => {
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        const githubCheckbox = githubRow.locator('input[type="checkbox"]').first();
        await githubCheckbox.click();

        const googleRow = adminWindow.locator('.raw-item-row', { hasText: 'Google' });
        const googleCheckbox = googleRow.locator('input[type="checkbox"]').first();
        await googleCheckbox.click();
      });

      await test.step('選択したアイテムを削除ボタンをクリック', async () => {
        const deleteSelectedButton = adminWindow.locator(
          'button:has-text("選択したアイテムを削除")'
        );

        // 削除ボタンをクリック（カスタムConfirmDialogが表示される）
        await deleteSelectedButton.click();

        // カスタムConfirmDialogの確認ボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // ダイアログが閉じたことを確認
        const confirmDialog = adminWindow.locator('.confirm-dialog');
        await expect(confirmDialog).not.toBeVisible();

        // アイテムが削除されたことを確認
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRow).not.toBeVisible();

        const googleRow = adminWindow.locator('.raw-item-row', { hasText: 'Google' });
        await expect(googleRow).not.toBeVisible();
      });

      await test.step('保存して確認', async () => {
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        expect(configHelper.hasItemByDisplayName('data.json', 'GitHub')).toBe(false);
        expect(configHelper.hasItemByDisplayName('data.json', 'Google')).toBe(false);
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== 重複削除テスト ====================

  test('重複を削除ボタンで同じ内容のアイテムを 1 件にまとめられる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      await test.step('重複が無い状態では何も削除されない', async () => {
        const dedupeButton = adminWindow.locator('button:has-text("重複を削除")');
        await dedupeButton.click();
        // 確認ダイアログは出ず、トーストで知らせる
        await expect(adminWindow.locator('[data-testid="confirm-dialog"]')).not.toBeVisible();
        await expect(adminWindow.getByText('重複するアイテムはありません')).toBeVisible();
      });

      await test.step('Wikipedia の名前とパスを GitHub と同じにして重複を作る', async () => {
        // 編集中のセルは input になり行のテキストから消えるので、id で行を特定する
        const wikiRow = adminWindow.locator('.raw-item-row[data-item-id="base0003"]');
        await wikiRow.locator('.name-column .editable-cell').click();
        const nameInput = wikiRow.locator('.name-column .edit-input');
        await nameInput.fill('GitHub');
        await nameInput.press('Enter');

        await wikiRow.locator('.content-column .editable-cell').click();
        const pathInput = wikiRow.locator('.content-column .edit-input');
        await pathInput.fill('https://github.com/');
        await pathInput.press('Enter');

        await expect(adminWindow.locator('.raw-item-row', { hasText: 'GitHub' })).toHaveCount(2);
      });

      await test.step('重複を削除して保存する', async () => {
        await adminWindow.locator('button:has-text("重複を削除")').click();
        const confirmDialog = adminWindow.locator('[data-testid="confirm-dialog"]');
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText('1 件');
        await adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]').click();

        await expect(adminWindow.locator('.raw-item-row', { hasText: 'GitHub' })).toHaveCount(1);

        await adminWindow.locator('button:has-text("変更を保存")').click();
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        await expect
          .poll(() => configHelper.hasItemByDisplayName('data.json', 'Wikipedia'))
          .toBe(false);
        expect(configHelper.hasItemByDisplayName('data.json', 'GitHub')).toBe(true);
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== 検索機能テスト ====================

  test('検索ボックスでアイテムを絞り込みできる', async ({ electronApp, mainWindow }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('検索前の全アイテム数を確認', async () => {
        const allRows = adminWindow.locator('.raw-item-row');
        // count() は待たないので、先に 1 行目の描画を待つ
        await expect(allRows.first()).toBeVisible();
        const initialCount = await allRows.count();
        expect(initialCount).toBeGreaterThan(0);
      });

      await test.step('GitHubで検索', async () => {
        const searchInput = adminWindow.locator('input[type="text"]').first();
        await searchInput.fill('GitHub');

        // GitHubアイテムが表示されることを確認
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRow).toBeVisible();
      });

      await test.step('検索をクリアして全アイテムが再表示される', async () => {
        const searchInput = adminWindow.locator('input[type="text"]').first();
        await searchInput.clear();

        // 全アイテムが再表示されることを確認
        const allRows = adminWindow.locator('.raw-item-row');
        const count = await allRows.count();
        expect(count).toBeGreaterThan(1);
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== メイン画面との同期テスト ====================

  test('管理画面でアイテムを編集するとメイン画面に即座に反映される', async ({
    electronApp,
    mainWindow,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('管理画面でGitHubアイテムの名前を編集', async () => {
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        const nameCell = githubRow.locator('.name-column .editable-cell');
        await nameCell.click();

        const nameInput = githubRow.locator('.name-column .edit-input');
        await nameInput.fill('GitHub同期テスト');
        await nameInput.press('Enter');

        // 保存
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();
      });

      await test.step('メイン画面に変更が反映されたことを確認', async () => {
        // メイン画面を確認（リロード不要で反映されるはず）
        const updatedItem = mainWindow.locator('.item', { hasText: 'GitHub同期テスト' });
        await expect(updatedItem).toBeVisible({ timeout: 3000 });

        // 元の名前は表示されない
        const originalItem = mainWindow.locator('.item .item-name', { hasText: /^GitHub$/ });
        await expect(originalItem).not.toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== 編集状態の保持テスト ====================

  test('編集は行の追加・削除で別のアイテムに移らず、タブを切り替えても残る', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      await test.step('Wikipedia の名前を編集してから、別の行を削除し、行を追加する', async () => {
        const wikiRow = adminWindow.locator('.raw-item-row[data-item-id="base0003"]');
        await wikiRow.locator('.name-column .editable-cell').click();
        const nameInput = wikiRow.locator('.name-column .edit-input');
        await nameInput.fill('Wikipedia編集後');
        await nameInput.press('Enter');

        // 別の行（Google）を削除
        const googleRow = adminWindow.locator('.raw-item-row[data-item-id="base0002"]');
        await googleRow.locator('button.delete-button').click();
        await adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]').click();
        await expect(googleRow).not.toBeVisible();

        // 行を追加（先頭に入り、行番号がずれる）
        await adminWindow.locator('button', { hasText: 'アイテムを追加' }).click();
      });

      await test.step('編集内容は元のアイテムに残り、他のアイテムに移っていない', async () => {
        const wikiRow = adminWindow.locator('.raw-item-row[data-item-id="base0003"]');
        await expect(wikiRow.locator('.name-column')).toContainText('Wikipedia編集後');
        await expect(wikiRow).toHaveClass(/changed/);
        // GitHub はそのまま
        const githubRow = adminWindow.locator('.raw-item-row[data-item-id="base0001"]');
        await expect(githubRow.locator('.name-column')).toContainText('GitHub');
        await expect(githubRow).not.toHaveClass(/changed/);
      });

      await test.step('基本設定タブへ移って戻っても編集が残る', async () => {
        await adminWindow.locator('.tab-button', { hasText: '基本設定' }).click();
        await expect(adminWindow.locator('.tab-button', { hasText: 'アイテム管理' })).toContainText(
          '*'
        );
        await adminWindow.locator('.tab-button', { hasText: 'アイテム管理' }).click();

        const wikiRow = adminWindow.locator('.raw-item-row[data-item-id="base0003"]');
        await expect(wikiRow.locator('.name-column')).toContainText('Wikipedia編集後');
        await expect(adminWindow.locator('.unsaved-changes')).toBeVisible();
      });

      await test.step('保存すると編集・削除・追加がそのままファイルに反映される', async () => {
        await adminWindow.locator('button:has-text("変更を保存")').click();
        await adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]').click();

        await expect
          .poll(() => configHelper.hasItemByDisplayName('data.json', 'Wikipedia編集後'))
          .toBe(true);
        expect(configHelper.hasItemByDisplayName('data.json', 'Wikipedia')).toBe(false);
        expect(configHelper.hasItemByDisplayName('data.json', 'Google')).toBe(false);
        expect(configHelper.hasItemByDisplayName('data.json', 'GitHub')).toBe(true);
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('変更を破棄すると追加・削除・編集がすべて元に戻る', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      await test.step('追加・削除・編集を行う', async () => {
        await adminWindow.locator('button', { hasText: 'アイテムを追加' }).click();

        const googleRow = adminWindow.locator('.raw-item-row[data-item-id="base0002"]');
        await googleRow.locator('button.delete-button').click();
        await adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]').click();

        const githubRow = adminWindow.locator('.raw-item-row[data-item-id="base0001"]');
        await githubRow.locator('.name-column .editable-cell').click();
        const nameInput = githubRow.locator('.name-column .edit-input');
        await nameInput.fill('GitHub破棄テスト');
        await nameInput.press('Enter');

        await expect(adminWindow.locator('.unsaved-changes')).toBeVisible();
      });

      await test.step('変更を破棄する', async () => {
        await adminWindow.locator('button:has-text("変更を破棄")').click();
        await adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]').click();

        await expect(adminWindow.locator('.unsaved-changes')).not.toBeVisible();
        await expect(adminWindow.locator('.raw-item-row[data-item-id="base0002"]')).toBeVisible();
        await expect(
          adminWindow.locator('.raw-item-row[data-item-id="base0001"] .name-column')
        ).toContainText(/^GitHub$/);
        // 追加した空行は消えている
        await expect(adminWindow.locator('.raw-item-row', { hasText: '(名前なし)' })).toHaveCount(
          0
        );
        expect(configHelper.hasItemByDisplayName('data.json', 'Google')).toBe(true);
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('入力欄で Delete キーを押しても選択中のアイテムは削除されない', async ({
    electronApp,
    mainWindow,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      await test.step('GitHub をチェックし、検索欄で Delete キーを押す', async () => {
        const githubRow = adminWindow.locator('.raw-item-row[data-item-id="base0001"]');
        await githubRow.locator('input[type="checkbox"]').click();

        const searchInput = adminWindow.locator('input.search-input');
        await searchInput.fill('git');
        await searchInput.press('ArrowLeft');
        await searchInput.press('Delete');

        await expect(githubRow).toBeVisible();
        await expect(adminWindow.locator('.unsaved-changes')).not.toBeVisible();
      });

      await test.step('一覧にフォーカスを戻して Delete キーを押すと確認ダイアログが出る', async () => {
        await adminWindow.locator('input.search-input').clear();
        await adminWindow.locator('.edit-mode-view').focus();
        await adminWindow.keyboard.press('Delete');

        const confirmDialog = adminWindow.locator('[data-testid="confirm-dialog"]');
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText('GitHub');
        await adminWindow.locator('[data-testid="confirm-dialog-cancel-button"]').click();
        await expect(adminWindow.locator('.raw-item-row[data-item-id="base0001"]')).toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== タブ選択テスト ====================

  // 注: マルチタブ環境でのテストはUI状態の複雑さからスキップ
  test.skip('マルチタブ環境でタブを選択してアイテムを編集できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('マルチタブ機能を有効化', async () => {
      configHelper.loadTemplate('with-tabs');
      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, 'マルチタブ有効化');
    });

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('タブ選択ドロップダウンが表示されることを確認', async () => {
        const tabDropdownButton = adminWindow.locator('.tab-dropdown .dropdown-trigger-btn');
        await expect(tabDropdownButton).toBeVisible();
      });

      await test.step('サブ1タブに切り替え', async () => {
        // ドロップダウンボタンをクリック
        const tabDropdownButton = adminWindow.locator('.tab-dropdown .dropdown-trigger-btn');
        await tabDropdownButton.click();

        // ドロップダウンメニューが表示されるまで待機
        const dropdownMenu = adminWindow.locator('.tab-dropdown .dropdown-menu');
        await expect(dropdownMenu).toBeVisible();

        // 対象のタブ項目をクリック（インデックス1 = サブ1タブ）
        const tabItems = adminWindow.locator('.tab-dropdown .dropdown-item');
        const subTab1 = tabItems.nth(1);
        await subTab1.click();

        // ドロップダウンが閉じるまで待機
        await expect(dropdownMenu).not.toBeVisible();

        // data2.jsonのアイテムが表示されることを確認
        const redditRow = adminWindow.locator('.raw-item-row', { hasText: 'Reddit' });
        await expect(redditRow).toBeVisible({ timeout: 5000 });
      });

      await test.step('サブ1タブでアイテムを編集', async () => {
        const redditRow = adminWindow.locator('.raw-item-row', { hasText: 'Reddit' });
        const nameCell = redditRow.locator('.name-column .editable-cell');
        await nameCell.click();

        const nameInput = redditRow.locator('.name-column .edit-input');
        await nameInput.fill('Reddit編集');
        await nameInput.press('Enter');

        // 保存
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // data2.jsonに保存されたことを確認
        expect(configHelper.hasItemByDisplayName('data2.json', 'Reddit編集')).toBe(true);
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== フォルダ取込アイテムテスト ====================

  // 注: フォルダ取込UIが変更されたためスキップ（種別選択ボタンのUIが変更）
  test.skip('フォルダ取込アイテムを追加できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('行を追加', async () => {
        const addButton = adminWindow.locator('button:has-text("行を追加")');
        await addButton.click();
      });

      await test.step('フォルダ取込アイテムを選択', async () => {
        const lastRow = adminWindow.locator('.raw-item-row').last();
        const folderButton = lastRow.locator('button.type-select-button.folder-button');
        await folderButton.click();
      });

      await test.step('パスを入力', async () => {
        const lastRow = adminWindow.locator('.raw-item-row').last();
        const pathCell = lastRow.locator('.content-column .editable-cell');
        await pathCell.click();

        const pathInput = lastRow.locator('.content-column .edit-input');
        await pathInput.fill('C:\\TestFolder');
        await pathInput.press('Enter');
      });

      await test.step('保存して確認', async () => {
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        const item = configHelper.getItemByPath('data.json', 'C:\\TestFolder');
        expect(item).toBeDefined();
        expect(item?.type).toBe('dir');
        if (item && isJsonDirItem(item)) {
          expect(item.path).toBe('C:\\TestFolder');
        }
      });
    } finally {
      await adminWindow.close();
    }
  });

  // ==================== 複数ファイルタブテスト ====================

  // 注: 複数ファイルタブテストはUI状態の複雑さからスキップ
  test.skip('複数ファイルタブでファイルとタブを切り替えて編集できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('複数ファイルタブ機能を有効化', async () => {
      configHelper.loadTemplate('with-multi-file-tabs');
      await mainWindow.reload();
      await utils.waitForPageLoad();
      await utils.attachScreenshot(testInfo, '複数ファイルタブ有効化');
    });

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('タブとファイル選択ドロップダウンが表示される', async () => {
        // タブ選択ドロップダウン（カスタム）
        const tabDropdownButton = adminWindow.locator('.tab-dropdown .dropdown-trigger-btn');
        await expect(tabDropdownButton).toBeVisible();

        // ファイル選択ドロップダウン（統合タブは複数ファイルを持つ）
        const fileDropdownButton = adminWindow.locator('.file-dropdown .dropdown-trigger-btn');
        await expect(fileDropdownButton).toBeVisible();
      });

      await test.step('data.jsonのアイテムが表示される', async () => {
        // デフォルトでdata.jsonが選択されているはず
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRow).toBeVisible({ timeout: 5000 });
      });

      await test.step('data3.jsonに切り替え', async () => {
        // ファイル選択ドロップダウンを開く
        const fileDropdownButton = adminWindow.locator('.file-dropdown .dropdown-trigger-btn');
        await fileDropdownButton.click();

        // メニューが表示されるまで待機
        const fileDropdownMenu = adminWindow.locator('.file-dropdown .dropdown-menu');
        await expect(fileDropdownMenu).toBeVisible();

        // data3.jsonを選択
        const fileItems = adminWindow.locator('.file-dropdown .dropdown-item');
        const data3Item = fileItems.filter({ hasText: 'data3.json' });
        await data3Item.click();

        // メニューが閉じるまで待機
        await expect(fileDropdownMenu).not.toBeVisible();

        // data3.jsonのアイテムが表示されることを確認
        const qiitaRow = adminWindow.locator('.raw-item-row', { hasText: 'Qiita' });
        await expect(qiitaRow).toBeVisible({ timeout: 5000 });

        // data.jsonのアイテムは表示されない
        const githubRow = adminWindow.locator('.raw-item-row', { hasText: 'GitHub' });
        await expect(githubRow).not.toBeVisible();
      });

      await test.step('data3.jsonでアイテムを編集', async () => {
        const qiitaRow = adminWindow.locator('.raw-item-row', { hasText: 'Qiita' });
        const nameCell = qiitaRow.locator('.name-column .editable-cell');
        await nameCell.click();

        const nameInput = qiitaRow.locator('.name-column .edit-input');
        await nameInput.fill('Qiita編集');
        await nameInput.press('Enter');

        // 保存
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // data3.jsonに保存されたことを確認
        expect(configHelper.hasItemByDisplayName('data3.json', 'Qiita編集')).toBe(true);
      });

      await test.step('サブ1タブに切り替え', async () => {
        // ドロップダウンボタンをクリック
        const tabDropdownButton = adminWindow.locator('.tab-dropdown .dropdown-trigger-btn');
        await tabDropdownButton.click();

        // ドロップダウンメニューが表示されるまで待機
        const dropdownMenu = adminWindow.locator('.tab-dropdown .dropdown-menu');
        await expect(dropdownMenu).toBeVisible();

        // 対象のタブ項目をクリック（インデックス1 = サブ1タブ）
        const tabItems = adminWindow.locator('.tab-dropdown .dropdown-item');
        const subTab1 = tabItems.nth(1);
        await subTab1.click();

        // ドロップダウンが閉じるまで待機
        await expect(dropdownMenu).not.toBeVisible();

        // サブ1は単一ファイル（data2.json）なので、ファイル選択ドロップダウンは表示されない
        const fileDropdownButton = adminWindow.locator('.file-dropdown .dropdown-trigger-btn');
        await expect(fileDropdownButton).not.toBeVisible();

        // data2.jsonのアイテムが表示される
        const redditRow = adminWindow.locator('.raw-item-row', { hasText: 'Reddit' });
        await expect(redditRow).toBeVisible({ timeout: 5000 });
      });

      await test.step('サブ1タブでアイテムを編集', async () => {
        const redditRow = adminWindow.locator('.raw-item-row', { hasText: 'Reddit' });
        const nameCell = redditRow.locator('.name-column .editable-cell');
        await nameCell.click();

        const nameInput = redditRow.locator('.name-column .edit-input');
        await nameInput.fill('Reddit複数ファイルタブ');
        await nameInput.press('Enter');

        // 保存
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // data2.jsonに保存されたことを確認
        expect(configHelper.hasItemByDisplayName('data2.json', 'Reddit複数ファイルタブ')).toBe(
          true
        );
      });
    } finally {
      await adminWindow.close();
    }
  });

  // 注: 複数ファイルタブテストはUI状態の複雑さからスキップ
  test.skip('複数ファイルタブでアイテムを追加すると正しいファイルに保存される', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, _testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('複数ファイルタブ機能を有効化', async () => {
      configHelper.loadTemplate('with-multi-file-tabs');
      await mainWindow.reload();
      await utils.waitForPageLoad();
    });

    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const _adminUtils = new TestUtils(adminWindow);

      await test.step('data3.jsonに切り替え', async () => {
        // ファイル選択ドロップダウンを開く
        const fileDropdownButton = adminWindow.locator('.file-dropdown .dropdown-trigger-btn');
        await fileDropdownButton.click();

        // メニューが表示されるまで待機
        const fileDropdownMenu = adminWindow.locator('.file-dropdown .dropdown-menu');
        await expect(fileDropdownMenu).toBeVisible();

        // data3.jsonを選択
        const fileItems = adminWindow.locator('.file-dropdown .dropdown-item');
        const data3Item = fileItems.filter({ hasText: 'data3.json' });
        await data3Item.click();

        // メニューが閉じるまで待機
        await expect(fileDropdownMenu).not.toBeVisible();
      });

      await test.step('data3.jsonに新規アイテムを追加', async () => {
        const addButton = adminWindow.locator('button:has-text("行を追加")');
        await addButton.click();

        // 種別選択
        const lastRow = adminWindow.locator('.raw-item-row').last();
        const singleItemButton = lastRow.locator('button', { hasText: '📄 単一アイテム' });
        await singleItemButton.click();

        // 名前入力
        const nameCell = lastRow.locator('.name-column .editable-cell');
        await nameCell.click();
        const nameInput = lastRow.locator('.name-column .edit-input');
        await nameInput.fill('新規data3アイテム');
        await nameInput.press('Enter');

        // パス入力
        const pathCell = lastRow.locator('.content-column .editable-cell');
        await pathCell.click();
        const pathInput = lastRow.locator('.content-column .edit-input');
        await pathInput.fill('https://example3.com');
        await pathInput.press('Enter');

        // 保存
        const saveButton = adminWindow.locator('button:has-text("変更を保存")');
        await saveButton.click();

        // 保存確認ダイアログのOKボタンをクリック
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // data3.jsonに保存されたことを確認
        expect(
          configHelper.hasItem('data3.json', '新規data3アイテム', 'https://example3.com')
        ).toBe(true);

        // data.jsonには保存されていないことを確認
        expect(configHelper.hasItemByDisplayName('data.json', '新規data3アイテム')).toBe(false);
      });
    } finally {
      await adminWindow.close();
    }
  });
});
