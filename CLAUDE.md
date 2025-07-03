# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

QuickDashLauncherは、グローバルホットキー（Ctrl+Alt+W）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスできるWindows用ランチャーアプリケーション（Electron + React + TypeScript）です。

## ビルドコマンド

```bash
npm install              # 依存関係のインストール
npm run dev             # 開発モード（Viteデベロップメントサーバー、ホットリロード付き）
npm run build           # 全コンポーネントのビルド（Vite使用）
npm run preview         # ビルド済みアプリケーションのプレビュー
npm run start           # ビルドして実行
npm run dist            # Windowsインストーラーの作成
```

## アーキテクチャ

### プロセス構造
- **メインプロセス** (`src/main/main.ts`): システム操作、ウィンドウ管理、IPCを処理するElectronメインプロセス
- **レンダラープロセス** (`src/renderer/`): UIのためのReactアプリケーション
- **プリロードスクリプト** (`src/main/preload.ts`): レンダラーに限定的なAPIを公開するセキュアブリッジ
- **共通型定義** (`src/common/types.ts`): プロセス間で共有される型定義

### IPCハンドラー構造
IPCハンドラーは機能ごとに分離（`src/main/ipc/`）:
- `configHandlers.ts`: 設定フォルダーへのアクセス
- `dataHandlers.ts`: データファイルの読み込み・保存
- `itemHandlers.ts`: アイテムの起動・フォルダー表示
- `iconHandlers.ts`: ファビコン取得・アイコン抽出

### 主要IPCチャンネル
- `get-config-folder`: ユーザーデータディレクトリパスを返す
- `load-data-files`: 全てのdata*.txtファイルを読み込み、パース
- `save-temp-data`: 一時アイテムを保存
- `open-item`: ファイル/URL/アプリを起動
- `open-parent-folder`: エクスプローラーでアイテムを表示
- `fetch-favicon`: ウェブサイトのファビコンをダウンロード
- `extract-icon`: アプリケーションアイコンを抽出

### データフロー
1. メインプロセスが`%APPDATA%/quickdashlauncher/config/`からデータファイルを読み込む
2. パーサーが複数のデータファイルをマージし、重複を削除し、名前順でソート
3. レンダラーがリアルタイムフィルタリングでアイテムを表示
4. ユーザーアクションがシステム操作のためのIPCコールをメインプロセスにトリガー

## 重要な実装詳細

### ウィンドウの動作
- フレームレスウィンドウ（479x506px）常に最前面
- DevToolsが開いていない限りブラー時に非表示
- Ctrl+Alt+Wグローバルホットキーで表示/非表示
- 表示時に検索ボックスが自動クリア＆フォーカス

### データファイル形式
```
// コメント行は//で開始
表示名,URLまたはパス
アプリ名,C:\path\to\app.exe,オプション引数
dir,C:\folder\path  // フォルダから全ショートカットをインポート（未実装）
```

### アイテムタイプの検出
- URL: `://`を含む
- カスタムURI: 非http(s)スキーマ（obsidian://, ms-excel://）
- アプリ: .exe, .bat, .cmd, .com拡張子
- フォルダ: 拡張子なしまたはスラッシュで終わる
- ファイル: その他すべて

### 検索の実装
- 大文字小文字を区別しないインクリメンタルサーチ
- スペース区切りキーワードでAND検索
- 表示名のみでフィルタリング

### アイコン処理
- ウェブサイト: ファビコンを`%APPDATA%/quickdashlauncher/config/favicons/`にキャッシュ
- アプリケーション: `@bitdisaster/exe-icon-extractor`と`extract-file-icon`を使用してアイコン抽出
- URIスキーマ: ファイル拡張子ベースのアイコン取得（ms-excel:// → .xlsx）
- デフォルト: 絵文字アイコン（📄ファイル、📁フォルダ、🌐ウェブ、🚀アプリ）

## ビルドシステム

Viteベースのビルドシステムを使用:
- **メインプロセス**: CommonJS形式で`dist/main/`に出力
- **プリロードスクリプト**: CommonJS形式で`dist/preload/`に出力
- **レンダラープロセス**: 標準的なViteビルドで`dist/renderer/`に出力
- **開発サーバー**: ポート9000で実行

## 現在の制限事項とTODO

1. **ディレクトリスキャン（dirディレクティブ）未実装** - パース時にスキップ
2. **最小限のエラーハンドリング** - エラーはコンソールにのみログ出力
3. **Windows専用パス** - クロスプラットフォーム非対応
4. **テストフレームワーク未導入** - 手動テストのみ

## デバッグ時の問題

### 白い/空白のウィンドウ
- DevToolsコンソールでエラーを確認（自動的に開く）
- Viteデベロップメントサーバーが起動しているか確認（開発モード時）
- プロダクションモードでindex.htmlパスが正しいか確認

### よくあるビルドの問題
- TypeScript設定の`@common`パスエイリアスがVite設定と一致しているか確認
- ビルド出力が正しいディレクトリ構造になっているか確認
- Electronのファイルパスがビルド/開発モードで適切に処理されているか確認

## テストチェックリスト

1. グローバルホットキー（Ctrl+Alt+W）登録とウィンドウトグル
2. 全キーボードショートカット（Enter、Shift+Enter、矢印、Ctrl、Escape）
3. 単一および複数キーワードでの検索
4. メイン/一時タブの切り替え
5. 異なるアイテムタイプの起動（URL、ファイル、フォルダ、引数付きアプリ）
6. ウェブサイトのファビコン取得（手動ボタン押下）
7. 一時タブへのアイテム追加
8. システムトレイダブルクリックでの復元
9. アプリケーションアイコンの抽出と表示
10. URIスキーマ（obsidian://, ms-excel://など）の処理