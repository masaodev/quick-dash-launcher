# ビルドとデプロイ

## ビルドコマンド

```bash
npm install              # 依存関係のインストール
npm run dev             # 開発モード（ポート9001、ホットキー: Ctrl+Alt+A）
npm run dev2            # 開発モード第2インスタンス（ポート9002、ホットキー: Ctrl+Alt+S）
npm run dev:test        # テストデータで開発モード起動（全機能を含むテストデータ、ポート9003、ホットキー: Ctrl+Alt+T）
npm run build           # 型チェック（tsc）→ Viteビルド。prebuildでTHIRD-PARTY-NOTICES.mdを生成
npm run start           # ビルドして実行
npm run dist            # Windowsインストーラー（NSIS）と ZIP 版の作成（x64）。build と build:cli を含む。ZIP は postdist（scripts/make-portable-zip.mjs）が作る
npm run dist:appx       # Store 版（MSIX の appx、x64）の作成。ロゴ画像を build/appx/ に作ってからパッケージにする（試作中）。build と build:cli を含む
npm run winrt:generate  # Store 版で使う WinRT の呼び出しコード（src/main/winrt/generated/）を作り直す
npm run build:cli       # CLI（qdl.exe）のビルド（cargo build --release。Rust が要る）
npm run test:cli        # CLI の単体テスト（cargo test）
npm run generate-licenses # THIRD-PARTY-NOTICES.md の生成（build の前に自動で実行。Rust のクレートを調べるので cargo が要る）
npm run create-dev-icon # 開発モード用アイコンの作成
npm run docs:screenshots # 画面仕様の画面イメージを撮影（ビルド込み）
npm run docs:demo-gif    # README のデモ GIF を撮影（ビルド込み。ffmpeg が要る。撮影中は画面を触らない。英語版は docs:demo-gif:en）
npm run docs:demo-gif-workspace # README のワークスペースのデモ GIF を撮影（同上。撮影中は実際のマウスが動く。英語版は docs:demo-gif-workspace:en）
npm run docs:readme-images # README の「登録と管理の画面」の画面イメージ（登録画面・管理画面）を撮影（ビルド込み。英語版は docs:readme-images:en）
```

