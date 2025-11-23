# E2Eテストガイド

QuickDashLauncherのE2Eテスト（End-to-End Test）の詳細ガイドです。

## テスト実行方法

### 基本的なテスト実行

```bash
# すべてのE2Eテストを実行
npm run test:e2e

# UIモードで実行（インタラクティブ）
npm run test:e2e:ui

# デバッグモードで実行
npm run test:e2e:debug

# ヘッド付きで実行（ブラウザを表示）
npm run test:e2e:headed
```

### 特定のテストを実行

```bash
# 特定のテストファイルを実行
npx playwright test tests/e2e/specs/item-registration.spec.ts

# 特定のテストケースを実行
npx playwright test -g "アイテムの名前を編集できる"
```

## テストファイル構成

```
tests/e2e/
├── fixtures/              # テスト用フィクスチャ
│   ├── e2e/              # E2E用設定ファイル
│   └── electron-app.ts   # Electronアプリフィクスチャ
├── helpers/              # ヘルパークラス
│   ├── config-file-helper.ts
│   └── test-utils.ts
└── specs/                # テスト仕様
    ├── app-launch.spec.ts
    ├── config-modification.spec.ts
    ├── first-launch-setup.spec.ts
    ├── item-display.spec.ts
    ├── item-registration.spec.ts
    ├── multi-tab.spec.ts
    ├── search.spec.ts
    └── settings-tab.spec.ts
```

## 設定ファイル

### playwright.config.ts

Playwrightの設定ファイル。以下の主要設定が含まれています：

```typescript
{
  testDir: './tests/e2e/specs',
  timeout: 30000,
  trace: {
    mode: 'on',
    screenshots: true,  // Electronでは制限あり
    snapshots: true,
    sources: true,
  },
  screenshot: 'on',
  video: 'on',
}
```

## ヘルパークラス

### TestUtils

テストで共通的に使用するユーティリティメソッドを提供：

#### 基本操作
- `waitForPageLoad()` - ページ読み込み待機
- `waitForElement()` - 要素の表示待機
- `clickByText()` - テキストで要素をクリック
- `fillInput()` - 入力フィールドに値を設定
- `wait()` - 指定時間待機

#### モーダル操作
- `openRegisterModal()` - 登録モーダルを開く
- `fillRegisterForm()` - フォーム入力
- `clickRegisterButton()` - 登録ボタンをクリック
- `clickCancelButton()` - キャンセルボタンをクリック

#### アイテム編集
- `rightClickItem()` - アイテムを右クリック
- `editItemByRightClick()` - 右クリックで編集モーダルを開く

#### 複数ウィンドウ操作
- `openAdminWindow()` - 管理ウィンドウを開く

#### スクリーンショット
- `attachScreenshot()` - スクリーンショット撮影してtestInfoに添付

### ConfigFileHelper

テスト用の設定ファイル操作：

- `readData()` - data.txtの読み込み
- `writeData()` - data.txtの書き込み
- `readSettings()` - settings.jsonの読み込み
- `restoreDataFromTemplate()` - テンプレートから復元
- `restoreSettingsFromTemplate()` - 設定テンプレートから復元
- `deleteData2()` - data2.txtの削除
- その他設定ファイル操作

詳細は [フィクスチャガイド](./fixtures-guide.md) を参照してください。

## トレース機能とスクリーンショット

### トレースビューアーの使用

テスト実行後、トレースファイルが `test-results/test-artifacts/` に保存されます。

```bash
# HTMLレポートを開く
npx playwright show-report test-results/html-report

# 特定のトレースファイルを開く
npx playwright show-trace test-results/test-artifacts/<テスト名>/trace.zip
```

### Electron環境での制限事項

**重要**: Electronアプリケーションでは、Playwrightのトレース機能による自動スクリーンショット撮影に制限があります。

#### 既知の問題

Playwrightの`trace: { screenshots: true }`設定は、通常のブラウザテストでは各アクション（click、fill、gotoなど）の前後でスクリーンショットを自動的に撮影しますが、**Electronアプリケーションでは期待通りに動作しません**。

