import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { NativeMenuTestHelper, TestUtils } from '../helpers/test-utils';

/**
 * 常駐しているワークスペースウィンドウを取得する（workspace-groups.spec.ts と同じ）
 */
async function getWorkspaceWindow(electronApp: ElectronApplication): Promise<Page> {
  const isWorkspace = async (win: Page) =>
    (await win.title()) === 'Workspace' || win.url().includes('workspace.html');
  for (const win of electronApp.windows()) {
    if (await isWorkspace(win)) return win;
  }
  return electronApp.waitForEvent('window', { predicate: isWorkspace, timeout: 10000 });
}

/**
 * 確認ウィンドウ（独立した子ウィンドウ）を待つ（workspace-groups.spec.ts と同じ）
 *
 * about:blank で開いてから中身を書き込むので、確認ダイアログが描かれるまで繰り返し探す
 */
async function waitForConfirmWindow(electronApp: ElectronApplication): Promise<Page> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    for (const win of electronApp.windows()) {
      if (win.isClosed()) continue;
      try {
        if (
          (await win.locator('.confirm-window-page [data-testid="confirm-dialog"]').count()) > 0
        ) {
          return win;
        }
      } catch {
        // 書き込み前・閉じた直後のウィンドウは無視する
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('確認ウィンドウが開きませんでした');
}

/** タイトルが Workspace のウィンドウ（本体）の bounds をメインプロセスから読む */
async function getWorkspaceBounds(
  electronApp: ElectronApplication
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Workspace');
    return win ? win.getBounds() : null;
  });
}

/**
 * ワークスペースアイテムの編集は独立した子ウィンドウで開く
 * - ワークスペース本体のサイズ・位置は変わらない（以前は 850x800 に広げて右端へ動かしていた）
 * - 保存すると反映され、編集ウィンドウは閉じる
 */
test.describe('QuickDashLauncher - ワークスペースアイテムの編集ウィンドウ', () => {
  test('編集ウィンドウで名前を変えて保存すると反映され、本体は動かない', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const added = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.addItem({
        displayName: '編集前',
        path: 'C:\\Windows\\System32\\notepad.exe',
        type: 'app',
      })
    );
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: '編集前' })
    ).toBeVisible({ timeout: 10000 });

    const boundsBefore = await getWorkspaceBounds(electronApp);
    expect(boundsBefore).not.toBeNull();

    const [editor] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 15000 }),
      workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.openItemEditor(id),
        added.id
      ),
    ]);
    await editor.locator('.workspace-editor-page').waitFor({ state: 'visible', timeout: 15000 });
    await expect(editor.locator('h2')).toContainText('ワークスペースアイテムの編集');
    await expect(editor).toHaveTitle('アイテムの編集');

    await test.step('本体のサイズ・位置は変わらない', async () => {
      const boundsAfter = await getWorkspaceBounds(electronApp);
      expect(boundsAfter).toEqual(boundsBefore);
    });

    await test.step('名前を変えて更新すると反映され、ウィンドウが閉じる', async () => {
      const nameInput = editor.locator('input[type="text"]').first();
      await expect(nameInput).toHaveValue('編集前');
      await nameInput.fill('編集後');
      await Promise.all([
        editor.waitForEvent('close', { timeout: 10000 }),
        editor.locator('.modal-actions button', { hasText: '保存' }).click(),
      ]);
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: '編集後' })
      ).toBeVisible({ timeout: 10000 });
      const items = await workspaceWindow.evaluate(() =>
        window.electronAPI.workspaceAPI.loadItems()
      );
      expect(items.find((i) => i.id === added.id)?.displayName).toBe('編集後');
    });
  });

  test('欄の並びはメインの編集画面と同じで、保存先は出さず種別は変えられない', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const added = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.addItem({
        displayName: '欄の確認',
        path: 'C:\\Windows\\System32\\notepad.exe',
        type: 'app',
        args: '--sample',
      })
    );
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: '欄の確認' })
    ).toBeVisible({ timeout: 10000 });

    const [editor] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 15000 }),
      workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.openItemEditor(id),
        added.id
      ),
    ]);
    await editor.locator('.workspace-editor-page').waitFor({ state: 'visible', timeout: 15000 });

    // 保存先（タブ）の選択は無く、種別は表示だけ
    await expect(editor.getByText('保存先タブ', { exact: true })).toHaveCount(0);
    await expect(editor.locator('select').first()).toBeDisabled();
    // パス欄にアイコン取得ボタンが付く
    await expect(editor.locator('.icon-fetch-btn')).toBeVisible();
    // 引数は「オプション設定」の折りたたみの中
    const argsInput = editor.getByPlaceholder(
      'コマンドライン引数（実行ファイルやアプリの場合のみ有効）'
    );
    await expect(argsInput).toHaveCount(0);
    await editor
      .locator('.options-toggle', { hasText: 'オプション設定（引数・アイコン）' })
      .click();
    await expect(argsInput).toHaveValue('--sample');
    await expect(editor.locator('.custom-icon-section')).toBeVisible();
  });

  test('「ワークスペースから削除」でアイテムが消え、編集ウィンドウが閉じる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const added = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.addItem({
        displayName: '消すアイテム',
        path: 'C:\\Windows\\System32\\notepad.exe',
        type: 'app',
      })
    );
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: '消すアイテム' })
    ).toBeVisible({ timeout: 10000 });

    const [editor] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 15000 }),
      workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.openItemEditor(id),
        added.id
      ),
    ]);
    await editor.locator('.workspace-editor-page').waitFor({ state: 'visible', timeout: 15000 });

    // 削除は確認の子ウィンドウを通す（名前は保存済みの名前）
    await editor.locator('.modal-actions button', { hasText: 'ワークスペースから削除' }).click();
    const confirm = await waitForConfirmWindow(electronApp);
    await expect(confirm.getByTestId('confirm-dialog')).toContainText(
      '「消すアイテム」をワークスペースから削除しますか？'
    );
    await Promise.all([
      editor.waitForEvent('close', { timeout: 10000 }),
      confirm.getByTestId('confirm-dialog-confirm-button').click(),
    ]);
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: '消すアイテム' })
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('右クリックの「削除」は確認を通し、キャンセルすれば消えない', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const added = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.addItem({
        displayName: '右クリックで消す',
        path: 'C:\\Windows\\System32\\notepad.exe',
        type: 'app',
      })
    );
    const card = workspaceWindow.locator('.workspace-item-card', { hasText: '右クリックで消す' });
    await expect(card).toBeVisible({ timeout: 10000 });
    const menu = new NativeMenuTestHelper(electronApp, workspaceWindow);

    // キャンセルすれば残る
    await menu.simulateWorkspaceMenu('remove', added.id);
    let confirm = await waitForConfirmWindow(electronApp);
    await expect(confirm.getByTestId('confirm-dialog')).toContainText(
      '「右クリックで消す」をワークスペースから削除しますか？'
    );
    await confirm.getByTestId('confirm-dialog-cancel-button').click();
    await expect(card).toBeVisible();

    // 確かめれば消える
    await menu.simulateWorkspaceMenu('remove', added.id);
    confirm = await waitForConfirmWindow(electronApp);
    await confirm.getByTestId('confirm-dialog-confirm-button').click();
    await expect(card).toHaveCount(0, { timeout: 10000 });
  });
});

