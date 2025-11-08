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

### `settings:set-multiple`
複数の設定項目を一括更新
- パラメータ: `settings: Partial<AppSettings>`
- 備考: ホットキーが設定された場合、初回起動モードを自動解除

### `settings:reset`
設定をデフォルト値にリセット

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

### `load-data-files`
全てのdata*.txtファイルを読み込み、パース

### `save-temp-data`
一時アイテムを保存

### `register-items`
アイテムをデータファイルに登録

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

### `fetch-favicons-with-progress`
複数URLのファビコンを逐次取得し、進捗状況をリアルタイム通知

### `extract-icons-with-progress`
複数アイテムのアイコンを逐次抽出し、進捗状況をリアルタイム通知

## ウィンドウ制御

### `get-window-pin-state`
ウィンドウ固定状態を取得

### `set-window-pin-state`
ウィンドウ固定状態を設定

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

## 編集モード専用

### `load-raw-data-files`
生データファイルを展開せずに読み込み（編集モード用）

### `save-raw-data-files`
生データファイルを直接保存（編集モード用）

## 削除済みチャンネル

以下のチャンネルは実装が削除されました：
- `update-item`: 単一アイテムの更新
- `delete-items`: 複数アイテムの削除
- `batch-update-items`: 複数アイテムの一括更新

## プリロードAPI

### `getPathForFile`
ドラッグ&ドロップされたファイルのパスを取得

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
- 処理種別（favicon/icon）と総数を含む

**icon-progress-update**
- アイコン取得処理の進捗更新を通知
- 現在の処理数、処理中アイテム、エラー数を含む

**icon-progress-complete**
- アイコン取得処理の完了を通知
- 最終的な処理結果とエラー数を含む

#### IconProgress型定義

```typescript
interface IconProgress {
  type: 'favicon' | 'icon';           // 処理の種別
  current: number;                    // 現在処理完了したアイテム数
  total: number;                      // 処理対象の総アイテム数
  currentItem: string;                // 現在処理中のアイテム名またはURL
  errors: number;                     // エラーが発生したアイテム数
  startTime: number;                  // 処理開始時刻（ミリ秒）
  isComplete: boolean;                // 処理が完了したかどうか
}
```

## システム制御

### `quit-app`
アプリケーションを終了

## 関連ドキュメント

- [アーキテクチャ概要](overview.md) - システム全体の構造
- [データフロー](data-flow.md) - IPCを使ったデータ処理フロー