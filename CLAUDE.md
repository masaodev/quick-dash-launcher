# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

QuickDashLauncherは、グローバルホットキー（Ctrl+Alt+Q）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスできるWindows用ランチャーアプリケーション（Electron + React + TypeScript）です。

## ビルドコマンド

```bash
npm install              # 依存関係のインストール
npm run dev             # 開発モード（ホットリロード付き）
npm run build           # 全コンポーネントのビルド
npm run start           # ビルド済みアプリケーションの実行
npm run dist            # Windowsインストーラーの作成

# 個別ビルド
npm run build:main      # メインプロセスのみ
npm run build:preload   # プリロードスクリプトのみ
npm run build:renderer  # レンダラープロセスのみ
```

## アーキテクチャ

### プロセス構造
- **メインプロセス** (`src/main/main.ts`): システム操作、ウィンドウ管理、IPCを処理するElectronメインプロセス
- **レンダラープロセス** (`src/renderer/`): UIのためのReactアプリケーション
- **プリロードスクリプト** (`src/main/preload.ts`): レンダラーに限定的なAPIを公開するセキュアブリッジ

### 主要IPCチャンネル
- `get-config-folder`: ユーザーデータディレクトリパスを返す
- `load-data-files`: 全てのdata*.txtファイルを読み込み、パース
- `save-temp-data`: 一時アイテムを保存
- `open-item`: ファイル/URL/アプリを起動
- `open-parent-folder`: エクスプローラーでアイテムを表示
- `fetch-favicon`: ウェブサイトのファビコンをダウンロード
- `extract-icon`: アイコン抽出（プレースホルダー）

### データフロー
1. メインプロセスが`%APPDATA%/quickdashlauncher/config/`からデータファイルを読み込む
2. パーサーが複数のデータファイルをマージし、重複を削除し、名前順でソート
3. レンダラーがリアルタイムフィルタリングでアイテムを表示
4. ユーザーアクションがシステム操作のためのIPCコールをメインプロセスにトリガー

## 重要な実装詳細

### ウィンドウの動作
- フレームレスウィンドウ（479x506px）常に最前面
- DevToolsが開いていない限りブラー時に非表示
- Ctrl+Alt+Qグローバルホットキーで表示/非表示
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

## 現在の制限事項とTODO

1. **アイコン抽出未実装** - nullを返し、デフォルト絵文字アイコンを表示
2. **ディレクトリスキャン（dirディレクティブ）未実装** - パース時にスキップ
3. **最小限のエラーハンドリング** - エラーはコンソールにのみログ出力
4. **Windows専用パス** - クロスプラットフォーム非対応

## デバッグ時の問題

### 白い/空白のウィンドウ
- DevToolsコンソールでエラーを確認（自動的に開く）
- main.tsのプリロードスクリプトパスがビルド出力と一致しているか確認
- プロダクションモードでindex.htmlパスが正しいか確認

### よくあるビルドの問題
- TypeScript設定はメイン/プリロードと共有タイプで異なるrootDirを使用
- Webpackはレンダラーを単一ファイルにバンドル
- メインプロセスファイルはdist/main/に出力

## テストチェックリスト

1. グローバルホットキー登録とウィンドウトグル
2. 全キーボードショートカット（Enter、Shift+Enter、矢印、Ctrl、Escape）
3. 単一および複数キーワードでの検索
4. メイン/一時タブの切り替え
5. 異なるアイテムタイプの起動（URL、ファイル、フォルダ、引数付きアプリ）
6. ウェブサイトのファビコン取得
7. 一時タブへのアイテム追加
8. システムトレイダブルクリックでの復元