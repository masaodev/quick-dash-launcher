# IPCチャンネル詳細

QuickDashLauncherで使用される主要なIPCチャンネルの仕様です。

## 設定・ファイル関連

### `settings:is-first-launch`
初回起動かどうかを取得
- 戻り値: `boolean`
- 判定基準: `hotkey`が空文字列または未設定の場合に`true`

### `settings:get`
アプリケーション設定を取得
- パラメータ: `key?: keyof AppSettings` (省略時は全設定を取得)
- 戻り値: 指定されたキーの値、または全設定

### `settings:set`
設定値を設定
- パラメータ: `key: keyof AppSettings`, `value: AppSettings[keyof AppSettings]`
- 特別な処理:
  - `autoLaunch`: 設定変更時に`AutoLaunchService.setAutoLaunch()`を呼び出し、Windowsレジストリに即座に反映

### `settings:set-multiple`
複数の設定項目を一括更新
- パラメータ: `settings: Partial<AppSettings>`
- 特別な処理:
  - ホットキーが設定された場合、初回起動モードを自動解除
  - `autoLaunch`が含まれている場合、`AutoLaunchService.setAutoLaunch()`を呼び出し、Windowsレジストリに即座に反映
- 処理完了後、`settings-changed`イベントを全ウィンドウに送信

### `settings:reset`
設定をデフォルト値にリセット
- 特別な処理:
  - `AutoLaunchService.setAutoLaunch(false)`を呼び出し、自動起動を無効化
- リセット後、`settings-changed`イベントを全ウィンドウに送信

### `settings-changed` (イベント)
設定変更を全ウィンドウに通知
- **方向**: メインプロセス → レンダラープロセス（全ウィンドウ）
- **パラメータ**: なし
- **発生タイミング**:
  - `settings:set-multiple`実行時
  - `settings:reset`実行時
- **用途**: メインウィンドウでの設定の即座反映（タブ名更新など）

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

### `get-config-folder`
ユーザーデータディレクトリパスを返す

### `get-app-info`
アプリケーション情報を取得
- 戻り値: `AppInfo` (バージョン、名前、説明、作者、ライセンス、GitHubリポジトリURL)
- package.jsonから動的に取得

### `open-external-url`
外部URLをデフォルトブラウザで開く
- パラメータ: `url: string`

### `load-data-files`
全てのdata*.txtファイルを読み込み、パース

### `save-temp-data`
一時アイテムを保存

### `register-items`
アイテムをデータファイルに登録
- パラメータ: `RegisterItem[]`
  - `RegisterItem`型:
    - `name: string` - アイテム名
    - `path: string` - パス
    - `type: LauncherItem['type']` - アイテムタイプ
    - `args?: string` - 引数（オプション）
    - `targetTab: string` - 保存先データファイル名（例: `'data.txt'`, `'data2.txt'`）
    - `itemCategory: 'item' | 'dir' | 'group'` - アイテムカテゴリ
    - `folderProcessing?: 'folder' | 'expand'` - フォルダ処理タイプ（オプション）
    - `icon?: string` - アイコンパス（オプション）
    - `customIcon?: string` - カスタムアイコンパス（オプション）
    - `dirOptions?: DirOptions` - フォルダ取込アイテムオプション（オプション）
    - `groupItemNames?: string[]` - グループアイテム名リスト（オプション）
- 戻り値: `void`
- 処理内容:
  - `targetTab`ごとにアイテムをグループ化
  - 各データファイル（例: data.txt, data2.txt）に対応するアイテムを書き込み
  - アイテムカテゴリに応じて異なる形式で保存（通常アイテム、フォルダ取込ディレクティブ、グループ）
  - 保存後、`data-changed`イベントを全ウィンドウに送信

### `sort-data-files`
データファイルをパスの昇順でソート

### `is-directory`
パスがディレクトリかどうかを判定

## アイテム操作

### `open-item`
ファイル/URL/アプリを起動

### `open-parent-folder`
エクスプローラーでアイテムを表示

## アイコン関連

### `fetch-favicon`
ウェブサイトのファビコンをダウンロード

### `extract-icon`
アプリケーションアイコンを抽出

### `extract-custom-uri-icon`
カスタムURIスキーマのハンドラーアプリアイコンを抽出

### `extract-file-icon-by-extension`
ファイル拡張子ベースのアイコン抽出

### `load-cached-icons`
キャッシュされたアイコンを一括読み込み

### `fetch-icons-combined`
ファビコンとアイコンを統合的に一括取得する統合API
- パラメータ: `urls: string[]`, `items: IconItem[]`
- 戻り値: `{ favicons: Record<string, string | null>, icons: Record<string, string | null> }`
- 特徴: 複数フェーズ（ファビコン取得 + アイコン抽出）の進捗を統合管理

### `fetch-favicons-with-progress` (削除)
**削除理由:** `fetch-icons-combined`に統合されました

### `extract-icons-with-progress` (削除)
**削除理由:** `fetch-icons-combined`に統合されました

## ウィンドウ制御

### `set-edit-mode`
編集モードの状態を設定（ウィンドウサイズとフォーカス制御用）

### `get-edit-mode`
編集モードの状態を取得

### `show-edit-window`
管理ウィンドウを表示

### `hide-edit-window`
管理ウィンドウを非表示