関連する既知の問題：
- [Issue #13180](https://github.com/microsoft/playwright/issues/13180) - Electronでトレーシングが動作しない
- [Issue #28687](https://github.com/microsoft/playwright/issues/28687) - スクリーンショットが歪む
- [Issue #28594](https://github.com/microsoft/playwright/issues/28594) - メインプロセス内でのトレーシングがアクションを記録しない
- [Issue #12125](https://github.com/microsoft/playwright/issues/12125) - 失敗時のスクリーンショットが動作しない

PlaywrightチームはElectron内部でのPlaywright使用を低優先度（P3）としており、完全な解決には至っていません。

#### 推奨される回避策

トレースに詳細なスクリーンショットを含めるには、**明示的にスクリーンショットを撮影**する必要があります。

```typescript
test('テスト名', async ({ mainWindow }, testInfo) => {
  const utils = new TestUtils(mainWindow);

  await test.step('ステップ1の説明', async () => {
    // 処理を実行
    await utils.openRegisterModal();

    // スクリーンショットを撮影
    await utils.attachScreenshot(testInfo, 'モーダル表示');
  });

  await test.step('ステップ2の説明', async () => {
    await utils.fillRegisterForm({
      name: 'テスト',
      path: 'https://example.com',
    });

    await utils.attachScreenshot(testInfo, 'フォーム入力完了');
  });
});
```

このパターンにより：
- トレースビューアーで各ステップのスクリーンショットが確認できる
- テストの進行状況が視覚的に理解しやすくなる
- デバッグが容易になる

### スクリーンショット撮影のベストプラクティス

1. **重要なアクションの前後で撮影**
   - モーダルを開く前後
   - フォーム入力後
   - ボタンクリック後
   - リロード後

2. **明確な説明を付ける**
   - `'初期状態'`, `'モーダル表示'`, `'登録後'` など

3. **test.stepを活用**
   - 各ステップを論理的に分割
   - トレースビューアーでの確認が容易

## トラブルシューティング

### トレースにスクリーンショットが表示されない

**原因**: Electronアプリケーションでは自動スクリーンショット機能に制限があります。

**解決策**: 上記の「推奨される回避策」に従って、明示的にスクリーンショットを撮影してください。

### テストがタイムアウトする

- `playwright.config.ts`の`timeout`設定を確認
- アクションのタイムアウト設定を調整
- ページ読み込み待機を追加

### ファイルパスの問題

- すべてのパスは絶対パスを使用
- `path.join(process.cwd(), ...)`を使用してパスを構築

## テストの書き方

### 基本パターン

```typescript
import { test } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';

test('テスト名', async ({ mainWindow }, testInfo) => {
  const utils = new TestUtils(mainWindow);

  await test.step('初期状態の確認', async () => {
    await utils.waitForPageLoad();
    await utils.attachScreenshot(testInfo, '初期状態');
  });

  await test.step('操作を実行', async () => {
    // テストコード
    await utils.attachScreenshot(testInfo, '操作後');
  });
});
```

### 複数ウィンドウのテストパターン

管理ウィンドウ（設定タブなど）は別ウィンドウとして開かれるため、`electronApp.waitForEvent('window')`を使用して新しいウィンドウを取得します。

```typescript
import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

test('管理ウィンドウのテスト', async ({ electronApp, mainWindow }, testInfo) => {
  const utils = new TestUtils(mainWindow);

  // 管理ウィンドウを開く（設定タブ）
  const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

  try {
    const adminUtils = new TestUtils(adminWindow);

    await test.step('管理ウィンドウの操作', async () => {
      await adminUtils.wait(500);
      await adminUtils.attachScreenshot(testInfo, '管理ウィンドウ表示');

      // 設定変更などの操作
      const settingsTab = adminWindow.locator('.settings-tab');
      await expect(settingsTab).toBeVisible();
    });
  } finally {
    // テスト後は必ずウィンドウをクローズ
    await adminWindow.close();
  }
});
```

#### openAdminWindowのパラメータ

- `electronApp`: ElectronApplicationインスタンス（フィクスチャから取得）
- `tab`: 開くタブ（`'settings'` | `'edit'` | `'other'`）

このメソッドは以下の処理を行います：

1. メインウィンドウの設定ドロップダウンをクリック
2. 指定されたタブメニューを選択
3. `electronApp.waitForEvent('window')`で新しいウィンドウを待機
4. ウィンドウタイトルが「設定・管理」であることを確認
5. ウィンドウのDOMコンテンツ読み込みを待機
6. Pageオブジェクトを返す

### フィクスチャの使用

```typescript
import { ConfigFileHelper } from '../helpers/config-file-helper';

test.beforeEach(async () => {
  const configHelper = new ConfigFileHelper(configDir);
  configHelper.loadDataTemplate('base'); // テンプレート読み込み
});

test('フィクスチャを使用したテスト', async ({ mainWindow }) => {
  // テストコード
});
```

## 関連ドキュメント

- [手動テストチェックリスト](./manual-checklist.md) - 手動テスト項目
- [フィクスチャガイド](./fixtures-guide.md) - テストフィクスチャの詳細
- [開発ガイド](../guides/development.md) - 開発プロセス全般
- [tests/e2e/README.md](../../tests/e2e/README.md) - E2Eテストのクイックリファレンス
- [Playwright公式ドキュメント](https://playwright.dev/)
- [Electron Testing with Playwright](https://playwright.dev/docs/api/class-electron)
