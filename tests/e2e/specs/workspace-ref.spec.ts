import * as fs from 'fs';
import * as path from 'path';

import type { ElectronApplication, Page } from '@playwright/test';
import type { AppItem, LauncherItem, WorkspaceItem } from '@common/types';

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

/** 子ウィンドウ（about:blank に中身を書き込む作り）を、セレクターが描かれるまで探す */
async function waitForWindowWith(
  electronApp: ElectronApplication,
  selector: string
): Promise<Page> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    for (const win of electronApp.windows()) {
      if (win.isClosed()) continue;
      try {
        if ((await win.locator(selector).count()) > 0) return win;
      } catch {
        // 書き込み前・閉じた直後のウィンドウは無視する
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`ウィンドウが開きませんでした: ${selector}`);
}

/** メインウィンドウのアイテム（表示名で探す） */
async function mainItem(mainWindow: Page, displayName: string): Promise<LauncherItem> {
  const items: AppItem[] = await mainWindow.evaluate(() =>
    window.electronAPI.loadDataFiles('internal')
  );
  const found = items.find(
    (item): item is LauncherItem => 'displayName' in item && item.displayName === displayName
  );
  if (!found) throw new Error(`メインウィンドウのアイテムが見つかりません: ${displayName}`);
  return found;
}

async function loadWorkspaceItems(workspaceWindow: Page): Promise<WorkspaceItem[]> {
  return workspaceWindow.evaluate(() => window.electronAPI.workspaceAPI.loadItems());
}

function readWorkspaceFile(configDir: string): { items: Record<string, unknown>[] } {
  return JSON.parse(fs.readFileSync(path.join(configDir, 'workspace.json'), 'utf8'));
}

/**
 * 参照アイテム（メインウィンドウのアイテムを id で指すワークスペースのアイテム）
 * - メインウィンドウから足すと既定で参照になり、ファイルには指す id だけを書く
 * - メインウィンドウで直すと、ワークスペースの表示も変わる
 * - ワークスペースでの表示名を付けられ、空にするとメインの表示名に戻る
 * - 元が消えると薄く表示し、別のアイテムを指し直せる
 * - 参照とコピーを行き来できる（1 件ずつ・一括）
 */
