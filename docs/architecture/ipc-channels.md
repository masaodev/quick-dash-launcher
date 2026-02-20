# IPCチャンネル詳細

QuickDashLauncherで使用される全IPCチャンネルの仕様です。

## チャンネル名の定数管理

全てのIPCチャンネル名は `src/common/ipcChannels.ts` で定数として一元管理されています。

```typescript
// 使用例
import { SETTINGS_GET, OPEN_ITEM } from '@common/ipcChannels.js';

// メインプロセス
ipcMain.handle(SETTINGS_GET, async (_event, key) => { ... });

// preload.ts
ipcRenderer.invoke(OPEN_ITEM, item);
```

### 定数の命名規則

| カテゴリ | プレフィックス | 例 |
|---------|---------------|-----|
| 設定 | `SETTINGS_*` | `SETTINGS_GET`, `SETTINGS_SET` |
| ウィンドウ | - | `SHOW_EDIT_WINDOW`, `GET_WINDOW_PIN_MODE` |
| アイテム操作 | - | `OPEN_ITEM`, `EXECUTE_GROUP` |
| データ | - | `LOAD_DATA_FILES`, `GET_DATA_FILES` |
| アイコン | - | `FETCH_FAVICON`, `EXTRACT_ICON` |
| ワークスペース | `WORKSPACE_*` | `WORKSPACE_LOAD_ITEMS`, `WORKSPACE_ADD_ITEM` |
| クリップボード | `CLIPBOARD_*` | `CLIPBOARD_CAPTURE`, `CLIPBOARD_RESTORE` |
| バックアップ | `BACKUP_*` | `BACKUP_LIST_SNAPSHOTS`, `BACKUP_RESTORE_SNAPSHOT` |
| ブックマーク自動取込 | `BOOKMARK_AUTO_IMPORT_*` | `BOOKMARK_AUTO_IMPORT_GET_SETTINGS`, `BOOKMARK_AUTO_IMPORT_EXECUTE_RULE` |
| イベント | `EVENT_*` | `EVENT_DATA_CHANGED`, `EVENT_WINDOW_SHOWN` |
| 通知 | `SHOW_*` | `SHOW_NOTIFICATION`, `SHOW_TOAST_WINDOW` |

### IPC_CHANNELSオブジェクト

全定数は `IPC_CHANNELS` オブジェクトにも集約されており、動的なチャンネル名参照にも対応しています。

```typescript
import { IPC_CHANNELS } from '@common/ipcChannels.js';

// 動的参照
const channel = IPC_CHANNELS.SETTINGS_GET; // 'settings:get'
```

## 設定関連

### `settings:is-first-launch`
初回起動かどうかを取得
- 戻り値: `boolean`
- 判定基準: `hotkey`が空文字列または未設定の場合に`true`

### `settings:get`
アプリケーション設定を取得
- パラメータ: `key?: keyof AppSettings` (省略時は全設定を取得)
- 戻り値: 指定されたキーの値、または全設定オブジェクト

### `settings:set`
設定値を設定
- パラメータ: `key: keyof AppSettings`, `value: AppSettings[keyof AppSettings]`
- 戻り値: `boolean`
- 特別な処理:
  - `autoLaunch`: Windowsレジストリに即座に反映

### `settings:set-multiple`
複数の設定項目を一括更新
- パラメータ: `settings: Partial<AppSettings>`
- 戻り値: `boolean`
- 特別な処理:
  - ホットキーが設定された場合、初回起動モードを自動解除
  - `autoLaunch`が含まれている場合、Windowsレジストリに即座に反映
- 処理完了後、`settings-changed`イベントを全ウィンドウに送信

### `settings:reset`
設定をデフォルト値にリセット
- 戻り値: `boolean`
- 特別な処理:
  - 自動起動を無効化（`AutoLaunchService.setAutoLaunch(false)`）
- リセット後、`settings-changed`イベントを全ウィンドウに送信

### `settings:validate-hotkey`
ホットキーの妥当性を検証
- パラメータ: `hotkey: string`
- 戻り値: `{ isValid: boolean, reason?: string }`

### `settings:get-config-path`
設定ファイルのパスを取得
- 戻り値: `string` (設定ファイルのフルパス)

### `settings:change-hotkey`
起動ホットキーを変更
- パラメータ: `newHotkey: string`
- 戻り値: `boolean` (成功/失敗)

### `settings:check-hotkey-availability`
ホットキーの利用可能性をチェック
- パラメータ: `hotkey: string`
- 戻り値: `boolean` (利用可能かどうか)

### `settings:change-item-search-hotkey`
ウィンドウ検索の起動ホットキーを変更
- パラメータ: `newHotkey: string`（空文字列で無効化）
- 戻り値: `boolean` (成功/失敗)

### `settings:get-displays`
接続されているディスプレイ情報を取得
- 戻り値: `DisplayInfo[]`
  - `index: number` - ディスプレイインデックス
  - `label: string` - 表示ラベル（例: `ディスプレイ 1 (プライマリ)`）
  - `isPrimary: boolean` - プライマリディスプレイかどうか
  - `width: number`, `height: number` - 作業領域のサイズ
  - `x: number`, `y: number` - 作業領域の座標

### `settings-changed` (イベント)
設定変更を全ウィンドウに通知
- **方向**: メインプロセス → レンダラープロセス（全ウィンドウ）
- **パラメータ**: なし
- **発生タイミング**:
  - `settings:set-multiple`実行時
  - `settings:reset`実行時

