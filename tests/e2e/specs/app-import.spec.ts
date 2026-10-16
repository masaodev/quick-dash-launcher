import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

const MODAL = '.app-import-modal';

/** スキャン結果の雛形（id などの決まった値はここで埋める） */
function scannedApp(
  id: string,
  displayName: string,
  targetPath: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    displayName,
    shortcutPath: `C:\\StartMenu\\${displayName}.lnk`,
    targetPath,
    checked: false,
    targetType: 'app',
    targetExtension: '.exe',
    source: 'lnk',
    isUninstaller: false,
    ...extra,
  };
}

/**
 * 実行環境のスタートメニューに依存しないよう、メインプロセスのスキャンを固定の結果に差し替える。
 * メモ帳は base テンプレートに notepad.exe があるので「登録済み」になる
 */
const SCANNED_APPS = [
  scannedApp('app-1', 'Alpha Editor', 'C:\\Apps\\Alpha\\alpha.exe'),
  scannedApp('app-2', 'Beta Viewer', 'C:\\Apps\\Beta\\beta.exe'),
  scannedApp('app-3', 'Beta Viewer のアンインストール', 'C:\\Apps\\Beta\\unins000.exe', {
    isUninstaller: true,
  }),
  scannedApp('app-4', 'Gamma Manual', 'C:\\Apps\\Gamma\\manual.pdf', {
    targetType: 'other',
    targetExtension: '.pdf',
  }),
  scannedApp('app-5', 'メモ帳', 'notepad.exe'),
];

async function stubScan(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ ipcMain }, apps) => {
    ipcMain.removeHandler('scan-installed-apps');
    ipcMain.handle('scan-installed-apps', () => ({ apps, scanDuration: 1 }));
  }, SCANNED_APPS);
}

/** アイテム管理の「＋ アイテムを追加」の横の「▼」から項目を選ぶ */
async function chooseImportMenu(adminWindow: Page, itemText: string): Promise<void> {
  await adminWindow.locator('.toolbar-split .toolbar-split-toggle').click();
  await adminWindow.locator('.toolbar-split .dropdown-item', { hasText: itemText }).click();
}

/** アプリ取込画面を開く（スキャンは固定の結果） */
async function openAppImport(electronApp: ElectronApplication, adminWindow: Page) {
  await stubScan(electronApp);
  await chooseImportMenu(adminWindow, 'インストール済みアプリを取り込む');
  const modal = adminWindow.locator(MODAL);
  await modal.waitFor({ state: 'visible', timeout: 10000 });
  await expect(modal.locator('.app-import-status')).toContainText('5 件');
  return modal;
}

/**
 * アプリ取込画面
 * - 開いた時点では何も選ばれていない（使うアプリだけを選ぶ）
 * - アンインストーラー・アプリ以外は既定で除外し、「除外したものも表示」で出せる
 * - 取込先の初期値は「選択中のタブに新しいデータファイル（アプリ）」。既存のファイル・新しいタブも選べる
 * - 取込先にすでにあるアプリには「登録済み」の印が付く（新しいファイルなら、そのタブのファイルと照らす）
 * - 選んだ分だけが未保存の変更としてアイテム管理に並ぶ
 */