### `toggle-edit-window`
管理ウィンドウの表示/非表示を切り替え

### `is-edit-window-shown`
管理ウィンドウの表示状態を取得

### `open-edit-window-with-tab`
指定されたタブで管理ウィンドウを開く
- パラメータ: `tab: 'settings' | 'edit' | 'other'`

### `get-initial-tab`
管理ウィンドウの初期表示タブを取得

### `set-active-tab` (レンダラーイベント)
管理ウィンドウのアクティブタブを変更
- メインプロセスからレンダラーへの一方向通信
- パラメータ: `tab: 'settings' | 'edit' | 'other'`

## データファイル管理

### `get-data-files`
設定フォルダ内のすべてのdata*.txtファイルを取得
- パラメータ: なし
- 戻り値: `string[]` - データファイル名の配列（例: `['data.txt', 'data2.txt', 'data3.txt']`）
- 用途: タブ表示機能、管理ウィンドウのファイル選択、設定画面のファイル一覧表示

### `create-data-file`
新しいデータファイルを作成
- パラメータ: `fileName: string` - 作成するファイル名（例: `'data3.txt'`）
- 戻り値: `{ success: boolean, error?: string }`
- 用途: 設定画面でのデータファイル追加機能
- 動作:
  - 指定されたファイル名で空のデータファイルを作成
  - ファイルが既に存在する場合はエラーを返す
  - 作成後、`data-changed`イベントは発生しない（手動で再読み込みが必要）

### `delete-data-file`
データファイルを削除
- パラメータ: `fileName: string` - 削除するファイル名（例: `'data3.txt'`）
- 戻り値: `{ success: boolean, error?: string }`
- 用途: 設定画面でのデータファイル削除機能
- 制限事項:
  - `data.txt`は削除不可（必須ファイル）
  - 削除後、`data-changed`イベントは発生しない（手動で再読み込みが必要）

## 編集モード専用

### `load-raw-data-files`
生データファイルを展開せずに読み込み（編集モード用）

### `save-raw-data-files`
生データファイルを直接保存（編集モード用）

### `update-item`
単一アイテムをCSV形式で更新
- パラメータ: `{ sourceFile: string, lineNumber: number, newItem: LauncherItem }`
  - `sourceFile`: データファイル名（例: `'data.txt'`, `'data2.txt'`, `'data3.txt'`）
  - `lineNumber`: 更新する行番号（1始まり）
  - `newItem`: 新しいアイテムデータ
- 戻り値: `{ success: boolean }`
- 用途: メインウィンドウからのアイテム編集時に使用
- バックアップ: 更新前に自動バックアップを作成

### `update-raw-line`
生データファイルの指定行を直接更新（フォルダ取込ディレクティブ編集用）
- パラメータ: `{ sourceFile: string, lineNumber: number, newContent: string }`
  - `sourceFile`: データファイル名（例: `'data.txt'`, `'data2.txt'`, `'data3.txt'`）
  - `lineNumber`: 更新する行番号（1始まり）
  - `newContent`: 新しい行の内容（生データ文字列）
- 戻り値: `{ success: boolean }`
- 用途: フォルダ取込ディレクティブの編集時に元の行を直接更新
- バックアップ: 更新前に自動バックアップを作成

### `delete-items`
複数アイテムを一括削除
- パラメータ: `DeleteItemRequest[]` (各要素: `{ sourceFile, lineNumber }`)
- 戻り値: `{ success: boolean }`
- バックアップ: 削除前に自動バックアップを作成

### `batch-update-items`
複数アイテムを一括更新
- パラメータ: `UpdateItemRequest[]` (各要素: `{ sourceFile, lineNumber, newItem }`)
- 戻り値: `{ success: boolean }`
- バックアップ: 更新前に自動バックアップを作成

## プリロードAPI

### `getPathForFile`
ドラッグ&ドロップされたファイルのパスを取得

### `onSettingsChanged`
設定変更イベントリスナー
- **方向**: メインプロセス → レンダラープロセス
- **パラメータ**: `callback: () => void`
- **用途**: メインウィンドウで設定変更を検知し、タブ名などを即座に更新

```typescript
onSettingsChanged(callback: () => void)
```

**使用例:**
```typescript
window.electronAPI.onSettingsChanged(async () => {
  const settings = await window.electronAPI.getSettings();
  setDataFileTabs(settings.dataFileTabs || [{ file: 'data.txt', name: 'メイン' }]);
  // その他の設定を反映
});
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

#### 進捗イベント

**icon-progress-start**
- アイコン取得処理の開始を通知
- 統合進捗情報（複数フェーズ）を含む

**icon-progress-update**
- アイコン取得処理の進捗更新を通知
- 現在のフェーズ、各フェーズの処理数、エラー数を含む

**icon-progress-complete**
- アイコン取得処理の完了を通知
- 最終的な処理結果（全フェーズ）とエラー数を含む

#### IconProgress型定義（更新版）

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

**変更点（v1.x.x）:**
- `IconProgress`を単一フェーズから複数フェーズ管理に変更
- `IconPhaseProgress`型を新規追加
- `IconProgressResult`に`type`フィールドを追加

## システム制御

### `quit-app`
アプリケーションを終了

## 関連ドキュメント

- [アーキテクチャ概要](overview.md) - システム全体の構造とデータフロー