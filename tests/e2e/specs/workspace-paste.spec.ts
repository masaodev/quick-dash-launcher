import fs from 'fs';
import path from 'path';

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

/** クリップボードにテキストを入れて、ワークスペース画面で Ctrl+V を押す */
async function pasteText(
  electronApp: ElectronApplication,
  workspaceWindow: Page,
  text: string
): Promise<void> {
  await electronApp.evaluate(({ clipboard }, value) => clipboard.writeText(value), text);
  await workspaceWindow.bringToFront();
  await workspaceWindow.locator('body').click({ position: { x: 5, y: 5 } });
  await workspaceWindow.keyboard.press('Control+v');
}

/**
 * ワークスペースへの Ctrl+V 貼り付けの振り分け
 * - ただのテキストはフォルダにならず、クリップボードアイテムになる（以前は「拡張子なし → folder」だった）
 * - URL は URL アイテム、Windows のパスは起動アイテムになる
 */
test.describe('QuickDashLauncher - ワークスペースへの貼り付け', () => {
  test('ただのテキストはクリップボードアイテムとして全文が保存される', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const text = '会議メモ\n二行目も残る';
    await pasteText(electronApp, workspaceWindow, text);

    const card = workspaceWindow.locator('.workspace-item-card', { hasText: '会議メモ' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const items = await workspaceWindow.evaluate(() => window.electronAPI.workspaceAPI.loadItems());
    const added = items.find((item) => item.displayName === '会議メモ');
    expect(added).toBeDefined();
    expect(added?.type).toBe('clipboard');
    if (added?.type !== 'clipboard') return;

    expect(added.formats).toContain('text');
    const dataFile = path.join(configHelper.getConfigDir(), added.dataFileRef);
    expect(fs.existsSync(dataFile)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf-8')) as { text?: string };
    expect(saved.text).toBe(text);
  });

  test('URL は URL アイテム、Windows のパスは起動アイテムになる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    await test.step('URL', async () => {
      await pasteText(electronApp, workspaceWindow, 'https://example.com/');
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: 'https://example.com/' })
      ).toBeVisible({ timeout: 15000 });
    });

    await test.step('実在するパス（アイコン付きの通常経路）', async () => {
      await pasteText(electronApp, workspaceWindow, 'C:\\Windows\\System32\\notepad.exe');
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: 'notepad.exe' })
      ).toBeVisible({ timeout: 15000 });
    });

    await test.step('「パスのコピー」の引用符付き・実在しないパスも起動アイテムになる', async () => {
      await pasteText(electronApp, workspaceWindow, '"C:\\存在しない\\フォルダ"');
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: 'フォルダ' })
      ).toBeVisible({ timeout: 10000 });
    });

    const items = await workspaceWindow.evaluate(() => window.electronAPI.workspaceAPI.loadItems());
    const byName = (name: string) => items.find((item) => item.displayName === name);

    const url = byName('https://example.com/');
    expect(url?.type).toBe('item');
    if (url?.type === 'item') expect(url.launcherType).toBe('url');

    const notepad = byName('notepad.exe');
    expect(notepad?.type).toBe('item');
    if (notepad?.type === 'item') expect(notepad.launcherType).toBe('app');

    const missing = byName('フォルダ');
    expect(missing?.type).toBe('item');
    if (missing?.type === 'item') {
      expect(missing.path).toBe('C:\\存在しない\\フォルダ');
      expect(missing.launcherType).toBe('folder');
    }

    // ただの文字列がフォルダになっていないこと（以前の不具合の再発防止）
    expect(items.some((item) => item.type === 'item' && item.path === 'https')).toBe(false);
  });
});
