# IPCチャンネル詳細

QuickDashLauncherで使用される主要なIPCチャンネルの仕様です。

## 設定・ファイル関連

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

## ウィンドウ制御

### `get-window-pin-state`
ウィンドウ固定状態を取得

### `set-window-pin-state`
ウィンドウ固定状態を設定

### `set-edit-mode`
編集モードの状態を設定（ウィンドウサイズとフォーカス制御用）

### `get-edit-mode`
編集モードの状態を取得

## 編集モード専用

### `load-raw-data-files`
生データファイルを展開せずに読み込み（編集モード用）

### `save-raw-data-files`
生データファイルを直接保存（編集モード用）

## 削除済みチャンネル

以下のチャンネルは実装が削除されました：
- `update-item`: 個別アイテムの更新
- `delete-items`: 複数アイテムの削除
- `batch-update-items`: 複数アイテムの一括更新

## プリロードAPI

### `getPathForFile`
ドラッグ&ドロップされたファイルのパスを取得

## システム制御

### `quit-app`
アプリケーションを終了

## 関連ドキュメント

- [アーキテクチャ概要](overview.md) - システム全体の構造
- [データフロー](data-flow.md) - IPCを使ったデータ処理フロー