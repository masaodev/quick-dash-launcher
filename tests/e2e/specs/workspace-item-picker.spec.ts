import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

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
 * アイテムを選ぶウィンドウ（独立した子ウィンドウ）を待つ
 *
 * about:blank で開いてから中身を書き込むので、選ぶ画面が描かれるまで繰り返し探す
 */
async function waitForPickerWindow(electronApp: ElectronApplication): Promise<Page> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    for (const win of electronApp.windows()) {
      if (win.isClosed()) continue;
      try {
        if ((await win.locator('.set-picker-page .set-picker-modal').count()) > 0) {
          return win;
        }
      } catch {
        // 書き込み前・閉じた直後のウィンドウは無視する
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('アイテムを選ぶウィンドウが開きませんでした');
}

/**
 * グループの右クリック「🔍 メインウィンドウのアイテムから選ぶ…」を押したことにして、選ぶウィンドウを待つ
 *
 * ワークスペースの URL は about:blank（中身を書き込む作り）で、トーストのウィンドウと区別できないので、
 * NativeMenuTestHelper（URL で送り先を探す）は使わず、タイトルが Workspace のウィンドウへ送る
 */
async function openPicker(electronApp: ElectronApplication, groupId: string): Promise<Page> {
  await electronApp.evaluate(({ BrowserWindow }, id) => {
    const workspace = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Workspace');
    workspace?.webContents.send('workspace-group-menu-add-from-main', id);
  }, groupId);
  return waitForPickerWindow(electronApp);
}

/**
 * グループの右クリックから、メインウィンドウのアイテムを選んでグループに追加する
 * - 選ぶ画面は独立した子ウィンドウで開き、追加先（ワークスペース名 › グループ名）を出す
 * - 複数選んで追加すると、そのグループに入ってウィンドウが閉じる
 * - すでにグループにあるアイテム（パスと引数が同じ）は「追加済み」で選べない
 */
test.describe('QuickDashLauncher - ワークスペースのグループにメインのアイテムを追加', () => {
  test('選んだアイテムがグループに入り、次に開くと追加済みになる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const group = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.createGroup('追加先のグループ')
    );
    await expect(
      workspaceWindow.locator('.workspace-group-name', { hasText: '追加先のグループ' })
    ).toBeVisible({ timeout: 10000 });

    const picker = await openPicker(electronApp, group.id);

    await test.step('見出しと追加先を出す', async () => {
      await expect(picker.locator('.set-modal-header h3')).toHaveText(
        'グループ「追加先のグループ」に追加するアイテム'
      );
      await expect(picker.locator('.workspace-dest')).toContainText('追加先');
      await expect(picker.locator('.workspace-dest')).toContainText('追加先のグループ');
      await expect(picker).toHaveTitle('グループ「追加先のグループ」に追加するアイテム');
    });

    await test.step('2 件を選んで追加すると、グループに入ってウィンドウが閉じる', async () => {
      await picker.locator('.set-picker-row', { hasText: 'GitHub' }).click();
      await picker.locator('.set-picker-row', { hasText: '電卓' }).click();
      const addButton = picker.locator('.modal-actions button', { hasText: '2 件を追加' });
      await expect(addButton).toBeEnabled();
      await Promise.all([picker.waitForEvent('close', { timeout: 10000 }), addButton.click()]);

      await expect
        .poll(
          async () => {
            const items = await workspaceWindow.evaluate(() =>
              window.electronAPI.workspaceAPI.loadItems()
            );
            return items
              .filter((item) => item.groupId === group.id)
              .map((item) => item.displayName)
              .sort();
          },
          { timeout: 10000 }
        )
        .toEqual(['GitHub', '電卓'].sort());
    });

    await test.step('もう一度開くと、入れたアイテムは追加済みで選べない', async () => {
      const again = await openPicker(electronApp, group.id);
      const added = again.locator('.set-picker-row.added', { hasText: 'GitHub' });
      await expect(added).toBeVisible();
      await expect(added).toContainText('追加済み');
      await expect(added.locator('input')).toBeDisabled();
      await expect(
        again.locator('.set-picker-row:not(.added)', { hasText: 'Google' })
      ).toBeVisible();

      await Promise.all([
        again.waitForEvent('close', { timeout: 10000 }),
        // Escape でウィンドウが閉じると press の完了を待てないので、その失敗は無視する
        again.keyboard.press('Escape').catch(() => {}),
      ]);
      const items = await workspaceWindow.evaluate(() =>
        window.electronAPI.workspaceAPI.loadItems()
      );
      expect(items.filter((item) => item.groupId === group.id)).toHaveLength(2);
    });
  });

  test('追加先のグループが無いときは、その旨と閉じるボタンを出す', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.openItemPicker('no-such-group')
    );
    const deadline = Date.now() + 15000;
    let missing: Page | undefined;
    while (!missing && Date.now() < deadline) {
      for (const win of electronApp.windows()) {
        if (win.isClosed()) continue;
        try {
          if ((await win.locator('.set-picker-missing').count()) > 0) missing = win;
        } catch {
          // 書き込み前・閉じた直後のウィンドウは無視する
        }
      }
      if (!missing) await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(missing).toBeDefined();
    await expect(missing!.locator('.set-picker-missing')).toContainText(
      '追加先のグループが見つかりません'
    );
    await Promise.all([
      missing!.waitForEvent('close', { timeout: 10000 }),
      missing!.locator('button', { hasText: '閉じる' }).click(),
    ]);
  });
});
