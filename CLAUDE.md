# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

QuickDashLauncherは、グローバルホットキー（Ctrl+Alt+W）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスできるWindows用ランチャーアプリケーション（Electron + React + TypeScript）です。

詳細な機能説明は **[プロジェクト概要](docs/guides/project-overview.md)** を参照してください。

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
- **[フォルダ取込ディレクティブ](docs/features/dir-directive.md)** - フォルダ内容のインポート機能
- **[アイテム管理](docs/features/item-management.md)** - 生データ編集機能の詳細
- **[アプリケーション設定](docs/features/app-settings.md)** - ホットキー・ウィンドウサイズ等の設定
- **[CSSデザインシステム](docs/features/css-design-system.md)** - 統一されたスタイル管理システム

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

## 技術スタック・制約事項

- **Windows専用アプリケーション**（React + TypeScript + Vite + Electron）
- **WSL2環境でのビルド時**: PowerShellコマンドを使用
- **テストフレームワーク**: Playwright（E2E）+ Vitest（ユニット）導入済み

詳細は **[プロジェクト概要](docs/guides/project-overview.md)** を参照してください。

## ドキュメント管理

このプロジェクトは体系的なドキュメント管理を採用しています。詳細なドキュメント管理ルールについては[ドキュメント管理ルール](docs/meta/documentation-rules.md)を参照してください。