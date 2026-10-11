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

/** アイテム管理の「アイテムを一括取り込み ▼」から項目を選ぶ */
async function chooseImportMenu(adminWindow: Page, itemText: string): Promise<void> {
  await adminWindow
    .locator('.dropdown-trigger-btn', { hasText: 'アイテムを一括取り込み' })
    .first()
    .click();
  await adminWindow.locator('.dropdown-item', { hasText: itemText }).click();
}

/**
 * アプリ取込画面
 * - 開いた時点では何も選ばれていない（使うアプリだけを選ぶ）
 * - アンインストーラー・アプリ以外は既定で除外し、「除外したものも表示」で出せる
 * - 取込先にすでにあるアプリには「登録済み」の印が付く
 * - 選んだ分だけが未保存の変更としてアイテム管理に並ぶ
 */
test.describe('QuickDashLauncher - アプリ取込', () => {
  test('検索で絞って選んだアプリだけを取り込める', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');
    await stubScan(electronApp);

    try {
      await test.step('開いた時点では何も選ばれておらず、除外分は一覧に出ない', async () => {
        await chooseImportMenu(adminWindow, 'インストール済みアプリを追加');
        const modal = adminWindow.locator(MODAL);
        await modal.waitFor({ state: 'visible', timeout: 10000 });
        await expect(modal.locator('.app-import-status')).toContainText('5 件');
        // アンインストーラーとアプリ以外（PDF）は除外され、3 件が並ぶ
        await expect(modal.locator('.app-table tbody tr[data-index]')).toHaveCount(3);
        await expect(modal.locator('.app-table tbody input:checked')).toHaveCount(0);
        await expect(
          modal.locator('.app-import-footer button', { hasText: '取り込む' })
        ).toBeDisabled();
      });

      await test.step('取込先にあるアプリには「登録済み」が付く', async () => {
        const modal = adminWindow.locator(MODAL);
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
        const modal = adminWindow.locator(MODAL);
        await modal.locator('.app-filter-checkbox', { hasText: '除外したものも表示' }).click();
        await expect(modal.locator('.app-table tbody tr[data-index]')).toHaveCount(5);
        await expect(modal.locator('.app-table tbody tr.excluded')).toHaveCount(2);
        await modal.locator('.app-filter-checkbox', { hasText: '除外したものも表示' }).click();
        await expect(modal.locator('.app-table tbody tr[data-index]')).toHaveCount(3);
      });

      await test.step('検索で絞って選び、検索を変えても選択は残る', async () => {
        const modal = adminWindow.locator(MODAL);
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
        await expect(modal.locator('.app-import-footer')).toContainText('2 件を選択中');
        await expect(
          modal.locator('.app-import-footer button', { hasText: '取り込む' })
        ).toHaveText('取り込む (2件)');
        // 登録済みを選んでいないので重複時の処理は出ない
        await expect(modal.locator('.duplicate-warning-section')).toHaveCount(0);
      });

      await test.step('登録済みを選ぶと重複時の処理が出る', async () => {
        const modal = adminWindow.locator(MODAL);
        const notepadRow = modal.locator('.app-table tbody tr', { hasText: 'メモ帳' });
        await notepadRow.click();
        await expect(modal.locator('.duplicate-warning-section')).toContainText(
          '1 件は取込先に登録済み'
        );
        await notepadRow.click();
        await expect(modal.locator('.duplicate-warning-section')).toHaveCount(0);
      });

      await test.step('取り込むと、選んだ分だけが未保存の変更として並ぶ', async () => {
        const modal = adminWindow.locator(MODAL);
        await modal.locator('.app-import-footer button', { hasText: '取り込む' }).click();
        await expect(modal).toHaveCount(0);
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'Alpha Editor' })).toBeVisible(
          {
            timeout: 10000,
          }
        );
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'Beta Viewer' })).toHaveCount(
          1
        );
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'Gamma Manual' })).toHaveCount(
          0
        );
        await expect(adminWindow.locator('.unsaved-changes')).toContainText(
          '未保存の変更があります'
        );
      });
    } finally {
      await adminWindow.close();
    }
  });
});
