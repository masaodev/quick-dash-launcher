# 開発ガイド

## 技術スタック

| 項目 | 技術 |
| --- | --- |
| フロントエンド | React + TypeScript + Vite |
| バックエンド | Electron（メインプロセス） |
| スタイリング | CSS変数ベースのデザインシステム（[CSSデザイン](../architecture/css-design.md)） |
| パッケージング | electron-builder |
| テスト | Playwright（E2E）+ Vitest（単体） |

動作環境は Windows のみです。開発には Node.js 22.12.0 以上が必要です（`package.json` の `engines`）。

## 開発環境のセットアップ

### 開発モード用アイコン

v0.5.20以降、開発モード実行時には赤い「DEV」オーバーレイ付きアイコンが適用されます。これにより、本番環境と視覚的に区別できます。

**アイコンの仕組み**:

- 開発用アイコンは`assets/icon-dev.ico`、`assets/icon-dev.png`に配置済み
- `PathManager.getAppIconPath()`が環境に応じて`assets/`ディレクトリのアイコンを選択
- 全ウィンドウ（メイン、トレイ、スプラッシュ、ワークスペース、管理）に適用

**App User Model ID**:

- 開発モード用に異なるIDを設定（アイコンキャッシュ対策）
- 本番: `net.masaodev.quick-dash-launcher`
- 開発: `net.masaodev.quick-dash-launcher.dev`

### 多重起動

v0.5.3以降、開発時に複数のインスタンスを同時に起動できるようになりました。これにより、異なる設定やデータで並行開発・比較検証が可能です。

#### 利用可能なインスタンス

| コマンド | ポート | ホットキー | 設定フォルダ | 用途 |
| --- | --- | --- | --- | --- |
| `npm run dev` | 9001 | Ctrl+Alt+A | `%APPDATA%\dev-quick-dash-launcher\config` | メイン開発環境 |
| `npm run dev2` | 9002 | Ctrl+Alt+S | `%APPDATA%\dev2-quick-dash-launcher\config` | 比較検証用 |
| `npm run dev:test` | 9003 | Ctrl+Alt+T | `./tests/dev/full` | テストデータでの動作確認（起動時に表示・表示固定モード） |

#### 環境変数

インスタンスの動作は以下の環境変数で制御されます：

| 環境変数 | 説明 | 例 |
| --- | --- | --- |
| `APP_INSTANCE` | インスタンス識別子（userDataパスに使用） | `dev`, `dev2` |
| `VITE_PORT` | Vite開発サーバーのポート番号 | `9001`, `9002` |
| `HOTKEY` | 起動ホットキー（設定ファイルを上書き） | `Ctrl+Alt+A`, `Ctrl+Alt+S` |
| `QUICK_DASH_CONFIG_DIR` | 設定フォルダのパス（絶対パスまたは相対パス） | `./tests/dev/full` |
| `WINDOW_PIN_MODE` | 起動時の固定モード（`normal`・`alwaysOnTop`・`stayVisible`。それ以外は無視） | `stayVisible` |
| `SHOW_WINDOW_ON_STARTUP` | `1` で起動時にメインウィンドウを表示する | `1` |
| `SKIP_SPLASH_WINDOW` | `1` でスプラッシュウィンドウを出さない | `1` |
| `DISABLE_GLOBAL_HOTKEY` | `1` でグローバルホットキーを登録しない | `1` |

#### 実装の仕組み

メインプロセスは環境変数を `EnvConfig`（`src/main/config/envConfig.ts`）から読む。

