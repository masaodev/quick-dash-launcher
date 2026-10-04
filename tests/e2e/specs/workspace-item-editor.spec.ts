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
    await expect(editor.locator('h2')).toHaveText('ワークスペースアイテムの編集');
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
        editor.locator('.modal-actions button', { hasText: '更新' }).click(),
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
});

/**
 * アイテム名のその場編集（ダブルクリック）
 * - 空のまま確定すると元の名前に戻る（Enter でもフォーカスを外しても同じ）
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

      const added = await workspaceWindow.evaluate(() =>
        window.electronAPI.workspaceAPI.addItem({
          displayName: '元の名前',
          path: 'C:\\Windows\\System32\\notepad.exe',
          type: 'app',
        })
      );
      const card = workspaceWindow.locator('.workspace-item-card', { hasText: '元の名前' });
      await expect(card).toBeVisible({ timeout: 10000 });

      await card.locator('.workspace-item-name').dblclick();
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
});
