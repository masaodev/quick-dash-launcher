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
 * グループの右クリック「✏️ 新しく入力して追加…」を押したことにして、追加のウィンドウを待つ
 *
 * ワークスペースの URL は about:blank でトーストのウィンドウと区別できないので、
 * タイトルが Workspace のウィンドウへイベントを送る（workspace-item-picker.spec.ts と同じ）。
 * about:blank で開いてから中身を書き込むので、見出しが描かれるまで繰り返し探す
 */
async function openNewItemWindow(electronApp: ElectronApplication, groupId: string): Promise<Page> {
  await electronApp.evaluate(({ BrowserWindow }, id) => {
    const workspace = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Workspace');
    workspace?.webContents.send('workspace-group-menu-add-new', id);
  }, groupId);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    for (const win of electronApp.windows()) {
      if (win.isClosed()) continue;
      try {
        const heading = win.locator('.workspace-editor-page h2', {
          hasText: 'ワークスペースにアイテムを追加',
        });
        if ((await heading.count()) > 0) return win;
      } catch {
        // 書き込み前・閉じた直後のウィンドウは無視する
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('追加のウィンドウが開きませんでした');
}

/**
 * グループの右クリックから、新しいアイテムを入力してグループに追加する
 * - 編集ウィンドウと同じフォームを新規の形で開き、上に追加先を出す
 * - 種別を選べる（フォルダ取込は出さない）。削除のボタンは無い
 * - 「追加」でそのグループに入り、ウィンドウが閉じる。入力が足りなければ開いたまま
 */
test.describe('QuickDashLauncher - ワークスペースのグループに新しいアイテムを入力して追加', () => {
  test('入力したアイテムがグループに入る', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const group = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.createGroup('新規の追加先')
    );
    await expect(
      workspaceWindow.locator('.workspace-group-name', { hasText: '新規の追加先' })
    ).toBeVisible({ timeout: 10000 });

    const editor = await openNewItemWindow(electronApp, group.id);

    await test.step('追加先・種別・ボタンの出し方', async () => {
      await expect(editor).toHaveTitle('ワークスペースにアイテムを追加');
      await expect(editor.locator('.workspace-dest')).toContainText('追加先');
      await expect(editor.locator('.workspace-dest')).toContainText('新規の追加先');
      const kind = editor.locator('.register-kind select');
      await expect(kind).toBeEnabled();
      await expect(kind.locator('option')).toHaveText(['📄 単一アイテム', '📦 セット', '📋 クリップボード']);
      await expect(
        editor.locator('.modal-actions button', { hasText: 'ワークスペースから削除' })
      ).toHaveCount(0);
    });

    await test.step('名前が空のまま「追加」を押しても閉じない', async () => {
      await editor.locator('.modal-actions button', { hasText: '追加' }).click();
      await expect(editor.locator('.error-message').first()).toBeVisible();
      expect(editor.isClosed()).toBe(false);
    });

    await test.step('名前とパスを入れて「追加」を押すと、グループに入って閉じる', async () => {
      await editor.locator('input[type="text"]').first().fill('新しく入れたサイト');
      await editor.locator('input[type="text"]').nth(1).fill('https://example.com/new');
      await Promise.all([
        editor.waitForEvent('close', { timeout: 10000 }),
        editor.locator('.modal-actions button', { hasText: '追加' }).click(),
      ]);

      await expect
        .poll(
          async () => {
            const items = await workspaceWindow.evaluate(() =>
              window.electronAPI.workspaceAPI.loadItems()
            );
            return items
              .filter((item) => item.groupId === group.id)
              .map((item) => [item.displayName, item.type === 'item' ? item.path : '']);
          },
          { timeout: 10000 }
        )
        .toEqual([['新しく入れたサイト', 'https://example.com/new']]);
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: '新しく入れたサイト' })
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