test.describe('QuickDashLauncher - ワークスペースの参照アイテム', () => {
  test('メインウィンドウから足すと参照になり、メインで直すとワークスペースにも出る', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const github = await mainItem(mainWindow, 'GitHub');
    const added: WorkspaceItem = await workspaceWindow.evaluate(
      (item) => window.electronAPI.workspaceAPI.addItem(item),
      github
    );

    await test.step('参照で足され、ファイルには中身を書かない', async () => {
      expect(added.ref).toMatchObject({ itemId: github.id, status: 'ok' });
      const stored = readWorkspaceFile(configHelper.getConfigDir()).items.find(
        (item) => item.id === added.id
      );
      expect(stored).toMatchObject({ type: 'ref', refItemId: github.id, lastKnownName: 'GitHub' });
      expect(stored).not.toHaveProperty('path');
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: 'GitHub' })
      ).toBeVisible();
    });

    await test.step('カードには印を付けず、ツールチップで参照と分かる', async () => {
      const card = workspaceWindow.locator(`.workspace-item-card[data-ref="ok"]`).first();
      await expect(card).toBeVisible();
      await expect(card).not.toHaveClass(/workspace-item-card-missing/);
      await expect(card).toHaveAttribute('title', /🔗 メインウィンドウのアイテム: GitHub/);
    });

    await test.step('メインウィンドウで表示名を直すと、ワークスペースも変わる', async () => {
      await mainWindow.evaluate(
        (item) =>
          window.electronAPI.updateItemById({
            id: item.id!,
            newItem: { ...item, displayName: 'GitHub（直した）' },
          }),
        github
      );
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: 'GitHub（直した）' })
      ).toBeVisible({ timeout: 10000 });
      await expect
        .poll(
          () =>
            readWorkspaceFile(configHelper.getConfigDir()).items.find((i) => i.id === added.id)
              ?.lastKnownName
        )
        .toBe('GitHub（直した）');
    });

    await test.step('ワークスペースでの表示名を付け、空にすると戻る', async () => {
      await workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.updateDisplayName(id, 'GH'),
        added.id
      );
      await expect(
        workspaceWindow.locator('.workspace-item-name', { hasText: /^GH$/ })
      ).toBeVisible();
      await workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.updateDisplayName(id, ''),
        added.id
      );
      await expect(
        workspaceWindow.locator('.workspace-item-name', { hasText: 'GitHub（直した）' })
      ).toBeVisible();
    });
  });

  test('その場での名前の変更でワークスペースでの表示名を付け、空にして確定するとメインの表示名に戻る', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const menu = new NativeMenuTestHelper(electronApp, workspaceWindow);

    const wiki = await mainItem(mainWindow, 'Wikipedia');
    const added: WorkspaceItem = await workspaceWindow.evaluate(
      (item) => window.electronAPI.workspaceAPI.addItem(item),
      wiki
    );
    const input = workspaceWindow.locator('.workspace-item-name-input');

    await menu.simulateWorkspaceMenu('rename', added.id);
    await input.fill('ウィキ');
    await input.press('Enter');
    await expect(
      workspaceWindow.locator('.workspace-item-name', { hasText: /^ウィキ$/ })
    ).toBeVisible();

    await menu.simulateWorkspaceMenu('rename', added.id);
    await input.fill('');
    await input.press('Enter');
    await expect(input).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await loadWorkspaceItems(workspaceWindow)).find((i) => i.id === added.id)?.ref?.alias
      )
      .toBeUndefined();
    const card = workspaceWindow.locator(`.workspace-item-card[data-ref="ok"]`, {
      hasText: 'Wikipedia',
    });
    await expect(card).toBeVisible();
  });

  test('元が消えると薄く表示し、別のアイテムを指し直せる', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const notepad = await mainItem(mainWindow, 'メモ帳');
    const added: WorkspaceItem = await workspaceWindow.evaluate(
      (item) => window.electronAPI.workspaceAPI.addItem(item),
      notepad
    );

    await test.step('メインウィンドウで消すと、最後に見た表示名で薄く出る', async () => {
      await mainWindow.evaluate((id) => window.electronAPI.deleteItemsById([{ id }]), notepad.id!);
      const card = workspaceWindow.locator('.workspace-item-card-missing', { hasText: 'メモ帳' });
      await expect(card).toBeVisible({ timeout: 10000 });
      await expect(card).toHaveAttribute('title', /元のアイテムが見つかりません/);
      const items = await loadWorkspaceItems(workspaceWindow);
      expect(items.find((i) => i.id === added.id)).toMatchObject({
        type: 'ref',
        ref: { status: 'missing' },
      });
    });

    await test.step('開こうとしても開かない（失敗を返す）', async () => {
      const item = (await loadWorkspaceItems(workspaceWindow)).find((i) => i.id === added.id)!;
      const result = await workspaceWindow.evaluate(
        (target) => window.electronAPI.workspaceAPI.launchItem(target, { trial: true }),
        item
      );
      expect(result.success).toBe(false);
    });

    await test.step('指す先を選ぶウィンドウで別のアイテムを選ぶと、指し直せる', async () => {
      await workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.openLinkPicker(id),
        added.id
      );
      const picker = await waitForWindowWith(electronApp, '.set-picker-page .set-picker-modal');
      await expect(picker.locator('.workspace-link-banner')).toBeVisible();
      await picker.locator('.set-picker-row', { hasText: '電卓' }).click();
      await Promise.all([
        picker.waitForEvent('close', { timeout: 10000 }),
        picker.locator('.modal-actions .btn-primary, .modal-actions button').last().click(),
      ]);
      await expect(
        workspaceWindow.locator('.workspace-item-card:not(.workspace-item-card-missing)', {
          hasText: '電卓',
        })
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test('参照とコピーを行き来できる（コピーにする・一括で参照に変える）', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const google = await mainItem(mainWindow, 'Google');
    const wikipedia = await mainItem(mainWindow, 'Wikipedia');
    const linked: WorkspaceItem = await workspaceWindow.evaluate(
      (item) => window.electronAPI.workspaceAPI.addItem(item),
      google
    );
    const copy: WorkspaceItem = await workspaceWindow.evaluate(
      (item) =>
        window.electronAPI.workspaceAPI.addItem(
          { ...item, displayName: 'ウィキ', memo: 'コピーのメモ' },
          undefined,
          undefined,
          { copy: true }
        ),
      wikipedia
    );

    await test.step('コピーで足したものは参照を持たない', async () => {
      expect(copy.ref).toBeUndefined();
      const stored = readWorkspaceFile(configHelper.getConfigDir()).items.find(
        (i) => i.id === copy.id
      );
      expect(stored).toMatchObject({ type: 'item', path: 'https://wikipedia.org/' });
    });

    await test.step('参照をコピーにすると、中身をワークスペースに持つ', async () => {
      await workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.convertToCopy(id),
        linked.id
      );
      const stored = readWorkspaceFile(configHelper.getConfigDir()).items.find(
        (i) => i.id === linked.id
      );
      expect(stored).toMatchObject({ type: 'item', displayName: 'Google' });
    });

    await test.step('一括のウィンドウで、パスが同じコピーを参照に変える', async () => {
      const workspaceId = copy.workspaceId;
      await workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.openLinkCopies(id),
        workspaceId
      );
      const page = await waitForWindowWith(electronApp, '.workspace-link-row');
      const row = page.locator('.workspace-link-row', { hasText: 'ウィキ' });
      await expect(row).toContainText('→ Wikipedia');
      await expect(row).toContainText('「ウィキ」をワークスペースでの表示名にする');
      await expect(row).toContainText('メモをメインウィンドウへ移す');
      await expect(page.locator('.workspace-link-row')).toHaveCount(2);
      await Promise.all([
        page.waitForEvent('close', { timeout: 10000 }),
        page.locator('.modal-actions button', { hasText: '2 件を参照に変える' }).click(),
      ]);

      const items = await loadWorkspaceItems(workspaceWindow);
      expect(items.find((i) => i.id === copy.id)).toMatchObject({
        displayName: 'ウィキ',
        memo: 'コピーのメモ',
        ref: { itemId: wikipedia.id, alias: 'ウィキ', status: 'ok' },
      });
      expect(items.find((i) => i.id === linked.id)?.ref?.itemId).toBe(google.id);
      // コピーのメモはメインウィンドウのアイテムへ移る
      await expect
        .poll(async () => (await mainItem(mainWindow, 'Wikipedia')).memo)
        .toBe('コピーのメモ');
    });
  });

  test('メインウィンドウのアイテムを消すとき、参照の数を知らせる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const calc = await mainItem(mainWindow, '電卓');
    await workspaceWindow.evaluate(async (item) => {
      await window.electronAPI.workspaceAPI.addItem(item);
      await window.electronAPI.workspaceAPI.addItem(item);
    }, calc);
    const counts = await mainWindow.evaluate(
      (id) => window.electronAPI.workspaceAPI.countRefs([id, 'noSuchId']),
      calc.id!
    );
    expect(counts).toEqual({ [calc.id!]: 2 });
  });

  test('同じアイテムのコピー 2 件を参照に変えても、先に移したメモを上書きせず、セットの行も付け替える', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const google = await mainItem(mainWindow, 'Google');
    const addCopy = (memo: string) =>
      workspaceWindow.evaluate(
        ({ item, memo }) =>
          window.electronAPI.workspaceAPI.addItem({ ...item, memo }, undefined, undefined, {
            copy: true,
          }),
        { item: google, memo }
      ) as Promise<WorkspaceItem>;
    const first = await addCopy('1 件目のメモ');
    const second = await addCopy('2 件目のメモ');
    // ワークスペースのセットの行が 1 件目のコピーを指している
    const set: WorkspaceItem = await workspaceWindow.evaluate(
      (id) =>
        window.electronAPI.workspaceAPI.createItem({
          type: 'set',
          displayName: 'コピーを指すセット',
          entries: [{ itemId: id }],
        }),
      first.id
    );

    const preview = await workspaceWindow.evaluate(
      (id) => window.electronAPI.workspaceAPI.previewLinkCopies(id),
      first.workspaceId
    );
    expect(preview.entries.find((e) => e.id === first.id)?.memo).toBe('move');
    expect(preview.entries.find((e) => e.id === second.id)?.memo).toBe('conflict');

    await workspaceWindow.evaluate(
      (ids) => window.electronAPI.workspaceAPI.applyLinkCopies(ids),
      [first.id, second.id]
    );
    await expect.poll(async () => (await mainItem(mainWindow, 'Google')).memo).toBe('1 件目のメモ');
    const items = await loadWorkspaceItems(workspaceWindow);
    const relinked = items.find((i) => i.id === set.id);
    expect(relinked?.type === 'set' && relinked.entries[0].itemId).toBe(google.id);
  });

  test('コピーをメインウィンドウへ移すと、メインウィンドウのアイテムになり、ワークスペース側は参照になる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    const copy: WorkspaceItem = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.createItem({
        type: 'item',
        displayName: '移すアイテム',
        path: 'https://example.com/move-to-main',
        memo: '移すアイテムのメモ',
      })
    );
    // 移すアイテムを指すワークスペースのセット（移したあと、行はメインウィンドウのアイテムを指す）
    const set: WorkspaceItem = await workspaceWindow.evaluate(
      (id) =>
        window.electronAPI.workspaceAPI.createItem({
          type: 'set',
          displayName: '移すセット',
          entries: [{ itemId: id }],
        }),
      copy.id
    );

    await test.step('通常アイテムを移す', async () => {
      const moved = await workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.moveToMain(id),
        copy.id
      );
      expect(moved).toBe(true);
      const main = await mainItem(mainWindow, '移すアイテム');
      expect(main).toMatchObject({
        path: 'https://example.com/move-to-main',
        memo: '移すアイテムのメモ',
      });
      const stored = readWorkspaceFile(configHelper.getConfigDir()).items.find(
        (i) => i.id === copy.id
      );
      expect(stored).toMatchObject({ type: 'ref', refItemId: main.id });
      const items = await loadWorkspaceItems(workspaceWindow);
      const relinked = items.find((i) => i.id === set.id);
      expect(relinked?.type === 'set' && relinked.entries[0].itemId).toBe(main.id);
    });

    await test.step('セットを移す（行はメインウィンドウのアイテムを指したまま）', async () => {
      const main = await mainItem(mainWindow, '移すアイテム');
      await workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.moveToMain(id),
        set.id
      );
      const items: AppItem[] = await mainWindow.evaluate(() =>
        window.electronAPI.loadDataFiles('internal')
      );
      const mainSet = items.find(
        (item) => 'displayName' in item && item.displayName === '移すセット'
      );
      expect(mainSet).toMatchObject({ type: 'set', entries: [{ itemId: main.id }] });
      const stored = readWorkspaceFile(configHelper.getConfigDir()).items.find(
        (i) => i.id === set.id
      );
      expect(stored).toMatchObject({ type: 'ref' });
    });

    await test.step('参照は移さない', async () => {
      const moved = await workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.moveToMain(id),
        copy.id
      );
      expect(moved).toBe(false);
    });
  });
});
