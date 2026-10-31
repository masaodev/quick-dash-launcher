import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * ワークスペースの操作（A3-147）
 * - アイテムの右クリック「📁 グループへ移動 ▸」
 * - グループの右クリック「▶ すべて開く」「📄 グループを複製」「🔼 ほかのグループを折りたたむ」
 * - アイテムの Shift+クリックで親フォルダを開く
 *
 * メニューの項目は Menu.prototype.popup を差し替えて読み、押したことは IPC のイベントを送って確かめる。
 * 実際にアプリを開かないよう、shell.openExternal・shell.showItemInFolder・shell.openPath は差し替えて呼ばれた先を記録する
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

async function captureMenuLabels(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ Menu }) => {
    const g = globalThis as { __e2eMenuLabels?: string[] | null };
    g.__e2eMenuLabels = null;
    Menu.prototype.popup = function (this: {
      items: Array<{ type: string; label: string; submenu?: { items: Array<{ label: string }> } }>;
    }) {
      g.__e2eMenuLabels = this.items.filter((i) => i.type !== 'separator').map((i) => i.label);
    };
  });
}

async function readMenuLabels(electronApp: ElectronApplication): Promise<string[]> {
  return electronApp.evaluate(
    () => (globalThis as { __e2eMenuLabels?: string[] | null }).__e2eMenuLabels ?? []
  );
}

interface Fixture {
  workspaceId: string;
  groupId: string;
  subId: string;
  otherId: string;
  fileId: string;
  clipRef: string;
}

