# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

QuickDashLauncherは、グローバルホットキー（Ctrl+Alt+W）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスできるWindows用ランチャーアプリケーション（Electron + React + TypeScript）です。

### 主要機能
- **グローバルホットキー**: Ctrl+Alt+Wで即座にランチャーを呼び出し
- **ウィンドウ固定化**: 📌ボタンでウィンドウを固定し、フォーカスアウトしても非表示にならない
- **アイコン表示**: アプリケーション、ファイル、URLのアイコンを自動取得・表示
- **タブ切り替え**: メインタブと一時タブでアイテムを分類管理
- **リアルタイム検索**: 入力に応じてアイテムをリアルタイムフィルタリング
- **ドラッグ&ドロップ登録**: ファイルやフォルダをドラッグ&ドロップで簡単登録
- **生データ編集モード**: Ctrl+Eで編集モードに切り替え、data.txt、data2.txt、tempdata.txtを直接編集。2つの編集方法を提供：①セル編集（クリック/📝ボタン）で素早い修正、②詳細編集ボタン（✏️）でRegisterModalを使った包括的編集（アイテム種別の選択、フォルダ処理・DIRオプション等も設定可能）。🔤整列ボタンで種類→パスと引数→名前の順にデータを自動整理。編集モード時はウィンドウサイズが自動拡大（1000x700px）し、フォーカスアウトでも非表示にならない。全ての変更（追加・編集・削除）は保存ボタンクリックまで確定されず、誤操作時も保存前なら元に戻せる
- **拡張DIRディレクティブ**: フォルダ内のファイル・フォルダを柔軟にインポート（フィルター、プレフィックス、深さ制御対応）

## ビルドコマンド

```bash
npm install              # 依存関係のインストール
npm run dev             # 開発モード（Viteデベロップメントサーバー、ホットリロード付き）
npm run build           # 全コンポーネントのビルド（Vite使用）
npm run preview         # ビルド済みアプリケーションのプレビュー
npm run start           # ビルドして実行
npm run dist            # Windowsインストーラーの作成
```

### WSL2環境でのビルド

WSL2環境からビルドするときは、Windows上でビルドさせるために、PowerShellを使ってください：

```bash
powershell.exe -Command "npm run build"
powershell.exe -Command "npm run dist"
```

## 詳細ドキュメント

### 📖 ガイド類
- **[はじめに](docs/guides/getting-started.md)** - プロジェクトの基本情報とセットアップ
- **[開発ガイド](docs/guides/development.md)** - 実装詳細とコード品質ガイドライン
- **[ビルドとデプロイ](docs/guides/build-and-deploy.md)** - ビルドシステムと配布方法
- **[テストチェックリスト](docs/guides/testing.md)** - 手動テストの手順

### ⚙️ 機能詳細
- **[アイコンシステム](docs/features/icon-system.md)** - アイコン取得・管理システム
- **[DIRディレクティブ](docs/features/dir-directive.md)** - フォルダ内容のインポート機能
- **[編集モード](docs/features/edit-mode.md)** - 生データ編集機能の詳細
- **[アプリケーション設定](docs/features/app-settings.md)** - ホットキー・ウィンドウサイズ等の設定

### 🏗️ アーキテクチャ
- **[システム概要](docs/architecture/overview.md)** - プロセス構造とデータ処理
- **[IPCチャンネル](docs/architecture/ipc-channels.md)** - プロセス間通信の仕様
- **[データフロー](docs/architecture/data-flow.md)** - データ処理の流れ
- **[ウィンドウ制御](docs/architecture/window-control.md)** - ウィンドウ管理システム

### 📚 リファレンス
- **[APIリファレンス](docs/reference/api-reference.md)** - 主要API一覧
- **[キーボードショートカット](docs/reference/keyboard-shortcuts.md)** - ショートカット一覧
- **[画面構成](docs/reference/screen-list.md)** - UI仕様

### 📝 メタ情報
- **[ドキュメント管理ルール](docs/meta/documentation-rules.md)** - ドキュメント更新のルール
- **[コードレビューレポート](docs/meta/code-review-report.md)** - コード品質分析

## 主な技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Electron (メインプロセス)
- **開発環境**: WSL2 + PowerShell（ビルド時）
- **パッケージング**: electron-builder

## 重要な制約事項

1. **Windows専用アプリケーション** - クロスプラットフォーム非対応
2. **WSL2環境でのビルド時**: PowerShellコマンドを使用する必要がある
3. **テストフレームワーク未導入** - 手動テストのみ実施

## ドキュメント管理

このプロジェクトは体系的なドキュメント管理を採用しています。詳細なドキュメント管理ルールについては[ドキュメント管理ルール](docs/meta/documentation-rules.md)を参照してください。