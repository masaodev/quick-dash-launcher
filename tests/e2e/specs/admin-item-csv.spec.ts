import * as fs from 'fs';
import * as path from 'path';

import type { ElectronApplication } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/** 保存・選択のダイアログを差し替え、選んだことにするパスを返させる */
async function stubDialogs(electronApp: ElectronApplication, filePath: string) {
  await electronApp.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as never;
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never;
  }, filePath);
}

/**
 * アイテム管理の CSV の書き出し・取り込み
 */
test.describe('QuickDashLauncher - アイテム管理の CSV', () => {
  test.beforeEach(async ({ configHelper }) => {
    // 2 つのタブ（data.json・data2.json）があるテンプレート
    configHelper.loadTemplate('with-tabs');
  });

  test('すべてのタブを CSV に書き出し、直した CSV を確かめてから未保存の変更として取り込める', async ({
    electronApp,
    mainWindow,
    configHelper,
  }, testInfo) => {
    const csvPath = path.join(configHelper.getConfigDir(), 'export-test.csv');
    await stubDialogs(electronApp, csvPath);
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      await test.step('「整理 ▼」の「CSV に書き出す」で、BOM 付きの CSV にすべてのタブが入る', async () => {
        await adminWindow.locator('.organize-dropdown .dropdown-trigger-btn').click();
        await adminWindow
          .locator('.organize-dropdown .dropdown-item', { hasText: 'CSV に書き出す' })
          .click();
        await expect.poll(() => fs.existsSync(csvPath)).toBe(true);
        const text = fs.readFileSync(csvPath, 'utf8');
        expect(text.charCodeAt(0)).toBe(0xfeff);
        expect(text).toContain('id,dataFile,type,displayName,path,args,memo,updatedAt');
        expect(text).toContain('datafiles/data.json');
        expect(text).toContain('datafiles/data2.json');
        expect(text).toContain('Stack Overflow');
      });

      await test.step('CSV を直す（GitHub の名前とメモを変え、取り込みでは変えない種別も書き換え、新しい行を足す）', async () => {
        const github = configHelper.getItemByDisplayName('data.json', 'GitHub')!;
        const lines = fs.readFileSync(csvPath, 'utf8').split('\r\n');
        const index = lines.findIndex((line) => line.startsWith(`${github.id},`));
        expect(index).toBeGreaterThan(0);
        const cells = lines[index].split(',');
        cells[2] = 'dir';
        cells[3] = 'GitHub（CSV）';
        cells[6] = '"CSV で書いたメモ\r\n2 行目"';
        lines[index] = cells.join(',');
        lines.splice(lines.length - 1, 0, ',,,CSV で足した,C:\\Windows\\notepad.exe,,,');
        fs.writeFileSync(csvPath, lines.join('\r\n'), 'utf8');
      });

      await test.step('「＋ アイテムを追加」の ▼ から取り込むと、確認の画面に変更と追加が出る', async () => {
        await adminWindow.locator('.toolbar-split-toggle').click();
        await adminWindow.locator('.dropdown-item', { hasText: 'CSV から取り込む' }).click();
        const modal = adminWindow.getByTestId('csv-import-modal');
        await expect(modal).toBeVisible();
        await expect(adminWindow.getByTestId('csv-import-summary')).toContainText(
          '変更 1 件・追加 1 件'
        );
        await expect(modal).toContainText('GitHub（CSV）');
        await expect(modal).toContainText('CSV で足した');
        await expect(adminWindow.getByTestId('csv-import-ignored')).toContainText(
          '「GitHub」: 種別（type）'
        );
        await new TestUtils(adminWindow).attachScreenshot(testInfo, '取り込みの確認');
      });

      await test.step('取り込むと未保存の変更になり、保存するまでファイルは変わらない', async () => {
        await adminWindow.getByTestId('csv-import-confirm').click();
        await expect(adminWindow.getByTestId('csv-import-modal')).toHaveCount(0);
        const row = adminWindow.locator('.raw-item-row', { hasText: 'GitHub（CSV）' });
        await expect(row).toBeVisible();
        await expect(row).toHaveClass(/changed/);
        await expect(
          adminWindow.locator('.raw-item-row', { hasText: 'CSV で足した' })
        ).toBeVisible();
        expect(configHelper.getItemByDisplayName('data.json', 'GitHub')).toBeDefined();
      });

      await test.step('保存すると CSV の内容がデータファイルに入る', async () => {
        await adminWindow.locator('button:has-text("変更を保存")').click();
        await adminWindow.locator('[data-testid="confirm-dialog-confirm-button"]').click();
        await expect
          .poll(() => configHelper.getItemByDisplayName('data.json', 'GitHub（CSV）')?.memo)
          .toBe('CSV で書いたメモ\n2 行目');
        // 種別は取り込みでは変えない
        expect(configHelper.getItemByDisplayName('data.json', 'GitHub（CSV）')?.type).toBe('item');
        expect(configHelper.getItemByDisplayName('data.json', 'CSV で足した')).toMatchObject({
          type: 'item',
          path: 'C:\\Windows\\notepad.exe',
        });
      });
    } finally {
      await adminWindow.close();
    }
  });

  test('id の見つからない行はエラーとして出し、取り込める行が無ければ「取り込む」を押せない', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const csvPath = path.join(configHelper.getConfigDir(), 'broken.csv');
    fs.writeFileSync(csvPath, 'id,displayName\r\nnothere1,どこにもない\r\n', 'utf8');
    await stubDialogs(electronApp, csvPath);
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'edit');

    try {
      await adminWindow.locator('.toolbar-split-toggle').click();
      await adminWindow.locator('.dropdown-item', { hasText: 'CSV から取り込む' }).click();
      const modal = adminWindow.getByTestId('csv-import-modal');
      await expect(modal).toContainText('2 行目: id「nothere1」のアイテムが見つかりません');
      await expect(adminWindow.getByTestId('csv-import-confirm')).toBeDisabled();
      await adminWindow.keyboard.press('Escape');
      await expect(modal).toHaveCount(0);
    } finally {
      await adminWindow.close();
    }
  });
});