## ウィンドウ制御

### `get-window-pin-mode`
ウィンドウピン留めモードを取得
- 戻り値: `WindowPinMode` (`'normal' | 'alwaysOnTop' | 'stayVisible'`)

### `cycle-window-pin-mode`
ウィンドウピン留めモードを循環切り替え
- 戻り値: `WindowPinMode` (新しいモード)
- 順序: `normal` → `alwaysOnTop` → `stayVisible` → `normal`

### `set-edit-mode`
編集モードの状態を設定（ウィンドウサイズとフォーカス制御用）
- パラメータ: `editMode: boolean`
- 戻り値: なし

### `get-edit-mode`
編集モードの状態を取得
- 戻り値: `boolean`

### `show-edit-window`
管理ウィンドウを表示
- 戻り値: なし

### `hide-edit-window`
管理ウィンドウを非表示
- 戻り値: なし

### `toggle-edit-window`
管理ウィンドウの表示/非表示を切り替え
- 戻り値: なし

### `is-edit-window-shown`
管理ウィンドウの表示状態を取得
- 戻り値: `boolean`

### `open-edit-window-with-tab`
指定されたタブで管理ウィンドウを開く
- パラメータ: `tab: 'settings' | 'edit' | 'archive' | 'other'`
- 戻り値: なし

### `get-initial-tab`
管理ウィンドウの初期表示タブを取得
- 戻り値: `'settings' | 'edit' | 'archive' | 'other'`

### `set-active-tab` (イベント)
管理ウィンドウのアクティブタブを変更
- **方向**: メインプロセス → レンダラープロセス
- **パラメータ**: `tab: 'settings' | 'edit' | 'archive' | 'other'`

### `admin:show-archive-tab`
管理ウィンドウをアーカイブタブで開く
- 戻り値: なし
- 処理内容: 管理ウィンドウが開いていない場合は開き、アーカイブタブを表示

### `open-edit-window-with-import-modal`
インポートモーダルを指定して管理ウィンドウを開く
- パラメータ: `modal: 'bookmark' | 'app'`
- 戻り値: なし
- 処理内容: 管理ウィンドウを表示し、指定されたインポートモーダルを開く

### `get-pending-import-modal`
次に表示すべきインポートモーダルを取得
- 戻り値: `'bookmark' | 'app' | null`
- 処理内容: `open-edit-window-with-import-modal`で設定された値を一度だけ取得してクリア

### `set-modal-mode`
モーダルモードを設定（ウィンドウの自動非表示を制御）
- パラメータ: `isModal: boolean`, `requiredSize?: { width: number; height: number }`
- 戻り値: なし
- 用途: ダイアログ表示中のウィンドウ制御

### `copy-to-clipboard`
テキストをクリップボードにコピー
- パラメータ: `text: string`
- 戻り値: `boolean` (成功/失敗)

### `log-performance-timing`
パフォーマンス計測情報をログ出力
- パラメータ: `label: string`, `duration: number`
- 戻り値: なし

### `quit-app`
アプリケーションを終了
- 処理: トレイアイコン破棄後、`app.quit()`を呼び出し

## データファイル管理

### `get-config-folder`
設定フォルダのパスを取得
- 戻り値: `string`

### `get-data-files`
設定フォルダ内のすべてのdata*.jsonファイルを取得
- 戻り値: `string[]` (例: `['data.json', 'data2.json', 'data3.json']`)

### `create-data-file`
新しいデータファイルを作成
- パラメータ: `fileName: string`
- 戻り値: `{ success: boolean, error?: string }`
- 動作: 空のファイルを作成。既存の場合はエラー

### `delete-data-file`
データファイルを削除
- パラメータ: `fileName: string`
- 戻り値: `{ success: boolean, error?: string }`
- 制限: `data.json`は削除不可

### `load-data-files`
全てのdata*.jsonファイルを読み込み、パース
- 戻り値: `AppItem[]` (LauncherItemとGroupItemの配列)
- 処理内容:
  - フォルダ取込ディレクティブの展開
  - .lnkファイルの解析
  - タブ単位の重複チェック
  - 名前順ソート

### `register-items`
アイテムをデータファイルに登録
- パラメータ: `RegisterItem[]`
  - `displayName: string` - アイテム名
  - `path: string` - パス
  - `type: LauncherItem['type']` - アイテムタイプ
  - `args?: string` - 引数
  - `targetTab: string` - 保存先データファイル名
  - `targetFile?: string` - 実際の保存先ファイル（targetTabより優先）
  - `itemCategory: 'item' | 'dir' | 'group' | 'window' | 'clipboard'` - アイテムカテゴリ
  - `folderProcessing?: 'folder' | 'expand'` - フォルダ処理タイプ
  - `icon?: string` - アイコンパス
  - `customIcon?: string` - カスタムアイコンパス
  - `windowConfig?: WindowConfig` - ウィンドウ設定（起動時ウィンドウ位置制御）
  - `dirOptions?: JsonDirOptions` - フォルダ取込オプション（`itemCategory: 'dir'`の場合）
  - `groupItemNames?: string[]` - グループアイテム名リスト（`itemCategory: 'group'`の場合）
  - `windowOperationConfig?: WindowOperationConfig` - ウィンドウ操作設定（`itemCategory: 'window'`の場合、必須）
    - `displayName: string` - 表示名
    - `windowTitle: string` - ウィンドウタイトル
    - `processName?: string` - プロセス名
    - `x?: number`, `y?: number`, `width?: number`, `height?: number` - 位置・サイズ
    - `moveToActiveMonitorCenter?: boolean` - アクティブモニター中央に移動
    - `virtualDesktopNumber?: number` - 仮想デスクトップ番号
    - `activateWindow?: boolean` - ウィンドウをアクティブ化
    - `pinToAllDesktops?: boolean` - 全デスクトップにピン
  - `clipboardDataRef?: string` - クリップボードデータファイルへの参照（`itemCategory: 'clipboard'`の場合、必須）
  - `clipboardFormats?: ClipboardFormat[]` - 保存フォーマット一覧（clipboard専用）
  - `clipboardSavedAt?: number` - 保存日時（clipboard専用）
  - `clipboardPreview?: string` - プレビューテキスト（clipboard専用）
  - `memo?: string` - 自由記述メモ