/**
 * アイテム名のその場編集（右クリック「表示名を変更」）
 * - 空のまま確定すると元の名前に戻る（Enter でもフォーカスを外しても同じ）
 * - ダブルクリックでは名前の編集に入らない（クリックで起動するので、ランチャーと同じく何もしない）
 */
test.describe('QuickDashLauncher - ワークスペースアイテム名のその場編集', () => {
  for (const commit of ['Enter', 'blur'] as const) {
    test(`名前を空にして確定（${commit}）すると元の名前に戻る`, async ({
      electronApp,
      mainWindow,
    }) => {
      const utils = new TestUtils(mainWindow);
      await utils.waitForPageLoad();
      const workspaceWindow = await getWorkspaceWindow(electronApp);
      await workspaceWindow.waitForLoadState('domcontentloaded');
      const menu = new NativeMenuTestHelper(electronApp, workspaceWindow);

      const added = await workspaceWindow.evaluate(() =>
        window.electronAPI.workspaceAPI.addItem({
          displayName: '元の名前',
          path: 'C:\\Windows\\System32\\notepad.exe',
          type: 'app',
        })
      );
      const card = workspaceWindow.locator('.workspace-item-card', { hasText: '元の名前' });
      await expect(card).toBeVisible({ timeout: 10000 });

      await menu.simulateWorkspaceMenu('rename', added.id);
      const input = workspaceWindow.locator('.workspace-item-name-input');
      await expect(input).toBeVisible();
      await input.fill('');
      if (commit === 'Enter') {
        await input.press('Enter');
      } else {
        await input.evaluate((el) => (el as HTMLInputElement).blur());
      }

      await expect(input).toHaveCount(0);
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: '元の名前' })
      ).toBeVisible();
      await workspaceWindow.waitForTimeout(300);
      const items = await workspaceWindow.evaluate(() =>
        window.electronAPI.workspaceAPI.loadItems()
      );
      expect(items.find((i) => i.id === added.id)?.displayName).toBe('元の名前');
    });
  }

  test('ダブルクリックでは名前の編集に入らない', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    // 起動しても何も開かないよう、存在しないパスにする
    await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.addItem({
        displayName: 'ダブルクリック',
        path: 'C:\\qdl-e2e-not-exist\\dummy.txt',
        type: 'file',
      })
    );
    const card = workspaceWindow.locator('.workspace-item-card', { hasText: 'ダブルクリック' });
    await expect(card).toBeVisible({ timeout: 10000 });

    await card.locator('.workspace-item-name').dblclick();
    await workspaceWindow.waitForTimeout(300);
    await expect(workspaceWindow.locator('.workspace-item-name-input')).toHaveCount(0);
  });
});

/**
 * 右クリック「メモを表示」
 */
test.describe('QuickDashLauncher - ワークスペースアイテムのメモ', () => {
  test('メモを表示で、メモがモーダルに出る', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const menu = new NativeMenuTestHelper(electronApp, workspaceWindow);

    const added = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.addItem({
        displayName: 'メモ付き',
        path: 'C:\\Windows\\System32\\notepad.exe',
        type: 'app',
        memo: 'メモの本文',
      })
    );
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: 'メモ付き' })
    ).toBeVisible({ timeout: 10000 });

    await menu.simulateWorkspaceMenu('showMemo', added.id);
    const modal = workspaceWindow.locator('.memo-view-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toHaveText('メモ付き');
    await expect(modal.locator('.memo-text')).toHaveText('メモの本文');

    await workspaceWindow.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
  });
});
