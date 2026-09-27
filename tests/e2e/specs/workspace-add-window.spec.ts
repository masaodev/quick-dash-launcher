import type { ElectronApplication, Page } from '@playwright/test';
import type { WindowInfo } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

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

const windowInfo: WindowInfo = {
  hwnd: 123456,
  title: '設計書.docx - Word',
  x: 100,
  y: 200,
  width: 800,
  height: 600,
  processId: 42,
  isVisible: true,
  processName: 'WINWORD.EXE',
};

/**
 * ウィンドウ検索結果の右クリック「ワークスペースに追加」
 * - 既定はタイトルとプロセス名だけのウィンドウ操作アイテム（hwnd・位置は持たない）
 * - 「位置・サイズも記録して」を選ぶと x/y/width/height も付く
 */
test.describe('QuickDashLauncher - ウィンドウ検索結果をワークスペースに追加', () => {
  test('メニューのイベントでウィンドウ操作アイテムが追加される', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);

    await test.step('既定: アクティブ化のみ', async () => {
      await menuHelper.sendIpcToRenderer(IPC_CHANNELS.EVENT_WINDOW_MENU_ADD_TO_WORKSPACE, {
        windowInfo,
        includePosition: false,
      });
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: '設計書.docx - Word' })
      ).toBeVisible({ timeout: 10000 });
    });

    await test.step('位置・サイズも記録', async () => {
      await menuHelper.sendIpcToRenderer(IPC_CHANNELS.EVENT_WINDOW_MENU_ADD_TO_WORKSPACE, {
        windowInfo: { ...windowInfo, title: '位置つき - Word' },
        includePosition: true,
      });
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: '位置つき - Word' })
      ).toBeVisible({ timeout: 10000 });
    });

    const items = await workspaceWindow.evaluate(() => window.electronAPI.workspaceAPI.loadItems());

    const plain = items.find((item) => item.displayName === '設計書.docx - Word');
    expect(plain?.type).toBe('window');
    if (plain?.type === 'window') {
      expect(plain.windowTitle).toBe('設計書.docx - Word');
      expect(plain.processName).toBe('WINWORD.EXE');
      expect(plain.x).toBeUndefined();
      expect(plain.width).toBeUndefined();
      expect('hwnd' in plain).toBe(false);
    }

    const positioned = items.find((item) => item.displayName === '位置つき - Word');
    expect(positioned?.type).toBe('window');
    if (positioned?.type === 'window') {
      expect(positioned).toMatchObject({ x: 100, y: 200, width: 800, height: 600 });
    }
  });
});
