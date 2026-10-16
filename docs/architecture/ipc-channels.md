# IPCチャンネル

メインプロセスとレンダラープロセス間の IPC の設計と、挙動に注意が要る主要チャンネルを説明します。

**全チャンネルの一覧はコードを正とします。** チャンネル名は `src/common/ipcChannels.ts` の `IPC_CHANNELS`、レンダラーに公開している API とその型は `src/common/types/electronApi.ts`（`ElectronAPI`）と `src/main/preload.ts`、受け口は `src/main/ipc/*Handlers.ts`（`window:child-written` のみ `src/main/services/childWindowService.ts`）を参照してください。このドキュメントにはチャンネルの網羅表を置きません。

## IPC の構成

| 役割 | 場所 | 内容 |
| --- | --- | --- |
| チャンネル名の定義 | `src/common/ipcChannels.ts` | `IPC_CHANNELS` オブジェクト（`as const`）と、チャンネル名の型 `IpcChannelName` |
| レンダラー向け API | `src/main/preload.ts` | `contextBridge.exposeInMainWorld('electronAPI', electronAPI)` で `window.electronAPI` として公開 |
| API の型 | `src/common/types/electronApi.ts` | `ElectronAPI`。preload の実装はこの型で注釈しているので、ずれは型チェックで検出される |
| 受け口 | `src/main/ipc/*Handlers.ts` | 機能ごとに `ipcMain.handle` / `ipcMain.on` を登録する。登録は `src/main/ipc/index.ts` を起点に呼ぶ（ブックマーク・アプリ取込は `dataHandlers.ts` 経由。`window:child-written` は `childWindowService.ts` が登録） |
| 全ウィンドウへの通知 | `src/main/ipc/notifications.ts` など | `webContents.send` でイベントを送る（`notifyDataChanged()`・`notifyWorkspaceChanged()`） |

レンダラーは `ipcRenderer` を直接使わず、必ず `window.electronAPI` の関数を呼ぶ。新しいチャンネルを足すときは、`IPC_CHANNELS` への追加 → ハンドラーの登録 → `ElectronAPI` 型と preload への追加、の順で揃える。

```typescript
// src/main/ipc/settingsHandlers.ts（受け口）
ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_event, key?: keyof AppSettings) => { ... });

// src/main/preload.ts（公開）
getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),

// レンダラー
const settings = await window.electronAPI.getSettings();
```

## 通信の種類と使い分け

| 種類 | メイン側 | レンダラー側 | 使う場面 |
| --- | --- | --- | --- |
| 呼び出し（要求→応答） | `ipcMain.handle` | `ipcRenderer.invoke` | 大半のチャンネル。戻り値または例外が `Promise` で返る |
| 一方向の通知（レンダラー→メイン） | `ipcMain.on` | `ipcRenderer.send` | 応答を待たない合図（`window:child-written`・`window:notify-main-child-result`・`window:set-escape-handled-by-page`・`layout-cancel`・`close-layout-progress-window`） |
| イベント（メイン→レンダラー） | `webContents.send` | `ipcRenderer.on` | 状態変化の通知（`data-changed`・`settings-changed`・`workspace-changed`・進捗など） |

- **エラーの返し方**: 失敗は例外として `invoke` 側に伝わる（`createSafeIpcHandler`（`src/main/utils/ipcWrapper.ts`）はログを出してから再スローする）。一部のチャンネルは `{ success: boolean, error?: string }` を返す。どちらの形かはハンドラーと `ElectronAPI` の型で確認する
- **イベントの購読**: preload の `on*` 関数（`onDataChanged` など）は購読解除用の関数を返す。React の `useEffect` のクリーンアップで必ず呼ぶ
- **Esc の扱い**: メインウィンドウの Esc は、メインプロセスの `before-input-event` が受けて隠す。レンダラーが `window:set-escape-handled-by-page` で true を送っているあいだ（ウィンドウ検索で選択中・閉じる確認の帯を表示中）は、隠さずにページへ渡す。状態はメインプロセスが 1 つだけ持ち、レンダラーは変わるたびに送る
- **ファイルのパス取得**: ドロップされた `File` からパスを得る `getPathForFile` は IPC ではなく、preload 内で `webUtils.getPathForFile` を呼ぶ

