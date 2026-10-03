import path from 'path';

import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { test } from '../e2e/fixtures/electron-app';
import { test as firstLaunchTest } from '../e2e/fixtures/first-launch-app';
import { TestUtils } from '../e2e/helpers/test-utils';

/**
 * 画面仕様書（docs/screens/）の画面イメージを撮る
 *
 * 撮影用のデータは tests/e2e/templates/screenshots/。本人の PC の情報（実際のウィンドウ一覧・
 * ブラウザのブックマークなど）が写る画面は撮らない
 */

const IMAGE_DIR = path.join(process.cwd(), 'docs', 'screens', 'images');

/** ページ全体、または要素だけを docs/screens/images/<name>.png に保存する */
async function shot(target: Page | Locator, name: string): Promise<void> {
  // アニメーション・カーソルの点滅が落ち着くのを待つ
  const page = 'page' in target ? target.page() : target;
  await page.waitForTimeout(500);
  await target.screenshot({ path: path.join(IMAGE_DIR, `${name}.png`), animations: 'disabled' });
}

/** about:blank で開いてから中身を書き込む子ウィンドウを、指定の要素が描かれるまで探す */
async function waitForWindowWith(
  electronApp: ElectronApplication,
  selector: string,
  exclude: Page[] = []
): Promise<Page> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    for (const win of electronApp.windows()) {
      if (win.isClosed() || exclude.includes(win)) continue;
      try {
        if ((await win.locator(selector).count()) > 0) {
          await win.locator(selector).first().waitFor({ state: 'visible', timeout: 5000 });
          return win;
        }
      } catch {
        // 書き込み前・閉じた直後のウィンドウは無視する
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${selector} を描いたウィンドウが見つかりません`);
}

/**
 * メイン画面の「アイコン未取得」から一括取得し、終わるまで待つ（アイコンの写った一覧を撮るため）
 *
 * Web サイトのファビコン取得にネットワークを使う
 */
async function fetchIcons(mainWindow: Page): Promise<void> {
  await mainWindow.locator('.missing-icon-notice button', { hasText: '取得' }).click();
  await mainWindow
    .locator('button[aria-label="詳細を表示"]')
    .waitFor({ state: 'visible', timeout: 45000 });
}

test.use({ configTemplate: 'screenshots' });

test.describe('画面仕様書の画面イメージ', () => {
  test('メインウィンドウ', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await fetchIcons(mainWindow);
    await mainWindow.locator('.progress-close-btn').click();
    // 閉じたときのマウス位置で選択が動くので、マウスを検索欄へ戻し、入力し直して選択を先頭に戻す
    await mainWindow.mouse.move(10, 10);
    await utils.searchFor('x');
    await utils.searchFor('');
    await shot(mainWindow, 'main-window');
  });

  test('管理ウィンドウ・ホットキー入力・共通ダイアログ', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await fetchIcons(mainWindow);
    const admin = await utils.openAdminWindow(electronApp, 'settings');
    await admin.waitForLoadState('domcontentloaded');
    await shot(admin, 'admin-window-settings');

    // ホットキー入力（通常時と入力待ち）
    const hotkeySection = admin.locator('.settings-section', { hasText: '起動ホットキー' });
    await shot(hotkeySection, 'hotkey-input');
    await hotkeySection.locator('.hotkey-input').first().click();
    await shot(hotkeySection, 'hotkey-input-recording');
    await admin.keyboard.press('Escape');

    // 確認ダイアログ（タブ管理で「仕事」タブを削除しようとする）
    await admin.locator('.settings-menu .menu-item', { hasText: 'タブ管理' }).first().click();
    const workTab = admin.locator('.tab-accordion-item', { hasText: '仕事' });
    await workTab.locator('.tab-delete-button').click();
    await admin.locator('[data-testid="confirm-dialog"]').waitFor({ state: 'visible' });
    await shot(admin, 'dialogs-confirm');
    await admin.locator('[data-testid="confirm-dialog-cancel-button"]').click();

    // アイテム管理タブ・ヘルプタブ
    await admin.locator('button', { hasText: 'アイテム管理' }).first().click();
    await admin.locator('.raw-item-row').first().waitFor({ state: 'visible' });
    await shot(admin, 'admin-window-items');
    await admin.locator('button', { hasText: 'ヘルプ' }).first().click();
    await shot(admin, 'admin-window-help');
  });

  test('ブックマーク取込画面', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const admin = await utils.openAdminWindow(electronApp, 'edit');
    await admin.waitForLoadState('domcontentloaded');

    // ネイティブのファイル選択ダイアログの代わりに、サンプルの HTML を返す
    const sample = path.join(process.cwd(), 'tests', 'e2e', 'fixtures', 'bookmarks-sample.html');
    await electronApp.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [p],
      })) as typeof dialog.showOpenDialog;
    }, sample);

    await admin
      .locator('.dropdown-trigger-btn', { hasText: 'アイテムを一括取り込み' })
      .first()
      .click();
    await admin.locator('.dropdown-item', { hasText: 'ブラウザのブックマークを追加' }).click();
    const modal = admin.locator('.auto-import-rule-modal.import-mode');
    await modal.waitFor({ state: 'visible' });
    // 本人のブラウザのブックマークが写らないよう、HTML ファイルに切り替えてから撮る
    await modal.locator('.browser-radio-group label', { hasText: 'HTML ファイル' }).click();
    await modal.locator('button', { hasText: 'ファイルを選択' }).click();
    await modal.locator('.folder-tree-item', { hasText: '開発' }).waitFor({ state: 'visible' });
    await shot(admin, 'bookmark-import-modal');
  });

  test('アイテム登録・編集と子画面', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await fetchIcons(mainWindow);
    const register = await utils.openRegisterModal(electronApp);
    await register.locator('.register-modal input').first().fill('サンプル');
    await shot(register, 'register-modal');

    // カスタムアイコンのファイル選択（共通ダイアログの FilePickerDialog）。オプション設定を開いてから選ぶ
    await register.locator('.options-toggle', { hasText: 'アイコン' }).click();
    await register.locator('.select-icon-btn-inline').click();
    await register.locator('.file-picker-dialog').waitFor({ state: 'visible' });
    await shot(register, 'dialogs-file-picker');
    // Escape だと登録画面ごと閉じてしまうので、キャンセルボタンで閉じる
    await register.locator('[data-testid="file-picker-cancel-button"]').click();
    await register.locator('.file-picker-dialog').waitFor({ state: 'hidden' });

    // フォルダ取込
    const typeSelect = register.locator('.register-modal select').nth(1);
    await typeSelect.selectOption({ value: 'dir' });
    await register.locator('.dir-options').waitFor({ state: 'visible' });
    await shot(register, 'dir-options-editor');

    // グループ → アイテム選択
    await typeSelect.selectOption({ value: 'group' });
    await register.locator('.register-modal button', { hasText: 'アイテムを追加' }).click();
    await register.locator('.group-item-selector-modal').waitFor({ state: 'visible' });
    await shot(register, 'group-item-selector-modal');
  });

  test('アイコン取得結果', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await fetchIcons(mainWindow);
    await mainWindow.locator('button[aria-label="詳細を表示"]').click();
    const detail = await waitForWindowWith(electronApp, '.icon-detail-modal', [mainWindow]);
    await shot(detail, 'icon-progress-detail-modal');
  });

  test('ワークスペースウィンドウ', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'Workspace')
        ?.show();
    });
    const workspace = await waitForWindowWith(electronApp, '.workspace-window', [mainWindow]);
    await workspace.locator('text=GitHub').first().waitFor({ state: 'visible' });
    await shot(workspace, 'workspace-window');
  });
});

firstLaunchTest('初回設定画面', async ({ mainWindow }) => {
  await mainWindow.locator('.first-launch-setup').waitFor({ state: 'visible' });
  await shot(mainWindow, 'first-launch-setup');
});
