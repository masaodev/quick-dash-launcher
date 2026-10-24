import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils, NativeMenuTestHelper } from '../helpers/test-utils';

/**
 * 右クリックと ＋ の入口（A3-146）
 *
 * ネイティブメニューは Playwright から押せないので、Menu.prototype.popup を差し替えて出た項目の文言を読み、
 * 項目を押したことは IPC のイベントを直接送って確かめる（context-menu.spec.ts と同じやり方）
 */

/** 次に出るネイティブメニューの項目（区切り以外の文言）を記録するようにする */
async function captureMenuLabels(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ Menu }) => {
    const g = globalThis as { __e2eMenuLabels?: string[] | null };
    g.__e2eMenuLabels = null;
    Menu.prototype.popup = function (this: { items: Array<{ type: string; label: string }> }) {
      g.__e2eMenuLabels = this.items.filter((i) => i.type !== 'separator').map((i) => i.label);
    };
  });
}

async function readMenuLabels(electronApp: ElectronApplication): Promise<string[]> {
  return electronApp.evaluate(
    () => (globalThis as { __e2eMenuLabels?: string[] | null }).__e2eMenuLabels ?? []
  );
}

/** 常駐しているワークスペースウィンドウ（workspace-groups.spec.ts と同じ） */
async function getWorkspaceWindow(electronApp: ElectronApplication): Promise<Page> {
  const isWorkspace = async (win: Page) =>
    (await win.title()) === 'Workspace' || win.url().includes('workspace.html');
  for (const win of electronApp.windows()) {
    if (await isWorkspace(win)) return win;
  }
  return electronApp.waitForEvent('window', { predicate: isWorkspace, timeout: 10000 });
}

/** ワークスペースウィンドウへメニューのイベントを送る（URL が about:blank なのでタイトルで探す） */
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

/**
 * アイテムを選ぶウィンドウ（独立した子ウィンドウ）を待つ（workspace-item-picker.spec.ts と同じ）
 */
async function waitForPickerWindow(electronApp: ElectronApplication): Promise<Page> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    for (const win of electronApp.windows()) {
      if (win.isClosed()) continue;
      try {
        if ((await win.locator('.set-picker-page .set-picker-modal').count()) > 0) return win;
      } catch {
        // 書き込み前・閉じた直後のウィンドウは無視する
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('アイテムを選ぶウィンドウが開きませんでした');
}

test.describe('QuickDashLauncher - メインウィンドウの右クリックの入口', () => {
  test('ふつうのアイテムには「削除…」が出て、確認してから消える。自動取込のアイテムには出ない', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    configHelper.addItemToFile('data.json', {
      id: 'e2eauto1',
      type: 'item',
      displayName: '自動取込のブックマーク',
      path: 'https://example.com/auto',
      autoImportRuleId: 'rule-e2e',
    });
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();

    await test.step('右クリックのメニューの最後に「削除…」が出る', async () => {
      await captureMenuLabels(electronApp);
      await mainWindow.locator('.item', { hasText: 'Wikipedia' }).click({ button: 'right' });
      await expect.poll(() => readMenuLabels(electronApp)).toContain('🗑️ 削除…');
      const labels = await readMenuLabels(electronApp);
      expect(labels[labels.length - 1]).toBe('🗑️ 削除…');
    });

    await test.step('自動取込のアイテムには「削除…」が出ない', async () => {
      await captureMenuLabels(electronApp);
      await mainWindow
        .locator('.item', { hasText: '自動取込のブックマーク' })
        .click({ button: 'right' });
      await expect.poll(() => readMenuLabels(electronApp)).toContain('✏️ 編集');
      expect(await readMenuLabels(electronApp)).not.toContain('🗑️ 削除…');
    });

    const wikipedia = await mainWindow.evaluate(async () => {
      const items = await window.electronAPI.loadDataFiles('internal');
      return items.find((i) => 'displayName' in i && i.displayName === 'Wikipedia');
    });
    expect(wikipedia).toBeTruthy();
    const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);
    const dialog = mainWindow.locator('[data-testid="confirm-dialog"]');

    await test.step('確認でキャンセルすると消えない（Enter でアイテムを開かない）', async () => {
      await menuHelper.sendIpcToRenderer('launcher-menu-delete-item', wikipedia);
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('「Wikipedia」を削除してもよろしいですか？');
      await dialog.locator('[data-testid="confirm-dialog-cancel-button"]').click();
      await expect(dialog).toHaveCount(0);
      await expect(mainWindow.locator('.item', { hasText: 'Wikipedia' })).toBeVisible();
    });

    await test.step('確認で「削除」を押すと一覧とデータファイルから消える', async () => {
      await menuHelper.sendIpcToRenderer('launcher-menu-delete-item', wikipedia);
      await dialog.locator('[data-testid="confirm-dialog-confirm-button"]').click();
      await expect(mainWindow.locator('.item', { hasText: 'Wikipedia' })).toHaveCount(0, {
        timeout: 10000,
      });
      const names = configHelper
        .readDataFile('data.json')
        .items.map((item) => ('displayName' in item ? item.displayName : ''));
      expect(names).not.toContain('Wikipedia');
    });
  });

  test('一覧の余白の右クリックに追加の入口が出て、クリップボードのパスから登録画面を開ける', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    await test.step('余白を右クリックすると追加の項目が出る', async () => {
      // アイテムが多いと一覧が窓いっぱいになり余白が無いので、1 件に絞ってから
      await utils.searchFor('電卓');
      await expect(mainWindow.locator('.item')).toHaveCount(1);
      await captureMenuLabels(electronApp);
      const list = mainWindow.locator('.item-list');
      const box = await list.boundingBox();
      if (!box) throw new Error('一覧が見つかりません');
      // 行の無い下の余白を右クリックする
      await list.click({ button: 'right', position: { x: 20, y: box.height - 10 } });
      await expect
        .poll(() => readMenuLabels(electronApp))
        .toEqual([
          '📄 アイテムを追加…',
          '📋 クリップボードのパス・URL から追加…',
          '🔖 ブラウザのブックマークから追加',
          '💻 インストール済みアプリから追加',
        ]);
    });

    await test.step('クリップボードのパスを初期値にして登録画面が開く', async () => {
      await electronApp.evaluate(({ clipboard }) => {
        clipboard.writeText('C:\\Windows\\System32\\notepad.exe');
      });
      const menuHelper = new NativeMenuTestHelper(electronApp, mainWindow);
      await menuHelper.sendIpcToRenderer('launcher-blank-menu-register-from-clipboard');
      const register = await utils.waitForRegisterWindow(electronApp);
      await expect(register.locator('.path-input-group input').first()).toHaveValue(
        'C:\\Windows\\System32\\notepad.exe'
      );
      await utils.pressEscapeToCloseRegisterModal();
    });
  });
});