- `APP_INSTANCE`: 起動直後に userData をインスタンスごとのフォルダに切り替える（`src/main/main.ts`）。設定フォルダもその下になる（[設定フォルダの場所](../architecture/file-formats/README.md#設定フォルダの場所)）
- `VITE_PORT`: Vite の開発サーバー（`vite.config.mts`）と、メインプロセスが読み込む URL の両方に使う
- `HOTKEY`: 設定ファイルの起動ホットキーより優先する（`src/main/services/hotkeyService.ts`）

#### カスタムインスタンスの作成

独自のインスタンスを作成する場合は、環境変数を指定して起動します：

**PowerShellの例:**

```powershell
# カスタムポート・ホットキーで起動
$env:APP_INSTANCE="custom"; $env:VITE_PORT="9003"; $env:HOTKEY="Ctrl+Shift+Z"; npm run dev

# 特定のテストデータで起動
$env:QUICK_DASH_CONFIG_DIR="./tests/dev/full"; npm run dev
```

**Bashの例:**

```bash
# カスタムポート・ホットキーで起動
APP_INSTANCE=custom VITE_PORT=9003 HOTKEY=Ctrl+Shift+Z npm run dev

# 特定のテストデータで起動
QUICK_DASH_CONFIG_DIR=./tests/dev/full npm run dev
```

#### 注意事項

- 各インスタンスは完全に独立しており、設定・データファイル・キャッシュは共有されません
- ホットキーは必ず異なる値を指定してください（競合を避けるため）
- `HOTKEY`環境変数が設定されている場合、設定ファイルの値は無視されます
- インスタンスを停止する際は、各ターミナルで`Ctrl+C`を押してください

## 重要な実装詳細

### ウィンドウの動作

メインウィンドウの表示・非表示・固定モード・子ウィンドウの扱いは [ウィンドウ制御](../architecture/window-control.md) を正とする。サイズと表示位置の設定項目は [設定ファイルの形式](../architecture/file-formats/settings-format.md) を参照。

### データファイル形式

データファイル（data.json、data2.json）の詳細な形式仕様については、専用ドキュメントを参照してください：
**[データファイル形式仕様](../architecture/file-formats/data-format.md)**

**基本例:**
詳細な形式仕様については上記リンク先を参照してください。JSON形式でアイテムを管理しています。

**画面イメージの撮り直し:** 画面の見た目を変えたら `npm run docs:screenshots` で画面仕様の画像を撮り直す（[画面仕様書 執筆ガイドライン - 画面イメージ](../screens/WRITING-GUIDE.md#画面イメージ)）。

**JSON Schema の再生成:** データファイル・設定ファイルの型（`src/common/types/json-data.ts`・`settings.ts`）を変えたら `npm run schema:generate` で `assets/schemas/*.schema.json` を再生成してコミットしてください。単体テスト（`tests/unit/schemas.test.ts`）が生成結果とコミット済みファイルの一致を検証しており、忘れると落ちます。詳細は [ファイル形式一覧の「AI・手動編集」](../architecture/file-formats/README.md#ai手動編集)。

### データ読み込みと重複排除

データファイルの読み込み（`src/main/services/data/dataFileLoader.ts`。起動時と F5 で呼ばれる）は、タブ単位で重複を除く。同じタブの中で重複したアイテムは 1 つだけ読み、別のタブにあるものは両方読む。重複の判定とタブに属さないファイルの扱いは [データファイル形式 - 重複排除ルール](../architecture/file-formats/data-format.md#4-重複排除ルール) を参照（判定キーの組み立ては `jsonItemConverter.ts`）。

### アイテムタイプの検出

判定は `src/common/utils/itemTypeDetector.ts`。パスの文字列から次の順で決める。

- URL: `://` を含み、スキーマが `http`・`https`・`ftp`
- カスタムURI: それ以外のスキーマ（`obsidian://`、`ms-excel:` など）
- アプリ: `shell:AppsFolder\` で始まる、または拡張子が `.exe`・`.bat`・`.cmd`・`.com`・`.lnk`
- フォルダ: `shell:` で始まる、拡張子がない、または `/`・`\` で終わる
- ファイル: その他すべて

### 検索の実装

- 大文字小文字を区別しないインクリメンタルサーチ
- スペース区切りキーワードでAND検索
- 表示名のみでフィルタリング

## コード品質向上のガイドライン

### リファクタリングの原則

1. **DRY（Don't Repeat Yourself）**: 同じロジックの重複を避ける
2. **単一責任の原則**: 1つの関数は1つの責任のみ持つ
3. **関数の小型化**: 理解しやすいサイズに関数を分割
4. **命名の明確化**: 関数名と変数名で処理内容を明確に表現

### 共通処理の抽出手順

1. **重複コードの特定**: 同様の処理が複数箇所にないか定期的に確認
2. **共通部分の抽出**: 重複している処理を独立した関数として分離
3. **関数の統合**: 抽出した共通関数を各箇所で使用するよう修正
4. **動作確認**: ビルドとテストで機能が維持されることを検証

**共通化した処理の置き場所（新しく書く前に確認する）:**

- アイコン取得: `src/main/services/icon/iconFetcher.ts` の `getIconForItem()`（アイコン用 IPC が直接、ワークスペースの IPC は `services/iconService.ts` 経由で使う）
- アイテムの起動: `src/main/utils/itemLauncher.ts`（URL・ファイル・アプリ・カスタムURI。`itemHandlers.ts` と `workspaceHandlers.ts` が共用）
- ウィンドウの検索・アクティブ化・位置とサイズの設定: `src/main/utils/windowActivator.ts`
- 登録・編集フォームの部品: `src/renderer/components/WindowConfigEditor.tsx`（ウィンドウ設定）と `CustomIconEditor.tsx`（カスタムアイコン）。`RegisterItemForm.tsx` とワークスペースのアイテム編集が使う

### パフォーマンス最適化

- **バンドルサイズ**: 不要なコードの削除でアプリケーションサイズを最適化
- **処理の一貫性**: 同じデータに対して常に同じ処理を適用
- **エラーハンドリング**: 1箇所での修正が全体に反映される設計

### PRの自動チェック

PRとmainへのpushで、GitHub Actions（`.github/workflows/ci.yml`）が型チェック（`npm run type-check`）・lint（`npm run lint`）・単体テスト（`vitest run`）を実行します。JSON Schemaの再生成漏れも `tests/unit/schemas.test.ts` のドリフト検知で失敗として出ます。E2Eは対象外なので、リリース前にローカルで `npm run test:e2e` を実行してください。

### 依存関係管理

#### Dependabotによる自動更新

v0.5.7以降、Dependabotを導入して依存関係の自動更新を実現しています。

**設定ファイル:** `.github/dependabot.yml`

**自動更新の対象:**

- npm依存関係（package.json）
- GitHub Actions（ワークフローファイル）

**更新スケジュール:**

- **npm依存関係**: 毎週月曜日 9:00 JST（Asia/Tokyo）
- **GitHub Actions**: 毎週月曜日 9:00 JST（Asia/Tokyo）

**依存関係のグループ化:**
Dependabotは依存関係を以下のグループに分けてPRを作成します：

1. **production-major** - 本番依存関係のメジャーバージョンアップ
2. **production-minor-patch** - 本番依存関係のマイナー・パッチ更新
3. **development-dependencies** - 開発依存関係のマイナー・パッチ更新

開発依存関係のメジャーバージョンアップはグループに入らず、個別のPRになります。GitHub Actionsの更新はグループ化せず、個別にPRが作成されます。

**PR数の制限:**

- npm依存関係: 最大10件のPR
- GitHub Actions: 最大5件のPR

**セキュリティアップデート:**
脆弱性が検出された場合、即座にPRが作成されます。

**運用フロー:**

1. 毎週月曜日にDependabotが依存関係をチェック
2. 更新可能なパッケージがあればPRを自動作成
3. PR内容をレビュー（CHANGELOGや破壊的変更を確認）
4. 問題なければマージ
5. テストが自動実行され、品質が確認される

**注意事項:**

- メジャーバージョンアップは慎重にテスト
- 破壊的変更がある場合は手動で対応
- E2Eテストを実行して動作確認

## 実装パターンとベストプラクティス

### Electronアプリケーション パターン

#### サービスクラスの設計

メインプロセスの処理本体は `src/main/services/` に置く。層の分担と構成は[システム概要](../architecture/overview.md#主要な責務の分担)を参照。

**設計パターン:**

- 状態を持つサービスはシングルトンで、`getInstance()` で取得する
- 状態を持たない処理は関数を直接エクスポートするモジュールにする（アイコン取得など）
- IPCハンドラーから呼び出し、ハンドラー側にはロジックを置かない
- 各サービスは単一責任の原則に従い、重複したロジックは一箇所に集約する

例: 状態を持つ `AutoLaunchService`（シングルトン）、関数をエクスポートする `services/iconService.ts`。

#### IPCハンドラーの構造化

- 機能ごとにハンドラーを分離（`src/main/ipc/`）
- 各ハンドラーは単一責任の原則に従う
- サービスクラスを呼び出して処理を実行
- 型安全性のため共有型は`src/common/types/`（`index.ts`から再エクスポート）、チャンネル名は`src/common/ipcChannels.ts`の`IPC_CHANNELS`で定義

#### プロセス間通信のベストプラクティス

チャンネル名は文字列を直書きせず `IPC_CHANNELS` を使い、レンダラーにはプリロードで `window.electronAPI` として公開した関数だけを見せる。受け口・公開・呼び出しの書き方の例と設計の詳細は[IPCチャンネル](../architecture/ipc-channels.md)を参照。

#### ファイルパスの処理

- 開発/本番環境の違いを考慮
- `app.isPackaged`を使用して環境を判定
- パスは常に絶対パスで処理

#### 設定ファイルの場所の管理

設定ファイルやアイコンキャッシュなどの保存場所は `PathManager`（`src/main/config/pathManager.ts`）で一元管理している。設定フォルダの決まり方（既定の場所、`QUICK_DASH_CONFIG_DIR`、多重起動の `APP_INSTANCE`）は [ファイル形式一覧 - 設定フォルダの場所](../architecture/file-formats/README.md#設定フォルダの場所) を正とする。

- テストでは `PathTestHelper`（`src/test/helpers/pathTestHelper.ts`）で一時フォルダに切り替え、終わったら片付ける
- 開発中に別の設定フォルダで試すときは、`QUICK_DASH_CONFIG_DIR` を付けて `npm run dev` する（[多重起動](#多重起動)）

### React + TypeScript パターン

#### 状態管理

- 小規模な状態は`useState`で管理
- グローバル状態は必要に応じてContextを使用
- 複雑な状態ロジックはカスタムフックに抽出

#### カスタムフックによる責務分離

大きなコンポーネントは、関連する状態とロジックをカスタムフックに分離してください：

例: ワークスペースウィンドウは、データの読み込み（`useWorkspaceData`）・操作（`useWorkspaceActions`）・ネイティブのドラッグ&ドロップ（`useNativeDragDrop`）をフックに分けている。

**カスタムフック作成のガイドライン:**

- 単一責任の原則に従う（データ管理、アクション処理、UI状態など）
- 関連するロジックをグループ化
- 再利用可能な形で設計
- JSDocで目的と使用例を明記

**参考実装:**

- `src/renderer/hooks/workspace/useWorkspaceData.ts` - データ読み込みと状態管理
- `src/renderer/hooks/workspace/useWorkspaceActions.ts` - アクション処理の統合
- `src/renderer/hooks/useNativeDragDrop.ts` - ネイティブドラッグ&ドロップ処理
- `src/renderer/hooks/useClipboardPaste.ts` - クリップボードからのペースト処理
- `src/renderer/hooks/useCollapsibleSections.ts` - 折りたたみ状態管理
- `src/renderer/hooks/workspace/useWorkspaceItemGroups.ts` - アイテムグループ化ロジック
- `src/renderer/hooks/workspace/useWorkspaceResize.ts` - ワークスペースウィンドウのサイズ変更処理
- `src/renderer/hooks/useFileOperations.ts` - ファイルパスの取り出しとアイテム追加の共通処理（ドロップ処理とクリップボードのペーストが共用）

#### 型定義とガード関数

- 型は`src/common/types/`で機能別に分割管理（v0.5.20で再編成）
- 型アサーションの代わりに型ガード関数を使用（`src/common/types/guards.ts`）

型定義ファイルは `src/common/types/` に機能別に分かれている（一覧はディレクトリを参照）。新しい型は該当ドメインのファイルに追加し、`index.ts` から再エクスポートする。

### CSS開発パターン

スタイルの規約（CSS 変数・共通クラス・命名・ファイル構成・値の直書き禁止）は **[CSSデザインシステム](../architecture/css-design.md)**、コンポーネントの命名と `Button` コンポーネントの使い分けは **[UIコンポーネント](../architecture/ui-components.md)** を正とする。ここには重ねて書かない。

### パフォーマンス最適化パターン

#### アイコンのキャッシュ

- ファビコンは設定フォルダの `icon-cache/favicons/` にキャッシュ（詳細は [アイコンシステム](../features/icons.md)）
- ダウンロード前にキャッシュの存在を確認

#### 検索の最適化

- 大文字小文字を区別しないインクリメンタルサーチ
- フィルタリングはレンダラー側でリアルタイム実行

## UIコンポーネント構造

画面とコンポーネントの対応は、[画面一覧](../screens/README.md) と各画面仕様の「基本情報」を正とする（画面のいちばん上のコンポーネントには「画面仕様:」コメントがある）。共通ダイアログは [共通ダイアログ](../screens/dialogs.md)、メイン画面の ⚙️ メニューは [メインウィンドウ](../screens/main-window.md) を参照。

## デバッグ

### DevToolsの開き方

開発モードでは、以下の方法でDevToolsを開くことができます：

**管理・ワークスペース・切り離しウィンドウ:**

- `Ctrl+Shift+I` で開発者ツールを開閉する（開発モードのみ。`attachCommonKeyHandlers`（`src/main/utils/managedWindow.ts`）を付けたウィンドウで使える）

**メインウィンドウ:**

- `attachCommonKeyHandlers` が付いていないため `Ctrl+Shift+I` は使えません。コードを直接編集して `mainWindow.webContents.openDevTools()` を追加する方法もありますが、通常は管理ウィンドウのDevToolsで十分です

> **注意**: v0.4.4以降、開発モードでの自動DevTools起動は削除されました。必要な場合は上記の方法で手動で開いてください。

### ウィンドウ検索機能のデバッグ

ウィンドウ検索機能のトラブルシューティングには、専用のデバッグツールを使用できます。

**ウィンドウデバッグツール（debug-windows.mjs）:**

```bash
# 基本的な使い方
npm run debug:windows

# 全仮想デスクトップのウィンドウを取得
npm run debug:windows -- --all-desktops

# 除外されたウィンドウも表示
npm run debug:windows -- --show-excluded

# 実行パスも表示
npm run debug:windows -- --show-paths

# ファイルに出力
npm run debug:windows -- --all-desktops --show-excluded --output debug.txt
```

**機能:**

- ウィンドウ一覧の取得と確認
- 除外ルールの動作確認（プロセス名・クラス名の組み合わせ）
- 各ウィンドウのプロセス名・クラス名・実行パスの確認
- システムウィンドウの除外動作の検証

**詳細:** `scripts/README.md` を参照

### デバッグ時の問題

#### 白い/空白のウィンドウ

- DevToolsコンソールでエラーを確認（管理・ワークスペース・切り離しウィンドウは `Ctrl+Shift+I` で開く。メインウィンドウは `Ctrl+Shift+I` が使えないため、上記の方法で開く）
- Viteデベロップメントサーバーが起動しているか確認（開発モード時）
- プロダクションモードでindex.htmlパスが正しいか確認

#### ウィンドウが検索で表示されない

1. **除外ルールで除外されていないか確認**

   ```bash
   npm run debug:windows -- --show-excluded
   ```

2. **全デスクトップを取得しているか確認**

   ```bash
   npm run debug:windows -- --all-desktops
   ```

3. **クローキング状態を確認**
   - 他の仮想デスクトップにあるウィンドウは`DWM_CLOAKED_SHELL`フラグでクローキングされている
   - `--all-desktops`オプションで取得可能

### よくあるビルドの問題

- TypeScript設定の`@common`パスエイリアスがVite設定と一致しているか確認
- ビルド出力が正しいディレクトリ構造になっているか確認
- Electronのファイルパスがビルド/開発モードで適切に処理されているか確認

## ファイル入出力処理

### データフォーマットの処理

データファイルはJSON形式で管理されています。詳細な形式仕様については、**[データファイル形式仕様](../architecture/file-formats/data-format.md)** を参照してください。

## UI/UXガイドライン

### ユーザーインターフェースの一貫性

#### 検索インターフェース

- **クリアボタン**: メイン画面の検索ボックス・アイテム管理の検索・アプリ取込の検索は、入力があるときだけ「×」（`.search-clear-button`）を表示し、クリックで入力を消す。新しく検索欄を作るときもこの形にそろえる
- **リアルタイム検索**: 入力と同時に結果をフィルタリング
- **キーボードナビゲーション**: 矢印キー、Enterキーでの操作

#### フォーカス管理

- **自動フォーカス**: メインウィンドウの表示時に検索ボックスへ、検索欄を持つモーダル（ウィンドウ選択・レイアウト取得・グループのアイテム選択）やワークスペースのフィルタ欄は表示時にその欄へフォーカスする
- **フォーカス維持**: メイン画面の検索ボックスは、クリアボタンを押した後もフォーカスを保つ

### アクセシビリティ

- **aria-label**: クリアボタンに「検索をクリア」ラベルを設定
- **キーボードアクセス**: Tabキーでフォーカス移動が可能

### 視覚的フィードバック

- **ホバーエフェクト**: クリアボタンのホバー時に背景色変更
- **クリックフィードバック**: アクティブ状態の視覚的表現
- **統一されたデザイン**: CSSデザインシステムの変数を使用した一貫したスタイル

## 関連ドキュメント

- [アイテム管理](../screens/admin-window.md) - アイテム管理タブでの編集
- [CSSデザインシステム](../architecture/css-design.md) - 統一されたスタイル管理システム
- [ビルドとデプロイ](build-deploy.md) - ビルドシステムと配布方法
- [テストガイド](../testing/README.md) - テストの実行方法
- [アイコンシステム](../features/icons.md) - アイコン取得・管理システム
- [フォルダ取込](../screens/register-modal.md#56-フォルダ取込オプションを設定) - フォルダ内容のインポート機能
