# ビルドとデプロイ

## ビルドコマンド

```bash
npm install              # 依存関係のインストール
npm run dev             # 開発モード（ポート9001、ホットキー: Ctrl+Alt+A）
npm run dev2            # 開発モード第2インスタンス（ポート9002、ホットキー: Ctrl+Alt+S）
npm run dev:test        # テストデータで開発モード起動（全機能を含むテストデータ、ポート9003、ホットキー: Ctrl+Alt+T）
npm run build           # 型チェック（tsc）→ Viteビルド。prebuildでTHIRD-PARTY-NOTICES.mdを生成
npm run preview         # ビルド済みアプリケーションのプレビュー
npm run start           # ビルドして実行
npm run dist            # Windowsインストーラー（NSIS）とポータブル版の作成（x64）
```

詳細は **[開発ガイド - 多重起動](development.md#多重起動)** を参照してください。

## ビルドシステム

Viteベースのビルドシステムを使用:

- **メインプロセス**: CommonJS形式で`dist/main/`に出力
- **プリロードスクリプト**: CommonJS形式で`dist/main/preload.js`に出力
- **レンダラープロセス**: 複数ウィンドウ分のHTMLを`dist/`に出力（エントリは`vite.config.mts`）
- **開発サーバー**: デフォルトポート9000（環境変数`VITE_PORT`で変更可能）

## パッケージング

- **パッケージングツール**: electron-builder
- **出力先**: `release/`ディレクトリ
- **Windows専用**: クロスプラットフォーム非対応
- **ターゲット**: NSISインストーラーとポータブル版（いずれもx64）
- **App ID**: `net.masaodev.quick-dash-launcher`（masaodev.netドメイン所有者のため）

### App ID（アプリケーション識別子）

QuickDashLauncherのApp IDは`net.masaodev.quick-dash-launcher`です。

**設定箇所**:

- `package.json`: `build.appId`
- `src/main/main.ts`: `app.setAppUserModelId()`（開発モードでは末尾に`.dev`を付けたIDを使う）
- `src/main/services/autoLaunchService.ts`: 自動起動設定

**v0.2.10での変更**:

- **変更前**: `com.example.quick-dash-launcher`
- **変更後**: `net.masaodev.quick-dash-launcher`
- **理由**: masaodev.netドメインを保有しているため、正式なリバースドメイン形式のApp IDに変更

**影響範囲**:

- Windowsレジストリの自動起動設定パス
- Windowsタスクバーでのアプリケーション識別
- インストールディレクトリ構造

**既存インストール版との互換性**:

- App ID変更により、旧版（v0.2.9以前）と新版（v0.2.10以降）は別アプリケーションとして認識されます
- 設定フォルダ（`app.getPath('userData')/config`）はアプリ名で決まり、App IDには左右されません
- 旧版をアンインストールしてから新版をインストールすることを推奨します

## リリース（タグ → GitHub Release）

`v*` 形式のタグをプッシュすると `.github/workflows/release.yml` がビルドし、GitHub Release を作成する（`/release-version` コマンドがこの手順を担う）。

- **リリースノートの本文はタグの注釈から取る**。`git tag -a v{version} --cleanup=verbatim -F notes.md` で作った注釈付きタグのメッセージ本文（1 行目の件名を除く）が、そのまま Release の「更新内容」になる
  - `--cleanup=verbatim` が無いと `#` で始まる Markdown 見出し行がコメント扱いで削られる
  - 軽量タグ（注釈なし）の場合は「QuickDashLauncher vX.Y.Z のリリースです。」の定型文にフォールバックする
- ワークフローが末尾にインストール方法・ライセンスの節を付け、`release-notes.md` として `softprops/action-gh-release` の `body_path` に渡す
- `workflow_dispatch` の手動実行はビルド検証のみで、Release は作らない

### 正式版とベータ版

細かい変更はベータ版として出し、ある程度まとまったところで正式版を出す。

| 種類     | タグの例                         | GitHub Release                    | winget                       |
| -------- | -------------------------------- | --------------------------------- | ---------------------------- |
| ベータ版 | `v0.8.0-beta.1`、`v0.8.0-beta.2` | プレリリース（Latest にならない） | 出ない                       |
| 正式版   | `v0.8.0`                         | 正式（Latest）                    | 自分で更新 PR を出す（下記） |

- タグに `-` が入っていると `release.yml` がプレリリースとして公開する
- 正式版のリリースノートは、前の正式版からの変更（ベータ版の分を含む）をまとめて書く
- 手順は `/release-version beta`・`/release-version stable`（`.claude/commands/git-workflow/release-version.md`）

### winget

[winget](https://github.com/microsoft/winget-pkgs) には `masaodev.quick-dash-launcher` として公開している（インストーラー版 `QuickDashLauncher.Setup.{VERSION}.exe`）。

- **正式版を出したら、自分で winget-pkgs に更新 PR を出す**（`/release-version stable` の手順に含む）。Actions の完了後に次を実行する。Microsoft 側の検証とモデレーターの承認を経てマージされると反映される

  ```bash
  wingetcreate update masaodev.quick-dash-launcher --version {version} \
    --urls "https://github.com/masaodev/quick-dash-launcher/releases/download/v{version}/QuickDashLauncher.Setup.{version}.exe|x64" \
    --release-notes-url "https://github.com/masaodev/quick-dash-launcher/releases/tag/v{version}" \
    --submit --token "$(gh auth token)"
  ```

  - `wingetcreate`（`winget install wingetcreate`）と、`repo` 権限のある `gh` のログインが要る。トークンはその場で渡し、保存しない
  - `--submit` を外して `--out <フォルダ>` を付けると、提出せずにマニフェストの生成と検証だけを試せる

- **予備としてコミュニティの自動更新ボット**（[damn-good-b0t](https://github.com/b0t-at/winget-pkgs-updates)）も QDL を見ている。ボットはリリース直後しばらく待ち、同じ版の PR がすでにあれば出さないので、自分で出せばぶつからない。出し忘れたときは半日〜1 日でボットが出す。プレリリースは拾わない
- 反映を確かめるには `winget show masaodev.quick-dash-launcher` で版を見る。PR の状況は [winget-pkgs の PR](https://github.com/microsoft/winget-pkgs/pulls?q=masaodev.quick-dash-launcher) で確認する

## 重要な制約事項

1. **Windows専用アプリケーション** - クロスプラットフォーム非対応

## トラブルシューティング

### ビルド関連の問題

#### TypeScriptパスエイリアスエラー

**問題**: `@common`パスが解決されない
**原因**: TypeScript設定とVite設定の不一致
**解決策**:

- `tsconfig.json`と`vite.config.mts`でパスエイリアスが一致していることを確認
- 両方に`@common: src/common`が設定されているか確認

#### 白い/空白のウィンドウ

**問題**: アプリケーション起動時に白い画面が表示される
**原因**:

1. Viteデベロップメントサーバーが起動していない（開発モード）
2. index.htmlパスが正しくない（本番モード）
   **解決策**:

- DevToolsコンソールでエラーを確認
- 開発モード: `npm run dev`が実行中か確認
- 本番モード: ビルド出力のパスを確認

### 実行時の問題

#### 起動ホットキーが動作しない

**問題**: 設定したホットキー（デフォルト: Alt+Space）でウィンドウが表示されない
**原因**: 他のアプリケーションとの競合
**解決策**:

- タスクマネージャーで複数のインスタンスが起動していないか確認
- 他のアプリケーションが同じホットキーを使用していないか確認
- 設定画面で別のホットキーに変更してみる

#### アイコンが表示されない

**問題**: アプリケーションアイコンやファビコンが表示されない
**原因**:

1. アイコン抽出の失敗
2. キャッシュディレクトリへのアクセス権限
   **解決策**:

- 設定フォルダ配下の`icon-cache/`（既定は`%APPDATA%\quick-dash-launcher\config\icon-cache\`。faviconは`favicons/`、アプリは`apps/`）の権限を確認
- コンソールログでアイコン抽出エラーを確認

### 依存関係の問題

#### extract-file-iconモジュールエラー

**問題**: アイコン抽出時にモジュールが見つからない
**原因**: ネイティブモジュールの再ビルドが必要
**解決策**:

```bash
npm rebuild extract-file-icon
```

## 関連ドキュメント

- [開発ガイド](development.md) - 基本的な開発情報
- [テストガイド](../testing/README.md) - テストの実行方法
