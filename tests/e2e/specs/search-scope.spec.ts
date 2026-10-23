import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 検索の範囲（A3-152）
 * - メインウィンドウ: 設定「検索でメモとパスにも当てる」（既定オフ）
 * - ワークスペースの絞り込み: スペース区切りの AND。「すべて」では語がグループ名とアイテム名にまたがってよい
 */

/** 常駐しているワークスペースウィンドウ（workspace-groups.spec.ts と同じ） */
async function getWorkspaceWindow(electronApp: ElectronApplication): Promise<Page> {
  const isWorkspace = async (win: Page) =>
    (await win.title()) === 'Workspace' || win.url().includes('workspace.html');
  for (const win of electronApp.windows()) {
    if (await isWorkspace(win)) return win;
  }
  return electronApp.waitForEvent('window', { predicate: isWorkspace, timeout: 10000 });
}

test.describe('QuickDashLauncher - 検索の範囲', () => {
  test('設定をオンにすると、メインウィンドウの検索がメモとパスにも当たる', async ({
    mainWindow,
    configHelper,
  }) => {
    configHelper.addItemToFile('data.json', {
      id: 'e2emem01',
      type: 'item',
      displayName: '社内ポータル',
      path: 'https://portal.example.com/',
      memo: '勤怠の入力はここ',
    });
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();

    await test.step('既定（オフ）では表示名だけで探す', async () => {
      await utils.searchFor('勤怠');
      await expect(mainWindow.locator('.item')).toHaveCount(0);
    });

    await test.step('オンにするとメモ・パスでも当たり、表示名とまたがる AND も当たる', async () => {
      await mainWindow.evaluate(() =>
        window.electronAPI.setMultipleSettings({ searchMemoAndPath: true })
      );
      await expect(mainWindow.locator('.item', { hasText: '社内ポータル' })).toBeVisible();
      await utils.searchFor('portal.example');
      await expect(mainWindow.locator('.item')).toHaveCount(1);
      await utils.searchFor('社内 勤怠');
      await expect(mainWindow.locator('.item', { hasText: '社内ポータル' })).toBeVisible();
    });

    await test.step('オフに戻すと表示名だけに戻る', async () => {
      await mainWindow.evaluate(() =>
        window.electronAPI.setMultipleSettings({ searchMemoAndPath: false })
      );
      await expect(mainWindow.locator('.item')).toHaveCount(0);
    });
  });

  test('ワークスペースの絞り込みはスペース区切りの AND で、グループ名とアイテム名にまたがる', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    await workspaceWindow.evaluate(async () => {
      const api = window.electronAPI.workspaceAPI;
      const [ws] = await api.loadWorkspaces();
      const kabu = await api.createGroup('株', undefined, undefined, ws.id);
      const work = await api.createGroup('仕事', undefined, undefined, ws.id);
      await api.addItem(
        { displayName: '銘柄選定.xlsm', path: 'a.xlsm', type: 'file' },
        kabu.id,
        ws.id
      );
      await api.addItem(
        { displayName: '信用売却.xlsx', path: 'b.xlsx', type: 'file' },
        kabu.id,
        ws.id
      );
      await api.addItem({ displayName: '週報.xlsm', path: 'c.xlsm', type: 'file' }, work.id, ws.id);
    });
    const card = (name: string) =>
      workspaceWindow.locator('.workspace-item-card', { hasText: name });
    await expect(card('週報.xlsm')).toBeVisible({ timeout: 10000 });

    await workspaceWindow.keyboard.press('Control+f');
    const input = workspaceWindow.locator('.workspace-filter-input');
    await expect(input).toBeFocused();

    await test.step('「株 xlsm」で株グループの xlsm だけが残る', async () => {
      await input.fill('株 xlsm');
      await expect(card('銘柄選定.xlsm')).toBeVisible();
      await expect(card('信用売却.xlsx')).toHaveCount(0);
      await expect(card('週報.xlsm')).toHaveCount(0);
    });

    await test.step('1 語ならグループ名に当たればその中を出す（今までどおり）', async () => {
      await input.fill('株');
      await expect(card('銘柄選定.xlsm')).toBeVisible();
      await expect(card('信用売却.xlsx')).toBeVisible();
      await expect(card('週報.xlsm')).toHaveCount(0);
    });
  });
});