詳細は **[開発ガイド - 多重起動](development.md#多重起動)** を参照してください。

## ビルドシステム

Viteベースのビルドシステムを使用:

- **メインプロセス**: CommonJS形式で`dist/main/`に出力
- **プリロードスクリプト**: CommonJS形式で`dist/main/preload.js`に出力
- **レンダラープロセス**: 複数ウィンドウ分のHTMLを`dist/`に出力（エントリは`vite.config.mts`）
- **CSP**: ビルドの最後に、出力した全 HTML へ CSP の meta を入れる（`scripts/viteCspPlugin.ts`。開発サーバーには入れない）。HTML に `<head>` が無いとビルドを失敗させる。HTML にインラインのハンドラー（`onclick` など）を書くと、ビルドした版では動かない（[システム概要 - CSP](../architecture/overview.md)）
- **開発サーバー**: 既定のポート9000（環境変数`VITE_PORT`で変更可能）

## パッケージング

- **パッケージングツール**: electron-builder
- **出力先**: `release/`ディレクトリ
- **Windows専用**: クロスプラットフォーム非対応
- **ターゲット**: NSISインストーラー（x64）。ZIP 版は、electron-builder が途中で作る展開済みのアプリ（`release/win-unpacked`）を ZIP にしたもの（下の「ZIP 版」）。Store 版（appx）は別のコマンドで作る（下記）
- **App ID**: `net.masaodev.quick-dash-launcher`（masaodev.netドメイン所有者のため）
- **CLI の同梱**: `npm run dist`・`dist:appx` は `build:cli` で `qdl.exe` を作ってから同梱する（`package.json` の `build.extraResources`。同梱先は下の「CLI（qdl.exe）」）。Rust が無いと失敗する（[開発ガイド - 必要なツール](development.md#必要なツール)）
- **DLL の同梱**: 仮想デスクトップの操作に使う `resources/native/VirtualDesktopAccessor.dll`（リポジトリに入っている）を、`build.extraResources` でアプリの `resources/resources/native/` に同梱する。パッケージ版は `process.resourcesPath` の下から、開発時はリポジトリ直下から読む（`src/main/utils/virtualDesktop/dllLoader.ts`）
- **サードパーティのライセンス表記**: `npm run build` の prebuild で `scripts/generate-third-party-notices.mjs` が `THIRD-PARTY-NOTICES.md` を作り、`build.extraFiles` でインストール先の直下（exe の横）に置く。ZIP 版・Store 版にも入り、リリースのアセットにも上げる。MIT・BSD・ISC などは著作権表示と本文の同梱を求めるので、名前とライセンス名だけでなく本文も載せる
  - 載せるもの: npm のパッケージ（`dependencies` とその依存。license-checker の `--production`）、同梱の DLL（本文は DLL の横の `<名前>-LICENSE.txt`。DLL を足したらスクリプトの `NATIVE_LIBRARIES` にも足す）、`qdl.exe` に入る Rust のクレート（`cargo metadata`。「MIT OR Apache-2.0」は MIT の本文を選ぶ）
  - Electron と Chromium の本文は、electron-builder が `LICENSE.electron.txt`・`LICENSES.chromium.html` として同梱するので載せない
  - 本文のファイルが無いパッケージがあると失敗する。同じプロジェクトの別パッケージから借りるときは、スクリプトの `LICENSE_TEXT_FROM` に足す（例: `@koromix/koffi-win32-x64` は `koffi` の本文）

### CLI（qdl.exe）

CLI は Rust の Cargo プロジェクト（`cli/`）で、本体とは別の実行ファイルになる。本体の Vite ビルド（`npm run build`）には含まれない。

- 出力: `cli/target/release/qdl.exe`（リリースビルドはサイズ優先の設定。`cli/Cargo.toml` の `[profile.release]`）
- C ランタイム: `cli/.cargo/config.toml` で静的リンク（`+crt-static`）にして、`VCRUNTIME140.dll` に頼らない。Visual C++ 再頒布可能パッケージの無い PC（素の Windows・Windows サンドボックスなど）でも動かすため。Cargo はこの設定を作業フォルダから探すので、`build:cli`・`test:cli` は `cli/` に移ってから cargo を呼ぶ
- 同梱先: インストーラー版は `<インストール先>\resources\bin\qdl.exe`、ZIP 版は `<展開したフォルダ>\resources\bin\qdl.exe`。ターミナルから `qdl` で呼ぶには、どちらも設定「Quick Dash Launcher CLI を使えるようにする」で `%LOCALAPPDATA%\quick-dash-launcher\bin` にコピーしてから PATH で呼ぶ（[CLI](../features/cli.md#qdl-を使えるようにする)）
- パッケージ版の本体は起動のたびに、`qdl.exe` が本体を起動するときに使う本体の場所を userData の `cli-launcher.json` に書き出す（`src/main/services/cli/cliLauncherInfo.ts`）。ZIP 版のポータブルモードでは userData がデータフォルダになり、`qdl.exe` が見る `%APPDATA%` には書かないので、QDL が起動していないときに `qdl` から起動することはできない（起動中なら使える）
- やり取りの形を変えたら、本体の `CLI_PROTOCOL_VERSION`（`src/main/services/cli/cliProtocol.ts`）と `cli/src/main.rs` の `PROTOCOL_VERSION` を一緒に上げる

### ZIP 版

`npm run dist` の最後に `postdist` が `scripts/make-portable-zip.mjs` を動かし、`release/QuickDashLauncher-<版>-portable.zip` を作る。中身は次のとおり（ZIP は Windows 標準の `tar.exe` で作る）。

```text
QuickDashLauncher-<版>\
├─ QuickDashLauncher.exe など（release/win-unpacked の中身そのまま）
└─ portable.txt              ZIP 版の印（中身は使い方の説明）
```

- **データの置き場所**: 既定ではインストーラー版と同じ `%APPDATA%\quick-dash-launcher` を使う。新しいバージョンの ZIP を別のフォルダに展開しても、前のデータをそのまま読む。インストーラー版や以前の 1 ファイルの exe のポータブル版から移っても、データはそのまま出る
- **ポータブルモード**: 印のある exe の横にデータフォルダ `QuickDashLauncher-data\` があれば、起動の最初に userData をデータフォルダにする（`src/main/utils/portableMode.ts`・`src/main/main.ts`）。設定フォルダは userData の下の `config\` なので一緒に移り、Electron のキャッシュなども `%APPDATA%` に書かない。ZIP にはデータフォルダを入れない。初回設定画面の「データを exe の横に保存する（ポータブルモード）」にチェックを付けるとデータフォルダを作って再起動する（[初回設定画面](../screens/first-launch-setup.md#55-使いはじめるボタン押下)）。初回設定の後は、使う人が自分で作る（`portable.txt` に書いてある）。今のデータを移すときは、エクスポートしてから切り替え、インポートする。データフォルダに書き込めないときは `%APPDATA%` を使い、起動時にトーストで知らせる。`APP_INSTANCE` が付いているとき（試用・計測用の別インスタンス）はデータフォルダを使わない
- **配布形式の判定**: 印のファイルで「ZIP 版」とみなす（`src/main/utils/appDistribution.ts`。コード上の名前は `portable`）。インストーラー版・Store 版は印が無いので、同じ名前のフォルダがあっても使わない
- **同時に動かす**: 既定ではインストーラー版や別のフォルダの ZIP 版と userData が同じなので、同時には起動できない（後から起動した方は終わる）。同時に動かすには、どちらかをポータブルモードにする。CLI の待ち受け（パイプ名）は共通なので、先に起動した方が `qdl` の依頼を受ける。ホットキーも先に起動した方が取る
- **起動の速さ**: 以前の 1 ファイルの exe（electron-builder の portable）は、起動のたびに一時フォルダへ展開していた。2026-10-31 の計測では、設定を読み込むまでが 1 ファイルの exe は 17〜23 秒、展開済みのフォルダは 1〜2 秒だった

### App ID（アプリケーション識別子）

Quick Dash Launcher のApp IDは`net.masaodev.quick-dash-launcher`です。

**設定箇所**:

- `package.json`: `build.appId`
- `src/main/main.ts`: `app.setAppUserModelId()`（開発モードでは末尾に`.dev`を付けたIDを使う）
- `src/main/services/autoLaunchService.ts`: 自動起動設定

v0.2.10 で `com.example.quick-dash-launcher` から変えた。App ID は自動起動の登録・タスクバーでの識別・インストール先に使われる。

**既存インストール版との互換性**:

- 旧版（v0.2.9以前）と新版（v0.2.10以降）は別アプリケーションとして認識されます
- 設定フォルダ（`app.getPath('userData')/config`）はアプリ名で決まり、App IDには左右されません
- 旧版をアンインストールしてから新版をインストールすることを推奨します

### Store 版（MSIX）

Microsoft Store に出すための appx を `npm run dist:appx` で作る（設定は `package.json` の `build.appx`）。

- **ロゴ**: `scripts/generate-appx-assets.mjs` が `assets/icon.svg` から拡大率・大きさ別の画像を `build/appx/` に作る（Electron で描くので `electron` コマンドで実行する）
- **自動起動**: マニフェストに StartupTask を書く（`resources/appx/extensions.xml`。初期値は無効）。アプリからは `@microsoft/dynwinrt`（プレビュー版）で WinRT の StartupTask を切り替える。呼び出しコードは `npm run winrt:generate` で作り、git に入れる。生成物の `index.js` は変数を `require` するのでバンドルできず、クラスのファイルを直接読み込む
- **Quick Dash Launcher CLI**: マニフェストにアプリ実行エイリアス（`qdl.exe`）を書く（同じ `resources/appx/extensions.xml`。`uap3` の名前空間は electron-builder のひな形に無いので、要素に `xmlns:uap3` を書く）。インストールするとターミナルから `qdl` で呼べる（[Store 版](../features/cli.md#store-版)）
- **設定フォルダ**: `%APPDATA%` 直下に新しく作るフォルダは、パッケージ専用の場所（`%LOCALAPPDATA%\Packages\<パッケージ>\LocalCache\Roaming\`）に振り替えられる。既にある `%APPDATA%\quick-dash-launcher` は振り替えられず、インストーラー版（とポータブルモードでない ZIP 版）と共有する。振り替えられたフォルダは、本体には振り替え前のパスで見えるが、エクスプローラーや外のターミナルには実際の場所でしか見えない。「設定フォルダを開く」などのフォルダを開く操作と `qdl status` の `configFolder` は、`utils/packagedPath.ts` で実際の場所に直す（パッケージファミリー名は `GetCurrentPackageFamilyName` で取る）
- **Publisher・Identity**: `identityName`（`masaodev.QuickDashLauncher`）と `publisher` は Partner Center がこの製品に割り当てた値で、変えると Store に提出できない。`displayName` は Partner Center で予約した名前と同じにする
- **言語**: `languages` の 1 つ目がパッケージの既定の言語になる。英語を既定にしている（日本語・英語以外の利用者には英語の掲載が出る）。アプリの表示言語は Windows の表示言語から決めるので、この並びには左右されない

ローカルで試すとき（署名なしの appx は実行ファイルを含められないので、開発者モードで展開したフォルダを登録する）:

1. Windows の［設定］→［システム］→［開発者向け］で開発者モードをオンにする
2. `release/` の appx を展開し、`AppxBlockMap.xml`・`[Content_Types].xml` を消す（unzip では `@scope` のフォルダ名が `%40scope` になるので戻す）
3. `Add-AppxPackage -Register <展開したフォルダ>\AppxManifest.xml` で登録し、`Start-Process "shell:AppsFolder\<パッケージファミリー名>!QuickDashLauncher"` で起動する
4. 外すときは `Get-AppxPackage -Name masaodev.QuickDashLauncher | Remove-AppxPackage`

`%APPDATA%\quick-dash-launcher` を共有しているときは、インストーラー版と同時には起動しない（同じ設定フォルダとホットキーを使う）。

## リリース（タグ → GitHub Release）

`v*` 形式のタグをプッシュすると `.github/workflows/release.yml` がビルドし、GitHub Release を作成する（`/release-version` コマンドがこの手順を担う）。

- **リリースノートは英語を先に書き、日本語（正本）を `<details><summary>日本語</summary>…</details>` で折りたたんで併記する**（ベータ版・正式版とも。英語 UI を出した後の版から）。日本語で書いて確認してから英訳する。形は [`/release-version`](../../.claude/commands/git-workflow/release-version.md) の「リリースノートの形」
- **リリースノートの本文はタグの注釈から取る**。`git tag -a v{version} --cleanup=verbatim -F notes.md` で作った注釈付きタグのメッセージ本文（1 行目の件名を除く）が、そのまま Release の「更新内容」になる
  - `--cleanup=verbatim` が無いと `#` で始まる Markdown 見出し行がコメント扱いで削られる
  - 軽量タグ（注釈なし）の場合は「QuickDashLauncher vX.Y.Z release.」の定型文にフォールバックする
- ワークフローが末尾にインストール方法・ライセンスの節（英語と、折りたたんだ日本語）を付け、`release-notes.md` として `softprops/action-gh-release` の `body_path` に渡す
- `workflow_dispatch` の手動実行はビルド検証のみで、Release は作らない

### 正式版とベータ版

細かい変更はベータ版として出し、ある程度まとまったところで正式版を出す。

| 種類 | タグの例 | GitHub Release | winget |
| --- | --- | --- | --- |
| ベータ版 | `v0.8.0-beta.1`、`v0.8.0-beta.2` | プレリリース（Latest にならない） | 出ない |
| 正式版 | `v0.8.0` | 正式（Latest） | 自分で更新 PR を出す（下記） |

- タグに `-` が入っていると `release.yml` がプレリリースとして公開する
- 正式版のリリースノートは、前の正式版からの変更（ベータ版の分を含む）をまとめて書く
- 手順は `/release-version beta`・`/release-version stable`（`.claude/commands/git-workflow/release-version.md`）

### winget

[winget](https://github.com/microsoft/winget-pkgs) には `masaodev.quick-dash-launcher` として公開している（インストーラー版 `QuickDashLauncher.Setup.{VERSION}.exe`）。

- **正式版を出したら、自分で winget-pkgs に更新 PR を出す**。リリースの Actions が終わってから、`npm run winget:manifest -- --version {VERSION} --release-notes <要約のファイル>`（`scripts/winget-manifest.mjs`）でマニフェストを `release/winget/` に作り、中身を確かめてから `wingetcreate submit <そのフォルダ> --token "$(gh auth token)"` で出す（手順は [`/release-version`](../../.claude/commands/git-workflow/release-version.md) の手順 8）。Microsoft 側の検証とモデレーターの承認を経てマージされると反映される
  - スクリプトがすること: `wingetcreate update --out` で前の版を元に作る（`ReleaseDate` には Release の公開日を UTC で入れる）→ 各言語の `PackageName`・`ShortDescription`・`Description`・`Tags`・`Documentations`（その言語の README へのリンク）を `packaging/winget/locale.<言語>.yaml` の値で置き換える → ja-JP に `ReleaseNotes`（数行の要約、1,000 字まで）を入れる → インストーラーの `InstallerSha256` と Release のアセットの digest の照合、`winget validate`。正式版の番号でないとき・Release がプレリリースのとき・インストーラーが載っていないときは止まる
  - `wingetcreate update --submit` で直接出さない。wingetcreate は前の版の `ReleaseNotes` を引き継がず、前の版にあった項目が無いと winget-pkgs の自動検証（Manifest-Metadata-Consistency）に指摘される（0.8.0 で起きた。1.0.1 では `ReleaseDate` が無くて指摘された）
  - **説明文の正本**は `packaging/winget/locale.ja-JP.yaml`（日本語が正本）と `locale.en-US.yaml`（その訳）。README の冒頭と「特徴」に合わせ、README の紹介を大きく変えたら一緒に直す。ReleaseNotes は ja-JP だけに入れる（0.7.39 から同じ。en-US はリリースノートの全文が上限の 10,000 字を超えるため入れていない）
  - `wingetcreate` は作る前に最新にする（`winget upgrade Microsoft.WingetCreate`）。古いと古い形式の版（`ManifestVersion`）で作られ、手元の `winget validate` は通っても winget-pkgs の検証で止まる（1.0.0 で起きた）
  - `wingetcreate`（`winget install wingetcreate`）と、`repo` 権限のある `gh` のログインが要る。トークンはその場で渡し、保存しない

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

**問題**: 設定したホットキー（既定: Alt+Space）でウィンドウが表示されない
**原因**: 他のアプリケーションとの競合
**解決策**:

- タスクマネージャーで複数のインスタンスが起動していないか確認（同じ userData の本体は二重起動の防止で 1 つしか動かないが、開発用のインスタンスや `QUICK_DASH_CONFIG_DIR` を指定した起動は同時に動く。[開発ガイド - 二重起動の防止](development.md#二重起動の防止)）
- 他のアプリケーションが同じホットキーを使用していないか確認
- 設定画面で別のホットキーに変更してみる
- 開発モード（`npm run dev` など）では、環境変数 `HOTKEY` のホットキー（`Ctrl+Alt+A` など）が設定ファイルより優先される（[開発ガイド - 多重起動](development.md#多重起動)）

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

再ビルドには C++ のビルド環境が要る（[開発ガイド - 必要なツール](development.md#必要なツール)）。

## 関連ドキュメント

- [開発ガイド](development.md) - 基本的な開発情報
- [テストガイド](../testing/README.md) - テストの実行方法