- 戻り値: なし
- 処理完了後、`data-changed`イベントを全ウィンドウに送信

### `is-directory`
パスがディレクトリかどうかを判定
- パラメータ: `filePath: string`
- 戻り値: `boolean`

### `data-changed` (イベント)
データ変更を全ウィンドウに通知
- **方向**: メインプロセス → レンダラープロセス（全ウィンドウ）
- **発生タイミング**: データファイルの登録・更新・削除時

## 編集モード専用

### `load-editable-items`
編集可能なアイテムを読み込み（編集モード用）
- 戻り値: `EditableItem[]`

### `save-editable-items`
編集可能なアイテムを保存（編集モード用）
- パラメータ: `items: EditableItem[]`
- 戻り値: なし
- 処理完了後、`data-changed`イベントを全ウィンドウに送信
- バックアップ: 保存前に自動作成

### `update-item-by-id`
単一LauncherItemをIDで更新（通常アイテム専用）
- パラメータ: `{ id: string, newItem: LauncherItem }`
- 戻り値: `{ success: boolean }`
- 処理完了後、`data-changed`イベントを全ウィンドウに送信

### `update-dir-item-by-id`
フォルダ取込アイテムをIDで更新
- パラメータ: `id: string`, `dirPath: string`, `options?: JsonDirOptions`, `memo?: string`
- 戻り値: なし（エラー時はthrow）
- 処理完了後、`data-changed`イベントを全ウィンドウに送信

### `update-group-item-by-id`
グループアイテムをIDで更新
- パラメータ: `id: string`, `displayName: string`, `itemNames: string[]`, `memo?: string`
- 戻り値: なし（エラー時はthrow）
- 処理完了後、`data-changed`イベントを全ウィンドウに送信

### `update-window-item-by-id`
ウィンドウ操作アイテムをIDで更新
- パラメータ: `id: string`, `config: { displayName: string, windowTitle: string, processName?: string, x?: number, y?: number, width?: number, height?: number, moveToActiveMonitorCenter?: boolean, virtualDesktopNumber?: number, activateWindow?: boolean, pinToAllDesktops?: boolean }`, `memo?: string`
- 戻り値: なし（エラー時はthrow）
- 処理完了後、`data-changed`イベントを全ウィンドウに送信

### `delete-items-by-id`
複数アイテムをIDで一括削除
- パラメータ: `{ id: string }[]`
- 戻り値: `{ success: boolean }`
- 特別な処理: クリップボードアイテムの場合、関連するデータファイルも削除
- 処理完了後、`data-changed`イベントを全ウィンドウに送信

### `batch-update-items-by-id`
複数LauncherItemをIDで一括更新（通常アイテム専用）
- パラメータ: `{ id: string, newItem: LauncherItem }[]`
- 戻り値: `{ success: boolean }`
- 処理完了後、`data-changed`イベントを全ウィンドウに送信

## アイテム操作

### `open-item`
ファイル/URL/アプリを起動
- パラメータ: `item: LauncherItem`
- 戻り値: なし
- 動作: ピンモードが`normal`の場合、起動後にウィンドウを非表示

### `open-parent-folder`
エクスプローラーでアイテムの親フォルダを表示
- パラメータ: `item: LauncherItem`
- 戻り値: なし
- 動作: ピンモードが`normal`の場合、表示後にウィンドウを非表示

### `execute-group`
グループアイテムを実行
- パラメータ: `group: GroupItem`, `allItems: AppItem[]`
- 戻り値: なし
- 動作: 設定（`parallelGroupLaunch`）に応じて並列または順次起動（順次の場合は500ms間隔）
- ピンモードが`normal`の場合、全アイテム実行後にウィンドウを非表示

### `execute-window-operation`
ウィンドウ操作アイテムを実行
- パラメータ: `item: WindowItem`
- 戻り値: なし
- 動作: 指定されたウィンドウタイトル・プロセス名でウィンドウを検索し、アクティブ化・位置設定を行う

## アイコン関連

### `fetch-favicon`
ウェブサイトのファビコンをダウンロード
- パラメータ: `url: string`
- 戻り値: `string | null` (base64エンコードされたデータURL)

### `extract-icon`
アプリケーション/ショートカットファイルからアイコンを抽出
- パラメータ: `filePath: string`
- 戻り値: `string | null` (base64エンコードされたデータURL)
- 対応形式: .exe, .lnk（ショートカット）

### `extract-custom-uri-icon`
カスタムURIスキーマのハンドラーアプリアイコンを抽出
- パラメータ: `uri: string`
- 戻り値: `string | null` (base64エンコードされたデータURL)
- 動作: レジストリからスキーマハンドラーを検索

