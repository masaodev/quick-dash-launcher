# システム概要

QuickDashLauncherのアーキテクチャ概要とデータフローを説明します。

## プロセス構造

| プロセス | 場所 | 役割 |
| --- | --- | --- |
| **メインプロセス** | `src/main/main.ts` | システム操作、ウィンドウ管理、IPC処理 |
| **レンダラープロセス** | `src/renderer/` | UIのためのReactアプリケーション |
| **プリロードスクリプト** | `src/main/preload.ts` | レンダラーに限定的なAPIを公開するセキュアブリッジ |
| **共通型定義** | `src/common/types/` | プロセス間で共有される型定義（機能別に分割） |

### ウィンドウとレンダラープロセスの対応

| ウィンドウ | 生成方法 | レンダラープロセス |
| --- | --- | --- |
| メイン | メインプロセスの `BrowserWindow` | 独立（開き元） |
| ワークスペース | メインのレンダラーが `window.open` で生成 | **メインと共有** |
| オーバーレイ（トースト・レイアウト進捗） | メインのレンダラーが `window.open` で生成 | **メインと共有** |
| 切り離しグループウィンドウ | ワークスペースのレンダラーが `window.open` で生成 | **メインと共有** |
| ワークスペースアイテムの編集ウィンドウ | ワークスペースのレンダラーが `window.open` で生成（閉じると破棄） | **メインと共有** |
| メイン画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果） | メインのレンダラーが `window.open` で生成（閉じると破棄） | **メインと共有**（管理画面から開いた場合は管理と共有） |
| ワークスペースの確認ウィンドウ | ワークスペースのレンダラーが `window.open` で生成（閉じると破棄） | **ワークスペースと共有** |
| 管理画面の子ウィンドウ（アイテムの登録・編集） | 管理のレンダラーが `window.open` で生成（閉じると破棄） | **管理と共有** |
| 管理 / スプラッシュ | メインプロセスの `BrowserWindow` | ウィンドウごとに1プロセス |

レンダラープロセスは1枚あたり約60MB以上の固定メモリを消費するため、常駐するウィンドウは
`src/main/services/childWindowService.ts` の `openChildWindow()` でメインウィンドウのレンダラーから開き、プロセスを共有する。
流れは次のとおり:

1. メインプロセスが対象HTML（`index.html` / `workspace.html` / `overlay.html`）の内容を読み込み、IPC（`WINDOW_OPEN_CHILD`）で開き元レンダラーに渡す
2. preload が `window.open('about:blank', name)` を実行し、`document.write` でHTMLを書き込む（相対パスは開き元URL基準で解決される）
3. メインプロセスが `did-create-window` で `BrowserWindow` を受け取り、以降の表示・位置・イベント管理は従来どおり行う
4. 開き元が使えない場合はタイムアウト後に `new BrowserWindow` で直接生成する（フォールバック）

切り離しウィンドウの `groupId` は `window.name`（`detached-group:<groupId>`）から取得する（フォールバック時のみURLクエリ）。
管理画面は重い処理（アイコン一括取得等）でメインのJSスレッドを塞がないよう独立プロセスのまま。

