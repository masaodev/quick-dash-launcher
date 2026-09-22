import type { ElectronApplication, Page } from '@playwright/test';
import type { WorkspaceUiStateFile } from '@common/types';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

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
});
