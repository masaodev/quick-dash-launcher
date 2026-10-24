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
 * 貼り付ける先のグループを作り、見出しを 2 回クリックして選ぶ（1 回目で閉じるので、2 回目で開き直す）
 *
 * グループのあるワークスペースでは、選んだグループに貼る（未分類は無い。A3-157）
 */
async function selectPasteGroup(workspaceWindow: Page, name: string): Promise<void> {
  await workspaceWindow.evaluate(async (groupName) => {
    const api = window.electronAPI.workspaceAPI;
    const [workspace] = await api.loadWorkspaces();
    await api.createGroup(groupName, undefined, undefined, workspace.id);
  }, name);
  const header = workspaceWindow.locator('.workspace-group-header', { hasText: name });
  await header.click();
  await header.click();
}

/**
 * ワークスペースへの Ctrl+V 貼り付けの振り分け
 * - ただのテキストはフォルダにならず、クリップボードアイテムになる（以前は「拡張子なし → folder」だった）
 * - URL は URL アイテム、Windows のパスは起動アイテムになる
 */
test.describe('QuickDashLauncher - ワークスペースへの貼り付け', () => {
  // 文字列の振り分けの細部は単体（pasteClassifier.test.ts）が確かめている。
  // ここでは貼るとその種類のアイテムとして保存され、カードが出る配線を確かめる
  test('貼ったものの種類で、クリップボード・URL・起動アイテムに振り分けて保存する', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    const text = '会議メモ\n二行目も残る';
    await selectPasteGroup(workspaceWindow, '貼り付け先');

    await test.step('ただのテキスト', async () => {
      await pasteText(electronApp, workspaceWindow, text);
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: '会議メモ' })
      ).toBeVisible({ timeout: 10000 });
    });

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

    await test.step('「パスのコピー」の引用符付き・実在しないパス', async () => {
      await pasteText(electronApp, workspaceWindow, '"C:\\存在しない\\フォルダ"');
      await expect(
        workspaceWindow.locator('.workspace-item-card', { hasText: 'フォルダ' })
      ).toBeVisible({ timeout: 10000 });
    });

    const items = await workspaceWindow.evaluate(() => window.electronAPI.workspaceAPI.loadItems());
    const byName = (name: string) => items.find((item) => item.displayName === name);

    await test.step('テキストはクリップボードアイテムとして全文が保存される', async () => {
      const added = byName('会議メモ');
      expect(added?.type).toBe('clipboard');
      if (added?.type !== 'clipboard') return;
      expect(added.formats).toContain('text');
      const dataFile = path.join(configHelper.getConfigDir(), added.dataFileRef);
      expect(fs.existsSync(dataFile)).toBe(true);
      const saved = JSON.parse(fs.readFileSync(dataFile, 'utf-8')) as { text?: string };
      expect(saved.text).toBe(text);
      // 取り込んだ実データをそのまま使い、複製を作らない（使われない実データを残さない）
      const dataDir = path.dirname(dataFile);
      expect(fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'))).toEqual([
        path.basename(added.dataFileRef),
      ]);
    });

    await test.step('URL は URL アイテム、パスは起動アイテムになる', async () => {
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

  test('余白の右クリックの「貼り付け」（webContents.paste）でも、ファイル以外の URL が足せる', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    await electronApp.evaluate(({ clipboard }) => clipboard.writeText('https://example.org/menu'));
    await selectPasteGroup(workspaceWindow, 'メニューで貼る先');
    await workspaceWindow.bringToFront();
    // メニューの「📋 貼り付け」がすることと同じ（以前は paste イベントでファイルしか扱わず、何も足されなかった）
    // ワークスペースはメインのレンダラーから window.open で開くので、URL ではなくタイトルで探す
    await electronApp.evaluate(({ BrowserWindow }) => {
      const ws = BrowserWindow.getAllWindows().find((win) => win.getTitle() === 'Workspace');
      ws?.webContents.paste();
    });
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: 'https://example.org/menu' })
    ).toBeVisible({ timeout: 15000 });
  });

  test('グループのあるワークスペースで、グループを選ばずに貼ると足さずに知らせる（A3-157）', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    await workspaceWindow.evaluate(async () => {
      const api = window.electronAPI.workspaceAPI;
      const [workspace] = await api.loadWorkspaces();
      await api.createGroup('選ばないグループ', undefined, undefined, workspace.id);
    });
    await expect(
      workspaceWindow.locator('.workspace-group-header', { hasText: '選ばないグループ' })
    ).toBeVisible();
    await pasteText(electronApp, workspaceWindow, 'https://example.net/nowhere');
    await expect(
      workspaceWindow.getByText(
        '貼り付ける先のグループの見出しをクリックしてから、貼り付けてください'
      )
    ).toBeVisible();
    const items = await workspaceWindow.evaluate(() => window.electronAPI.workspaceAPI.loadItems());
    expect(items.some((i) => i.displayName === 'https://example.net/nowhere')).toBe(false);
  });

  test('貼り付け先のグループは見出しに枠で見え、閉じていれば開き、中のトーストでグループ名を添えて知らせる', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    await workspaceWindow.evaluate(async () => {
      const api = window.electronAPI.workspaceAPI;
      const [workspace] = await api.loadWorkspaces();
      await api.createGroup('閉じた貼り付け先', undefined, undefined, workspace.id);
      await api.createGroup('ほかのグループ', undefined, undefined, workspace.id);
    });
    const header = workspaceWindow.locator('.workspace-group-header', {
      hasText: '閉じた貼り付け先',
    });
    // 1 回クリックすると閉じる。閉じても貼り付け先として選ばれ、枠が付く
    await header.click();
    await expect(header).toHaveClass(/paste-target/);
    await expect(
      workspaceWindow.locator('.workspace-group-header.paste-target', { hasText: 'ほかのグループ' })
    ).toHaveCount(0);

    await pasteText(electronApp, workspaceWindow, 'https://example.com/closed');
    await expect(
      workspaceWindow.getByText('https://example.com/closed を「閉じた貼り付け先」に追加しました')
    ).toBeVisible({ timeout: 10000 });
    // 閉じていたグループは開いて、入ったものが見える
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: 'https://example.com/closed' })
    ).toBeVisible();
  });

  test('ワークスペースを切り替えると貼り付け先の選択が外れ、前のワークスペースのグループには入らない', async ({
    electronApp,
    mainWindow,
  }) => {
    await new TestUtils(mainWindow).waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');
    await workspaceWindow.evaluate(async () => {
      const api = window.electronAPI.workspaceAPI;
      const [workspace] = await api.loadWorkspaces();
      await api.createGroup('前のワークスペースの先', undefined, undefined, workspace.id);
      const other = await api.createWorkspace('切り替え先');
      await api.createGroup('切り替え先のグループ', undefined, undefined, other.id);
    });
    const header = workspaceWindow.locator('.workspace-group-header', {
      hasText: '前のワークスペースの先',
    });
    await header.click();
    await expect(header).toHaveClass(/paste-target/);

    await workspaceWindow
      .locator('.workspace-tab-bar .tab-button', { hasText: '切り替え先' })
      .click();
    await expect(
      workspaceWindow.locator('.workspace-group-header', { hasText: '切り替え先のグループ' })
    ).toBeVisible();
    await expect(workspaceWindow.locator('.workspace-group-header.paste-target')).toHaveCount(0);

    await pasteText(electronApp, workspaceWindow, 'https://example.com/elsewhere');
    await expect(
      workspaceWindow.getByText(
        '貼り付ける先のグループの見出しをクリックしてから、貼り付けてください'
      )
    ).toBeVisible();
    const items = await workspaceWindow.evaluate(() => window.electronAPI.workspaceAPI.loadItems());
    expect(items.some((i) => i.displayName === 'https://example.com/elsewhere')).toBe(false);
  });

  test('クリップボードアイテムの編集画面にはパス欄を出さず、名前を変えても中身の参照は保つ', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const workspaceWindow = await getWorkspaceWindow(electronApp);
    await workspaceWindow.waitForLoadState('domcontentloaded');

    await pasteText(electronApp, workspaceWindow, '編集するメモ');
    await expect(
      workspaceWindow.locator('.workspace-item-card', { hasText: '編集するメモ' })
    ).toBeVisible({ timeout: 10000 });
    const before = (
      await workspaceWindow.evaluate(() => window.electronAPI.workspaceAPI.loadItems())
    ).find((item) => item.displayName === '編集するメモ');
    if (before?.type !== 'clipboard') throw new Error('クリップボードアイテムになっていない');

    const [editor] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 15000 }),
      workspaceWindow.evaluate(
        (id) => window.electronAPI.workspaceAPI.openItemEditor(id),
        before.id
      ),
    ]);
    await editor.locator('.workspace-editor-page').waitFor({ state: 'visible', timeout: 15000 });
    const nameInput = editor.getByPlaceholder('クリップボードアイテムの表示名を入力');
    await expect(nameInput).toHaveValue('編集するメモ');
    // パスの入力欄そのものが無い（ラベルの文言に頼らない）
    await expect(editor.getByPlaceholder('ファイルパス、URL、またはカスタムURIを入力')).toHaveCount(
      0
    );
    // メインの編集画面と同じく、内容欄とカスタムアイコンの欄が出る。
    // 中身がテキストだけなので「テキストを書く」で開き、保存してある全文を見せる
    await expect(editor.getByRole('textbox', { name: '保存するテキスト' })).toHaveValue(
      '編集するメモ'
    );
    await expect(editor.locator('.custom-icon-section')).toBeVisible();

    await nameInput.fill('編集したメモ');
    await Promise.all([
      editor.waitForEvent('close', { timeout: 10000 }),
      editor.locator('.modal-actions button', { hasText: '保存' }).click(),
    ]);

    let after:
      Awaited<ReturnType<typeof window.electronAPI.workspaceAPI.loadItems>>[number] | undefined;
    await expect
      .poll(async () => {
        const items = await workspaceWindow.evaluate(() =>
          window.electronAPI.workspaceAPI.loadItems()
        );
        after = items.find((item) => item.id === before.id);
        return after?.displayName;
      })
      .toBe('編集したメモ');
    expect(after?.type).toBe('clipboard');
    if (after?.type !== 'clipboard') return;
    expect(after.dataFileRef).toBe(before.dataFileRef);
  });
});
