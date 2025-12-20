# IPCチャンネル詳細

QuickDashLauncherで使用される全IPCチャンネルの仕様です。

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
グローバルホットキーを変更
- パラメータ: `newHotkey: string`
- 戻り値: `boolean` (成功/失敗)

### `settings:check-hotkey-availability`
ホットキーの利用可能性をチェック
- パラメータ: `hotkey: string`
- 戻り値: `boolean` (利用可能かどうか)

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
設定フォルダ内のすべてのdata*.txtファイルを取得
- 戻り値: `string[]` (例: `['data.txt', 'data2.txt', 'data3.txt']`)

### `create-data-file`
新しいデータファイルを作成
- パラメータ: `fileName: string`
- 戻り値: `{ success: boolean, error?: string }`
- 動作: 空のファイルを作成。既存の場合はエラー

### `delete-data-file`
データファイルを削除
- パラメータ: `fileName: string`
- 戻り値: `{ success: boolean, error?: string }`
- 制限: `data.txt`は削除不可

### `load-data-files`
全てのdata*.txtファイルを読み込み、パース
- 戻り値: `AppItem[]` (LauncherItemとGroupItemの配列)
- 処理内容:
  - フォルダ取込ディレクティブの展開
  - .lnkファイルの解析
  - タブ単位の重複チェック
  - 名前順ソート

### `register-items`
アイテムをデータファイルに登録
- パラメータ: `RegisterItem[]`
  - `name: string` - アイテム名
  - `path: string` - パス
  - `type: LauncherItem['type']` - アイテムタイプ
  - `args?: string` - 引数
  - `targetTab: string` - 保存先データファイル名
  - `targetFile?: string` - 実際の保存先ファイル
  - `itemCategory: 'item' | 'dir' | 'group'` - アイテムカテゴリ
  - `folderProcessing?: 'folder' | 'expand'` - フォルダ処理タイプ
  - `icon?: string` - アイコンパス
  - `customIcon?: string` - カスタムアイコンパス
  - `dirOptions?: DirOptions` - フォルダ取込オプション
  - `groupItemNames?: string[]` - グループアイテム名リスト
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

### `load-raw-data-files`
生データファイルを展開せずに読み込み（編集モード用）
- 戻り値: `RawDataLine[]`

### `save-raw-data-files`
生データファイルを直接保存（編集モード用）
- パラメータ: `rawLines: RawDataLine[]`
- 戻り値: なし
- 処理完了後、`data-changed`イベントを全ウィンドウに送信
- バックアップ: 保存前に自動作成

### `update-item`
単一アイテムをCSV形式で更新
- パラメータ: `{ sourceFile: string, lineNumber: number, newItem: LauncherItem }`
- 戻り値: `{ success: boolean }`
- バックアップ: 更新前に自動作成
- 処理完了後、`data-changed`イベントを全ウィンドウに送信

### `update-raw-line`
生データファイルの指定行を直接更新（フォルダ取込ディレクティブ編集用）
- パラメータ: `{ sourceFile: string, lineNumber: number, newContent: string }`
- 戻り値: `{ success: boolean }`
- バックアップ: 更新前に自動作成
- 処理完了後、`data-changed`イベントを全ウィンドウに送信

### `delete-items`
複数アイテムを一括削除
- パラメータ: `DeleteItemRequest[]` (各要素: `{ sourceFile, lineNumber }`)
- 戻り値: `{ success: boolean }`
- バックアップ: 削除前に自動作成
- 処理完了後、`data-changed`イベントを全ウィンドウに送信

### `batch-update-items`
複数アイテムを一括更新
- パラメータ: `UpdateItemRequest[]` (各要素: `{ sourceFile, lineNumber, newItem }`)
- 戻り値: `{ success: boolean }`
- バックアップ: 更新前に自動作成
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
- 動作: グループ内のアイテムを500ms間隔で順次起動
- ピンモードが`normal`の場合、全アイテム実行後にウィンドウを非表示

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

## その他

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
onSetActiveTab(callback: (tab: 'settings' | 'edit' | 'other') => void)
```

### `onWindowShown`
ウィンドウ表示イベントリスナー
```typescript
onWindowShown(callback: () => void)
```

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
システム内の開いているウィンドウ一覧を取得
- 戻り値: `WindowInfo[]`
- 処理内容:
  - Win32 API（koffi経由）でシステム内の全ウィンドウを列挙
  - QuickDashLauncher自身のウィンドウは除外
  - 表示されていないウィンドウ（`IsWindowVisible = false`）は除外
  - タイトルのないウィンドウは除外
  - 各ウィンドウのアイコンを取得（Windows API + GDI+使用）
  - 実行ファイルパスを取得（プロセスIDから取得）
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
    icon?: string;               // アイコン（base64エンコードされたデータURL）
  }
  ```
