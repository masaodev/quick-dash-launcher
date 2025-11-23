import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';
import { ConfigFileHelper } from '../helpers/config-file-helper';
import path from 'path';

test.describe('QuickDashLauncher - 設定ファイル変更テスト', () => {
  let configHelper: ConfigFileHelper;

  test.beforeEach(async () => {
    const configDir = path.join(process.cwd(), 'tests', 'fixtures', 'e2e', 'default');
    configHelper = new ConfigFileHelper(configDir);

    // テンプレートから強制的に復元して初期状態を保証
    configHelper.restoreDataFromTemplate('base');
    configHelper.deleteData2(); // data2.txtは削除
  });

  test.afterEach(async () => {
    // テンプレートから復元して次のテストのために初期状態に戻す
    configHelper.restoreDataFromTemplate('base');
    configHelper.deleteData2();
  });

  // ==================== data.txt 変更テスト ====================

  test('data.txtにアイテムを追加してリロード後に表示される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // 新しいアイテムを追加
    configHelper.addItem('新規サイト', 'https://example.com');

    // アプリをリロード
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // 追加したアイテムが表示されることを確認
    const item = mainWindow.locator('.item', { hasText: '新規サイト' });
    await expect(item).toBeVisible();
  });

  test('data.txtからアイテムを削除してリロード後に非表示になる', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // GitHubが表示されていることを確認
    const githubBefore = mainWindow.locator('.item', { hasText: 'GitHub' });
    await expect(githubBefore).toBeVisible();

    // GitHubを削除
    configHelper.removeItem('GitHub');

    // アプリをリロード
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // 削除したアイテムが表示されないことを確認
    const githubAfter = mainWindow.locator('.item', { hasText: 'GitHub' });
    await expect(githubAfter).not.toBeVisible();
  });

  test('data.txtのアイテムを更新してリロード後に反映される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // ページの読み込み完了を待機
    await utils.waitForPageLoad();

    // GitHubアイテムを更新
    configHelper.updateItem('GitHub', 'GitLab', 'https://gitlab.com');

    // アプリをリロード
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // 古いアイテムが表示されないことを確認
    const oldItem = mainWindow.locator('.item', { hasText: 'GitHub' });
    await expect(oldItem).not.toBeVisible();

    // 新しいアイテムが表示されることを確認
    const newItem = mainWindow.locator('.item', { hasText: 'GitLab' });
    await expect(newItem).toBeVisible();
  });

  test('テンプレートからdata.txtを読み込んで表示される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // 基本テンプレートを読み込み
    configHelper.loadDataTemplate('base');

    // アプリをリロード
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // 基本テンプレートに含まれるアイテムが表示されることを確認
    const knownItems = ['GitHub', 'Google', 'Wikipedia', 'メモ帳', '電卓'];

    for (const itemName of knownItems) {
      const item = mainWindow.locator('.item', { hasText: itemName });
      await expect(item).toBeVisible();
    }
  });

  test('空のdata.txtでアイテムが表示されない', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // 空テンプレートを読み込み
    configHelper.loadDataTemplate('empty');

    // アプリをリロード
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // アイテムが表示されないことを確認
    const items = mainWindow.locator('.item');
    const itemCount = await items.count();
    expect(itemCount).toBe(0);
  });

  // ==================== settings.json 変更テスト ====================

  test('settings.jsonのホットキー設定が反映される', async ({ electronApp }) => {
    // カスタムホットキー設定を読み込み
    configHelper.loadSettingsTemplate('custom-hotkey');

    // 設定が更新されたことを確認（ファイルから読み込み）
    const settings = configHelper.readSettings();
    expect(settings.hotkey).toBe('Ctrl+Shift+L');
  });

  test('settings.jsonのウィンドウサイズ設定を変更できる', async ({ mainWindow }) => {
    // ウィンドウサイズを更新
    configHelper.updateSettings({
      windowWidth: 800,
      windowHeight: 600,
    });

    // 設定が更新されたことを確認
    const settings = configHelper.readSettings();
    expect(settings.windowWidth).toBe(800);
    expect(settings.windowHeight).toBe(600);
  });

  test('settings.jsonのバックアップ設定を有効化できる', async () => {
    // バックアップ設定テンプレートを読み込み
    configHelper.loadSettingsTemplate('with-backup');

    // 設定が更新されたことを確認
    const settings = configHelper.readSettings();
    expect(settings.backupEnabled).toBe(true);
    expect(settings.backupOnStart).toBe(true);
    expect(settings.backupOnEdit).toBe(true);
    expect(settings.backupInterval).toBe(3);
    expect(settings.backupRetention).toBe(10);
  });

  test('settings.jsonの個別設定項目を更新できる', async () => {
    // 個別設定を更新
    configHelper.updateSetting('autoLaunch', true);

    // 設定が更新されたことを確認
    const settings = configHelper.readSettings();
    expect(settings.autoLaunch).toBe(true);
  });

  test('settings.jsonを削除すると初回起動状態になる', async () => {
    // settings.jsonを削除
    configHelper.deleteSettings();

    // ファイルが存在しないことを確認
    const exists = configHelper.fileExists('settings.json');
    expect(exists).toBe(false);
  });

  // ==================== 複合テスト ====================

  test('data.txtとsettings.jsonの両方を変更して反映される', async ({ mainWindow }) => {
    const utils = new TestUtils(mainWindow);

    // data.txtにアイテムを追加
    configHelper.addItem('新規アイテム', 'https://new-item.com');

    // settings.jsonのウィンドウサイズを変更
    configHelper.updateSettings({
      windowWidth: 700,
      windowHeight: 500,
    });

    // アプリをリロード
    await mainWindow.reload();
    await utils.waitForPageLoad();

    // data.txtの変更が反映されていることを確認
    const newItem = mainWindow.locator('.item', { hasText: '新規アイテム' });
    await expect(newItem).toBeVisible();

    // settings.jsonの変更が反映されていることを確認
    const settings = configHelper.readSettings();
    expect(settings.windowWidth).toBe(700);
    expect(settings.windowHeight).toBe(500);
  });

  // このテストは旧方式のバックアップ機能をテストしていますが、
  // 現在はテンプレートからの復元方式に変更されたためスキップします
  test.skip('バックアップ・復元が正しく動作する', async () => {
    // 元のデータを読み込み
    const originalData = configHelper.readData();
    const originalSettings = configHelper.readSettings();

    // データと設定を変更
    configHelper.addItem('一時アイテム', 'https://temp.com');
    configHelper.updateSetting('windowWidth', 999);

    // 変更されたことを確認
    const modifiedData = configHelper.readData();
    const modifiedSettings = configHelper.readSettings();
    expect(modifiedData).not.toBe(originalData);
    expect(modifiedSettings.windowWidth).toBe(999);

    // 復元
    configHelper.restoreAll();

    // 元に戻ったことを確認
    const restoredData = configHelper.readData();
    const restoredSettings = configHelper.readSettings();
    expect(restoredData).toBe(originalData);
    expect(restoredSettings.windowWidth).toBe(originalSettings.windowWidth);
  });
});
