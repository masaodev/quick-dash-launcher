import path from 'path';

import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/** 取込画面（アイテム管理から開いたモード）のロケータ */
const IMPORT_MODAL = '.auto-import-rule-modal.import-mode';

/**
 * ネイティブのファイル選択ダイアログは操作できないので、メインプロセスの dialog.showOpenDialog を
 * 固定のファイルを返すものに差し替える
 */
async function stubOpenDialog(electronApp: ElectronApplication, filePath: string): Promise<void> {
  await electronApp.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [p],
    })) as typeof dialog.showOpenDialog;
  }, filePath);
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
 * ブックマーク取込の入口統合
 * - アイテム管理の「ブラウザのブックマークを追加」は、設定のルール編集と同じ画面（ツリー＋パターン）で開く
 * - 「今回だけ取り込む」で絞り込んだ分が未保存の変更として入る
 * - HTML ファイルも取込元に選べるが「ルールとして保存」はできない
 * - 設定「ブックマーク自動取込」とのあいだを行き来できる
 */
test.describe('QuickDashLauncher - ブックマーク取込（入口統合）', () => {
  test('HTML ファイルからフォルダで絞り込み、今回だけ取り込める', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');
    await stubOpenDialog(
      electronApp,
      path.join(process.cwd(), 'tests', 'e2e', 'fixtures', 'bookmarks-sample.html')
    );

    try {
      await test.step('一括取込メニューから取込画面が開く（設定のルール編集と同じ画面）', async () => {
        await chooseImportMenu(adminWindow, 'ブラウザのブックマークを追加');
        const modal = adminWindow.locator(IMPORT_MODAL);
        await modal.waitFor({ state: 'visible', timeout: 10000 });
        await expect(modal.locator('h3')).toHaveText('ブラウザのブックマークの追加');
        await expect(
          modal.locator('.folder-filter-mode, input[placeholder*="github"]').first()
        ).toBeVisible();
        // 実行環境に Chrome / Edge があればその一覧が先に読まれるので、件数はここでは見ない
        await expect(
          modal.locator('.auto-import-modal-footer button', { hasText: '今回だけ取り込む' })
        ).toBeVisible();
        await expect(
          modal.locator('.auto-import-modal-footer button', { hasText: 'ルールとして保存' })
        ).toBeDisabled();
      });

      await test.step('HTML ファイルを選ぶとフォルダ付きで読み込まれ、プレビューに出る', async () => {
        const modal = adminWindow.locator(IMPORT_MODAL);
        await modal.locator('.browser-radio-group label', { hasText: 'HTML ファイル' }).click();
        // ファイルを選ぶまでは 0 件
        await expect(modal.locator('.auto-import-preview-count')).toContainText('マッチ: 0件');
        await expect(
          modal.locator('.auto-import-modal-footer button', { hasText: '今回だけ取り込む' })
        ).toBeDisabled();
        await modal.locator('button', { hasText: 'ファイルを選択' }).click();
        await expect(modal.locator('.auto-import-file-name')).toHaveText('bookmarks-sample.html');
        await expect(modal.locator('.auto-import-load-status')).toContainText('5 件', {
          timeout: 10000,
        });
        await expect(modal.locator('.auto-import-preview-count')).toContainText('マッチ: 5件');
        await expect(modal.locator('.folder-tree-item', { hasText: '開発' })).toBeVisible();
        await expect(modal.locator('.folder-tree-item', { hasText: '読み物' })).toBeVisible();
      });

      await test.step('フォルダを選ぶと絞り込まれ、ボタンの件数も変わる', async () => {
        const modal = adminWindow.locator(IMPORT_MODAL);
        await modal
          .locator('.folder-tree-item', { hasText: '開発' })
          .locator('input[type="checkbox"]')
          .check();
        await expect(modal.locator('.auto-import-preview-count')).toContainText('マッチ: 2件');
        await expect(modal.locator('.auto-import-preview-item')).toHaveCount(2);
        await expect(
          modal.locator('.auto-import-modal-footer button', { hasText: '今回だけ取り込む' })
        ).toHaveText('今回だけ取り込む (2件)');
      });

      await test.step('HTML ファイルはルールとして保存できない（名前を入れても無効のまま）', async () => {
        const modal = adminWindow.locator(IMPORT_MODAL);
        await modal.locator('input[placeholder*="開発系ブックマーク"]').fill('HTML からのルール');
        const saveButton = modal.locator('.auto-import-modal-footer button', {
          hasText: 'ルールとして保存',
        });
        await expect(saveButton).toBeDisabled();
        await expect(saveButton).toHaveAttribute('title', /HTML ファイルはルールにできません/);
      });

      await test.step('今回だけ取り込むと、未保存の変更としてアイテム管理に並ぶ', async () => {
        const modal = adminWindow.locator(IMPORT_MODAL);
        await modal
          .locator('.auto-import-modal-footer button', { hasText: '今回だけ取り込む' })
          .click();
        await expect(modal).toHaveCount(0);
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'GitHub Docs' })).toBeVisible({
          timeout: 10000,
        });
        await expect(
          adminWindow.locator('.raw-item-row', { hasText: 'MDN Web Docs' })
        ).toBeVisible();
        // 絞り込みから外れた分は入らない
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'ニュース' })).toHaveCount(0);
        await expect(adminWindow.locator('.unsaved-changes')).toContainText(
          '未保存の変更があります'
        );
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('取込画面と設定「ブックマーク自動取込」のあいだを行き来でき、設定側は保存だけ', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');

    try {
      await test.step('取込画面の案内から設定の該当カテゴリを開く（取込画面は閉じる）', async () => {
        await chooseImportMenu(adminWindow, 'ブラウザのブックマークを追加');
        const modal = adminWindow.locator(IMPORT_MODAL);
        await modal.waitFor({ state: 'visible', timeout: 10000 });
        await modal
          .locator('.auto-import-import-hint .btn', { hasText: '自動取込の設定を開く' })
          .click();
        await expect(
          adminWindow.locator('.menu-item.active', { hasText: 'ブックマーク自動取込' })
        ).toBeVisible({ timeout: 5000 });
        await expect(modal).toHaveCount(0);
      });

      await test.step('設定の「手動で取り込む」でアイテム管理タブの取込画面が開く', async () => {
        await adminWindow.locator('.auto-import-hint .btn', { hasText: '手動で取り込む' }).click();
        await adminWindow.locator(IMPORT_MODAL).waitFor({ state: 'visible', timeout: 10000 });
        await expect(
          adminWindow.locator('.tab-button.active', { hasText: 'アイテム管理' })
        ).toBeVisible();
        await adminWindow
          .locator(`${IMPORT_MODAL} .auto-import-modal-footer button`, { hasText: 'キャンセル' })
          .click();
        await expect(adminWindow.locator(IMPORT_MODAL)).toHaveCount(0);
      });

      await test.step('設定側の「+ ルールを追加」は同じ画面だが、フッターは保存だけ', async () => {
        await chooseImportMenu(adminWindow, 'ブックマーク自動取込の設定');
        await adminWindow.locator('.auto-import-add-rule button').click();
        const ruleModal = adminWindow.locator('.auto-import-rule-modal');
        await ruleModal.waitFor({ state: 'visible', timeout: 10000 });
        await expect(ruleModal).not.toHaveClass(/import-mode/);
        await expect(ruleModal.locator('h3')).toContainText('新規ルール作成');
        await expect(
          ruleModal.locator('.auto-import-modal-footer button', { hasText: '今回だけ取り込む' })
        ).toHaveCount(0);
        await expect(
          ruleModal.locator('.auto-import-modal-footer button', { hasText: '保存' })
        ).toBeVisible();
        await ruleModal
          .locator('.auto-import-modal-footer button', { hasText: 'キャンセル' })
          .click();
      });
    } finally {
      await adminWindow.close();
    }
  });
});
