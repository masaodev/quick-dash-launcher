import path from 'path';

import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { stubBrowsers } from '../helpers/fake-browsers';
import { TestUtils } from '../helpers/test-utils';

/** ブックマーク取込画面（アイテム管理から） */
const IMPORT_MODAL = '.bookmark-import-modal';
/** ブックマークの取込ルールの追加・編集（設定から） */
const RULE_MODAL = '.bookmark-rule-modal';

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

/** アイテム管理の「＋ アイテムを追加」の横の「▼」から項目を選ぶ */
async function chooseImportMenu(adminWindow: Page, itemText: string): Promise<void> {
  await adminWindow.locator('.toolbar-split .toolbar-split-toggle').click();
  await adminWindow.locator('.toolbar-split .dropdown-item', { hasText: itemText }).click();
}

/**
 * ブックマーク取込
 * - アイテム管理から: アプリ取込と同じく一覧（フォルダの木）にチェックを入れて取り込む。
 *   フォルダごと選んだときだけ「ブラウザと同期する」でルールにできる
 * - 設定の「＋ ルールを追加」: 条件（取込元・フォルダ・名前・URL）と、このルールで取り込まれるもの、表示名
 */
test.describe('QuickDashLauncher - ブックマーク取込', () => {
  test('HTML ファイルからフォルダを選んで、新しいデータファイルに取り込める', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');
    await stubBrowsers(electronApp);
    await stubOpenDialog(
      electronApp,
      path.join(process.cwd(), 'tests', 'e2e', 'fixtures', 'bookmarks-sample.html')
    );
    const modal = adminWindow.locator(IMPORT_MODAL);
    const footerButton = modal.locator('.import-footer button', { hasText: '取り込む' });

    try {
      await test.step('追加の ▼ メニューから開く。初めは何も選ばれていない', async () => {
        await chooseImportMenu(adminWindow, 'ブラウザのブックマークから追加');
        await modal.waitFor({ state: 'visible', timeout: 10000 });
        await expect(modal.locator('h3')).toHaveText('ブラウザのブックマークを取り込む');
        await expect(modal.locator('.import-selection')).toContainText('0 件を選択中');
        await expect(footerButton).toBeDisabled();
        // 取込先の既定は、選んでいるタブの新しいデータファイル「ブックマーク」
        await expect(modal.locator('.import-echo')).toHaveText(
          /^.+ › ブックマーク（新規） に取り込む$/
        );
      });

      await test.step('HTML ファイルを選ぶと、フォルダの木が出る', async () => {
        await modal.locator('select[aria-label="取込元"]').selectOption('html');
        await modal.locator('button', { hasText: 'ファイルを選択' }).click();
        await expect(modal.locator('.bookmark-import-file-name')).toHaveText(
          'bookmarks-sample.html'
        );
        await expect(modal.locator('.bookmark-import-status')).toHaveText('5 件のブックマーク', {
          timeout: 10000,
        });
        await expect(
          modal.locator('.bookmark-import-row.folder', { hasText: '開発' })
        ).toBeVisible();
        // フォルダの外にあるブックマークも並ぶ
        await expect(modal.locator('.bookmark-import-row', { hasText: 'Google' })).toBeVisible();
      });

      await test.step('フォルダにチェックを入れると中身がまとめて選ばれる。HTML ファイルは同期できない', async () => {
        await modal
          .locator('.bookmark-import-row.folder', { hasText: '開発' })
          .locator('input[type="checkbox"]')
          .check();
        await expect(modal.locator('.import-selection')).toContainText('2 件を選択中');
        await expect(footerButton).toHaveText('2 件を取り込む');
        await expect(modal.locator('.bookmark-import-sync-toggle input')).toBeDisabled();
        await expect(modal.locator('.bookmark-import-sync-note')).toHaveText(
          'HTML ファイルは自動取込にできません'
        );
      });

      await test.step('取り込むと新しいデータファイルができ、未保存の変更として並ぶ', async () => {
        await footerButton.click();
        await expect(modal).toHaveCount(0, { timeout: 10000 });
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'GitHub Docs' })).toBeVisible({
          timeout: 10000,
        });
        await expect(
          adminWindow.locator('.raw-item-row', { hasText: 'MDN Web Docs' })
        ).toBeVisible();
        // 選ばなかった分は入らない
        await expect(adminWindow.locator('.raw-item-row', { hasText: 'ニュース' })).toHaveCount(0);
        await expect(adminWindow.locator('.unsaved-changes')).toContainText(
          '未保存の変更があります'
        );
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('フォルダごと選んだときだけ「これからも自動で取り込む」が使える', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');
    await stubBrowsers(electronApp);
    const modal = adminWindow.locator(IMPORT_MODAL);
    const syncBox = modal.locator('.bookmark-import-sync-toggle input');
    const syncNote = modal.locator('.bookmark-import-sync-note');
    const folderRow = (name: string) =>
      modal.locator('.bookmark-import-row.folder', { hasText: name }).first();

    try {
      await test.step('最初のプロファイルが選ばれ、そのブックマークが読み込まれる', async () => {
        await chooseImportMenu(adminWindow, 'ブラウザのブックマークから追加');
        await modal.waitFor({ state: 'visible', timeout: 10000 });
        await expect(modal.locator('select[aria-label="プロファイル"]')).toHaveValue('Default');
        await expect(modal.locator('.bookmark-import-status')).toHaveText('10 件のブックマーク');
        // 一番上のフォルダは画面の言葉で出す
        await expect(folderRow('ブックマーク バー')).toBeVisible();
        await expect(folderRow('その他のブックマーク')).toBeVisible();
      });

      await test.step('フォルダを選ぶと、そのフォルダを同期するルールにできる', async () => {
        await folderRow('開発').locator('input[type="checkbox"]').check();
        await expect(modal.locator('.import-selection')).toContainText('5 件を選択中');
        await expect(syncBox).toBeEnabled();
        await expect(modal.locator('.bookmark-import-sync-toggle')).toHaveText(
          '「開発」 フォルダを、これからも自動で取り込む'
        );
        await syncBox.check();
        await expect(modal.locator('.bookmark-import-rule-name input')).toHaveAttribute(
          'placeholder',
          '開発'
        );
        await expect(syncNote).toContainText('「開発」（サブフォルダも）');
        await expect(modal.locator('.import-footer button', { hasText: '取り込み' })).toHaveText(
          '5 件を取り込み、自動取込に登録'
        );
      });

      await test.step('1 件ずつ選んだ分が混ざると同期できない', async () => {
        await folderRow('読み物').locator('.bookmark-import-twisty').click();
        await modal
          .locator('.bookmark-import-row:not(.folder)', { hasText: 'Qiita' })
          .locator('input[type="checkbox"]')
          .check();
        await expect(syncBox).toBeDisabled();
        await expect(syncBox).not.toBeChecked();
        await expect(syncNote).toContainText('1 件ずつ選んだ分があるので自動取込にできません');
      });

      await test.step('検索中は同期できない。見つかった分をまとめて選べる', async () => {
        await modal.locator('input[placeholder="名前や URL で探す"]').fill('☆');
        await expect(modal.locator('.bookmark-import-list-head')).toContainText(
          '見つかった 3 件をすべて選ぶ'
        );
        await expect(syncNote).toContainText('検索中は自動取込にできません');
        await modal.locator('.bookmark-import-list-head input[type="checkbox"]').check();
        await expect(modal.locator('.import-selection')).toContainText('8 件を選択中');
      });

      await test.step('全部を選ぶと、すべてのブックマークを同期するルールにできる', async () => {
        await modal.locator('.search-clear-button').click();
        await folderRow('ブックマーク バー').locator('input[type="checkbox"]').check();
        await folderRow('その他のブックマーク').locator('input[type="checkbox"]').check();
        await expect(modal.locator('.import-selection')).toContainText('10 件を選択中');
        await expect(modal.locator('.bookmark-import-sync-toggle')).toHaveText(
          'すべてのブックマークを、これからも自動で取り込む'
        );
      });

      await test.step('プロファイルは 1 つだけ選ぶ（「すべてのプロファイル」は無い）', async () => {
        const profileSelect = modal.locator('select[aria-label="プロファイル"]');
        await expect(profileSelect.locator('option')).toHaveText(['個人', '仕事']);
        await profileSelect.selectOption({ label: '仕事' });
        await expect(modal.locator('.bookmark-import-status')).toHaveText('2 件のブックマーク');
        // 読み直すと選択は空に戻る
        await expect(modal.locator('.import-selection')).toContainText('0 件を選択中');
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('設定の「＋ ルールを追加」で、名前の条件と表示名のあるルールを作れる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');
    await stubBrowsers(electronApp);
    const ruleModal = adminWindow.locator(RULE_MODAL);
    const count = ruleModal.locator('.import-selection');

    try {
      await test.step('設定から開く。最初のプロファイルの全部が対象', async () => {
        await chooseImportMenu(adminWindow, 'ブックマーク自動取込の設定');
        await adminWindow.locator('.auto-import-add-rule button').click();
        await ruleModal.waitFor({ state: 'visible', timeout: 10000 });
        await expect(ruleModal.locator('h3')).toHaveText('ブックマークの取込ルールを追加');
        await expect(count).toHaveText('このルールで 10 件（全 10 件）');
        await expect(ruleModal.locator('.bookmark-rule-item')).toHaveCount(10);
      });

      await test.step('名前に含む文字で絞り込み、すぐ下の一覧が変わる', async () => {
        await ruleModal.locator('#bookmark-rule-name-word').fill('☆');
        await expect(count).toHaveText('このルールで 3 件（全 10 件）');
        await expect(ruleModal.locator('#bookmark-rule-name')).toHaveAttribute(
          'placeholder',
          /^ブックマーク☆/
        );
      });

      await test.step('フォルダの ▼ で木が開き、取り込む・除くを選べる', async () => {
        await ruleModal.locator('button', { hasText: 'すべてのフォルダ' }).click();
        await ruleModal
          .locator('.bookmark-rule-folder', { hasText: '開発' })
          .locator('input')
          .check();
        await expect(count).toHaveText('このルールで 1 件（全 10 件）');
        await ruleModal.locator('input[name="folderFilterMode"][value="exclude"]').check();
        await expect(count).toHaveText('このルールで 2 件（全 10 件）');
        await ruleModal.locator('input[name="folderFilterMode"][value="include"]').check();
        await ruleModal
          .locator('.bookmark-rule-folder', { hasText: '開発' })
          .locator('input')
          .uncheck();
        await expect(count).toHaveText('このルールで 3 件（全 10 件）');
      });

      await test.step('プロファイルは 1 つだけ選ぶ', async () => {
        const profileSelect = ruleModal.locator('select[aria-label="プロファイル"]');
        await expect(profileSelect.locator('option')).toHaveText(['個人', '仕事']);
        await profileSelect.selectOption({ label: '仕事' });
        await expect(ruleModal.locator('.bookmark-rule-status')).toHaveText('2 件のブックマーク');
        await profileSelect.selectOption({ label: '個人' });
        await expect(ruleModal.locator('.bookmark-rule-status')).toHaveText('10 件のブックマーク');
      });

      await test.step('オプション設定は初めから開いていて、頭に付ける文字が一覧の名前に出る', async () => {
        await expect(ruleModal.locator('.bookmark-rule-options-body')).toBeVisible();
        await ruleModal.locator('.bookmark-rule-options-body input').first().fill('[bkm]');
        await expect(ruleModal.locator('.bookmark-rule-item').first()).toContainText('[bkm]☆');
        await expect(ruleModal.locator('.bookmark-rule-options-summary')).toHaveText(
          '頭に「[bkm]」'
        );
      });

      await test.step('保存すると新しいデータファイルを取込先にしたルールができ、編集で開き直せる', async () => {
        await ruleModal.locator('.import-footer button', { hasText: '保存' }).click();
        await expect(ruleModal).toHaveCount(0, { timeout: 10000 });
        const ruleCard = adminWindow.locator('.auto-import-rule-card', {
          hasText: 'ブックマーク☆',
        });
        await expect(ruleCard).toBeVisible();
        await expect(ruleCard.locator('.rule-target')).toContainText('ブックマーク');

        await ruleCard.locator('button', { hasText: '編集' }).click();
        await ruleModal.waitFor({ state: 'visible', timeout: 10000 });
        await expect(ruleModal.locator('h3')).toHaveText('ブックマークの取込ルールを編集');
        await expect(ruleModal.locator('#bookmark-rule-name-word')).toHaveValue('☆');
        // 取込先は保存したファイルのまま（新しいファイルにはならない）
        await expect(ruleModal.locator('.import-dest-field')).toHaveCount(0);
        await ruleModal.locator('.import-footer button', { hasText: 'キャンセル' }).click();
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('取込画面と設定「ブックマーク自動取込」のあいだを行き来できる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');
    await adminWindow.waitForLoadState('domcontentloaded');
    await stubBrowsers(electronApp);

    try {
      await test.step('取込画面の自動取込の帯のリンクから設定の該当カテゴリを開く（取込画面は閉じる）', async () => {
        await chooseImportMenu(adminWindow, 'ブラウザのブックマークから追加');
        const modal = adminWindow.locator(IMPORT_MODAL);
        await modal.waitFor({ state: 'visible', timeout: 10000 });
        // 帯の右端のリンク。ルールが無くても出す
        await expect(modal.locator('.bookmark-import-sync-link')).toHaveText(
          'ブックマーク自動取込（ルールはまだありません）'
        );
        await modal.locator('.bookmark-import-sync-link').click();
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
          .locator(`${IMPORT_MODAL} .import-footer button`, { hasText: 'キャンセル' })
          .click();
        await expect(adminWindow.locator(IMPORT_MODAL)).toHaveCount(0);
      });
    } finally {
      await adminWindow.close();
    }
  });
});
