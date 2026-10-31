import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

const FOLDER_ICON = '\u{1F4C1}';
const FILE_ICON = '\u{1F4C4}';

/** ランチャーのアイテム行の種別アイコン（アイコン画像が無いときの絵文字） */
function itemIcon(page: Page, name: string) {
  return page.locator('.item', { hasText: name }).locator('.item-icon');
}

/** config/path-type-cache.json に残った拡張子の無いファイルの一覧 */
function readMemo(configDir: string): string[] {
  const memoPath = path.join(configDir, 'path-type-cache.json');
  if (!fs.existsSync(memoPath)) return [];
  return JSON.parse(fs.readFileSync(memoPath, 'utf8')).extensionlessFiles ?? [];
}

/**
 * 拡張子の無いファイル（hosts・LICENSE など）をフォルダと取り違えない
 * - 種別はパスの文字列で決めるので、ディスクで確かめた結果を path-type-cache.json に残して使う
 * - フォルダ取込はディスクを一覧するので、メモ無しでファイルと分かる
 */
test.describe('QuickDashLauncher - 拡張子の無いファイル', () => {
  test.use({ configTemplate: 'empty' });

  let workDir: string;

  test.beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-extless-'));
    fs.writeFileSync(path.join(workDir, 'LICENSE'), 'MIT');
    fs.mkdirSync(path.join(workDir, 'scan'));
    fs.writeFileSync(path.join(workDir, 'scan', 'Makefile'), 'all:');
    fs.mkdirSync(path.join(workDir, 'scan', 'docs'));
  });

  test.afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  test('フォルダ取込で展開した拡張子の無いファイルは 📄 で出る', async ({
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);

    await test.step('フォルダ取込を足して読み直す', async () => {
      configHelper.addItemToFile('data.json', {
        id: 'dirEXT01',
        type: 'dir',
        path: path.join(workDir, 'scan'),
        options: { depth: 0, types: 'both' },
      });
      await utils.waitForPageLoad();
      await utils.reloadWithF5();
    });

    await test.step('Makefile はファイル、docs はフォルダ', async () => {
      await expect(itemIcon(mainWindow, 'Makefile')).toHaveText(FILE_ICON);
      await expect(itemIcon(mainWindow, 'docs')).toHaveText(FOLDER_ICON);
    });
  });

  test('登録すると、拡張子の無いファイルは 📄 で出て、F5 でも保たれる', async ({
    electronApp,
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const licensePath = path.join(workDir, 'LICENSE');

    await test.step('登録画面からパスを入れて登録する', async () => {
      await utils.waitForPageLoad();
      await utils.openRegisterModal(electronApp);
      await utils.fillRegisterForm({ name: 'ライセンス', path: licensePath });
      await utils.clickRegisterButton();
    });

    await test.step('ファイルとして表示され、メモに残る', async () => {
      await expect(itemIcon(mainWindow, 'ライセンス')).toHaveText(FILE_ICON);
      expect(readMemo(configHelper.getConfigDir())).toEqual([licensePath]);
    });

    await test.step('F5 で読み直してもファイルのまま', async () => {
      await utils.reloadWithF5();
      await expect(itemIcon(mainWindow, 'ライセンス')).toHaveText(FILE_ICON);
    });

    await test.step('ファイルを消して F5 すると、メモから外れてフォルダの見た目に戻る', async () => {
      fs.rmSync(licensePath);
      await utils.reloadWithF5();
      await expect(itemIcon(mainWindow, 'ライセンス')).toHaveText(FOLDER_ICON);
      expect(readMemo(configHelper.getConfigDir())).toEqual([]);
    });
  });

  test('直接書き足した拡張子の無いファイルは、「アイコンをすべて取り直す」でファイルと分かる', async ({
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const licensePath = path.join(workDir, 'LICENSE');

    await test.step('データファイルに直接書き足して F5（メモに無いのでフォルダの見た目）', async () => {
      configHelper.addSimpleItem('data.json', 'ライセンス', licensePath);
      await utils.waitForPageLoad();
      await utils.reloadWithF5();
      await expect(itemIcon(mainWindow, 'ライセンス')).toHaveText(FOLDER_ICON);
    });

    await test.step('「アイコンをすべて取り直す」でディスクを確かめ、ファイルになる', async () => {
      await mainWindow.locator('button[title^="更新・取得"]').click();
      await mainWindow.locator('.dropdown-item', { hasText: 'アイコンをすべて取り直す' }).click();
      await expect(itemIcon(mainWindow, 'ライセンス')).toHaveText(FILE_ICON);
      expect(readMemo(configHelper.getConfigDir())).toEqual([licensePath]);
    });

    await test.step('データから消すと、次の読み込みでメモからも外れる', async () => {
      const data = configHelper.readDataFile('data.json');
      configHelper.writeDataFile('data.json', { ...data, items: [] });
      await utils.reloadWithF5();
      await expect(mainWindow.locator('.item', { hasText: 'ライセンス' })).toHaveCount(0);
      expect(readMemo(configHelper.getConfigDir())).toEqual([]);
    });
  });
});
