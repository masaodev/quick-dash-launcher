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

## コード品質チェックコマンド

```bash
npm run lint            # ESLintによるコード品質チェック
npm run lint:fix        # ESLintエラーの自動修正
npm run type-check      # TypeScriptの型チェック
npm run format          # Prettierによるコード整形
```

### WSL2環境でのビルド

WSL2環境からビルドするときは、Windows上でビルドさせるために、PowerShellを使ってください：

```bash
powershell.exe -Command "npm run build"
powershell.exe -Command "npm run dist"
```

## テストコマンド

### 単体テスト（Vitest）
```bash
npm run test            # インタラクティブテスト実行
npm run test:unit       # 単体テスト実行（ワンショット）
npm run test:ui         # テストUIを開く
npm run test:coverage   # カバレッジレポート付きでテスト実行
```

### E2Eテスト（Playwright + Electron）
```bash
npm run test:e2e        # E2Eテスト実行（ヘッドレス）
npm run test:e2e:ui     # PlaywrightのテストUIを開く
npm run test:e2e:debug  # デバッグモードでE2Eテスト実行
npm run test:e2e:headed # ヘッド付きでE2Eテスト実行
```

## 詳細ドキュメント

### 📖 ガイド類
- **[はじめに](docs/guides/getting-started.md)** - プロジェクトの基本情報とセットアップ
- **[開発ガイド](docs/guides/development.md)** - 実装詳細とコード品質ガイドライン
- **[ビルドとデプロイ](docs/guides/build-and-deploy.md)** - ビルドシステムと配布方法
- **[テストチェックリスト](docs/guides/testing.md)** - 手動テストの手順

### ⚙️ 機能詳細
- **[アイコンシステム](docs/features/icon-system.md)** - アイコン取得・管理システム
- **[フォルダ取込アイテム](docs/features/folder-import-item.md)** - フォルダ内容のインポート機能
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

### 開発時の重要な注意事項

- **IPCチャンネル**: メインプロセスとレンダラープロセス間の通信は機能別に分離
- **カスタムURIスキーマ**: obsidian://, ms-excel://, vscode://等の非HTTP URIスキーマに対応
- **ドラッグ&ドロップ**: ファイル・フォルダのドロップでアイテム登録機能
- **アイコンシステム**: ファビコン取得、アプリアイコン抽出、カスタムURIアイコン処理
- **ウィンドウ制御**: フレームレス、常に最前面、ピン留め機能

詳細は **[プロジェクト概要](docs/guides/project-overview.md)** を参照してください。

## アーキテクチャ概要

### IPCハンドラー構造
メインプロセスのIPC通信は機能別に分離され、`src/main/ipc/`に配置：
- **dataHandlers**: データファイル読み書き
- **itemHandlers**: アイテム実行・起動
- **configHandlers**: 設定ファイル管理
- **iconHandlers**: アイコン取得・キャッシュ
- **windowHandlers**: ウィンドウ表示制御
- **editHandlers**: 編集モード管理
- **settingsHandlers**: アプリ設定管理

### デザインシステム
CSS変数ベースの統一されたデザインシステムを採用（`src/renderer/styles/variables.css`）：
- ハードコード値の使用禁止
- 統一されたカラーパレット、フォントサイズ、間隔の管理

### TypeScript設定
- **パスエイリアス**: `@common/*` → `./src/common/*`
- **共有型定義**: `src/common/types.ts`でメイン・レンダラープロセス間の型を共有
- **厳密な型チェック**: `strict: true`で型安全性を確保

## ドキュメント管理

このプロジェクトは体系的なドキュメント管理を採用しています。詳細なドキュメント管理ルールについては[ドキュメント管理ルール](docs/meta/documentation-rules.md)を参照してください。