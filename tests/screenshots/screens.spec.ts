import path from 'path';

import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { test } from '../e2e/fixtures/electron-app';
import { test as firstLaunchTest } from '../e2e/fixtures/first-launch-app';
import { stubBrowsers } from '../e2e/helpers/fake-browsers';
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

    // アイテム管理タブ・ヘルプタブ
    await admin.locator('button', { hasText: 'アイテム管理' }).first().click();
    await admin.locator('.raw-item-row').first().waitFor({ state: 'visible' });
    await shot(admin, 'admin-window-items');

    // 確認ダイアログ（アイテム管理で「仕事」タブを削除しようとする）
    await admin.getByTestId('admin-tab').filter({ hasText: '仕事' }).click({ button: 'right' });
    await admin.getByTestId('admin-tab-delete').click();
    await admin.locator('[data-testid="confirm-dialog"]').waitFor({ state: 'visible' });
    await shot(admin, 'dialogs-confirm');
    await admin.locator('[data-testid="confirm-dialog-cancel-button"]').click();
    await admin.locator('button', { hasText: 'ヘルプ' }).first().click();
    await shot(admin, 'admin-window-help');
  });

  test('ブックマーク取込画面', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const admin = await utils.openAdminWindow(electronApp, 'edit');
    await admin.waitForLoadState('domcontentloaded');
    // 本人のブラウザのブックマークが写らないよう、固定のブラウザとブックマークに差し替える
    await stubBrowsers(electronApp);

    await admin.locator('.toolbar-split .toolbar-split-toggle').click();
    await admin.locator('.dropdown-item', { hasText: 'ブラウザのブックマークから追加' }).click();
    const modal = admin.locator('.bookmark-import-modal');
    await modal.waitFor({ state: 'visible' });
    // 「開発」フォルダをまとめて選び、開いて中身も見せる
    const devFolder = modal.locator('.bookmark-import-row.folder', { hasText: '開発' }).first();
    await devFolder.locator('input[type="checkbox"]').check();
    await devFolder.locator('.bookmark-import-twisty').click();
    await shot(admin, 'bookmark-import-modal');
  });

  test('ブックマークの取込ルールの追加画面', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const admin = await utils.openAdminWindow(electronApp, 'edit');
    await admin.waitForLoadState('domcontentloaded');
    await stubBrowsers(electronApp);

    await admin.locator('.toolbar-split .toolbar-split-toggle').click();
    await admin.locator('.dropdown-item', { hasText: 'ブックマーク自動取込の設定' }).click();
    await admin.locator('.auto-import-add-rule button').click();
    const modal = admin.locator('.bookmark-rule-modal');
    await modal.waitFor({ state: 'visible' });
    // 名前に ☆ を含むものに、頭に [bkm] を付けて取り込むルール
    await modal.locator('#bookmark-rule-name-word').fill('☆');
    await modal.locator('.bookmark-rule-options-body input').first().fill('[bkm]');
    // 入力で下へ動いた本文を先頭に戻してから撮る（取込先・ルール名・条件が見えるように）
    await modal.locator('.bookmark-rule-body').evaluate((el) => el.scrollTo(0, 0));
    await shot(admin, 'bookmark-rule-modal');
  });

  test('アプリ取込画面', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const admin = await utils.openAdminWindow(electronApp, 'edit');
    await admin.waitForLoadState('domcontentloaded');

    // 本人のスタートメニューが写らないよう、スキャン結果を Windows 標準のアプリに差し替える。
    // アイコンはショートカットの代わりに実在する exe から取る。メモ帳は撮影用データにあるので「登録済み」になる
    const system32 = 'C:\\Windows\\System32';
    const app = (id: string, displayName: string, exe: string, targetPath?: string) => ({
      id,
      displayName,
      shortcutPath: `${system32}\\${exe}`,
      targetPath: targetPath ?? `${system32}\\${exe}`,
      checked: false,
      targetType: 'app',
      targetExtension: '.exe',
      source: 'lnk',
      isUninstaller: false,
    });
    const apps = [
      app('s1', 'コマンド プロンプト', 'cmd.exe'),
      app('s2', 'コントロール パネル', 'control.exe'),
      app('s3', 'タスク マネージャー', 'taskmgr.exe'),
      app('s4', '電卓', 'calc.exe'),
      app('s5', 'メモ帳', 'notepad.exe', 'notepad.exe'),
      app('s6', '文字コード表', 'charmap.exe'),
      { ...app('s7', 'Sample Tool のアンインストール', 'cmd.exe'), isUninstaller: true },
    ];
    await electronApp.evaluate(({ ipcMain }, scanned) => {
      ipcMain.removeHandler('scan-installed-apps');
      ipcMain.handle('scan-installed-apps', () => ({ apps: scanned, scanDuration: 1 }));
    }, apps);

    await admin.locator('.toolbar-split .toolbar-split-toggle').click();
    await admin.locator('.dropdown-item', { hasText: 'インストール済みアプリから追加' }).click();
    const modal = admin.locator('.app-import-modal');
    await modal.waitFor({ state: 'visible' });
    await modal.locator('.app-table tbody tr', { hasText: '電卓' }).click();
    await modal.locator('.app-table tbody tr', { hasText: 'タスク マネージャー' }).click();
    await modal.locator('.app-table tbody tr img.app-icon').first().waitFor({ state: 'visible' });
    await shot(admin, 'app-import-modal');
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

    // セット → アイテムの追加
    await typeSelect.selectOption({ value: 'set' });
    await register.locator('.register-modal button', { hasText: 'アイテムを追加' }).click();
    await register.locator('.set-picker-modal').waitFor({ state: 'visible' });
    await shot(register, 'set-item-picker-modal');
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
    // ワークスペースはメイン画面と同じアイコンキャッシュを使うので、先に取得しておく
    await fetchIcons(mainWindow);
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

firstLaunchTest.describe('初回設定', () => {
  // ファイル全体の test.use（screenshots）が効くと初回設定にならないので、ここで戻す
  firstLaunchTest.use({ configTemplate: 'first-launch' });

  firstLaunchTest('初回設定画面', async ({ mainWindow }) => {
    await mainWindow.locator('.first-launch-setup').waitFor({ state: 'visible' });
    await shot(mainWindow, 'first-launch-setup');

    await mainWindow.getByRole('button', { name: '次へ' }).click();
    await mainWindow.locator('.launch-hotkey-section').waitFor({ state: 'visible' });
    await shot(mainWindow, 'first-launch-setup-hotkey');

    await mainWindow.getByRole('button', { name: '次へ' }).click();
    await mainWindow.locator('.first-launch-try').waitFor({ state: 'visible' });
    await shot(mainWindow, 'first-launch-setup-try');
  });
});