- アイコン取得の詳細:
  - `getWindowIcon()`: ウィンドウハンドルからHICONを取得（WM_GETICON, GCLP_HICONを試行）
  - `convertIconToBase64()`: HICONをGDI+でPNG base64に変換
  - `getExecutablePathFromProcessId()`: プロセスIDから実行ファイルパスを取得
  - メモリリーク対策: GDI+リソース解放、一時ファイル削除、koffi callback解放
  - エラーハンドリング: GDI+ステータスコード（0-20）の詳細ログ出力で問題診断を支援（詳細は[アイコンシステム](../features/icons.md#gdiエラーハンドリング)を参照）

### `activate-window`
指定されたウィンドウをアクティブ化
- パラメータ: `hwnd: number | bigint` (ウィンドウハンドル)
- 戻り値: `{ success: boolean, error?: string }`
- 処理内容:
  - 最小化されているウィンドウを復元（ShowWindow SW_RESTORE）
  - ウィンドウをアクティブ化（SetForegroundWindow）
  - normalモードの場合、ランチャーウィンドウを自動的に非表示
- Win32 API使用:
  - `ShowWindow`: ウィンドウの表示状態を変更
  - `SetForegroundWindow`: ウィンドウをフォーカス

## ワークスペース関連

### `workspace:load-items`
ワークスペースアイテムを読み込み
- 戻り値: `WorkspaceItem[]` (並び順にソート済み)

### `workspace:add-item`
アイテムをワークスペースに追加
- パラメータ: `item: AppItem`
- 戻り値: `WorkspaceItem`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:add-items-from-paths`
ファイルパスからアイテムを追加（ドラッグ&ドロップ用）
- パラメータ: `filePaths: string[]`
- 戻り値: `WorkspaceItem[]`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:remove-item`
ワークスペースからアイテムを削除
- パラメータ: `itemId: string`
- 戻り値: `boolean`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:update-display-name`
アイテムの表示名を更新
- パラメータ: `itemId: string`, `newName: string`
- 戻り値: `boolean`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:reorder-items`
アイテムの並び順を更新
- パラメータ: `itemIds: string[]` (新しい順序)
- 戻り値: `boolean`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:launch-item`
ワークスペースアイテムを起動
- パラメータ: `item: WorkspaceItem`
- 戻り値: なし
- 起動時に実行履歴に自動追加

### `workspace:load-groups`
ワークスペースグループを読み込み
- 戻り値: `WorkspaceGroup[]` (並び順にソート済み)

### `workspace:create-group`
ワークスペースグループを作成
- パラメータ: `name: string`, `color: string`
- 戻り値: `WorkspaceGroup`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:update-group`
ワークスペースグループを更新
- パラメータ: `groupId: string`, `updates: Partial<WorkspaceGroup>`
- 戻り値: `boolean`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:delete-group`
ワークスペースグループを削除
- パラメータ: `groupId: string`
- 戻り値: `boolean`
- グループ内のアイテムは未分類に移動
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:reorder-groups`
グループの並び順を更新
- パラメータ: `groupIds: string[]` (新しい順序)
- 戻り値: `boolean`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:move-item-to-group`
アイテムをグループに移動
- パラメータ: `itemId: string`, `groupId: string | null` (nullは未分類)
- 戻り値: `boolean`
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:load-execution-history`
実行履歴を読み込み
- 戻り値: `ExecutionHistoryItem[]` (最新順、最大10件)

### `workspace:add-execution-history`
実行履歴にアイテムを追加
- パラメータ: `item: AppItem`
- 戻り値: なし
- 最大10件を超えた場合、古いものから削除
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:clear-execution-history`
実行履歴をクリア
- 戻り値: なし
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:archive-group`
ワークスペースグループをアーカイブ
- パラメータ: `groupId: string`
- 戻り値: `boolean`
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
- 戻り値: `boolean`
- 処理内容:
  - グループとアイテムをワークスペースに復元
  - アーカイブから削除
  - 同名グループが存在する場合、グループ名に「(復元)」サフィックスを付加
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace:delete-archived-group`
アーカイブされたグループを完全削除
- パラメータ: `groupId: string`
- 戻り値: `boolean`
- 処理内容:
  - グループとアイテムをアーカイブから完全削除（復元不可）
- 処理完了後、`workspace-changed`イベントを全ウィンドウに送信

### `workspace-changed` (イベント)
ワークスペース変更を全ウィンドウに通知
- **方向**: メインプロセス → レンダラープロセス（全ウィンドウ）
- **パラメータ**: なし
- **発生タイミング**: ワークスペースアイテム・グループ・実行履歴・アーカイブの変更時

## 関連ドキュメント

- [アーキテクチャ概要](overview.md) - システム全体の構造とデータフロー
- [ウィンドウ制御](window-control.md) - ウィンドウ管理の詳細
- [ワークスペース](../features/workspace.md) - ワークスペース機能の使い方
