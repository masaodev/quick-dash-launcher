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
- パラメータ: `tab: 'settings' | 'edit' | 'other'`
- 戻り値: なし

### `get-initial-tab`
管理ウィンドウの初期表示タブを取得
- 戻り値: `'settings' | 'edit' | 'other'`

### `set-active-tab` (イベント)
管理ウィンドウのアクティブタブを変更
- **方向**: メインプロセス → レンダラープロセス
- **パラメータ**: `tab: 'settings' | 'edit' | 'other'`

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

### `open-data-file`
data.txtをデフォルトアプリケーションで開く
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

## 関連ドキュメント

- [アーキテクチャ概要](overview.md) - システム全体の構造とデータフロー
- [ウィンドウ制御](window-control.md) - ウィンドウ管理の詳細