### `extract-file-icon-by-extension`
ファイル拡張子ベースのアイコン抽出
- パラメータ: `filePath: string`
- 戻り値: `string | null` (base64エンコードされたデータURL)
- 動作: URIからの拡張子抽出にも対応

### `load-cached-icons`
キャッシュされたアイコンを一括読み込み
- パラメータ: `items: IconItem[]`
- 戻り値: `Record<string, string>` (パスをキーとするアイコンデータのマップ)

### `fetch-icons-combined`
ファビコンとアイコンを統合的に一括取得
- パラメータ: `urlItems: IconItem[]`, `items: IconItem[]`
- 戻り値: `{ favicons: Record<string, string | null>, icons: Record<string, string | null> }`
- 特徴: 複数フェーズ（ファビコン取得 + アイコン抽出）の進捗を統合管理

### `select-custom-icon-file`
カスタムアイコンファイル選択ダイアログを表示
- 戻り値: `string | null` (選択されたファイルパス)
- 対応形式: PNG, JPG, JPEG, ICO, SVG

### `save-custom-icon`
カスタムアイコンを保存
- パラメータ: `sourceFilePath: string`, `itemIdentifier: string`
- 戻り値: `string` (保存されたカスタムアイコンのファイル名)
- 制限: 最大5MBまで

### `delete-custom-icon`
カスタムアイコンを削除
- パラメータ: `customIconFileName: string`
- 戻り値: なし

### `get-custom-icon`
カスタムアイコンを取得
- パラメータ: `customIconFileName: string`
- 戻り値: `string | null` (base64エンコードされたデータURL)

### 進捗イベント

#### `icon-progress-start`
アイコン取得処理の開始を通知
- 統合進捗情報（複数フェーズ）を含む

#### `icon-progress-update`
アイコン取得処理の進捗更新を通知
- 現在のフェーズ、各フェーズの処理数、エラー数を含む

#### `icon-progress-complete`
アイコン取得処理の完了を通知
- 最終的な処理結果（全フェーズ）とエラー数を含む

### IconProgress型定義

```typescript
interface IconProgress {
  currentPhase: number;               // 現在のフェーズ番号（1から開始）
  totalPhases: number;                // 総フェーズ数
  phases: IconPhaseProgress[];        // 各フェーズの進捗情報
  isComplete: boolean;                // 全体の処理が完了したかどうか
  startTime: number;                  // 全体の処理開始時刻（ミリ秒）
}

interface IconPhaseProgress {
  type: 'favicon' | 'icon';           // 処理の種別
  current: number;                    // 現在処理完了したアイテム数
  total: number;                      // 処理対象の総アイテム数
  currentItem: string;                // 現在処理中のアイテム名またはURL
  errors: number;                     // エラーが発生したアイテム数
  startTime: number;                  // フェーズ開始時刻（ミリ秒）
  isComplete: boolean;                // フェーズが完了したかどうか
  results?: IconProgressResult[];     // 処理結果の詳細リスト
}

interface IconProgressResult {
  itemName: string;                   // アイテム名またはURL
  success: boolean;                   // 成功したかどうか
  errorMessage?: string;              // エラーメッセージ（失敗時のみ）
  type: 'favicon' | 'icon';           // 処理の種別
}
```

## システム通知

### `show-notification`
OS標準通知を表示
- パラメータ:
  - `title: string` - 通知タイトル
  - `body: string` - 通知本文
  - `type?: NotificationType` - 通知タイプ（アイコン選択用）
- 戻り値: なし
- 通知タイプ: `'success' | 'error' | 'warning' | 'info'`

### `show-toast-window`
トースト専用ウィンドウで通知を表示
- パラメータ:
  - `message: string` - 表示メッセージ
  - `type?: ToastType` - トーストの種類（`'success' | 'error' | 'warning' | 'info'`）
  - `duration?: number` - 表示時間（ミリ秒、デフォルト: 3000）
- 戻り値: なし
- 特徴: メインウィンドウが閉じた後でも通知表示可能

### `show-toast` (イベント)
トースト通知を全ウィンドウに送信
- **方向**: メインプロセス → レンダラープロセス
- **パラメータ**: `{ message: string, type?: ToastType, duration?: number }`
- **発生タイミング**: トースト通知が要求された時
- **用途**: レンダラープロセス内でreact-hot-toastを使用して通知表示

## ブックマーク関連

### `detect-installed-browsers`
インストール済みのブラウザ（Chrome/Edge）を検出
- 戻り値: `BrowserInfo[]` (ブラウザ情報の配列)
- 検出対象: Chrome, Edge
- 検出場所: `%LOCALAPPDATA%\Google\Chrome\User Data`, `%LOCALAPPDATA%\Microsoft\Edge\User Data`
- プロファイル検出: 各ブラウザの`User Data`配下のプロファイルフォルダを検索
- プロファイル名取得: 各プロファイルの`Preferences`ファイルから`profile.name`を取得
- セキュリティ: `LOCALAPPDATA`配下のみアクセス許可、パストラバーサル対策

### `parse-browser-bookmarks`
ブラウザのブックマークJSONファイルをパース
- パラメータ: `filePath: string` (ブックマークJSONファイルのパス)
- 戻り値: `SimpleBookmarkItem[]`
- 解析対象: Chrome/EdgeのブックマークJSON形式
- ファイルサイズ上限: 50MB
- セキュリティチェック: `LOCALAPPDATA`配下のみアクセス許可、パストラバーサル対策
- JSON構造: `{ "roots": { "bookmark_bar": {...}, "other": {...}, "synced": {...} } }`
- 抽出ロジック: `roots`配下を再帰的に走査し、`type: "url"`のノードを抽出