- **about:blank で開く理由**: `window.open` の子ウィンドウをURLへナビゲーションさせると、Electron 44では preload が適用されない
- **preload の登録**: `session.registerPreloadScript` でセッション単位に登録し、`window.open` の子ウィンドウを含む全ウィンドウに共通適用する（各 `BrowserWindow` の `webPreferences.preload` は指定しない）
- **注意**: プロセスを共有するウィンドウはJSスレッドも共有する。重い処理を行うウィンドウは独立プロセスにすること
- **副次効果**: 開き元（メイン・ワークスペース・管理）では `setWindowOpenHandler` により、生成待ちに対応しない `window.open`（外部リンク等）は全て拒否される
- **IPC**: `window:open-child` / `window:child-written`（[IPCチャンネル](ipc-channels.md#windowopen-child-イベント)）

---

## 主要な責務の分担

メインプロセス側は「ウィンドウ管理」「IPC ハンドラー」「サービス」「ユーティリティ」の層に分かれる。個々のファイルは増減するので、網羅的な一覧はディレクトリを直接参照すること。

| 層 | 場所 | 責務 |
| --- | --- | --- |
| ウィンドウ管理 | `src/main/*WindowManager.ts` | ウィンドウごとの生成・表示・位置・破棄（`windowManager.ts`＝メイン、`workspaceWindowManager.ts`・`adminWindowManager.ts`・`detachedGroupWindowManager.ts` など） |
| IPC ハンドラー | `src/main/ipc/` | 機能ごとの `*Handlers.ts` が IPC の受け口を登録する。処理本体はサービス層に委ねる |
| サービス | `src/main/services/` | 設定・データファイル・ワークスペース・アイコン・クリップボード・バックアップ・通知などの処理本体 |
| ユーティリティ | `src/main/utils/` | アイテムの起動（`itemLauncher.ts`）、ウィンドウ検索・制御（`windowActivator.ts`・`windowMatcher.ts`）、仮想デスクトップ制御（`virtualDesktop/`）など |
| 設定・パス | `src/main/config/` | ファイルパスの一元管理（`pathManager.ts`）と環境変数（`envConfig.ts`、`QUICK_DASH_*`） |
| 共通 | `src/common/` | プロセス間で共有する型（`types/`）・ユーティリティ（`utils/`）・IPC チャンネル定数（`ipcChannels.ts`） |

**設計原則:**

- ハンドラーは IPC の登録に専念し、処理本体はサービス層に置く
- サービスは `getInstance()` で取得するシングルトンか、関数を直接エクスポートするモジュールのどちらか（例: アイコン取得は `services/icon/` の関数群）
- パスは `PathManager` の静的メソッドから取得し、各所で組み立てない
- 型は `src/common/types/` に機能別に分割し、`index.ts` から再エクスポートする

### 構成上のポイント

- **データファイル**: 読み込み・変換・保存は `src/main/services/data/` に分かれる（読み込みと外部変更の検知、JSON アイテムから表示用アイテムへの変換、管理画面の一覧の保存と楽観ロック、破損ファイルの記録）
- **ワークスペース**: `WorkspaceService` はファサードで、ファイルの読み書き（`WorkspaceFileStore`）・UI 状態（`WorkspaceUiStateStore`）・アイテム／グループ／アーカイブの各マネージャーに分割されている（`src/main/services/workspace/`）。ファイル形式は[ワークスペースファイル形式](file-formats/workspace-format.md)を参照
- **トースト通知**: トーストとレイアウト進捗は 1 枚のオーバーレイウィンドウを共用し、`overlayWindowService.ts` が管理する。OS 標準の通知は `notificationService.ts`
- **子ウィンドウ**: メインのレンダラーを共有する子ウィンドウは `childWindowService.ts` で開く（[ウィンドウとレンダラープロセスの対応](#ウィンドウとレンダラープロセスの対応)）

IPC の設計とチャンネル定義の置き場所は[IPCチャンネル](ipc-channels.md)を参照。

---

## データ処理システム

設定フォルダのデータファイル（`datafiles/data*.json`）とワークスペースファイルは、人や AI がエディタで直接編集する前提で読み書きする。各処理の仕様は[データファイル形式 5 章](file-formats/data-format.md#5-エラー処理とフォールバック)と[ワークスペースファイル形式](file-formats/workspace-format.md)を参照。

- **読み込み**: 起動時とメイン画面の F5 で、データファイルとワークスペースをまとめて読み直す（`services/data/dataFileLoader.ts` の `reloadConfigFiles`）。寛容パース（`common/utils/jsonParser.ts`）で、JSON 構文が壊れたファイルは「破損」として読まず、不正なアイテムはアイテム単位でスキップし、`id` の欠落・重複は採番する。採番・補正があれば 1 回だけ書き戻す
- **変換**: JSON アイテムを表示用の `AppItem` に変換する（`services/data/jsonItemConverter.ts`）。フォルダ取込（`type: "dir"`）はフォルダを走査して展開し、`.lnk` はリンク先を解析する（`ipc/directoryScanner.ts`）。タブ単位で重複を除き、表示名でソートする
- **保存**: QDL 自身の書き込みは `services/dataFileTracker.ts` の `writeDataFile()` を通し、書いた内容を記憶する。管理画面の一覧保存は読み込み時のハッシュと照合する楽観ロック付き（`editableItemsStore.ts`）。メイン画面からの登録・編集は都度ディスクを読み直して ID で差し替える（`dataItemWriter.ts`）。破損中のファイルへの保存・登録は拒否する
- **外部変更**: ファイル監視はしない。読み込んだ内容が記憶と違えば QDL の外で編集されたとみなし、変更前の内容をスナップショット（`backup/*_pre-external/`。`backupEnabled` が true のとき）に残す。読み込み結果は `config/last-load-report.json` に書き出す（`services/loadReportService.ts`）
- **形式の移行**: データファイルには形式の移行がなく、`$schema`・`version` の補完だけを行う。ワークスペースファイルは旧形式（`version` なし）を検知すると、移行前スナップショット（`_pre-migration`）を作ってから 2.0 に変換して書き戻す（`services/workspace/WorkspaceFileStore.ts`・`workspaceMigration.ts`）
- **補助ファイル**: 起動時に同梱 JSON Schema を `config/schemas/` へコピーし、直接編集する人・AI 向けの `config/README.md` を生成する（`services/configFolderDocsService.ts`）

パスはいずれも `src/main/`・`src/common/` からの相対。

---

## データフロー

### 初回起動フロー

1. アプリケーション起動時に`hotkey`設定の有無をチェック
2. `hotkey`が空 → 初回設定画面を表示
3. ユーザーがホットキーを設定 → 設定保存 → メインウィンドウに遷移

### 通常モード（表示・起動）

1. メインプロセスが設定フォルダの `datafiles/` からデータファイルを読み込む（[設定フォルダの場所](file-formats/README.md#設定フォルダの場所)）
2. フォルダ取込の展開や `.lnk` のリンク先の解決をし、タブ単位で重複を除いて並べる
3. レンダラーが受け取ったアイテムを、入力に合わせて絞り込んで表示する
4. 起動などの操作は IPC でメインプロセスに依頼する

### 編集モード（生データ編集）

1. 管理ウィンドウがデータファイルを JSON のまま読み込む（`load-editable-items`）
2. 一覧での編集は管理ウィンドウの中だけで持ち、保存のときにまとめて書き込む（`save-editable-items`）
3. 書き込んだら `data-changed` イベントでメインウィンドウなどに知らせ、各ウィンドウが読み直す

### 設定の即座反映フロー

1. 設定を保存する（`settings:set-multiple`）
2. `settings-changed` イベントを全ウィンドウに送る
3. 各ウィンドウが設定を読み直して画面に反映する

### アイコン取得フロー

1. レンダラーが対象のアイテムを渡して一括取得を依頼する（`fetch-icons-combined`）
2. メインプロセスが、フェーズ 1 で URL のファビコン、フェーズ 2 で EXE・カスタム URI などのアイコンを取得し、キャッシュに保存する
3. 進捗をイベントでレンダラーに送り、終わると結果（成功・エラー）を返す

### 検索履歴

1. 検索語を入力したままアイテムを実行すると、メインプロセスがその検索語を `search-history.json` に保存する（最大 100 件）
2. 同じ検索語がすでにあれば古いほうを消し、最新の時刻で先頭に入れる（`src/main/services/searchHistoryService.ts`）
3. レンダラーは履歴を読み、Ctrl+↑/↓ で検索ボックスに出す

### ワークスペースフロー

1. ワークスペースウィンドウ・切り離しウィンドウ・メイン画面からの追加・編集は、IPC でメインプロセスのワークスペースのサービスに依頼する
2. サービスが `workspace.json`・`workspace-archive.json` に書き込み、`workspace-changed` イベントで各ウィンドウに知らせる
3. 形式と読み書きの仕組みは [ワークスペースファイル形式](file-formats/workspace-format.md)を参照

---

## 関連ドキュメント

- [IPCチャンネル](ipc-channels.md) - 各IPCチャンネルの仕様
- [ウィンドウ制御](window-control.md) - ウィンドウ管理システム
- [ファイル形式一覧](file-formats/README.md) - すべてのファイル形式の概要
- [データファイル形式](file-formats/data-format.md) - data.json仕様
- [ワークスペースファイル形式](file-formats/workspace-format.md) - workspace.json仕様
- [設定ファイル形式](file-formats/settings-format.md) - settings.json仕様
- [CSSデザインシステム](css-design.md) - スタイル管理
