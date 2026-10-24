import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * ワークスペースの小さな直し（A3-160・A3-163・A3-164）
 * - 右クリックのパスのコピー・グループの「テキストでコピー」で、画面の右下に知らせを出す
 * - ワークスペースの削除の確認は、ほかの確認と同じ別の小さなウィンドウに出す（低い画面で切れない）
 * - タブの並びの空いた所の右クリックで「ワークスペースを追加」を出す
 */

async function getWorkspaceWindow(electronApp: ElectronApplication): Promise<Page> {
  const isWorkspace = async (win: Page) =>
    (await win.title()) === 'Workspace' || win.url().includes('workspace.html');
  for (const win of electronApp.windows()) {
    if (await isWorkspace(win)) return win;
  }
  return electronApp.waitForEvent('window', { predicate: isWorkspace, timeout: 10000 });
}

async function sendToWorkspace(
  electronApp: ElectronApplication,
  channel: string,
  ...args: unknown[]
): Promise<void> {
  await electronApp.evaluate(
    ({ BrowserWindow }, { channel, args }) => {
      const workspace = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Workspace');
      workspace?.webContents.send(channel, ...args);
    },
    { channel, args }
  );
}

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

test.describe('QuickDashLauncher - ワークスペースの小さな直し', () => {
  test('パスのコピーとグループのテキストでコピーで、画面の右下に知らせが出る', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const { itemId, groupId } = await workspaceWindow.evaluate(async () => {
      const api = window.electronAPI.workspaceAPI;
      const group = await api.createGroup('知らせのグループ');
      const item = await api.addItem(
        { displayName: 'メモ帳', path: 'C:\\Windows\\System32\\notepad.exe', type: 'app' },
        group.id
      );
      return { itemId: item.id, groupId: group.id };
    });
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: 'メモ帳' })
    ).toBeVisible();

    await sendToWorkspace(electronApp, 'workspace-menu-copy-path', itemId);
    await expect(workspaceWindow.getByText('パスをコピーしました')).toBeVisible();
    expect(await electronApp.evaluate(({ clipboard }) => clipboard.readText())).toBe(
      'C:\\Windows\\System32\\notepad.exe'
    );

    await sendToWorkspace(electronApp, 'workspace-group-menu-copy-as-text', groupId);
    await expect(
      workspaceWindow.getByText('「知らせのグループ」をテキストでコピーしました')
    ).toBeVisible();
  });

  test('ワークスペースの削除の確認は別の小さなウィンドウに出て、削除できる', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const created = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.createWorkspace('消すワークスペース')
    );
    await expect(
      workspaceWindow.locator('.workspace-tab-name', { hasText: '消すワークスペース' })
    ).toBeVisible();

    await sendToWorkspace(electronApp, 'workspace-tab-menu-delete', created.id);
    const confirm = await waitForConfirmWindow(electronApp);
    await expect(confirm.locator('[data-testid="confirm-dialog"]')).toContainText(
      '消すワークスペース'
    );
    // 画面の中には確認を出さない
    await expect(workspaceWindow.locator('[data-testid="confirm-dialog"]')).toHaveCount(0);
    await confirm.getByRole('button', { name: '削除' }).click();

    await expect(
      workspaceWindow.locator('.workspace-tab-name', { hasText: '消すワークスペース' })
    ).toHaveCount(0);
    const names = await workspaceWindow.evaluate(async () =>
      (await window.electronAPI.workspaceAPI.loadWorkspaces()).map((w) => w.displayName)
    );
    expect(names).not.toContain('消すワークスペース');
  });

  test('タブの並びの空いた所の右クリックは「ワークスペースを追加」だけ', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    await electronApp.evaluate(({ Menu }) => {
      const g = globalThis as { __e2eMenuLabels?: string[] | null };
      g.__e2eMenuLabels = null;
      Menu.prototype.popup = function (this: { items: Array<{ type: string; label: string }> }) {
        g.__e2eMenuLabels = this.items.filter((i) => i.type !== 'separator').map((i) => i.label);
      };
    });
    await workspaceWindow.locator('.workspace-tab-scroll').dispatchEvent('contextmenu');
    await expect
      .poll(() =>
        electronApp.evaluate(
          () => (globalThis as { __e2eMenuLabels?: string[] | null }).__e2eMenuLabels ?? []
        )
      )
      .toEqual(['➕ ワークスペースを追加']);
  });
});
