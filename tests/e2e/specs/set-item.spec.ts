import * as fs from 'fs';
import * as path from 'path';

import { isJsonSetItem } from '@common/types';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * セット（グループとウィンドウ配置を統合した種別）の E2E
 *
 * with-groups テンプレートは旧形式のグループのまま置いてあり、読み込み時のセットへの変換も確かめる
 */
test.describe('QuickDashLauncher - セットの登録・編集・変換', () => {
  test.beforeEach(async ({ configHelper, mainWindow }) => {
    configHelper.loadTemplate('with-groups');

    const utils = new TestUtils(mainWindow);
    await mainWindow.reload();
    await utils.waitForPageLoad();
  });

  test('旧形式のグループは読み込み時にセットに変換され、変換前のファイルが残る', async ({
    mainWindow,
    configHelper,
  }) => {
    await test.step('メイン画面にセットとして表示される', async () => {
      for (const name of ['開発環境スタート', 'Web開発セット', 'ドキュメント作成']) {
        const row = mainWindow.locator('.item', { hasText: name });
        await expect(row).toBeVisible({ timeout: 5000 });
      }
      const icon = mainWindow
        .locator('.item', { hasText: '開発環境スタート' })
        .locator('.item-icon');
      expect((await icon.textContent())?.includes('📦')).toBe(true);
    });

    await test.step('data.json の中身がセットになり、名前は id に置き換わる', async () => {
      const item = configHelper.getItemByDisplayName('data.json', '開発環境スタート');
      expect(item?.type).toBe('set');
      if (item && isJsonSetItem(item)) {
        // VS Code, GitHub, Stack Overflow, メモ帳
        expect(item.entries).toEqual([
          { itemId: 'grp00005' },
          { itemId: 'grp00001' },
          { itemId: 'grp00004' },
          { itemId: 'grp00006' },
        ]);
      }
    });

    await test.step('変換前のスナップショットが backup に残る', async () => {
      const backupDir = path.join(configHelper.getConfigDir(), 'backup');
      const snapshots = fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [];
      expect(snapshots.some((name) => name.endsWith('_pre-set-migration'))).toBe(true);
    });
  });

  test('新規セットを登録できる（どのタブのアイテムも選べる）', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);

    await test.step('種類でセットを選ぶ', async () => {
      await utils.openRegisterModal(electronApp);
      const typeSelect = utils.registerPage.locator('.register-modal select').nth(1);
      await typeSelect.selectOption({ value: 'set' });
      await utils.registerPage
        .locator('.register-modal input[placeholder*="セットの名前を入力"]')
        .first()
        .fill('テストセット');
    });

    await test.step('アイテムを追加する画面で 2 件選んで追加する', async () => {
      await utils.registerPage
        .locator('.register-modal button', { hasText: 'アイテムを追加' })
        .click();
      const picker = utils.registerPage.locator('.set-picker-modal');
      await expect(picker).toBeVisible();
      await picker.locator('.set-picker-row', { hasText: 'GitHub' }).locator('input').check();
      await picker.locator('.set-picker-row', { hasText: 'Google' }).locator('input').check();
      await picker.locator('button', { hasText: '2 件を追加' }).click();
      await expect(picker).not.toBeVisible();

      const rows = utils.registerPage.locator('.register-modal .set-editor-row');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText('GitHub');
      await expect(rows.nth(1)).toContainText('Google');
    });

    await test.step('登録すると、行は id で保存される', async () => {
      await utils.clickRegisterButton();
      expect(await utils.isRegisterModalVisible()).toBe(false);
      await expect(mainWindow.locator('.item', { hasText: 'テストセット' })).toBeVisible();

      const item = configHelper.getItemByDisplayName('data.json', 'テストセット');
      expect(item?.type).toBe('set');
      if (item && isJsonSetItem(item)) {
        expect(item.entries).toEqual([{ itemId: 'grp00001' }, { itemId: 'grp00002' }]);
      }
    });
  });

  test('行が無いセットは登録できず、追加済みのアイテムは選べない', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);

    await test.step('行が無いと登録できない', async () => {
      await utils.openRegisterModal(electronApp);
      await utils.registerPage
        .locator('.register-modal select')
        .nth(1)
        .selectOption({ value: 'set' });
      await utils.registerPage
        .locator('.register-modal input[placeholder*="セットの名前を入力"]')
        .first()
        .fill('空のセット');
      await utils.registerPage
        .locator('.register-modal .modal-actions button:is(:has-text("登録"), :has-text("保存"))')
        .first()
        .click();
      expect(await utils.isRegisterModalVisible()).toBe(true);
      await expect(utils.registerPage.locator('.error-message').first()).toContainText(
        'セットに行を 1 つ以上入れてください'
      );
    });

    await test.step('追加済みのアイテムはチェックできない', async () => {
      const addButton = utils.registerPage.locator('.register-modal button', {
        hasText: 'アイテムを追加',
      });
      await addButton.click();
      const picker = utils.registerPage.locator('.set-picker-modal');
      await picker.locator('.set-picker-row', { hasText: 'GitHub' }).locator('input').check();
      await picker.locator('button', { hasText: '1 件を追加' }).click();

      await addButton.click();
      const githubRow = picker.locator('.set-picker-row', { hasText: 'GitHub' });
      await expect(githubRow.locator('input')).toBeDisabled();
      await expect(githubRow).toContainText('追加済み');
      await picker.locator('button', { hasText: 'キャンセル' }).click();
      await utils.clickCancelButton();
    });
  });

  test('ウィンドウを追加は検索で絞り込め、ウィンドウ位置を更新は行が無いと押せない', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.openRegisterModal(electronApp);
    await utils.registerPage
      .locator('.register-modal select')
      .nth(1)
      .selectOption({ value: 'set' });

    await test.step('行が無いあいだは「ウィンドウ位置を更新」を押せない', async () => {
      await expect(
        utils.registerPage.locator('.register-modal button', { hasText: 'ウィンドウ位置を更新' })
      ).toBeDisabled();
    });

    await test.step('ウィンドウを追加の画面で、合わない言葉で絞ると何も出ず、追加も押せない', async () => {
      await utils.registerPage
        .locator('.register-modal button', { hasText: 'ウィンドウを追加' })
        .click();
      const modal = utils.registerPage.locator('.set-addwin-modal');
      await expect(modal).toBeVisible();
      await expect(modal.locator('h3')).toHaveText('ウィンドウを追加');
      await expect(modal.locator('.set-search')).toBeFocused();
      await modal.locator('.set-search').fill('合うウィンドウが無いはずの言葉zzqx');
      await expect(modal.locator('.set-empty')).toHaveText(
        /合うウィンドウがありません|開いているウィンドウがありません/
      );
      await expect(modal.locator('button', { hasText: '表示中をすべて選ぶ' })).toBeDisabled();
      await expect(modal.getByRole('button', { name: '追加', exact: true })).toBeDisabled();
      await modal.locator('button', { hasText: 'キャンセル' }).click();
      await expect(modal).not.toBeVisible();
    });

    await utils.clickCancelButton();
  });

  test('管理画面でセットの名前を変えて保存できる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      const adminUtils = new TestUtils(adminWindow);
      let detailWindow = adminWindow;

      await test.step('セットの詳細編集を開く', async () => {
        const row = adminWindow.locator('.raw-item-row', { hasText: '開発環境スタート' });
        await expect(row).toBeVisible({ timeout: 5000 });
        expect((await row.locator('.type-icon').textContent())?.includes('📦')).toBe(true);
        await row.locator('button.detail-edit-button').click();
        detailWindow = await adminUtils.waitForRegisterWindow(electronApp);
        await expect(detailWindow.locator('.register-modal .set-editor-row')).toHaveCount(4);
      });

      await test.step('名前を変えて更新し、保存する', async () => {
        await detailWindow
          .locator('.register-modal input[placeholder*="セットの名前を入力"]')
          .first()
          .fill('開発環境スタート改');
        const updateButton = detailWindow
          .locator('.register-modal .modal-actions button:is(:has-text("登録"), :has-text("保存"))')
          .first();
        await adminUtils.closeRegisterModalBy(() => updateButton.click());

        await adminWindow.locator('button:has-text("変更を保存")').click();
        const confirmButton = adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        const item = configHelper.getItemByDisplayName('data.json', '開発環境スタート改');
        expect(item?.type).toBe('set');
        if (item && isJsonSetItem(item)) expect(item.entries).toHaveLength(4);
      });
    } finally {
      await adminWindow.close();
    }
  });
  test('行をドラッグで並べ替えられ、ファイルのドロップ先は出ない', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.openRegisterModal(electronApp);
    const page = utils.registerPage;
    await page.locator('.register-modal select').nth(1).selectOption({ value: 'set' });
    await page.locator('.register-modal button', { hasText: 'アイテムを追加' }).click();
    const picker = page.locator('.set-picker-modal');
    for (const name of ['GitHub', 'Google', 'メモ帳']) {
      await picker.locator('.set-picker-row', { hasText: name }).locator('input').check();
    }
    await picker.locator('button', { hasText: '3 件を追加' }).click();
    const rows = page.locator('.register-modal .set-editor-row');
    await expect(rows).toHaveCount(3);
    const before = await rows.allInnerTexts();

    // 3 行目を 1 行目に重ねる
    await rows.nth(2).dragTo(rows.nth(0));
    await expect(page.locator('.drag-overlay')).toHaveCount(0);
    const after = await rows.allInnerTexts();
    expect(after[0]).toBe(before[2]);
    expect(after[1]).toBe(before[0]);
    expect(after[2]).toBe(before[1]);
    await utils.clickCancelButton();
  });
});
