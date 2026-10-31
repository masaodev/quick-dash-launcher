import * as fs from 'fs';
import * as path from 'path';

import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * 検索の範囲（A3-152）
 * - ランチャー: 設定「検索でメモにも当てる」（既定オフ）
 * - ワークスペースの絞り込み: スペース区切りの AND。「すべて」では語がグループ名とアイテム名にまたがってよい
 * - 設定「検索で全角と半角を区別しない」「検索でひらがなとカタカナを区別しない」（既定オフ。A3-209）
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
  test('設定をオンにすると、ランチャーの検索がメモにも当たる', async ({
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

    await test.step('オンにするとメモでも当たり、表示名とまたがる AND も当たる。パスには当てない', async () => {
      await mainWindow.evaluate(() => window.electronAPI.setMultipleSettings({ searchMemo: true }));
      await expect(mainWindow.locator('.item', { hasText: '社内ポータル' })).toBeVisible();
      await utils.searchFor('portal.example');
      await expect(mainWindow.locator('.item')).toHaveCount(0);
      await utils.searchFor('社内 勤怠');
      await expect(mainWindow.locator('.item', { hasText: '社内ポータル' })).toBeVisible();
    });

    await test.step('オフに戻すと表示名だけに戻る', async () => {
      await mainWindow.evaluate(() =>
        window.electronAPI.setMultipleSettings({ searchMemo: false })
      );
      await expect(mainWindow.locator('.item')).toHaveCount(0);
    });
  });

  test('全角・半角、ひらがな・カタカナは既定で区別し、設定をオンにするとメインとワークスペースで区別しない', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    configHelper.addItemToFile('data.json', {
      id: 'e2ewid01',
      type: 'item',
      displayName: 'テスト手順書',
      path: 'https://example.com/test',
    });
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();
    const item = mainWindow.locator('.item', { hasText: 'テスト手順書' });

    await test.step('既定ではランチャーの検索で ﾃｽﾄ・てすと は当たらない', async () => {
      await utils.searchFor('ﾃｽﾄ');
      await expect(mainWindow.locator('.item')).toHaveCount(0);
      await utils.searchFor('てすと');
      await expect(mainWindow.locator('.item')).toHaveCount(0);
    });

    await test.step('全角と半角を区別しないと ﾃｽﾄ で当たる（てすと は当たらない）', async () => {
      await mainWindow.evaluate(() =>
        window.electronAPI.setMultipleSettings({ searchIgnoreWidth: true })
      );
      await utils.searchFor('ﾃｽﾄ');
      await expect(item).toBeVisible();
      await utils.searchFor('てすと');
      await expect(mainWindow.locator('.item')).toHaveCount(0);
    });

    await test.step('ひらがなとカタカナも区別しないと てすと で当たる', async () => {
      await mainWindow.evaluate(() =>
        window.electronAPI.setMultipleSettings({ searchIgnoreKana: true })
      );
      await expect(item).toBeVisible();
    });

    await test.step('ワークスペースの絞り込みも同じ設定に従う', async () => {
      const workspaceWindow = await getWorkspaceWindow(electronApp);
      await workspaceWindow.waitForLoadState('domcontentloaded');
      await workspaceWindow.evaluate(async () => {
        const api = window.electronAPI.workspaceAPI;
        const [ws] = await api.loadWorkspaces();
        const group = await api.createGroup('資料', undefined, undefined, ws.id);
        await api.addItem(
          { displayName: 'テスト結果.xlsx', path: 'r.xlsx', type: 'file' },
          group.id,
          ws.id
        );
        await api.addItem(
          { displayName: '週報.xlsm', path: 'w.xlsm', type: 'file' },
          group.id,
          ws.id
        );
      });
      const card = (name: string) =>
        workspaceWindow.locator('.workspace-item-card', { hasText: name });
      await expect(card('週報.xlsm')).toBeVisible({ timeout: 10000 });
      await workspaceWindow.keyboard.press('Control+f');
      const input = workspaceWindow.locator('.workspace-filter-input');
      await input.fill('てすと ＸＬＳＸ');
      await expect(card('テスト結果.xlsx')).toBeVisible();
      await expect(card('週報.xlsm')).toHaveCount(0);

      await mainWindow.evaluate(() =>
        window.electronAPI.setMultipleSettings({
          searchIgnoreWidth: false,
          searchIgnoreKana: false,
        })
      );
      await expect(card('テスト結果.xlsx')).toHaveCount(0);
    });
  });

  test('設定をオンにすると、検索結果が「名前が語で始まる → よく開く順」に並ぶ', async ({
    mainWindow,
    configHelper,
  }) => {
    for (const [id, displayName] of [
      ['e2eord01', '議事録ぺんぎん'],
      ['e2eord02', 'ぺんぎんの書き方'],
      ['e2eord03', 'ぺんぎん帳'],
    ]) {
      configHelper.addItemToFile('data.json', {
        id,
        type: 'item',
        displayName,
        path: `https://example.com/${id}`,
      });
    }
    // 起動の記録（本体は初めて使うときに読むので、先に置けばそれを使う）
    fs.writeFileSync(
      path.join(configHelper.getConfigDir(), 'item-usage.json'),
      JSON.stringify({
        version: 1,
        since: 0,
        byId: {
          e2eord01: { count: 50, lastLaunchedAt: 1 },
          e2eord03: { count: 5, lastLaunchedAt: 1 },
        },
        byPath: {},
      })
    );
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();
    const names = async () =>
      (await mainWindow.locator('.item .item-name').allTextContents()).map((n) => n.trim());

    await test.step('既定（オフ）では今までどおりの順（名前順）', async () => {
      await utils.searchFor('ぺんぎん');
      await expect.poll(names).toEqual(['ぺんぎんの書き方', 'ぺんぎん帳', '議事録ぺんぎん']);
    });

    await test.step('オンにすると、語で始まるものが上、その中でよく開くものが上', async () => {
      await mainWindow.evaluate(() =>
        window.electronAPI.setMultipleSettings({ searchSortByUsage: true })
      );
      await expect.poll(names).toEqual(['ぺんぎん帳', 'ぺんぎんの書き方', '議事録ぺんぎん']);
    });

    await test.step('検索欄が空なら並べ替えない', async () => {
      await utils.searchFor('');
      const all = await names();
      expect(all.indexOf('ぺんぎんの書き方')).toBeLessThan(all.indexOf('ぺんぎん帳'));
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