test.describe('QuickDashLauncher - ワークスペースの操作', () => {
  test('グループの複製・グループへ移動・ほかを折りたたむ・すべて開く・Shift+クリック', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    // 開いた先を記録する（実際には開かない）
    await electronApp.evaluate(({ shell }) => {
      const g = globalThis as { __e2eOpened?: string[] };
      g.__e2eOpened = [];
      shell.openExternal = async (url: string) => {
        g.__e2eOpened?.push(`external:${url}`);
      };
      shell.showItemInFolder = (fullPath: string) => {
        g.__e2eOpened?.push(`folder:${fullPath}`);
      };
      shell.openPath = async (fullPath: string) => {
        g.__e2eOpened?.push(`path:${fullPath}`);
        return '';
      };
    });
    const opened = () =>
      electronApp.evaluate(() => (globalThis as { __e2eOpened?: string[] }).__e2eOpened ?? []);

    const fx: Fixture = await workspaceWindow.evaluate(async () => {
      const api = window.electronAPI.workspaceAPI;
      const [ws] = await api.loadWorkspaces();
      const group = await api.createGroup('複製元', undefined, undefined, ws.id);
      const sub = await api.createGroup('中のグループ', undefined, group.id, ws.id);
      const other = await api.createGroup('別のグループ', undefined, undefined, ws.id);
      await api.addItem(
        { displayName: 'サイトA', path: 'https://example.com/a', type: 'url' },
        group.id,
        ws.id
      );
      await api.addItem(
        { displayName: 'サイトB', path: 'https://example.com/b', type: 'url' },
        sub.id,
        ws.id
      );
      await api.addItem(
        { displayName: 'メモ帳', path: 'C:\\Windows\\System32\\notepad.exe', type: 'app' },
        group.id,
        ws.id
      );
      const saved = await window.electronAPI.clipboardAPI.saveText('定型文の本文');
      await api.addItem(
        {
          type: 'clipboard',
          displayName: '定型文',
          clipboardDataRef: saved.dataFileRef ?? '',
          formats: ['text'],
          savedAt: Date.now(),
        },
        group.id,
        ws.id
      );
      const items = await api.loadItems();
      return {
        workspaceId: ws.id,
        groupId: group.id,
        subId: sub.id,
        otherId: other.id,
        fileId: items.find((i) => i.displayName === 'メモ帳')?.id ?? '',
        clipRef: saved.dataFileRef ?? '',
      };
    });
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: '定型文' })
    ).toBeVisible({ timeout: 10000 });

    await test.step('右クリックに新しい項目が出る', async () => {
      await captureMenuLabels(electronApp);
      await workspaceWindow
        .locator('.workspace-group-header', { hasText: '複製元' })
        .click({ button: 'right' });
      await expect.poll(() => readMenuLabels(electronApp)).toContain('📄 グループを複製');
      const groupLabels = await readMenuLabels(electronApp);
      expect(groupLabels[0]).toBe('▶ すべて開く');
      expect(groupLabels).toContain('🔼 ほかのグループを折りたたむ');

      await captureMenuLabels(electronApp);
      await workspaceWindow
        .locator('.workspace-item-card', { hasText: 'メモ帳' })
        .click({ button: 'right' });
      await expect.poll(() => readMenuLabels(electronApp)).toContain('📁 グループへ移動');
      // アプリには「管理者として実行」が出る（URL には出ない）
      expect(await readMenuLabels(electronApp)).toContain('🛡️ 管理者として実行');

      await captureMenuLabels(electronApp);
      await workspaceWindow
        .locator('.workspace-item-card', { hasText: 'サイトA' })
        .click({ button: 'right' });
      await expect.poll(() => readMenuLabels(electronApp)).toContain('📁 グループへ移動');
      expect(await readMenuLabels(electronApp)).not.toContain('🛡️ 管理者として実行');
    });

    await test.step('グループを複製すると、サブグループとアイテムごと写り、クリップボードの実データは別になる', async () => {
      await sendToWorkspace(electronApp, 'workspace-group-menu-duplicate', fx.groupId);
      await expect
        .poll(async () => {
          const groups = await workspaceWindow.evaluate(() =>
            window.electronAPI.workspaceAPI.loadGroups()
          );
          return groups.some((g) => g.displayName === '複製元 のコピー');
        })
        .toBe(true);
      const result = await workspaceWindow.evaluate(async () => {
        const api = window.electronAPI.workspaceAPI;
        const groups = await api.loadGroups();
        const items = await api.loadItems();
        const copy = groups.find((g) => g.displayName === '複製元 のコピー');
        const copySub = groups.find((g) => g.parentGroupId === copy?.id);
        const inCopy = items.filter((i) => i.groupId === copy?.id).map((i) => i.displayName);
        const inCopySub = items.filter((i) => i.groupId === copySub?.id).map((i) => i.displayName);
        const clip = items.find((i) => i.groupId === copy?.id && i.type === 'clipboard') as
          { dataFileRef?: string } | undefined;
        return { subName: copySub?.displayName, inCopy, inCopySub, clipRef: clip?.dataFileRef };
      });
      expect(result.subName).toBe('中のグループ');
      expect(result.inCopy.sort()).toEqual(['サイトA', 'メモ帳', '定型文'].sort());
      expect(result.inCopySub).toEqual(['サイトB']);
      expect(result.clipRef).toBeTruthy();
      expect(result.clipRef).not.toBe(fx.clipRef);
    });

    await test.step('「グループへ移動」でアイテムが別のグループに入る', async () => {
      await sendToWorkspace(electronApp, 'workspace-menu-move-to-group', fx.fileId, fx.otherId);
      await expect
        .poll(async () => {
          const items = await workspaceWindow.evaluate(() =>
            window.electronAPI.workspaceAPI.loadItems()
          );
          return items.find((i) => i.id === fx.fileId)?.groupId;
        })
        .toBe(fx.otherId);
    });

    await test.step('「ほかのグループを折りたたむ」で、そのグループ以外が閉じる', async () => {
      await sendToWorkspace(electronApp, 'workspace-group-menu-collapse-others', fx.subId);
      await expect
        .poll(async () => {
          const groups = await workspaceWindow.evaluate(() =>
            window.electronAPI.workspaceAPI.loadGroups()
          );
          return groups
            .filter((g) => g.workspaceId === fx.workspaceId)
            .map((g) => `${g.displayName}:${g.collapsed ? '閉' : '開'}`)
            .sort();
        })
        .toEqual(
          [
            '複製元:開',
            '中のグループ:開',
            '別のグループ:閉',
            '複製元 のコピー:閉',
            '中のグループ:閉',
          ].sort()
        );
      await sendToWorkspace(electronApp, 'workspace-menu-set-all-collapsed', fx.workspaceId, false);
    });

    await test.step('「すべて開く」でサブグループの中も含めて順に開く', async () => {
      await sendToWorkspace(electronApp, 'workspace-group-menu-open-all', fx.groupId);
      await expect
        .poll(async () => (await opened()).filter((o) => o.startsWith('external:')), {
          timeout: 10000,
        })
        .toEqual(['external:https://example.com/a', 'external:https://example.com/b']);
    });

    await test.step('Shift+クリックで親フォルダを開く', async () => {
      await workspaceWindow
        .locator('.workspace-item-card', { hasText: 'メモ帳' })
        .first()
        .click({ modifiers: ['Shift'] });
      await expect
        // ワークスペースは親フォルダのパスをそのまま開く（ランチャーの Shift+Enter は親フォルダの中で選ぶ）
        .poll(async () => (await opened()).filter((o) => o.startsWith('path:')))
        .toEqual(['path:C:\\Windows\\System32']);
    });
  });
});
