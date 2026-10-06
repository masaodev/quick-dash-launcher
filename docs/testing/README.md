# テストガイド

QuickDashLauncherのテスト関連ドキュメントです。

## クイックスタート

### テスト実行コマンド

```bash
# 単体テスト（Vitest）
npm run test            # ウォッチモード（ファイル変更のたびに再実行）
npm run test:unit       # ワンショット実行
npm run test:ui         # Vitest UI（ブラウザで結果を確認）
npm run test:coverage   # カバレッジレポート付き

# E2Eテスト（Playwright）
npm run test:e2e        # ヘッドレス実行
npm run test:e2e:ui     # テストUI表示
npm run test:e2e:debug  # デバッグモード
npm run test:e2e:headed # ヘッド付き実行

# 画面仕様の画面イメージ（通常の E2E とは別。ビルドしてから撮影）
npm run docs:screenshots

# 手動確認用スクリプト（src/test/manual/。自動テストの対象外）
npm run test:window-move "ウィンドウタイトル" [x] [y] [width] [height] [desktopNumber]  # 指定ウィンドウの移動
npm run test:window-list [--all-desktops]                                                # ウィンドウ一覧の取得
```

### 特定のテストを実行

```bash
# 1ファイルだけ実行（ビルド込み。引数なしで指定できる名前の一覧を表示）
npm run test:e2e:single first-launch

# npx で直接実行する場合は事前に npm run build が必要
npx playwright test tests/e2e/specs/item-registration.spec.ts   # 特定のファイル
npx playwright test -g "新規アイテムを登録できる"                     # 特定のテストケース
```

`test:e2e:single` は `scripts/run-e2e-test.js` に登録された名前（`first-launch`、`basic-ui`、`item-register` など）だけを受け付けます。登録されていない spec は `npx playwright test` で指定してください。

---

## テストの種類

### 1. 単体テスト（Vitest）

個別モジュールや関数レベルのテスト。

- **テストファイル**: `src/**/*.{test,spec}.{js,ts,jsx,tsx}` と `tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}`（`vitest.config.mts` の `include`）。`tests/e2e/` は対象外
- **セットアップ**: `tests/unit/setup.ts`（jsdom 環境。React Testing Library のクリーンアップと `window.matchMedia`・`electronAPI` のモックを設定）
- **ヘルパー**: `src/test/helpers/pathTestHelper.ts`
- **実行**: `npm run test:unit`

### 2. E2Eテスト（Playwright）

エンドツーエンドのシナリオテスト。

