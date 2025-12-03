# テストガイド

QuickDashLauncherのテスト関連ドキュメントです。

## クイックスタート

### テスト実行コマンド

```bash
# 単体テスト（Vitest）
npm run test            # インタラクティブモード
npm run test:unit       # ワンショット実行
npm run test:coverage   # カバレッジレポート付き

# E2Eテスト（Playwright）
npm run test:e2e        # ヘッドレス実行
npm run test:e2e:ui     # テストUI表示
npm run test:e2e:debug  # デバッグモード
npm run test:e2e:headed # ヘッド付き実行
```

### 特定のテストを実行

```bash
# 特定のファイル
npx playwright test tests/e2e/specs/item-registration.spec.ts

# 特定のテストケース
npx playwright test -g "アイテムの名前を編集できる"
```

---

## テストの種類

### 1. 単体テスト（Vitest）

個別モジュールや関数レベルのテスト。

- **テストファイル**: `src/**/*.test.ts`
- **ヘルパー**: `src/test/helpers/pathTestHelper.ts`
- **実行**: `npm run test:unit`

### 2. E2Eテスト（Playwright）

エンドツーエンドのシナリオテスト。

```
tests/e2e/
├── fixtures/     # テスト用フィクスチャ
├── helpers/      # ヘルパークラス
└── specs/        # テスト仕様
    ├── alert-dialog.spec.ts
    ├── app-launch.spec.ts
    ├── confirm-dialog.spec.ts
    ├── first-launch-setup.spec.ts
    ├── item-display.spec.ts
    ├── item-registration.spec.ts
    ├── multi-tab.spec.ts
    ├── search.spec.ts
    └── settings-tab.spec.ts
```

### 3. 手動テスト

リリース前の確認項目は [手動テストチェックリスト](./manual-checklist.md) を参照。

---

## テストフィクスチャ

### 開発用テンプレート

```bash
npm run dev:minimal   # 最小限のセット
npm run dev:full      # 全機能セット
npm run dev:tabs      # タブ機能デモ
npm run dev:groups    # グループ起動デモ
npm run dev:large     # 大量データ（パフォーマンステスト）
npm run dev:empty     # 空データセット
```

### テンプレート一覧

| テンプレート | 説明 | 用途 |
|-------------|------|------|
| `minimal` | 最小限（5個） | 基本動作確認、バグ修正 |
| `full-featured` | 全機能（30個+グループ） | デモ、機能確認 |
| `multi-tab` | 3タブ構成 | タブ機能の確認 |
| `with-groups` | グループ起動特化 | グループ機能の確認 |
| `large-dataset` | 大量データ（100個以上） | パフォーマンステスト |
| `empty` | 空データ | 初期状態の確認 |

### E2Eテスト用テンプレート

| テンプレート | 説明 |
|-------------|------|
| `base` | 基本的なアイテムセット |
| `with-tabs` | マルチタブ機能有効 |
| `empty` | 空のデータファイル |
| `with-groups` | グループアイテム含む |
| `with-backup` | バックアップ機能有効 |
| `first-launch` | 初回起動用 |

---

## E2Eテストの書き方

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

### 複数ウィンドウのテスト

```typescript
test('管理ウィンドウのテスト', async ({ electronApp, mainWindow }, testInfo) => {
  const utils = new TestUtils(mainWindow);
  const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

  try {
    const adminUtils = new TestUtils(adminWindow);
    // テストコード
  } finally {
    await adminWindow.close();
  }
});
```

### ConfigFileHelperの使用

```typescript
// テンプレート読み込み
configHelper.loadTemplate('with-tabs');

// データファイル操作
configHelper.readData();
configHelper.writeData(lines);
configHelper.addItem(name, path, args);

// 設定ファイル操作
configHelper.readSettings();
configHelper.updateSetting('key', value);
```

---

## トレース機能

### Electron環境での制限

**重要**: Electronアプリケーションでは、Playwrightのトレース機能による自動スクリーンショット撮影に制限があります。

**推奨回避策**: 明示的にスクリーンショットを撮影

```typescript
await utils.attachScreenshot(testInfo, 'モーダル表示');
```

### トレースビューアーの使用

```bash
# HTMLレポートを開く
npx playwright show-report test-results/html-report

# 特定のトレースを開く
npx playwright show-trace test-results/test-artifacts/<テスト名>/trace.zip
```

---

## Git管理方針

### 管理対象（コミットする）

| ファイル | 理由 |
|---------|------|
| `tests/e2e/templates/*` | テストの基礎データ |
| `tests/dev/*/data.txt` | 開発用初期データ |
| `tests/dev/*/settings.json` | テンプレート設定 |
| `README.md` | ドキュメント |

### 管理対象外（除外する）

| ファイル | 理由 |
|---------|------|
| `tests/e2e/configs/.temp/` | テスト実行時の一時ディレクトリ |
| `tests/dev/*/icons/` | 自動生成 |
| `tests/dev/*/favicons/` | 自動生成 |
| `tests/dev/*/backup/` | 自動生成 |

---

## カスタムテンプレートの作成

### 開発用テンプレート

```bash
mkdir tests/dev/my-custom
echo "My App,C:\path\to\app.exe" > tests/dev/my-custom/data.txt
```

### E2Eテスト用テンプレート

```bash
mkdir tests/e2e/templates/my-test
echo "My Item,https://example.com" > tests/e2e/templates/my-test/data.txt
echo '{"showDataFileTabs": false}' > tests/e2e/templates/my-test/settings.json
```

---

## トラブルシューティング

### テストがタイムアウトする

- `playwright.config.ts`の`timeout`設定を確認
- ページ読み込み待機を追加

### トレースにスクリーンショットが表示されない

- Electron環境の制限のため、明示的に撮影が必要

### テンプレートを変更したのに反映されない

- アプリをリロード（Ctrl+R）または再起動

### ファイルパスの問題

- すべてのパスは絶対パスを使用
- `path.join(process.cwd(), ...)`でパスを構築

---

## 関連ドキュメント

- [手動テストチェックリスト](./manual-checklist.md)
- [開発ガイド](../setup/development.md)
- [tests/e2e/README.md](../../tests/e2e/README.md)
- [tests/dev/README.md](../../tests/dev/README.md)
- [Playwright公式ドキュメント](https://playwright.dev/)
