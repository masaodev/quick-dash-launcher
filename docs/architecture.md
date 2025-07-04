# アーキテクチャ詳細

## プロセス構造
- **メインプロセス** (`src/main/main.ts`): システム操作、ウィンドウ管理、IPCを処理するElectronメインプロセス
- **レンダラープロセス** (`src/renderer/`): UIのためのReactアプリケーション
- **プリロードスクリプト** (`src/main/preload.ts`): レンダラーに限定的なAPIを公開するセキュアブリッジ
- **共通型定義** (`src/common/types.ts`): プロセス間で共有される型定義

## IPCハンドラー構造
IPCハンドラーは機能ごとに分離（`src/main/ipc/`）:
- `configHandlers.ts`: 設定フォルダーへのアクセス
- `dataHandlers.ts`: データファイルの読み込み・保存
- `itemHandlers.ts`: アイテムの起動・フォルダー表示
- `iconHandlers.ts`: ファビコン取得・アイコン抽出
- `windowHandlers.ts`: ウィンドウ固定化制御

## 主要IPCチャンネル
- `get-config-folder`: ユーザーデータディレクトリパスを返す
- `load-data-files`: 全てのdata*.txtファイルを読み込み、パース
- `save-temp-data`: 一時アイテムを保存
- `open-item`: ファイル/URL/アプリを起動
- `open-parent-folder`: エクスプローラーでアイテムを表示
- `fetch-favicon`: ウェブサイトのファビコンをダウンロード
- `extract-icon`: アプリケーションアイコンを抽出
- `extract-custom-uri-icon`: **新機能** カスタムURIスキーマのハンドラーアプリアイコンを抽出
- `extract-file-icon-by-extension`: ファイル拡張子ベースのアイコン抽出
- `load-cached-icons`: キャッシュされたアイコンを一括読み込み
- `get-window-pin-state`: ウィンドウ固定状態を取得
- `set-window-pin-state`: ウィンドウ固定状態を設定

## データフロー
1. メインプロセスが`%APPDATA%/quickdashlauncher/config/`からデータファイルを読み込む
2. パーサーが複数のデータファイルをマージし、重複を削除し、名前順でソート
3. レンダラーがリアルタイムフィルタリングでアイテムを表示
4. ユーザーアクションがシステム操作のためのIPCコールをメインプロセスにトリガー

## ウィンドウ制御システム

### ウィンドウ固定化機能
- **実装場所**: `src/main/windowManager.ts`
- **状態管理**: メインプロセスで`isPinned`フラグを管理
- **制御ロジック**: 固定中はウィンドウのblurイベントで非表示にならない
- **UI制御**: レンダラーで固定ボタン（📌）の状態を管理

### ウィンドウ表示制御
- **グローバルホットキー**: `Ctrl+Alt+W`でウィンドウ表示/非表示
- **フォーカスアウト**: 固定されていない場合、フォーカスを失うと自動的に非表示
- **Escapeキー**: 固定状態に関係なく、Escapeキーで非表示可能
- **システムトレイ**: ダブルクリックでウィンドウ表示

### IPC通信フロー
1. レンダラーが固定ボタンクリック → `set-window-pin-state`
2. メインプロセスが固定状態を更新 → `windowManager.setWindowPinState()`
3. レンダラーが固定状態を取得 → `get-window-pin-state`
4. blur イベントで固定状態をチェック → 非固定時のみ非表示