- **テストファイル**: `tests/e2e/specs/*.spec.ts`（機能別）
- **フィクスチャ・ヘルパー・テンプレートの構成**: [tests/e2e/README.md](../../tests/e2e/README.md)
- **実行**: `npm run test:e2e`（ビルド込み）
- **README のデモ GIF の撮影**: `npm run docs:demo-gif`（`tests/demo-gif/` で 1 操作ごとに撮り、`scripts/make-demo-gif.mjs` が ffmpeg で `docs/images/demo-main.gif` にまとめる。デモデータは `tests/e2e/templates/demo/`。ffmpeg が要る。通常の E2E には含めない）
- **画面イメージの撮影**: `npm run docs:screenshots`（`tests/screenshots/`。通常の E2E には含めない。決まりは [画面仕様書 執筆ガイドライン - 画面イメージ](../screens/WRITING-GUIDE.md#画面イメージ)）

### 3. ブラウザ自動操作（Playwright MCP）

Claude Code から、起動中の QuickDashLauncher を MCP 経由でその場で操作する仕組みです。画面のスナップショット（アクセシビリティツリー）の取得、クリック・文字入力、タブ切り替え、スクリーンショット撮影ができます。テストコードを書いて繰り返し実行する E2E テストとは別物で、変更の動作確認や不具合の再現に使います。

**つなぎ方**: リポジトリ直下の `.mcp.json` に MCP サーバー `electron-playwright` が定義されています。中身は `npx @playwright/mcp@latest --cdp-endpoint http://localhost:9222` で、ポート 9222 のリモートデバッグ（Chrome DevTools Protocol）に接続して Electron の画面を操作します。Chrome MCP（claude-in-chrome）は Chrome の拡張機能経由で動くため、Electron アプリは操作できません。

**起動**: QDL を `npm run dev:test` で起動します。`src/main/main.ts` は開発モードのときだけリモートデバッグポートを開き、設定フォルダが `tests/dev/full` のとき（＝`dev:test`）は 9222 に固定、それ以外（`dev`・`dev2`）は空きポートを自動で割り当てます。したがって MCP がつながるのは `dev:test` のインスタンスだけで、ビルド済みの本番版ではポート自体が開きません。

操作は Claude Code に自然文で頼みます（例: 「仕事タブに切り替えて、表示されているアイテムを確認して」「検索ボックスに GitHub と入力してスクリーンショットを撮って」）。管理画面など別ウィンドウは MCP 側ではタブとして見えるので、タブを切り替えてから操作します。

**つながらないとき**:

- **ポート 9222 が使用中**: 前回の `dev:test` の Electron が残っているか、別のアプリが 9222 を使っています。残った Electron を終了してから起動し直します（`taskkill //F //IM electron.exe` は他の Electron アプリも終了させる点に注意）。
- **MCP のツールが出てこない**: `.mcp.json` の設定を確認し、Claude Code を再起動します。`npx @playwright/mcp@latest` が実行できるかも確認します。
- **クリックがタイムアウトする**: 要素がまだ表示されていないことが多いので、スナップショットで現在の状態を確かめてから再試行します。

9222 はローカルの開発用ポートです。外部から接続できる状態にしないでください。

---

## テストデータ（テンプレート）

| 置き場 | 用途 | 一覧・使い方 |
| --- | --- | --- |
| `tests/dev/` | 開発時に手で動かすデータ（`npm run dev:test` は `tests/dev/full` を使う） | [tests/dev/README.md](../../tests/dev/README.md) |
| `tests/e2e/templates/` | E2E テストが一時ディレクトリにコピーして使うデータ（既定は `base`） | [tests/e2e/README.md](../../tests/e2e/README.md#テンプレートシステム) |

dev / dev2 / dev:test のポート・ホットキー・設定フォルダは [開発ガイド - 多重起動](../setup/development.md#多重起動) を参照してください。

---

## E2Eテストの書き方

### 基本パターン

```typescript
import { test } from '../fixtures/electron-app';
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
// テンプレートから一時ディレクトリを作成（推奨）
const configHelper = ConfigFileHelper.createTempConfigDir(testName, 'base');

// または既存ディレクトリに対してテンプレートを読み込み
configHelper.loadTemplate('with-tabs');

// データファイル操作（JSONファイル名を指定）
configHelper.readDataFile('data.json');
configHelper.writeDataFile('data.json', content);
configHelper.addSimpleItem('data.json', displayName, itemPath);
configHelper.addItemToFile('data.json', item);

// 設定ファイル操作
configHelper.readSettings();
configHelper.updateSetting('key', value);
configHelper.updateSettings({ key1: value1, key2: value2 });

// クリーンアップ
configHelper.cleanup();
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

失敗したテストのスクリーンショット・動画・トレースは `test-results/test-artifacts/` に、フィクスチャが記録するトレースは `test-results/traces/` に保存されます。

```bash
npx playwright show-trace test-results/test-artifacts/<テスト名>/trace.zip
npx playwright show-trace test-results/traces/trace-<タイムスタンプ>.zip
```

---

## Git管理方針

### 管理対象（コミットする）

| ファイル | 理由 |
| --- | --- |
| `tests/e2e/templates/*/datafiles/*.json` | テストの基礎データ |
| `tests/e2e/templates/*/settings.json` | テンプレート設定 |
| `tests/dev/*/datafiles/*.json`、`tests/dev/*/datafiles/*.txt` | 開発用初期データ |
| `tests/dev/*/settings.json` | テンプレート設定 |
| `README.md` | ドキュメント |

### 管理対象外（除外する）

| ファイル | 理由 |
| --- | --- |
| `tests/e2e/configs/.temp/` | テスト実行時の一時ディレクトリ |
| `tests/dev/` 配下の自動生成物（`*/icons/`・`*/favicons/`・`*/custom-icons/`・`backup/` など） | 実行時に自動生成。除外の一覧は `tests/dev/.gitignore` を参照 |

---

## カスタムテンプレートの作成

- **開発用**: [tests/dev/README.md の手順](../../tests/dev/README.md#カスタムテンプレートの作成) に従い、`tests/dev/<名前>/` を作って `QUICK_DASH_CONFIG_DIR` で指定して起動します。
- **E2E 用**: `tests/e2e/templates/<名前>/` に `datafiles/data.json`（必要なら `settings.json`）を置き、テスト側で `test.use({ configTemplate: '<名前>' })` または `configHelper.loadTemplate('<名前>')` で指定します。データの形式は [data-format.md](../architecture/file-formats/data-format.md) を参照してください。

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

- [開発ガイド](../setup/development.md)
- [tests/e2e/README.md](../../tests/e2e/README.md)
- [tests/dev/README.md](../../tests/dev/README.md)
- [Playwright公式ドキュメント](https://playwright.dev/)
