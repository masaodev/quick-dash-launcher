# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

QuickDashLauncherは、グローバルホットキー（Alt+Space）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスできるWindows用ランチャーアプリケーション（Electron + React + TypeScript）です。

詳細な機能説明は **[プロジェクト概要](docs/guides/project-overview.md)** を参照してください。

## ビルドコマンド

```bash
npm install              # 依存関係のインストール
npm run dev             # 開発モード（Viteデベロップメントサーバー、ホットリロード付き）
npm run dev:minimal     # 最小限のセットで開発モード起動
npm run dev:full        # フル機能セットで開発モード起動
npm run dev:tabs        # タブ機能デモで開発モード起動
npm run dev:groups      # グループ起動デモで開発モード起動
npm run build           # 全コンポーネントのビルド（Vite使用）
npm run preview         # ビルド済みアプリケーションのプレビュー
npm run start           # ビルドして実行
npm run dist            # Windowsインストーラーの作成
```

**注:** `tests/dev/`ディレクトリには、開発用の設定テンプレートが含まれています。詳細は[tests/dev/README.md](tests/dev/README.md)を参照してください。

## コード品質チェックコマンド

```bash
npm run lint            # ESLintによるコード品質チェック
npm run lint:fix        # ESLintエラーの自動修正
npm run type-check      # TypeScriptの型チェック
npm run format          # Prettierによるコード整形
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

# 特定のテストのみ実行
npm run test:e2e:single <test-name>

# 例: 初回起動テストのみ実行
npm run test:e2e:single first-launch
```

**利用可能なテスト名:**
- `first-launch` - 初回起動セットアップ
- `basic-ui` - 基本UI（アイテム表示・選択・検索）
- `item-register` - アイテム登録・編集
- `item-management` - アイテム管理（管理画面での編集・削除・整列）
- `multi-tab` - マルチタブ機能
- `settings` - 設定タブ
- `context-menu` - コンテキストメニュー
- `alert-dialog` - AlertDialog（通知ダイアログ）
- `confirm-dialog` - ConfirmDialog（確認ダイアログ）

## 詳細ドキュメント

ドキュメント構成の詳細は **[ドキュメント構成ガイド](docs/README.md)** を参照してください。

### 📖 開発者向けガイド
- **[はじめに](docs/guides/getting-started.md)** - プロジェクトの基本情報とセットアップ
- **[開発ガイド](docs/guides/development.md)** - 実装詳細とコード品質ガイドライン
- **[ビルドとデプロイ](docs/guides/build-and-deploy.md)** - ビルドシステムと配布方法
- **[テストチェックリスト](docs/testing/manual-checklist.md)** - 手動テストの手順
- **[GitHub ワークフロー](docs/guides/github-workflow.md)** - Git操作とPRフロー

### 📖 ユーザーマニュアル
- **[アイコンシステム](docs/manual/icon-system.md)** - アイコン取得・管理システム
- **[グループ起動機能](docs/manual/group-launch.md)** - 複数アイテムの一括起動
- **[フォルダ取込アイテム](docs/manual/folder-import-item.md)** - フォルダ内容のインポート機能
- **[アイテム管理](docs/manual/item-management.md)** - 生データ編集機能の詳細
- **[アプリケーション設定](docs/manual/app-settings.md)** - ホットキー・ウィンドウサイズ等の設定
- **[システムトレイメニュー](docs/manual/system-tray.md)** - タスクトレイからのアクセス方法