test.describe('QuickDashLauncher - アプリ取込', () => {
  test('検索で絞って選んだアプリを、選択中のタブの新しいデータファイルに取り込める', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');

    try {
      const modal = await openAppImport(electronApp, adminWindow);
      const fileSelect = modal.getByLabel('取込先のデータファイル');
      const importButton = modal.locator('.import-footer button', { hasText: '取り込む' });

      await test.step('開いた時点では何も選ばれておらず、除外分は一覧に出ない', async () => {
        // アンインストーラーとアプリ以外（PDF）は除外され、3 件が並ぶ
        await expect(modal.locator('.app-table tbody tr[data-index]')).toHaveCount(3);
        await expect(modal.locator('.app-table tbody input:checked')).toHaveCount(0);
        await expect(modal.locator('.import-selection')).toContainText('0 件を選択中');
        await expect(importButton).toBeDisabled();
      });

      await test.step('取込先の初期値は選択中のタブの新しいデータファイル', async () => {
        await expect(modal.getByLabel('取込先のタブ')).toHaveValue('0');
        await expect(fileSelect).toHaveValue('');
        await expect(modal.locator('.import-dest input')).toHaveValue('アプリ');
        await expect(modal.locator('.import-echo')).toHaveText(
          'メイン › アプリ（新規） に取り込む'
        );
      });

      await test.step('タブにあるアプリには「登録済み」が付く', async () => {
        await expect(
          modal
            .locator('.app-table tbody tr', { hasText: 'メモ帳' })
            .locator('.app-registered-badge')
        ).toHaveText('登録済み');
        await expect(
          modal
            .locator('.app-table tbody tr', { hasText: 'Alpha Editor' })
            .locator('.app-registered-badge')
        ).toHaveCount(0);
      });

      await test.step('「除外したものも表示」で除外分が出る', async () => {
        await modal.locator('.app-filter-checkbox', { hasText: '除外したものも表示' }).click();
        await expect(modal.locator('.app-table tbody tr[data-index]')).toHaveCount(5);
        await expect(modal.locator('.app-table tbody tr.excluded')).toHaveCount(2);
        await modal.locator('.app-filter-checkbox', { hasText: '除外したものも表示' }).click();
        await expect(modal.locator('.app-table tbody tr[data-index]')).toHaveCount(3);
      });

      await test.step('検索で絞って選び、検索を変えても選択は残る', async () => {
        const search = modal.locator('.search-input');
        await search.fill('alpha');
        await expect(modal.locator('.app-table tbody tr[data-index]')).toHaveCount(1);
        await modal.locator('.app-table tbody tr', { hasText: 'Alpha Editor' }).click();
        await search.fill('beta');
        await modal
          .locator('.app-table tbody tr', { hasText: 'Beta Viewer' })
          .locator('input[type="checkbox"]')
          .check();
        await search.fill('');
        await expect(modal.locator('.app-table tbody input:checked')).toHaveCount(2);
        await expect(modal.locator('.import-selection')).toContainText('2 件を選択中');
        await expect(importButton).toHaveText('2 件を取り込む');
      });

      await test.step('新しいファイルなら、登録済みを選んでも重複時の処理は出ない', async () => {
        const notepadRow = modal.locator('.app-table tbody tr', { hasText: 'メモ帳' });
        await notepadRow.click();
        await expect(modal.locator('.duplicate-warning-section')).toHaveCount(0);
        await notepadRow.click();
      });

      await test.step('既存のファイルを選ぶと、登録済みを選んだときに重複時の処理が出る', async () => {
        await fileSelect.selectOption('datafiles/data.json');
        await expect(modal.locator('.import-dest input')).toHaveCount(0);
        await expect(modal.locator('.import-echo')).toHaveText('メイン に取り込む');
        const notepadRow = modal.locator('.app-table tbody tr', { hasText: 'メモ帳' });
        await notepadRow.click();
        await expect(modal.locator('.duplicate-warning-section')).toContainText(
          '1 件は取込先に登録済み'
        );
        await notepadRow.click();
        await expect(modal.locator('.duplicate-warning-section')).toHaveCount(0);
        await fileSelect.selectOption('');
      });

      await test.step('取り込むと新しいファイルができ、選んだ分だけが未保存の変更として並ぶ', async () => {
        await importButton.click();
        await expect(modal).toHaveCount(0);
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'Alpha Editor' })).toBeVisible(
          { timeout: 10000 }
        );
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'Beta Viewer' })).toHaveCount(
          1
        );
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'Gamma Manual' })).toHaveCount(
          0
        );
        // 新しいファイルを開いているので、メイン用データファイルのアイテムは並ばない
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'メモ帳' })).toHaveCount(0);
        await expect(adminWindow.locator('.unsaved-changes')).toContainText(
          '未保存の変更があります'
        );
        await expect
          .poll(() => configHelper.readSettings().dataFileTabs?.[0]?.files)
          .toEqual(['datafiles/data.json', 'datafiles/data2.json']);
        expect(configHelper.readSettings().dataFileLabels?.['datafiles/data2.json']).toBe('アプリ');
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('新しいタブを作って取り込める', async ({ electronApp, mainWindow, configHelper }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');

    try {
      const modal = await openAppImport(electronApp, adminWindow);

      await test.step('タブに「＋ 新しいタブ」を選ぶと、タブ名の欄だけが出る（ファイル名はタブ名と同じ）', async () => {
        await modal.getByLabel('取込先のタブ').selectOption({ label: '＋ 新しいタブ' });
        await expect(modal.getByLabel('取込先のデータファイル')).toHaveCount(0);
        await expect(modal.locator('.import-dest input')).toHaveCount(1);
        await modal
          .locator('.import-dest-field', { hasText: 'タブ名' })
          .locator('input')
          .fill('ツール');
        await expect(modal.locator('.import-echo')).toHaveText('ツール（新しいタブ） に取り込む');
      });

      await test.step('取り込むとタブとファイルができ、そのタブが開く', async () => {
        await modal.locator('.app-table tbody tr', { hasText: 'Alpha Editor' }).click();
        await modal.locator('.import-footer button', { hasText: '取り込む' }).click();
        // タブ表示がオフなので、表示するかを聞かれる
        await adminWindow.getByTestId('confirm-dialog-confirm-button').click();
        await expect(modal).toHaveCount(0);
        await expect
          .poll(() => configHelper.readSettings().dataFileTabs?.map((tab) => tab.name))
          .toEqual(['メイン', 'ツール']);
        const settings = configHelper.readSettings();
        expect(settings.dataFileTabs?.[1]?.files).toEqual(['datafiles/data2.json']);
        expect(settings.dataFileLabels?.['datafiles/data2.json']).toBe('ツール');
        expect(settings.showDataFileTabs).toBe(true);
        await expect(adminWindow.getByTestId('admin-tab').nth(1)).toHaveClass(/active/);
        await expect(
          adminWindow.locator('.raw-item-row', { hasText: 'Alpha Editor' })
        ).toBeVisible();
      });
    } finally {
      await adminWindow.close();
    }
  });
});
