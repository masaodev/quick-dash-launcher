import * as fs from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test.describe('QuickDashLauncher - コンテキストメニュー機能テスト', () => {
  let shortcutPath: string;


  test.beforeEach(async ({ configHelper, mainWindow }) => {
    // with-shortcutsテンプレートを使用
    configHelper.loadTemplate('with-shortcuts');

    // テスト用のショートカットファイルを作成
    const testDir = configHelper.getConfigDir();
    shortcutPath = path.join(testDir, 'test-shortcut.lnk');

    // 実際の.lnkファイルを作成（notepad.exeへのショートカット）
    const { execSync } = require('child_process');
    const psScriptPath = path.join(testDir, 'create-shortcut.ps1');
    const psScriptContent = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
$Shortcut.TargetPath = "notepad.exe"
$Shortcut.Save()
`;
    fs.writeFileSync(psScriptPath, psScriptContent, 'utf-8');

    try {
      execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { encoding: 'utf-8' });
    } catch (error) {
      console.error('ショートカット作成エラー:', error);
      throw error;
    }

    if (!fs.existsSync(shortcutPath)) {
      throw new Error(`ショートカットファイルが作成されませんでした: ${shortcutPath}`);
    }

    const dataPath = configHelper.getDataPath();
    let dataContent = fs.readFileSync(dataPath, 'utf-8');
    dataContent = dataContent.replace('TEST_SHORTCUT_PATH', shortcutPath);
    fs.writeFileSync(dataPath, dataContent, 'utf-8');

    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    await mainWindow.reload();
    await utils.waitForPageLoad();
  });

  test.afterEach(async () => {
    if (shortcutPath && fs.existsSync(shortcutPath)) {
      fs.unlinkSync(shortcutPath);
    }
    const psScriptPath = path.join(path.dirname(shortcutPath), 'create-shortcut.ps1');
    if (fs.existsSync(psScriptPath)) {
      try {
        fs.unlinkSync(psScriptPath);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });
  // ==================== 基本的なコンテキストメニュー表示 ====================

  test('右クリックでコンテキストメニューが表示される', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('通常のアイテムを右クリックするとメニューが表示される', async () => {
      await utils.attachScreenshot(testInfo, '初期状態');
      await utils.rightClickItem('Google');
      await utils.wait(300);
      await utils.attachScreenshot(testInfo, 'コンテキストメニュー表示');

      const contextMenu = mainWindow.locator('.context-menu');
      await expect(contextMenu).toBeVisible();
    });

    await test.step('メニューに基本項目が表示される', async () => {
      const editItem = mainWindow.locator('.context-menu-item', { hasText: '編集' });
      const copyPathItem = mainWindow.locator('.context-menu-item', { hasText: 'パスをコピー' });

      await expect(editItem).toBeVisible();
      await expect(copyPathItem).toBeVisible();
    });
  });

  test('通常のアイテムのメニュー構成', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('Webサイトアイテムには親フォルダメニューが表示されない', async () => {
      await utils.rightClickItem('Google');
      await utils.wait(300);
      await utils.attachScreenshot(testInfo, 'Webサイトのメニュー');

      const editItem = mainWindow.locator('.context-menu-item', { hasText: '編集' });
      const copyPathItem = mainWindow.locator('.context-menu-item', { hasText: 'パスをコピー' });
      const parentFolderItem = mainWindow.locator('.context-menu-item', {
        hasText: '親フォルダー',
      });

      await expect(editItem).toBeVisible();
      await expect(copyPathItem).toBeVisible();
      // URLには親フォルダーが存在しないため表示されない
      const count = await parentFolderItem.count();
      expect(count).toBe(0);
    });

    // メニューを閉じる
    await mainWindow.keyboard.press('Escape');
    await utils.wait(300);

    await test.step('アプリケーションアイテムには親フォルダメニューが表示される', async () => {
      await utils.rightClickItem('メモ帳');
      await utils.wait(300);
      await utils.attachScreenshot(testInfo, 'アプリケーションのメニュー');

      const copyParentPathItem = mainWindow.locator('.context-menu-item', {
        hasText: '親フォルダーのパスをコピー',
      });
      const openParentFolderItem = mainWindow.locator('.context-menu-item', {
        hasText: '親フォルダーを開く',
      });

      await expect(copyParentPathItem).toBeVisible();
      await expect(openParentFolderItem).toBeVisible();
    });
  });

  // ==================== ショートカットアイテムのメニュー ====================

  test('ショートカットアイテムのメニュー構成', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ショートカットを右クリックするとメニューが表示される', async () => {
      await utils.attachScreenshot(testInfo, '初期状態');
      await utils.rightClickItem('テストショートカット');
      await utils.wait(300);
      await utils.attachScreenshot(testInfo, 'ショートカットメニュー表示');

      const contextMenu = mainWindow.locator('.context-menu');
      await expect(contextMenu).toBeVisible();
    });

    await test.step('区切り線が正しく表示される', async () => {
      const dividers = mainWindow.locator('.context-menu-divider');
      const count = await dividers.count();
      // 編集メニューがある場合: 編集の後 + ショートカットセクションの前 = 2つ
      // 編集メニューがない場合: ショートカットセクションの前のみ = 1つ
      expect(count).toBeGreaterThanOrEqual(1);
    });

    await test.step('基本メニュー項目が表示される', async () => {
      const editItem = mainWindow.locator('.context-menu-item', { hasText: '編集' });
      const copyPathItem = mainWindow.locator('.context-menu-item', {
        hasText: /^パスをコピー$/,
      });
      const copyParentPathItem = mainWindow.locator('.context-menu-item', {
        hasText: '親フォルダーのパスをコピー',
      });
      const openParentFolderItem = mainWindow.locator('.context-menu-item', {
        hasText: /^親フォルダーを開く$/,
      });

      await expect(editItem).toBeVisible();
      await expect(copyPathItem).toBeVisible();
      await expect(copyParentPathItem).toBeVisible();
      await expect(openParentFolderItem).toBeVisible();
    });

    await test.step('ショートカット専用メニュー項目が表示される', async () => {
      const copyShortcutPathItem = mainWindow.locator('.context-menu-item', {
        hasText: 'リンク先のパスをコピー',
      });
      const copyShortcutParentPathItem = mainWindow.locator('.context-menu-item', {
        hasText: 'リンク先の親フォルダーのパスをコピー',
      });
      const openShortcutParentFolderItem = mainWindow.locator('.context-menu-item', {
        hasText: 'リンク先の親フォルダーを開く',
      });

      await expect(copyShortcutPathItem).toBeVisible();
      await expect(copyShortcutParentPathItem).toBeVisible();
      await expect(openShortcutParentFolderItem).toBeVisible();
    });

    await test.step('アイコンが正しく表示される', async () => {
      await utils.attachScreenshot(testInfo, 'アイコン確認');

      // 編集アイコン
      const editIcon = mainWindow.locator('.context-menu-item:has-text("編集") .context-menu-icon');
      await expect(editIcon).toContainText('✏️');

      // コピー系アイコン（📋）
      const copyIcons = mainWindow.locator(
        '.context-menu-item:has-text("コピー") .context-menu-icon'
      );
      const copyCount = await copyIcons.count();
      expect(copyCount).toBeGreaterThan(0);

      // フォルダを開く系アイコン（📂）
      const folderIcons = mainWindow.locator(
        '.context-menu-item:has-text("開く") .context-menu-icon'
      );
      const folderCount = await folderIcons.count();
      expect(folderCount).toBe(2); // 親フォルダーを開く + リンク先の親フォルダーを開く
    });
  });

  // ==================== メニュー操作 ====================

  test('メニューを閉じる操作', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('Escapeキーでメニューが閉じる', async () => {
      await utils.rightClickItem('メモ帳');
      await utils.wait(300);

      let contextMenu = mainWindow.locator('.context-menu');
      await expect(contextMenu).toBeVisible();

      await mainWindow.keyboard.press('Escape');
      await utils.wait(300);
      await utils.attachScreenshot(testInfo, 'Escapeキーで閉じた後');

      contextMenu = mainWindow.locator('.context-menu');
      const count = await contextMenu.count();
      expect(count).toBe(0);
    });

    await test.step('メニュー外をクリックするとメニューが閉じる', async () => {
      await utils.rightClickItem('メモ帳');
      await utils.wait(300);

      let contextMenu = mainWindow.locator('.context-menu');
      await expect(contextMenu).toBeVisible();

      // メニュー外をクリック
      await mainWindow.click('body', { position: { x: 10, y: 10 } });
      await utils.wait(300);
      await utils.attachScreenshot(testInfo, 'メニュー外クリックで閉じた後');

      contextMenu = mainWindow.locator('.context-menu');
      const count = await contextMenu.count();
      expect(count).toBe(0);
    });
  });

  // ==================== メニュー項目の機能テスト ====================

  test('編集メニューの動作', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('編集メニューが存在する場合、クリックすると編集モーダルが開く', async () => {
      await utils.rightClickItem('Google');
      await utils.wait(300);

      // 編集メニューが存在するか確認
      const editItem = mainWindow.locator('.context-menu-item', { hasText: '編集' });
      const editCount = await editItem.count();

      if (editCount > 0) {
        await editItem.first().click();
        await utils.wait(500);
        await utils.attachScreenshot(testInfo, '編集モーダル表示');

        const isVisible = await utils.isRegisterModalVisible();
        expect(isVisible).toBe(true);
      } else {
        // 編集メニューがない場合はスキップ
        await utils.attachScreenshot(testInfo, '編集メニューなし');
        await mainWindow.keyboard.press('Escape');
      }
    });
  });

  test('パスをコピーメニューの動作', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('パスをコピーメニューをクリックするとメニューが閉じる', async () => {
      await utils.rightClickItem('メモ帳');
      await utils.wait(500);
      await utils.attachScreenshot(testInfo, 'メニュー表示');

      const copyPathItem = mainWindow.locator('.context-menu-item').filter({
        hasText: /^パスをコピー$/,
      });
      await copyPathItem.first().click();
      await utils.wait(500);

      // メニューが閉じたことを確認
      const contextMenu = mainWindow.locator('.context-menu');
      const count = await contextMenu.count();
      expect(count).toBe(0);
      await utils.attachScreenshot(testInfo, 'パスコピー後');
    });
  });

  test('ショートカットのリンク先の親フォルダーを開くメニュー', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('ショートカットアイテムを探す', async () => {
      // ショートカットアイテムが存在するか確認
      const items = mainWindow.locator('.item');
      const itemCount = await items.count();
      await utils.attachScreenshot(testInfo, `アイテム一覧（${itemCount}件）`);

      // アイテム名をすべて出力
      for (let i = 0; i < itemCount; i++) {
        const itemName = await items.nth(i).locator('.item-name').textContent();
        console.log(`Item ${i}: ${itemName}`);
      }
    });

    await test.step('ショートカットアイテムが存在すればメニューを確認', async () => {
      const shortcutItem = mainWindow.locator('.item').filter({ hasText: 'テストショートカット' });
      const shortcutCount = await shortcutItem.count();

      if (shortcutCount > 0) {
        await shortcutItem.click({ button: 'right' });
        await utils.wait(500);
        await utils.attachScreenshot(testInfo, 'ショートカットメニュー表示');

        // リンク先の親フォルダーを開くメニューが存在するか確認
        const openShortcutParentFolderItem = mainWindow.locator('.context-menu-item').filter({
          hasText: 'リンク先の親フォルダーを開く',
        });
        const menuCount = await openShortcutParentFolderItem.count();

        if (menuCount > 0) {
          await expect(openShortcutParentFolderItem.first()).toBeVisible();

          // メニューをクリック
          await openShortcutParentFolderItem.first().click();
          await utils.wait(500);

          // メニューが閉じたことを確認
          const contextMenu = mainWindow.locator('.context-menu');
          const contextCount = await contextMenu.count();
          expect(contextCount).toBe(0);
          await utils.attachScreenshot(testInfo, 'メニュー閉じた後');
        } else {
          console.log('リンク先の親フォルダーを開くメニューが見つかりません');
          await utils.attachScreenshot(testInfo, 'メニュー項目なし');
        }
      } else {
        console.log('テストショートカットアイテムが見つかりません');
        await utils.attachScreenshot(testInfo, 'ショートカットアイテムなし');
      }
    });
  });

  // ==================== メニュー位置の調整 ====================

  test('メニュー位置の自動調整', async ({ mainWindow }, testInfo) => {
    const utils = new TestUtils(mainWindow);

    await test.step('メニューが画面内に収まるように調整される', async () => {
      // アイテムを右クリック
      await utils.rightClickItem('Google');
      await utils.wait(300);
      await utils.attachScreenshot(testInfo, 'メニュー位置確認');

      const contextMenu = mainWindow.locator('.context-menu');
      await expect(contextMenu).toBeVisible();

      // メニューの位置を取得
      const box = await contextMenu.boundingBox();
      expect(box).not.toBeNull();

      if (box) {
        // メニューが画面内に収まっているか確認
        const viewport = mainWindow.viewportSize();
        if (viewport) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
          expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        }
      }
    });
  });
});