### `select-bookmark-file`
ブックマークファイル選択ダイアログを表示
- 戻り値: `string | null` (選択されたファイルパス)
- 対応形式: HTML, HTM

### `parse-bookmark-file`
ブックマークファイルをパース
- パラメータ: `filePath: string`
- 戻り値: `SimpleBookmarkItem[]`
- パース方法: HTMLの`<A>`タグからURL/名前を抽出

## 検索履歴関連

### `load-search-history`
検索履歴を読み込み
- 戻り値: `SearchHistoryEntry[]`

### `save-search-history`
検索履歴を保存
- パラメータ: `entries: SearchHistoryEntry[]`
- 戻り値: なし

### `add-search-history-entry`
検索履歴エントリーを追加
- パラメータ: `query: string`
- 戻り値: なし

### `clear-search-history`
検索履歴をクリア
- 戻り値: なし

## クリップボード操作

### `clipboard:check-current`
現在のクリップボードの内容を確認（保存せず）
- 戻り値: `CurrentClipboardState`
  - `hasContent: boolean` - 内容があるかどうか
  - `formats: ClipboardFormat[]` - 利用可能なフォーマット（`'text' | 'html' | 'rtf' | 'image' | 'file'`）
  - `preview?: string` - プレビューテキスト
  - `imageThumbnail?: string` - 画像のサムネイル（base64）
  - `estimatedSize?: number` - 推定データサイズ（バイト）

### `clipboard:capture`
現在のクリップボードをキャプチャして永続化
- 戻り値: `ClipboardCaptureResult`
  - `success: boolean`
  - `dataFileRef?: string` - 保存されたデータファイルへの参照
  - `savedAt?: number` - 保存日時
  - `preview?: string` - プレビューテキスト
  - `formats?: ClipboardFormat[]` - 保存されたフォーマット
  - `dataSize?: number` - データサイズ（バイト）
  - `error?: string` - エラーメッセージ

### `clipboard:restore`
保存済みクリップボードデータを現在のクリップボードに復元
- パラメータ: `ref: string` (データファイル参照)
- 戻り値: `ClipboardRestoreResult`
  - `success: boolean`
  - `restoredFormats?: ClipboardFormat[]` - 復元されたフォーマット
  - `error?: string`

### `clipboard:delete-data`
保存済みクリップボードデータを削除
- パラメータ: `ref: string` (データファイル参照)
- 戻り値: `boolean`

### `clipboard:get-preview`
保存済みクリップボードデータのプレビューを取得
- パラメータ: `ref: string` (データファイル参照)
- 戻り値: `ClipboardPreview | null`
  - `preview: string`
  - `formats: ClipboardFormat[]`
  - `dataSize: number`
  - `savedAt: number`
  - `imageThumbnail?: string`

### `clipboard:capture-to-session`
クリップボードをセッションとして一時保存（登録確定前の保持用）
- 戻り値: `ClipboardSessionCaptureResult`
  - `success: boolean`
  - `sessionId?: string` - セッションID
  - `capturedAt?: number` - キャプチャ日時
  - `preview?: string`, `formats?: ClipboardFormat[]`, `dataSize?: number`, `error?: string`

### `clipboard:commit-session`
セッションデータを永続化してコミット
- パラメータ: `id: string` (セッションID)
- 戻り値: `ClipboardSessionCommitResult`
  - `success: boolean`
  - `dataFileRef?: string`
  - `savedAt?: number`
  - `error?: string`

### `clipboard:discard-session`
セッションデータを破棄（キャンセル用）
- パラメータ: `id: string` (セッションID)
- 戻り値: `boolean`

## ブックマーク自動取込

### `bookmark-auto-import:get-settings`
ブックマーク自動取込設定を取得
- 戻り値: `BookmarkAutoImportSettings`

### `bookmark-auto-import:save-settings`
ブックマーク自動取込設定を保存
- パラメータ: `settings: BookmarkAutoImportSettings`
- 戻り値: なし

### `bookmark-auto-import:execute-rule`
単一ルールを実行してブックマークを取込
- パラメータ: `rule: BookmarkAutoImportRule`
- 戻り値: `BookmarkAutoImportResult`

### `bookmark-auto-import:execute-all`
全ルールを実行してブックマークを取込
- 戻り値: `BookmarkAutoImportResult[]`

### `bookmark-auto-import:preview-rule`
ルールを実行した場合の取込プレビューを取得（実際には取込まない）
- パラメータ: `rule: BookmarkAutoImportRule`
- 戻り値: `BookmarkWithFolder[]`

### `bookmark-auto-import:delete-rule-items`
指定ルールに紐づくアイテムを削除
- パラメータ: `ruleId: string`, `targetFile: string`
- 戻り値: `number` (削除件数)

### `bookmark-auto-import:get-folders`
ブックマークファイルのフォルダ構造を取得
- パラメータ: `bookmarkPath: string`
- 戻り値: `BookmarkFolder[]`

### `bookmark-auto-import:get-bookmarks-with-folders`
フォルダパス付きブックマーク一覧を取得
- パラメータ: `bookmarkPath: string`
- 戻り値: `BookmarkWithFolder[]`

## バックアップ

