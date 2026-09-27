import type { ElectronApplication, Page } from '@playwright/test';
import type { JsonWorkspaceArchiveFile, WorkspaceUiStateFile } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { test, expect } from '../fixtures/electron-app';
import { NativeMenuTestHelper, TestUtils } from '../helpers/test-utils';

/**
 * 常駐しているワークスペースウィンドウ（起動時に生成される）を取得する
 *
 * メインのレンダラーから window.open で開かれるため URL は about:blank になる。タイトルで判定する
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
 * ワークスペースから開かれた確認ウィンドウ（独立した子ウィンドウ）を待つ
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

/** ワークスペース本体のウィンドウの位置・大きさ */
async function getWorkspaceBounds(electronApp: ElectronApplication) {
  return electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === 'Workspace')
      ?.getBounds()
  );
}

/**
 * ワークスペース画面のグループ操作
 * - 作成直後のグループでも折りたたみが効き、workspace-ui-state.json に保存される
 *   （以前はウィンドウを開き直すまでトグルが無視される不具合があった）
 * - アーカイブタブでグループを「アーカイブから削除」すると、確認の上で完全に消える
 * - グループのアーカイブは確認ウィンドウで行い、キャンセルなら何も変わらない。ワークスペースは動かない
 */
test.describe('QuickDashLauncher - ワークスペースのグループ', () => {
  test('作成直後のグループを折りたたむと UI 状態に保存され、再展開で消える', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    let groupId = '';
    await test.step('ワークスペース画面からグループを作る', async () => {
      const created = await workspaceWindow.evaluate(() =>
        window.electronAPI.workspaceAPI.createGroup('新しいグループ')
      );
      groupId = created.id;
      // 変更通知で画面に反映されるのを待つ
      await workspaceWindow
        .locator('.workspace-group-header', { hasText: '新しいグループ' })
        .waitFor({ state: 'visible', timeout: 10000 });
    });

    const header = workspaceWindow.locator('.workspace-group-header', {
      hasText: '新しいグループ',
    });
    const readCollapsed = () =>
      configHelper.readConfigJson<WorkspaceUiStateFile>('workspace-ui-state.json')
        ?.collapsedGroups ?? {};

    await test.step('ヘッダークリックで折りたたまれ、ui-state に保存される', async () => {
      await header.click();
      await expect(header.locator('.workspace-group-collapse-icon')).toHaveClass(/collapsed/);
      await expect.poll(() => readCollapsed()[groupId]).toBe(true);
    });

    await test.step('もう一度クリックで展開され、ui-state から消える', async () => {
      await header.click();
      await expect(header.locator('.workspace-group-collapse-icon')).not.toHaveClass(/collapsed/);
      await expect.poll(() => readCollapsed()[groupId]).toBeUndefined();
    });
  });

  test('アーカイブタブの「アーカイブから削除」で確認の上グループが完全に消える', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const readArchive = () =>
      configHelper.readConfigJson<JsonWorkspaceArchiveFile>('workspace-archive.json');

    let groupId = '';
    await test.step('グループを作ってアーカイブする', async () => {
      const created = await workspaceWindow.evaluate(() =>
        window.electronAPI.workspaceAPI.createGroup('消すグループ')
      );
      groupId = created.id;
      await workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.archiveGroup(id),
        groupId
      );
      await expect.poll(() => readArchive()?.groups.some((g) => g.id === groupId)).toBe(true);
    });

    await test.step('アーカイブタブで削除メニュー → 確認ダイアログ → 削除', async () => {
      await workspaceWindow.locator('.archive-tab').click();
      await workspaceWindow
        .locator('.workspace-group-header', { hasText: '消すグループ' })
        .waitFor({ state: 'visible', timeout: 10000 });

      // ネイティブメニューは操作できないので、メニュー選択時のイベントを直接送る
      const menu = new NativeMenuTestHelper(electronApp, workspaceWindow);
      await menu.sendIpcToRenderer(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_DELETE, groupId);

      // 確認はワークスペースの中ではなく、独立した確認ウィンドウで行う
      const confirmWindow = await waitForConfirmWindow(electronApp);
      await expect(workspaceWindow.locator('.confirm-dialog')).toHaveCount(0);
      const dialog = confirmWindow.locator('[data-testid="confirm-dialog"]');
      await expect(dialog).toContainText('アーカイブから削除');
      await expect(dialog).toContainText('元に戻せません');
      await dialog
        .getByRole('button', { name: '削除' })
        .click()
        .catch(() => {});
      await expect.poll(() => confirmWindow.isClosed()).toBe(true);

      await expect.poll(() => readArchive()?.groups.some((g) => g.id === groupId)).toBe(false);
      await expect(
        workspaceWindow.locator('.workspace-group-header', { hasText: '消すグループ' })
      ).toHaveCount(0);
    });
  });

  test('グループのアーカイブは確認ウィンドウで行い、ワークスペースは動かない', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const readArchive = () =>
      configHelper.readConfigJson<JsonWorkspaceArchiveFile>('workspace-archive.json');

    let groupId = '';
    await test.step('グループを作る', async () => {
      const created = await workspaceWindow.evaluate(() =>
        window.electronAPI.workspaceAPI.createGroup('しまうグループ')
      );
      groupId = created.id;
      await workspaceWindow
        .locator('.workspace-group-header', { hasText: 'しまうグループ' })
        .waitFor({ state: 'visible', timeout: 10000 });
    });

    const boundsBefore = await getWorkspaceBounds(electronApp);
    const menu = new NativeMenuTestHelper(electronApp, workspaceWindow);

    await test.step('確認ウィンドウを Escape で閉じると何も変わらない', async () => {
      await menu.sendIpcToRenderer(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ARCHIVE, groupId);
      const confirmWindow = await waitForConfirmWindow(electronApp);
      await expect(confirmWindow.locator('[data-testid="confirm-dialog"]')).toContainText(
        'しまうグループ'
      );
      // 確認ウィンドウが開いている間もワークスペースの位置・大きさは変わらない
      expect(await getWorkspaceBounds(electronApp)).toEqual(boundsBefore);
      await confirmWindow.keyboard.press('Escape').catch(() => {});
      await expect.poll(() => confirmWindow.isClosed()).toBe(true);
      await expect(
        workspaceWindow.locator('.workspace-group-header', { hasText: 'しまうグループ' })
      ).toBeVisible();
      expect(readArchive()?.groups.some((g) => g.id === groupId) ?? false).toBe(false);
    });

    await test.step('確認ウィンドウでアーカイブするとグループがアーカイブへ移る', async () => {
      await menu.sendIpcToRenderer(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ARCHIVE, groupId);
      const confirmWindow = await waitForConfirmWindow(electronApp);
      await confirmWindow
        .locator('[data-testid="confirm-dialog-confirm-button"]')
        .click()
        .catch(() => {});
      await expect.poll(() => confirmWindow.isClosed()).toBe(true);
      await expect.poll(() => readArchive()?.groups.some((g) => g.id === groupId)).toBe(true);
      await expect(
        workspaceWindow.locator('.workspace-group-header', { hasText: 'しまうグループ' })
      ).toHaveCount(0);
      expect(await getWorkspaceBounds(electronApp)).toEqual(boundsBefore);
    });
  });
});