### 📚 リファレンス（仕様書）
- **[データファイル形式仕様](docs/reference/data-file-format.md)** - data.txtファイル形式の完全仕様
- **[アプリケーション設定仕様](docs/reference/settings-specification.md)** - 設定項目の完全仕様
- **[アイコン仕様](docs/reference/icon-specification.md)** - アイコン処理の完全仕様
- **[キーボードショートカット](docs/reference/keyboard-shortcuts.md)** - ショートカット一覧
- **[画面構成](docs/reference/screens/screen-list.md)** - UI仕様
- **[システム概要](docs/reference/architecture/overview.md)** - プロセス構造とデータ処理
- **[IPCチャンネル](docs/reference/architecture/ipc-channels.md)** - プロセス間通信の仕様
- **[データフロー](docs/reference/architecture/data-flow.md)** - データ処理の流れ
- **[ウィンドウ制御](docs/reference/architecture/window-control.md)** - ウィンドウ管理システム
- **[CSSデザインシステム](docs/reference/architecture/css-design-system.md)** - 統一されたスタイル管理システム

## 技術スタック・開発時の注意事項

### プラットフォーム・フレームワーク
- **Windows専用アプリケーション**（Electron + React + TypeScript + Vite）
- **テストフレームワーク**: Vitest（単体）、Playwright（E2E）

### 開発時の重要な制約
- **カスタムURIスキーマ対応**: `obsidian://`, `ms-excel://`, `vscode://` 等の非HTTPスキーマに対応
- **パスエイリアス**: `@common/*` で共通型定義にアクセス（`src/common/types.ts`）
- **CSSデザインシステム**: CSS変数ベース（`src/renderer/styles/variables.css`）。ハードコード値の使用禁止
  - 詳細な命名規則・ベストプラクティスは **[CSSデザインシステム](docs/reference/architecture/css-design-system.md)** を参照
- **設定ファイルパス**: `PathManager`クラスで一元管理。環境変数`QUICK_DASH_CONFIG_DIR`でカスタマイズ可能

詳細なアーキテクチャは **[システム概要](docs/reference/architecture/overview.md)** を参照してください。

### テスト時の設定
テスト実行時には`PathTestHelper`を使用して一時フォルダで設定を管理します。

```typescript
import { PathTestHelper } from '../../src/test/helpers/pathTestHelper';

beforeEach(() => {
  pathHelper = new PathTestHelper();
  pathHelper.setup('test-name'); // 一時フォルダ作成
});

afterEach(() => {
  pathHelper.cleanup(); // クリーンアップ
});
```

## Git操作のルール

### コミット・プッシュの確認

**重要**: コミットおよびプッシュを実行する前に、**必ずユーザーに確認を取ってください**。

- ❌ 勝手にコミット・プッシュしない
- ✅ 変更内容を説明し、ユーザーの承認を得てから実行する
- ✅ コミットメッセージの内容も事前に提示する

## コード品質チェック

**コミット・プッシュ前**には、**`quality-checker`サブエージェント**で品質チェックを実行してください。

```
Task tool with subagent_type="quality-checker"
```

このサブエージェントは以下を自動的に実行します：
- TypeScript型チェック・ESLint実行
- コード複雑度・命名規則・重複コードの検出
- セキュリティリスクの確認
- プロジェクト固有の品質基準チェック
- 優先度付きレポート生成

詳細は `.claude/agents/quality-checker.md` を参照してください。

## ドキュメント更新

機能追加・変更時のドキュメント更新は、**`documentation-updater`サブエージェント**を使用してください。

```
Task tool with subagent_type="documentation-updater"
```

このサブエージェントは以下を自動的に実行します：
- 変更内容の分析
- 関連ドキュメントの特定
- 複数ドキュメントの一括更新
- ドキュメント間の整合性確認

詳細は `.claude/agents/documentation-updater.md` を参照してください。

## E2Eテスト実行

E2Eテストの実行と失敗分析は、**`e2e-test-runner`サブエージェント**を使用してください。

```
Task tool with subagent_type="e2e-test-runner"
```

このサブエージェントは以下を自動的に実行します：
- Playwright E2Eテストの実行
- テスト失敗時の詳細分析（スクリーンショット・トレース解析）
- 失敗原因の特定と修正案の提示
- デバッグ推奨アクションの提供
- 構造化されたテストレポート生成

詳細は `.claude/agents/e2e-test-runner.md` を参照してください。