### `backup:list-snapshots`
バックアップのスナップショット一覧を取得
- 戻り値: `SnapshotInfo[]` (新しい順)
  - `timestamp: string` - タイムスタンプ文字列（フォルダ名、例: `2026-02-11T08-30-00`）
  - `createdAt: Date` - 作成日時
  - `totalSize: number` - 合計サイズ（バイト）
  - `fileCount: number` - ファイル数

### `backup:restore-snapshot`
スナップショットからリストア（リストア前に自動バックアップ作成）
- パラメータ: `timestamp: string`
- 戻り値: `{ success: boolean, error?: string }`

### `backup:delete-snapshot`
スナップショットを削除
- パラメータ: `timestamp: string`
- 戻り値: `{ success: boolean, error?: string }`

### `backup:get-status`
バックアップの状態を取得
- 戻り値: `BackupStatus`
  - `snapshotCount: number` - スナップショット件数
  - `lastBackupTime: Date | null` - 最終バックアップ日時
  - `totalSize: number` - 合計サイズ（バイト）

## その他

### `scan-installed-apps`
インストール済みアプリケーションをスキャン
- 戻り値: `InstalledApp[]` (アプリ情報の配列)
- スキャン対象: スタートメニュー、Program Files等

### `open-config-folder`
設定フォルダをエクスプローラーで開く
- 戻り値: なし

### `get-app-info`
アプリケーション情報を取得
- 戻り値: `AppInfo`
  - `version: string`
  - `name: string`
  - `description: string`
  - `author: string`
  - `license: string`
  - `repository: string`
- 情報源: package.json

### `open-external-url`
外部URLをデフォルトブラウザで開く
- パラメータ: `url: string`
- 戻り値: なし

### `getPathForFile` (プリロードAPI)
ドラッグ&ドロップされたファイルのパスを取得
- パラメータ: `file: File`
- 戻り値: `string`

## プリロードAPIイベントリスナー

### `onShowToast`
トースト通知イベントリスナー
```typescript
onShowToast(callback: (data: { message: string, type?: ToastType, duration?: number }) => void)
```
- **用途**: メインプロセスからのトースト通知をレンダラーで受信
- **ToastType**: `'success' | 'error' | 'warning' | 'info'`

### `onSettingsChanged`
設定変更イベントリスナー
```typescript
onSettingsChanged(callback: () => void)
```

### `onDataChanged`
データ変更イベントリスナー
```typescript
onDataChanged(callback: () => void)
```

### `onIconProgress`
アイコン取得進捗イベントリスナー
```typescript
onIconProgress(eventType: 'start' | 'update' | 'complete', callback: (data: IconProgress) => void)
```

### `onSetActiveTab`
管理ウィンドウのタブ変更イベントリスナー
```typescript
onSetActiveTab(callback: (tab: 'settings' | 'edit' | 'archive' | 'other') => void)
```

### `onWindowShown`
ウィンドウ表示イベントリスナー
```typescript
onWindowShown(callback: () => void)
```

### `onWindowShownItemSearch`
ウィンドウ検索モードで直接起動されたときのイベントリスナー
```typescript
onWindowShownItemSearch(callback: () => void)
```
- **発生タイミング**: `itemSearchHotkey`で設定されたウィンドウ検索の起動ホットキーでウィンドウが表示されたとき
- **用途**: ウィンドウ検索モードを自動的に有効にする

### `onWindowHidden`
ウィンドウ非表示イベントリスナー
```typescript
onWindowHidden(callback: () => void)
```

### `window-hidden` (イベント)
ウィンドウ非表示を全ウィンドウに通知
- **方向**: メインプロセス → レンダラープロセス（全ウィンドウ）
- **パラメータ**: なし
- **発生タイミング**:
  - ウィンドウが非表示になる直前（`hideMainWindow`実行時）
- **用途**: ウィンドウ非表示時の前処理（タブリセット等）を実行するため

## ウィンドウ検索関連

### `get-all-windows`
システム内の開いているウィンドウ一覧を取得（現在の仮想デスクトップのみ）
- 戻り値: `WindowInfo[]`
- 処理内容:
  - Win32 API（koffi経由）でシステム内の全ウィンドウを列挙
  - 現在の仮想デスクトップのウィンドウのみを取得
  - QuickDashLauncher自身のウィンドウは除外
  - 表示されていないウィンドウ（`IsWindowVisible = false`）は除外
  - タイトルのないウィンドウは除外
  - システムウィンドウを除外（プロセス名+クラス名で判定）
  - 各ウィンドウのアイコンを取得（Windows API + GDI+使用）
  - 実行ファイルパスとプロセス名を取得（プロセスIDから取得）
  - ウィンドウクラス名を取得（GetClassNameW使用）
- データ型:
  ```typescript
  interface WindowInfo {
    hwnd: number | bigint;      // ウィンドウハンドル
    title: string;               // ウィンドウタイトル
    x: number;                   // X座標
    y: number;                   // Y座標
    width: number;               // 幅
    height: number;              // 高さ
    processId: number;           // プロセスID
    isVisible: boolean;          // 表示状態
    executablePath?: string;     // 実行ファイルパス（取得可能な場合）
    processName?: string;        // プロセス名（実行ファイル名）
    className?: string;          // ウィンドウクラス名
    icon?: string;               // アイコン（base64エンコードされたデータURL）
    desktopNumber?: number;      // 仮想デスクトップ番号（1から開始、v0.5.19以降）
  }
  ```
