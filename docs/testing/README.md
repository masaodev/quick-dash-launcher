# テストガイド

QuickDashLauncherのテスト関連ドキュメントです。

## クイックスタート

### テスト実行コマンド

```bash
# 単体テスト（Vitest）
npm run test            # ウォッチモード（ファイル変更のたびに再実行）
npm run test:unit       # ワンショット実行
npm run test:ui         # Vitest UI（ブラウザで結果を確認）
npm run test:coverage   # カバレッジレポート付き（閾値を下回ると失敗）

# CLI（cli/、Rust の cargo test。Rust が要る）
npm run test:cli

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

- **テストファイル**: `src/**/*.{test,spec}.{js,ts,jsx,tsx}` と `tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}`。`tests/e2e/` は対象外
- **実行環境**: `vitest.config.mts` の `projects` で 2 つに分ける。`src/main/` と `tests/unit/main/` のテストは node（プロジェクト名 `main`）、それ以外は jsdom（`renderer`）。片方だけ流すときは `npx vitest run --project main`
- **カバレッジの閾値**: `vitest.config.mts` の `coverage.thresholds`（`src/main/` は対象外）
- **セットアップ**: `tests/unit/setup.ts`（`renderer` だけ。React Testing Library のクリーンアップと `window.matchMedia`・`electronAPI` のモックを設定）
- **ヘルパー**: `src/test/helpers/pathTestHelper.ts`
- **実行**: `npm run test:unit`
- **useEffect を待つ**: `findBy*` は画面に出た時点で戻るので、`useEffect` がまだ走っていないことがあります（全件を並列で流して重いときに起きます）。`useEffect` で登録するコールバックを呼ぶテストは、登録されるまで `waitFor` で待ちます。`useEffect` で状態を戻すコンポーネントは、テストの操作が後から上書きされるので、描画中に戻す形にします（2026-10-31。`SetupFirstLaunch` と `WindowPlacementPickModal` でときどき落ちていました）

### 2. E2Eテスト（Playwright）

エンドツーエンドのシナリオテスト。

- **テストファイル**: `tests/e2e/specs/*.spec.ts`（機能別）
- **フィクスチャ・ヘルパー・テンプレートの構成**: [tests/e2e/README.md](../../tests/e2e/README.md)
- **実行**: `npm run test:e2e`（ビルド込み）
- **GitHub Actions**: `.github/workflows/e2e.yml` が GitHub の Windows ランナー（windows-2022）で全件を流す。main へのマージ（docs・Markdown・`.claude/` だけの変更は除く）と手動起動（Actions の「E2E」→ Run workflow、または `gh workflow run e2e.yml --ref <ブランチ>`。`spec` に spec のパスを入れるとそれだけ流す）。PR の CI（`ci.yml`）には含めない。ランナーは英語版の Windows で、画面は 1024×768、マウスのカーソルは画面の中央にある。表示言語はテンプレートの `settings.json` で決め、マウスの位置に結果が左右されないように書く。失敗したテストの画像とトレースは、実行の Artifacts（`e2e-test-results`）に 7 日残る
- **流し直し**: 落ちたテストは CI で 2 回、手元で 1 回まで流し直す（`playwright.config.ts` の `retries`）。流し直して通ったものは flaky として結果に出る
- **流し分け**: 全件は CI で流し、手元では原則流さない（手元の PC は普段使いの PC で、操作が入ると落ちることがあるため）
  - 作業中に直した所を確かめる・画面の見た目を目で確かめる → 手元で関係する spec だけ（`npx playwright test tests/e2e/specs/<名前>.spec.ts`）か、開発用インスタンスで開く
  - PR のマージ前 → 変えた機能に関係する spec だけを手元で流す。全件はマージ前には流さない（時間がかかるため。全件は main へのマージ後の CI に任せる）
  - main へのマージ後 → CI が自動で全件を流す。落ちたら Artifacts の画像・トレースを見て、手元でその spec を再現して直す
  - リリースの前 → main の最新の E2E が通っていることを確かめる（[/release-version](../../.claude/commands/git-workflow/release-version.md) の事前要件）
- **README のデモ GIF の撮影**: `npm run docs:demo-gif`（`tests/demo-gif/` がデモデータ（5 タブ。メインに案件・アプリも含めて約 130 件。中身は `demo-content-ja.ts`、書き出しは `demo-data.ts`）で起動して操作し、ffmpeg の画面キャプチャでメインウィンドウの範囲を録画する。`scripts/make-demo-gif.mjs` がそれを `docs/images/demo-main.gif` にする。英語の README 用は `npm run docs:demo-gif:en`（環境変数 `DEMO_LANG=en`。英語の画面と `demo-content-en.ts` のデータで撮り、`docs/images/demo-main-en.gif` にする）。撮影中はウィンドウが最前面に固定されるので、その範囲に他のウィンドウを重ねない。画面下の説明文（字幕）は既定では出さず、`DEMO_CAPTIONS=1` で出す。ffmpeg が要る。通常の E2E には含めない）
- **README のワークスペースのデモ GIF の撮影**: `npm run docs:demo-gif-workspace`（英語版は `:en`）。メインデモと同じデータに、`demo-content-*.ts` の `workspace` のグループを入れたワークスペースで起動する。メインウィンドウで探したファイルをワークスペースのグループへドラッグし、メインウィンドウを隠した後、そのグループをワークスペースの外へドラッグして切り離す。ウィンドウをまたぐドラッグは Playwright のマウスでは起こせないので、`os-mouse.ts` が PowerShell から OS のマウスを動かす（撮影中はマウスに触れない）。撮る範囲（プライマリディスプレイの右上、メインウィンドウからワークスペースまで）の後ろには無地のウィンドウを敷き、壁紙や他のアプリを写さない。`docs/images/demo-workspace.gif`（英語は `demo-workspace-en.gif`）にする
- **README の画面イメージの撮影**: `npm run docs:readme-images`（同じデモデータで起動し、README の「画面」に載せる管理画面・登録画面（単一アイテム・フォルダ取込）を `docs/images/readme-admin.png`・`readme-register-item.png`・`readme-register-dir.png` に保存する。英語の README 用は `npm run docs:readme-images:en` で、名前の末尾に `-en` を付けて保存する。画面にパスが写るので、デモ用のフォルダを `subst` で空いているドライブ（S: など）に割り当ててから撮り、終わったら外す。見比べ用の別案は `test-results/readme-images/`（英語は `readme-images-en/`）に置く。通常の E2E には含めない）
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

### 4. CLI のテスト（cargo test）

CLI（`qdl.exe`）は Rust なので、Vitest とは別に `cargo test` で単体テストを回す。

- **テスト**: `cli/src/main.rs` の `#[cfg(test)]`（パイプ名・userData のフォルダ名の規則、依頼と応答の JSON の形）
- **本体側**: パイプ名・依頼の読み取り・パイプでの待ち受けと応答・引数とコマンドの解釈・アイテムとワークスペースの操作・PATH への組み込み・起動情報に記録する exe の決め方は `src/main/services/cli/*.test.ts` で、Vitest（`npm run test:unit`）の対象
- **実行**: `npm run test:cli`（`cargo test --manifest-path cli/Cargo.toml`）。CI でも実行する（`.github/workflows/ci.yml`）
- **手で試す**: 起動中の開発インスタンスに `qdl.exe` を向けて試す方法は [開発ガイド - CLI を試す](../setup/development.md#cli-を試す)

---

## テストデータ（テンプレート）

| 置き場 | 用途 | 一覧・使い方 |
| --- | --- | --- |
| `tests/dev/` | 開発時に手で動かすデータ（`npm run dev:test` は `tests/dev/full` を使う） | [tests/dev/README.md](../../tests/dev/README.md) |
| `tests/e2e/templates/` | E2E テストが一時ディレクトリにコピーして使うデータ（既定は `base`） | [tests/e2e/README.md](../../tests/e2e/README.md#テンプレートシステム) |

dev / dev2 / dev:test のポート・ホットキー・設定フォルダは [開発ガイド - 多重起動](../setup/development.md#多重起動) を参照してください。

E2E は日本語の画面で動かします。テンプレートと `tests/dev/full` の `settings.json` には `"language": "ja"` を入れてあります（`settings.json` の無い `first-launch` は Windows の表示言語に従うので、日本語の Windows で動かします）。英語の画面は `tests/e2e/specs/language.spec.ts` と単体テストで確かめます。単体テストでは `tests/unit/setup.ts` が i18next を日本語で初期化します。

---

## E2Eテストの書き方

### 単体テストとの分け方

変換・振り分けなどの細部（どの値がどの形になるか）は単体テストで確かめ、E2E では「画面で操作する・読み込むと、画面に出てファイルに書き戻る」配線を確かめます。細部を E2E でも照合すると、形を変えるたびに両方を直すことになるためです。単体テストの無い経路（たとえば data.json を読み込んで書き戻し、変換前のスナップショットを作るまで）は E2E で確かめます。

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

アプリの終了はフィクスチャが `app.quit()` で行います。テストの中で `electronApp.close()` を呼ばないでください。Playwright の `electronApp.close()` は、管理ウィンドウを一度でも開いたあとだと終了までに 5 秒ほど待つためです（2026-10-25 に計測。全件の 3 分の 1 のテストにこの待ちが乗っていました）。

### 待ち方

- 画面やファイルが変わるのを待つときは、`waitForTimeout` で固定の時間を置かずに、`expect(locator)` か `expect.poll` で変わった結果を待ちます。`settings.json` やデータファイルへの保存は非同期なので、読む側も `expect.poll(() => configHelper.readSettings().<キー>)` で待ちます。
- 何かが起きないこと（画面が移らない・ウィンドウが閉じない・メニューが後から出ない）を確かめるときだけ、`waitForTimeout` で少し待ってから確かめます。なぜ待つのかをコメントに書きます。
- 例外として、管理ウィンドウを開くヘルパー（`openAdminWindow`）は、⚙ を押したあとに 0.2 秒待ちます。外すと CI で、管理ウィンドウから開く詳細編集が応答しなくなることがあるためです（2026-10-26。何を待てばよいかは分かっていません）。固定の待ちを外すときは、CI でその spec を繰り返し流して確かめます（`gh workflow run e2e.yml --ref <ブランチ> -f spec="<spec> --repeat-each=10 --retries=0"`）。

### 実際に開かないようにする

アイテムを開く操作（Enter・ダブルクリック・メニューの「開く」）では、本物のアプリや URL を開かないよう、メインプロセスの受け口を差し替えて、渡されたものを記録して確かめます。「エラーが出ない」だけでは確かめたことになりません。

- アイテムを開く: `ipcMain` の `open-item` を差し替える（`multi-tab.spec.ts`・`item-execution.spec.ts`）
- URL を開く: `shell.openExternal` を差し替える（`item-execution.spec.ts`）
- ネイティブの右クリックメニュー: `Menu.prototype.popup` を差し替え、右クリックしてからメニューの選択を IPC で送る。メニューの対象は右クリックで決まるので、右クリックせずに IPC だけを送っても何も起きません（`context-menu.spec.ts`）

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

### 2 種類のトレース

失敗したテストには、トレースが 2 つ残ります（成功したテストの分は残しません）。

| 置き場 | 記録するもの | 中身 |
| --- | --- | --- |
| `test-results/test-artifacts/<テスト名>/trace.zip` | Playwright の設定（`trace: retain-on-failure`） | テストの手順とエラーだけ。Electron の画面は入らない |
| `test-results/traces/trace-<タイムスタンプ>.zip` | フィクスチャ（`tests/e2e/fixtures/electron-app.ts`）がアプリの起動から終了まで | 画面のコマと DOM のスナップショットも入る。画面の様子はこちらで見る |

失敗時のスクリーンショット・動画は `test-results/test-artifacts/<テスト名>/` に保存されます。途中の画面を確実に残したいときは、明示的に撮影します。

```typescript
await utils.attachScreenshot(testInfo, 'モーダル表示');
```

### トレースビューアーの使用

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
- **E2E 用**: `tests/e2e/templates/<名前>/` に `datafiles/data.json`（必要なら `settings.json`。置くときは `"language": "ja"` を入れる）を置き、テスト側で `test.use({ configTemplate: '<名前>' })` または `configHelper.loadTemplate('<名前>')` で指定します。データの形式は [data-format.md](../architecture/file-formats/data-format.md) を参照してください。

---

## トラブルシューティング

### テストがタイムアウトする

- `playwright.config.ts`の`timeout`設定を確認
- ページ読み込み待機を追加

### トレースにスクリーンショットが表示されない

- `test-results/test-artifacts/` のトレースには Electron の画面が入らない。`test-results/traces/` のトレースを開く（[2 種類のトレース](#2-種類のトレース)）

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