## 命名規則

チャンネル名（文字列）と定数名の規則。**新しく追加するチャンネルに適用する。** 既存のチャンネルには規則より前に作られて合わないものがあるが、名前を変えると受け口と preload をそろえて直す必要があるため、そのまま残す（例: イベントなのに定数名が `EVENT_` で始まらない `WORKSPACE_CHANGED`、過去形でないイベント `show-toast`・`open-import-modal`）。

| 対象 | 規則 | 例 |
| --- | --- | --- |
| 定数名 | `UPPER_SNAKE_CASE`。メイン→レンダラーのイベントは `EVENT_` で始める | `SETTINGS_GET`、`EVENT_DATA_CHANGED` |
| 機能単位で名前空間を持つチャンネル | `<機能>:<動作>`（kebab-case） | `settings:get`、`workspace:add-item`、`clipboard:capture`、`backup:list-snapshots`、`bookmark-auto-import:execute-rule`、`window:open-child` |
| 古くからあるチャンネル | 名前空間なしの kebab-case | `open-item`、`load-data-files`、`fetch-icons-combined` |
| イベント | 過去形・状態を表す kebab-case | `data-changed`、`settings-changed`、`workspace-changed`、`window-shown` |

コンテキストメニューは例外で、既存の同じ形にそろえる（表示の依頼は `show-<対象>-context-menu`、メニューで選ばれたことのイベントは `<対象>-menu-<動作>`。例: `show-windows-context-menu`・`windows-menu-close`）。

新しく追加するチャンネルは `<機能>:<動作>` の形にし、メイン→レンダラーのイベントは定数名を `EVENT_` で始め、名前を過去形・状態にする。定数名の接頭辞（`WORKSPACE_`・`CLIPBOARD_`・`BACKUP_` など）は名前空間に合わせる。

## データの読み込みと保存

### `load-data-files`

データファイル（`datafiles/data*.json`）とワークスペースを読み直し、メイン画面に表示する `AppItem[]` を返す。