- アイコン取得の詳細:
  - `getWindowIcon()`: ウィンドウハンドルからHICONを取得（WM_GETICON, GCLP_HICONを試行）
  - `convertIconToBase64()`: HICONをGDI+でPNG base64に変換
  - `getExecutablePathFromProcessId()`: プロセスIDから実行ファイルパスを取得
  - メモリリーク対策: GDI+リソース解放、一時ファイル削除、koffi callback解放
  - エラーハンドリング: GDI+ステータスコード（0-20）の詳細ログ出力で問題診断を支援（詳細は[アイコンシステム](../features/icons.md#gdiエラーハンドリング)を参照）
- システムウィンドウ除外:
  - 除外対象: Windows入力エクスペリエンス、Windowsシェルエクスペリエンス、Program Manager
  - 判定方法: プロセス名とクラス名の両方が一致する場合に除外
  - 詳細: `src/main/utils/nativeWindowControl.ts` の `EXCLUDED_WINDOWS` 配列
  - デバッグ: `scripts/debug-windows.mjs` で除外動作を確認可能

### `get-all-windows-all-desktops`
すべての仮想デスクトップからウィンドウ一覧を取得（v0.5.19以降）
- 戻り値: `WindowInfo[]`
- 処理内容:
  - Win32 API（koffi経由）でシステム内の全ウィンドウを列挙
  - すべての仮想デスクトップからウィンドウを取得（`includeAllVirtualDesktops: true`）
  - DWMクローキングフラグの処理:
    - `DWM_CLOAKED_SHELL`（仮想デスクトップによるクローキング）は許可
    - それ以外のクローキングは除外
  - 各ウィンドウに`desktopNumber`を設定（1から開始）
  - QuickDashLauncher自身のウィンドウは除外
  - 表示されていないウィンドウ（`IsWindowVisible = false`）は除外
  - タイトルのないウィンドウは除外
  - システムウィンドウを除外（プロセス名+クラス名で判定）
  - 各ウィンドウのアイコンを取得（Windows API + GDI+使用）
  - 実行ファイルパスを取得（プロセスIDから取得）

### `get-virtual-desktop-info`
仮想デスクトップ情報を取得（v0.5.19以降）
- 戻り値: `{ currentDesktop: number, desktopCount: number }`
- 処理内容:
  - 現在アクティブな仮想デスクトップ番号を取得（1から開始）
  - 仮想デスクトップの総数を取得
  - 仮想デスクトップがサポートされていない環境では `{ currentDesktop: 1, desktopCount: 1 }` を返す

### `activate-window`
指定されたウィンドウをアクティブ化
- パラメータ: `hwnd: number | bigint` (ウィンドウハンドル)
- 戻り値: `{ success: boolean, error?: string }`
- 処理内容:
  - **v0.5.12以降**: 全仮想デスクトップからウィンドウを検索（`includeAllVirtualDesktops: true`）
  - 最小化されているウィンドウを復元（ShowWindow SW_RESTORE）
  - 位置・サイズ設定がある場合、`SetWindowPos()`で直接設定（最大3回リトライ、100ms間隔）
  - ウィンドウをアクティブ化（SetForegroundWindow）
  - normalモードの場合、ランチャーウィンドウを自動的に非表示
- Win32 API使用:
  - `ShowWindow`: ウィンドウの表示状態を変更
  - `SetForegroundWindow`: ウィンドウをフォーカス
  - `SetWindowPos`: ウィンドウの位置・サイズ設定（v0.5.12以降）
- **v0.5.12以降の拡張機能**:
  - 別の仮想デスクトップにあるウィンドウに対して、デスクトップを切り替えずに位置・サイズを設定可能
  - cloaked window（別デスクトップの非表示ウィンドウ）も検索・操作対象
  - リトライロジックにより確実に設定を反映

## ワークスペース関連

### `workspace:load-items`
ワークスペースアイテムを読み込み
- 戻り値: `WorkspaceItem[]` (並び順にソート済み)

### `workspace:add-item`
アイテムをワークスペースに追加
- パラメータ: `item: AppItem`, `groupId?: string` (追加先グループID、省略時は未分類)
- 戻り値: `WorkspaceItem`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:add-items-from-paths`
ファイルパスからアイテムを追加（ドラッグ&ドロップ用）
- パラメータ: `filePaths: string[]`, `groupId?: string` (追加先グループID)
- 戻り値: `WorkspaceItem[]`
- 動作: アイテムタイプに応じてアイコンをキャッシュに自動保存
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:remove-item`
ワークスペースからアイテムを削除
- パラメータ: `id: string`
- 戻り値: `{ success: boolean }`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:update-display-name`
アイテムの表示名を更新
- パラメータ: `id: string`, `displayName: string`
- 戻り値: `{ success: boolean }`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:update-item`
アイテムを更新（全フィールド対応）
- パラメータ: `id: string`, `updates: Partial<WorkspaceItem>`
- 戻り値: `{ success: boolean }`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:reorder-items`
アイテムの並び順を更新
- パラメータ: `itemIds: string[]` (新しい順序)
- 戻り値: `{ success: boolean }`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:launch-item`
ワークスペースアイテムを起動
- パラメータ: `item: WorkspaceItem`
- 戻り値: `{ success: boolean, message?: string, successCount?: number, errorCount?: number }`
- 動作:
  - `windowOperation`タイプ: ウィンドウタイトル・プロセス名でウィンドウを検索してアクティブ化
  - `group`タイプ: グループ内のアイテムを順次実行
  - `clipboard`タイプ: クリップボードデータを復元
  - その他: 通常の起動処理（ウィンドウ設定がある場合はウィンドウアクティブ化を先に試行）

### `workspace:load-groups`
ワークスペースグループを読み込み
- 戻り値: `WorkspaceGroup[]` (並び順にソート済み)

### `workspace:create-group`
ワークスペースグループを作成
- パラメータ: `name: string`, `color?: string` (省略可)
- 戻り値: `WorkspaceGroup`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:update-group`
ワークスペースグループを更新
- パラメータ: `id: string`, `updates: Partial<WorkspaceGroup>`
- 戻り値: `{ success: boolean }`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:delete-group`
ワークスペースグループを削除
- パラメータ: `id: string`, `deleteItems: boolean` (trueの場合グループ内アイテムも削除、falseの場合は未分類に移動)
- 戻り値: `{ success: boolean }`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:reorder-groups`
グループの並び順を更新
- パラメータ: `groupIds: string[]` (新しい順序)
- 戻り値: `{ success: boolean }`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:set-groups-collapsed`
複数グループの折りたたみ状態を一括更新
- パラメータ: `ids: string[]`, `collapsed: boolean`
- 戻り値: `{ success: boolean }`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:move-item-to-group`
アイテムをグループに移動
- パラメータ: `itemId: string`, `groupId?: string` (省略または`undefined`は未分類)
- 戻り値: `{ success: boolean }`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:archive-group`
ワークスペースグループをアーカイブ
- パラメータ: `groupId: string`
- 戻り値: `{ success: boolean }`
- 処理内容:
  - グループとその中のアイテムをアーカイブに移動
  - ワークスペースから削除
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:load-archived-groups`
アーカイブされたグループを読み込み
- 戻り値: `ArchivedWorkspaceGroup[]` (アーカイブ日時順にソート済み)
- 各グループにはアイテム数を含む

### `workspace:restore-group`
アーカイブされたグループを復元
- パラメータ: `groupId: string`
- 戻り値: `{ success: boolean }`
- 処理内容:
  - グループとアイテムをワークスペースに復元
  - アーカイブから削除
  - 同名グループが存在する場合、グループ名に「(復元)」サフィックスを付加
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:delete-archived-group`
アーカイブされたグループを完全削除
- パラメータ: `groupId: string`
- 戻り値: `{ success: boolean }`
- 処理内容:
  - グループとアイテムをアーカイブから完全削除（復元不可）
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace-changed` (イベント)
ワークスペース変更を全ウィンドウに通知
- **方向**: メインプロセス → レンダラープロセス（全ウィンドウ）
- **パラメータ**: なし
- **発生タイミング**: ワークスペースアイテム・グループ・実行履歴・アーカイブの変更時

### `workspace:toggle-window`
ワークスペースウィンドウの表示/非表示を切り替え
- 戻り値: なし

### `workspace:show-window`
ワークスペースウィンドウを表示
- 戻り値: なし

### `workspace:hide-window`
ワークスペースウィンドウを非表示
- 戻り値: `boolean`

### `workspace:get-always-on-top`
ワークスペースウィンドウの常に最前面表示状態を取得
- 戻り値: `boolean`

### `workspace:toggle-always-on-top`
ワークスペースウィンドウの常に最前面表示を切り替え
- 戻り値: `boolean` (新しい状態)

### `workspace:set-size`
ワークスペースウィンドウのサイズを設定
- パラメータ: `width: number`, `height: number`
- 戻り値: `boolean`

### `workspace:set-position-and-size`
ワークスペースウィンドウの位置とサイズを設定
- パラメータ: `x: number`, `y: number`, `width: number`, `height: number`
- 戻り値: `boolean`

### `workspace:set-position-mode`
ワークスペースウィンドウの位置モードを設定
- パラメータ: `mode: WorkspacePositionMode`
- 戻り値: `boolean`
- 動作: `displayLeft`・`displayRight`指定時はカーソル位置のディスプレイを基準にする

### `workspace:get-opacity`
ワークスペースウィンドウの不透明度を取得
- 戻り値: `number` (0〜100のパーセント値)

### `workspace:set-opacity`
ワークスペースウィンドウの不透明度を設定
- パラメータ: `opacityPercent: number` (0〜100のパーセント値)
- 戻り値: `boolean`
- 処理内容: 設定に保存し、ウィンドウにも即時反映

### `workspace:set-modal-mode`
ワークスペースウィンドウのモーダルモードを設定（ダイアログ表示時のウィンドウサイズ制御）
- パラメータ: `isModal: boolean`, `requiredSize?: { width: number; height: number }`
- 戻り値: なし
- 処理内容:
  - モーダル表示時（`isModal: true`）: 現在のウィンドウサイズを保存し、必要な場合のみ拡大
  - モーダルを閉じる時（`isModal: false`）: 保存した元のサイズに自動復元
- 実装場所: `src/main/workspaceWindowManager.ts:228-284`（`setWorkspaceModalMode`関数）

詳細は [ワークスペースウィンドウ制御](window-control.md#ワークスペースウィンドウ制御) を参照してください。

## 関連ドキュメント

- [アーキテクチャ概要](overview.md) - システム全体の構造とデータフロー
- [ウィンドウ制御](window-control.md) - ウィンドウ管理の詳細
- [ワークスペース](../features/workspace.md) - ワークスペース機能の使い方