test.describe('QuickDashLauncher - 文字入力欄の右クリック', () => {
  test('検索欄を右クリックすると、切り取り・コピー・貼り付けなどのメニューが出る', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await utils.searchFor('Google');
    await captureMenuLabels(electronApp);
    await mainWindow.locator('input.search-box').click({ button: 'right' });
    await expect
      .poll(() => readMenuLabels(electronApp))
      .toEqual(['元に戻す', 'やり直し', '切り取り', 'コピー', '貼り付け', 'すべて選択']);
  });
});

test.describe('QuickDashLauncher - ワークスペースの右クリックと ＋ の入口', () => {
  test('＋ は 1 つにまとまり、タブ・余白・「未分類」の見出しの右クリックに追加の項目が出る', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const [workspace] = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.loadWorkspaces()
    );
    await workspaceWindow.evaluate(
      (id) =>
        window.electronAPI.workspaceAPI.addItem(
          { displayName: '未分類のメモ帳', path: 'notepad.exe', type: 'app' },
          undefined,
          id
        ),
      workspace.id
    );
    await expect(
      workspaceWindow.locator('.workspace-group-name', { hasText: '未分類' })
    ).toBeVisible({ timeout: 10000 });

    await test.step('タブの横の ＋ は無く、ヘッダーの ＋ でグループ・アイテム・ワークスペースを選ぶ', async () => {
      await expect(workspaceWindow.locator('.workspace-add-tab-btn')).toHaveCount(0);
      await captureMenuLabels(electronApp);
      await workspaceWindow.getByTestId('workspace-add-menu-button').click();
      await expect
        .poll(() => readMenuLabels(electronApp))
        .toEqual(['➕ グループを追加', '➕ ワークスペースを追加']);
    });

    await test.step('タブの右クリックにグループの追加と開閉が出る', async () => {
      await captureMenuLabels(electronApp);
      await workspaceWindow
        .locator('.workspace-tab-bar .tab-button', {
          has: workspaceWindow.locator('.workspace-tab-name'),
        })
        .first()
        .click({ button: 'right' });
      await expect.poll(() => readMenuLabels(electronApp)).toContain('➕ グループを追加');
      const labels = await readMenuLabels(electronApp);
      expect(labels).toEqual(
        expect.arrayContaining(['➕ ワークスペースを追加', '🔽 すべて展開', '🔼 すべて折りたたむ'])
      );
    });

    await test.step('余白の右クリック', async () => {
      await captureMenuLabels(electronApp);
      await workspaceWindow.locator('.workspace-item-list').dispatchEvent('contextmenu');
      await expect
        .poll(() => readMenuLabels(electronApp))
        .toEqual(['➕ グループを追加', '📋 貼り付け', '🔽 すべて展開', '🔼 すべて折りたたむ']);
    });

    await test.step('「未分類」の見出しの右クリック', async () => {
      await captureMenuLabels(electronApp);
      await workspaceWindow
        .locator('.workspace-uncategorized-section .workspace-group-header')
        .click({ button: 'right' });
      await expect
        .poll(() => readMenuLabels(electronApp))
        .toEqual(['➕ アイテムを追加', '📁 グループにまとめる']);
    });
  });

  test('メニューの項目でグループの追加・未分類のまとめ・開閉・ワークスペースの追加ができる', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const api = (fn: string, ...args: unknown[]) =>
      workspaceWindow.evaluate(
        ({ fn, args }) =>
          (
            window.electronAPI.workspaceAPI as unknown as Record<
              string,
              (...a: unknown[]) => Promise<unknown>
            >
          )[fn](...args),
        { fn, args }
      );
    const [workspace] = (await api('loadWorkspaces')) as Array<{ id: string }>;
    await api(
      'addItem',
      { displayName: 'まとめるA', path: 'a.txt', type: 'file' },
      undefined,
      workspace.id
    );
    await api(
      'addItem',
      { displayName: 'まとめるB', path: 'b.txt', type: 'file' },
      undefined,
      workspace.id
    );
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: 'まとめるB' })
    ).toBeVisible({
      timeout: 10000,
    });

    await test.step('「グループにまとめる」で未分類のアイテムが新しいグループに入る', async () => {
      await sendToWorkspace(electronApp, 'workspace-menu-group-uncategorized', workspace.id);
      await expect
        .poll(async () => {
          const items = (await api('loadItems')) as Array<{
            displayName: string;
            groupId?: string;
          }>;
          return items.filter((i) => i.displayName.startsWith('まとめる') && i.groupId).length;
        })
        .toBe(2);
      await expect(workspaceWindow.locator('.workspace-uncategorized-section')).toHaveCount(0);
    });

    await test.step('「グループを追加」でグループが増える', async () => {
      const before = ((await api('loadGroups')) as unknown[]).length;
      await sendToWorkspace(electronApp, 'workspace-menu-add-group', workspace.id);
      await expect
        .poll(async () => ((await api('loadGroups')) as unknown[]).length)
        .toBe(before + 1);
    });

    await test.step('「すべて折りたたむ」「すべて展開」', async () => {
      await sendToWorkspace(electronApp, 'workspace-menu-set-all-collapsed', workspace.id, true);
      await expect
        .poll(async () =>
          ((await api('loadGroups')) as Array<{ collapsed?: boolean }>).every((g) => g.collapsed)
        )
        .toBe(true);
      await sendToWorkspace(electronApp, 'workspace-menu-set-all-collapsed', workspace.id, false);
      await expect
        .poll(async () =>
          ((await api('loadGroups')) as Array<{ collapsed?: boolean }>).some((g) => g.collapsed)
        )
        .toBe(false);
    });

    await test.step('「ワークスペースを追加」で空のワークスペースができ、［＋ グループを追加］で足せる', async () => {
      await sendToWorkspace(electronApp, 'workspace-menu-add-workspace');
      await expect.poll(async () => ((await api('loadWorkspaces')) as unknown[]).length).toBe(2);
      await workspaceWindow
        .locator('.workspace-tab-bar .tab-button', { hasText: 'ワークスペース 2' })
        .click();
      const empty = workspaceWindow.locator('.workspace-empty');
      await expect(empty).toBeVisible();
      await empty.getByRole('button', { name: '＋ グループを追加' }).click();
      await expect
        .poll(async () => {
          const [, second] = (await api('loadWorkspaces')) as Array<{ id: string }>;
          const groups = (await api('loadGroups')) as Array<{ workspaceId: string }>;
          return groups.filter((g) => g.workspaceId === second.id).length;
        })
        .toBe(1);
    });
  });

  test('未分類へ追加する画面で選んだアイテムが、どのグループにも入らずに入る', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const [workspace] = await workspaceWindow.evaluate(() =>
      window.electronAPI.workspaceAPI.loadWorkspaces()
    );

    await workspaceWindow.evaluate(
      (id) => window.electronAPI.workspaceAPI.openItemPicker(`ws:${id}`),
      workspace.id
    );
    const picker = await waitForPickerWindow(electronApp);

    await expect(picker.locator('.set-modal-header h3')).toHaveText('「未分類」に追加するアイテム');
    await expect(picker.locator('.workspace-dest')).toContainText('未分類');
    await picker.locator('.set-picker-row', { hasText: '電卓' }).click();
    const addButton = picker.locator('.modal-actions button', { hasText: '1 件を追加' });
    await Promise.all([picker.waitForEvent('close', { timeout: 10000 }), addButton.click()]);

    await expect
      .poll(async () => {
        const items = await workspaceWindow.evaluate(() =>
          window.electronAPI.workspaceAPI.loadItems()
        );
        const added = items.find((item) => item.displayName === '電卓');
        return added ? { groupId: added.groupId ?? null, workspaceId: added.workspaceId } : null;
      })
      .toEqual({ groupId: null, workspaceId: workspace.id });
  });
});