- パラメータ: `trigger?: 'explicit' | 'full' | 'internal'`（既定 `explicit`）
  - `explicit`: 起動時・F5
  - `full`: メイン画面の「完全リフレッシュ」。`explicit` に加えて、ドライブ文字で始まる拡張子の無いパスもすべてディスクで確かめ直す（`explicit` で確かめ直すのは `path-type-cache.json` に載っているパスだけ）（[データファイル形式 3.1.2](file-formats/data-format.md#312-サポートされるパス種類)）
  - `internal`: 変更通知を受けた再読込・画面内の一覧取得。先行する `internal` の読み込みがあれば結果を共有する
- 処理内容: フォルダ取込の展開・`.lnk` の解析・タブ単位の重複排除のあと、ワークスペースも読み直す（内容が変わっていれば `workspace-changed` を送る）
- 旧グループ・旧ウィンドウ配置のアイテムがあれば、読み込みのときにセットへ変換して保存する（[データファイル形式 3.3.6](file-formats/data-format.md#336-旧形式からの変換)）
- 外部変更（QDL の外での変更）を検知した場合は、変更前の内容をスナップショットに残す。破損ファイルや読み込み時の補正はトーストで知らせる
- 実装: `src/main/services/data/dataFileLoader.ts`（`reloadConfigFiles()`）

F5 では、レンダラーが `settings:reapply` を呼んでから `load-data-files` を `explicit` で呼ぶ。ファイル監視はしないので、QDL の外で編集したファイルが反映されるのは F5 か再起動のときだけ。QDL の外での変更への備えは[データファイル形式](file-formats/data-format.md#53-qdl-の外での変更への備え)を参照。

### `load-editable-items` / `save-editable-items`

管理画面のアイテム一覧の読み込みと保存。楽観ロックで QDL の外での変更との競合を防ぐ。

- `load-editable-items` の戻り値: `LoadEditableItemsResult`（`items: EditableJsonItem[]`、省略可能な `fileHashes?`（ファイルごとの内容ハッシュ）、`error?: string`）
- `save-editable-items` のパラメータ: `editableItems: EditableJsonItem[]`、`expectedHashes?: Record<string, string>`（読み込み時の `fileHashes`）
- `save-editable-items` の戻り値: `SaveEditableItemsResult`（保存後の `fileHashes`、実際に書き換えた `writtenFiles`）。次回の保存では返ってきた `fileHashes` を渡す
- 読み込み後に QDL の外でファイルが変わっていた場合は保存を拒否し、エラーメッセージに `EXTERNAL_CHANGE_CONFLICT_MARKER`（`[external-change]`）を含める
- 内容が変わらなかったファイルは書かない。1 ファイルでも書いたときだけ `data-changed` を送る
- 型: `src/common/types/editableItem.ts`、実装: `src/main/services/data/editableItemsStore.ts`

### `register-items` と ID ベースの更新

- `register-items`: `RegisterItem[]` をデータファイルに追加する。`RegisterItem` の項目は `src/common/types/register.ts` を参照。登録先が `datafiles/` 直下の `.json` でないアイテムが 1 件でもあれば、何も書かずに例外を返す（`create-data-file`・`delete-data-file` も同じ名前の制約で、外れると `{ success: false, error }` を返す。判定は `src/common/utils/dataFileName.ts`。`create-data-file` は同じ名前のファイルが既にあるときも作らず、`alreadyExists: true` を添えて返す）
- `update-item-by-id`・`update-dir-item-by-id`・`update-set-item-by-id`・`delete-items-by-id`: アイテムの `id` で対象を特定して書き換える（行番号では特定しない）。`delete-items-by-id` はクリップボードアイテムの保存データも消す
- いずれも処理後に `data-changed` を全ウィンドウへ送る

### `data-changed` (イベント)

データファイルが QDL 内の操作で変わったことを全ウィンドウに通知する。

- **方向**: メインプロセス → レンダラープロセス（全ウィンドウ。読み込み中のウィンドウには読み込み完了後に送る）
- **パラメータ**: なし
- **受け手の動作**: メイン画面は `load-data-files` を `internal` で呼び直す。管理画面は一覧を読み直す
- **送信元**: `notifyDataChanged()`（`src/main/ipc/notifications.ts`）。アイテムの登録・更新・削除のほか、データファイルの作成・削除、ブックマーク自動取込の後にも呼ばれる

## 設定

### `settings:set-multiple`

複数の設定項目を一括で保存し、副作用を適用する。

- パラメータ: `settings: Partial<AppSettings>`
- 戻り値: `true`
- 処理内容: 保存後、変更されたキーに応じて副作用（自動起動・CLI（`qdl` コマンド）の PATH への追加と除去・ワークスペースの不透明度と表示位置・全デスクトップ表示・ウィンドウスナップ）を適用し、`settings-changed` を全ウィンドウに送る。`hotkey` が設定されたら初回起動モードを解除する

### `settings:reset`

設定を既定値に戻す。

- パラメータ: `keys?: Array<keyof AppSettings>`（省略時は全項目。指定時は設定画面のカテゴリ単位など一部だけ戻す）
- 戻り値: 戻した後の `AppSettings`
- 処理内容: 副作用とホットキー登録を適用し直し、`settings-changed` を送る

### `settings:get-language`

- 方向: Renderer → Main（invoke）
- 戻り値: `'ja' | 'en'`（設定 `language` と Windows の表示言語から決めた今の表示言語）
- 処理内容: 設定を読んで言語を決め、main の言語もそれに合わせる。スプラッシュは設定の読み込みより先に開くので、ウィンドウを開く前に登録する。各ウィンドウは描画の前にこれを呼び、`settings-changed` を受けたら呼び直す

### `settings:reapply`

`settings.json` をディスクの内容で適用し直す。設定値そのものは毎回ディスクから読むが、ホットキー登録・自動起動・CLI の PATH 登録・ウィンドウ状態は保存時にしか適用されないため、QDL の外で `settings.json` を編集したときに F5 から呼ぶ（CLI の `qdl reload` も同じ処理を呼ぶ）。処理後に `settings-changed` を送る。

### `settings:set-hotkey-recording`

ホットキー入力欄の録画の開始・終了を伝える。

- パラメータ: `recording: boolean`
- 戻り値: なし
- 処理内容: 最初の録画が始まったら登録中のホットキーを一時的に外し、全ウィンドウでウィンドウメニュー（Alt+Space で開くもの）を出さないようにする。すべての録画が終わったら（送り元のレンダラーが終了したときも）ホットキーを登録し直す。録画中に `settings:change-hotkey` などで登録し直したホットキーは、そちらを優先する

### `settings-changed` (イベント)

設定の変更を全ウィンドウに通知する。

- **方向**: メインプロセス → レンダラープロセス（全ウィンドウ）
- **パラメータ**: なし（受け手は `settings:get` で読み直す）
- **発生タイミング**: `settings:set-multiple`・`settings:reset`・`settings:reapply` の実行後

設定ファイルの項目は[設定ファイル形式](file-formats/settings-format.md)を参照。

## ワークスペース

### 変更操作と `workspace-changed` (イベント)

`workspace:*` の変更系チャンネル（アイテム・グループ・ワークスペース（タブ）・アーカイブの追加・更新・削除・並び替え）は、成功すると `workspace-changed` を全ウィンドウに送る（`src/main/ipc/workspaceHandlers.ts`）。主に `withWorkspaceChange()` を使い、追加・作成（`workspace:add-item`・`workspace:add-items-from-paths`・`workspace:create-workspace`・`workspace:create-group`）と、先に切り離しウィンドウを閉じる削除・アーカイブ（`workspace:delete-workspace`・`workspace:delete-group`・`workspace:archive-group`）は `notifyWorkspaceChanged()` を直接呼ぶ。受け手のワークスペース画面は一覧を読み直す。

- **方向**: メインプロセス → レンダラープロセス（全ウィンドウ）
- **パラメータ**: なし
- `load-data-files` の再読込でワークスペースの内容が変わっていた場合にも送られる
- `workspace:add-item` は、クリップボードアイテムなら保存データ（`clipboard-data/<id>.json`）を `ClipboardService.duplicateClipboardData` で複製し、複製を指すアイテムとして足す（メインウィンドウと 1 つのファイルを共有しない。複製できなければ元の参照のまま）。逆向き（ワークスペースのアイテムをメインウィンドウに登録）は、登録画面が保存するときに `clipboard:duplicate-data` で複製する

### 失敗時の扱い

`workspace.json` / `workspace-archive.json` の書き込みは楽観ロックで、前回読んだ／書いた内容と現在のファイルが違えば書かずに失敗する。QDL の外での変更との競合・ファイルの破損・再読込中・書き込み失敗のときは、ハンドラーがトーストで操作者に知らせたうえで例外を `invoke` 側へ返す。実装は `src/main/services/workspace/WorkspaceFileStore.ts`。ファイル形式は[ワークスペースファイル形式](file-formats/workspace-format.md)を参照。

## 子ウィンドウとの受け渡し

### `window:open-child` (イベント)

開き元レンダラーに子ウィンドウの生成を依頼する（レンダラープロセス共有）。

- **方向**: メインプロセス → レンダラープロセス（開き元: メイン・ワークスペース・管理画面）
- **パラメータ**: `{ html: string, name: string }`（書き込むHTMLの内容と `window.name`）
- **処理**: preload が `window.open('about:blank', name)` を実行し、`document.write` で HTML を書き込む
- **実装**: `src/main/services/childWindowService.ts`、`src/main/preload.ts`
- **補足**: 生成された `BrowserWindow` はメインプロセスが `did-create-window` で受け取る。詳細は [システム概要](overview.md#ウィンドウとレンダラープロセスの対応)

### `window:child-written`

子ウィンドウへの HTML 書き込み完了を通知する。

- **方向**: レンダラープロセス → メインプロセス（`ipcRenderer.send`）
- **パラメータ**: `name: string`（`window:open-child` で指定した名前）
- **処理**: 登録済みの開き元からの通知のみ受け付け、ウィンドウの受け取りと合わせて生成完了とする

### 要求と結果の受け渡し（登録・編集ウィンドウ、確認ウィンドウ）

閉じると破棄する子ウィンドウ（メイン画面の登録・編集、ワークスペースの確認）は、同じ手順で開き元とやり取りする。

| 手順 | メイン画面・管理画面の子ウィンドウ | ワークスペースの確認ウィンドウ |
| --- | --- | --- |
| 1. 開き元が開く（閉じたときに結果で解決） | `window:open-main-child`（`MainChildWindowRequest` → `MainChildWindowReturn \| null`） | `workspace:open-confirm`（`ConfirmWindowRequest` → `ConfirmWindowResult \| null`） |
| 2. 子が自分の要求を受け取る | `window:get-main-child-request` | `workspace:get-confirm-request` |
| 3. 子が結果を預けて閉じる | `window:return-main-child-value` | `workspace:return-confirm-result` |
| `window.name` の接頭辞（以降が要求 ID） | `main-child:` | `workspace-confirm:` |

- ワークスペースのアイテムをメインウィンドウに登録するときは、要求の `prefillItems` に初期値のアイテムを載せる。右クリックの「メインウィンドウに登録」は、メインプロセスがメインウィンドウを出してから `workspace-menu-register-to-main` イベント（メインプロセス → メインウィンドウ。パラメータはワークスペースのアイテム）で知らせ、メインウィンドウが `window:open-main-child` を呼ぶ
- 管理画面から `window:open-main-child` で開いたときは、管理ウィンドウを親・開き元にする。登録フォームは内容を保存せず、`window:return-main-child-value` で返した内容が閉じたときに管理画面へ渡る
- 要求は子ウィンドウが閉じるまで保持されるので、手順 2 は何度呼んでもよい
- メイン画面の子ウィンドウでの操作結果（登録・更新・削除）は `window:notify-main-child-result`（`send`）でメインへ伝え、メインは `window:main-child-result` イベントとしてメイン画面に中継する（トースト表示用）。データ自体の反映は `data-changed` で行う
- 実装: `src/main/mainChildWindowManager.ts`、`src/main/workspaceConfirmWindowManager.ts`。ワークスペースアイテムの編集ウィンドウは `workspace:open-item-editor`（`src/main/workspaceItemEditorWindowManager.ts`）
- 詳細は [ウィンドウ制御](window-control.md) を参照

## 外部で開く

画面から渡された URL やパスをそのまま OS に渡さないよう、受け付けるものを絞っている（`src/main/ipc/configHandlers.ts`）。

- `open-external-url`: http・https の URL だけを既定のブラウザで開く。それ以外のスキーム（`file:`・カスタム URI など）は開かずにログだけ残す。アイテムの起動（カスタム URI を開く機能）はこのチャンネルを通らない
- `shell:open-folder`: 存在するフォルダの絶対パスだけをエクスプローラーで開く。ファイル・存在しないパス・相対パスは開かない。ドライブ直下のアイテムの親として届く `C:` の形は `C:\` として扱う

## 通知と進捗

- **トースト**: `show-toast-window` で表示する。トーストはセットの進み具合と共用の 1 枚のオーバーレイウィンドウに出し（`src/main/services/overlayWindowService.ts`）、メインプロセスはそのウィンドウにだけ `show-toast` イベントを送る。セットの進み具合の表示中はトーストを出さない（実行が終わった後に残っている表示は、次のトーストで置き換える）。オプションは `ToastOptions`（`src/common/types/toast.ts`）を参照
- **アイコン取得の進捗**: `icon-progress-start` / `icon-progress-update` / `icon-progress-complete`。データは `IconProgress`（`src/common/types/icon.ts`）
- **セットの実行の進み具合**: 位置のある行が 1 つでもあるセットを実行したときに出す。`layout-progress-start` / `layout-progress-update` / `layout-progress-complete`（チャンネル名は旧ウィンドウ配置のまま）。中止は `layout-cancel`、表示を閉じるのは `close-layout-progress-window`（どちらも `send`）。実装は `src/main/services/launch/setExecutor.ts`

## 関連ドキュメント

- [システム概要](overview.md) - システム全体の構造とデータフロー
- [ウィンドウ制御](window-control.md) - ウィンドウ管理の詳細
