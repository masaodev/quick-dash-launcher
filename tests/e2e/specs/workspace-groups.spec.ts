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
 * ワークスペース画面のグループ操作
 * - 作成直後のグループでも折りたたみが効き、workspace-ui-state.json に保存される
 *   （以前はウィンドウを開き直すまでトグルが無視される不具合があった）
 * - アーカイブタブでグループを「アーカイブから削除」すると、確認の上で完全に消える
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

      const dialog = workspaceWindow.locator('.confirm-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('アーカイブから削除');
      await expect(dialog).toContainText('元に戻せません');
      await dialog.getByRole('button', { name: '削除' }).click();

      await expect.poll(() => readArchive()?.groups.some((g) => g.id === groupId)).toBe(false);
      await expect(
        workspaceWindow.locator('.workspace-group-header', { hasText: '消すグループ' })
      ).toHaveCount(0);
    });
  });
});
