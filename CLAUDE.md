# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

QuickDashLauncherは、グローバルホットキー（Alt+Space）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスできるWindows用ランチャーアプリケーション（Electron + React + TypeScript）です。

詳細は **[はじめに](docs/setup/getting-started.md)** を参照してください。

## ビルドコマンド

```bash
npm install              # 依存関係のインストール
npm run dev             # 開発モード（ポート9001、ホットキー: Ctrl+Alt+A）
npm run dev2            # 開発モード第2インスタンス（ポート9002、ホットキー: Ctrl+Alt+S）
npm run dev:test        # テストデータで開発モード起動（全機能を含むテストデータ）
npm run build           # 全コンポーネントのビルド（Vite使用）
npm run preview         # ビルド済みアプリケーションのプレビュー
npm run start           # ビルドして実行
npm run dist            # Windowsインストーラーの作成
```

### 多重起動について

v0.5.3以降、開発時に複数のインスタンスを同時に起動できるようになりました。

**インスタンスごとの分離:**
- 独立した設定フォルダ（`userData`パス）
- 異なるViteポート番号
- 異なるグローバルホットキー
- 完全に分離されたキャッシュ・データファイル

**使用例:**
```bash
# ターミナル1: 開発用メインインスタンス
npm run dev

# ターミナル2: 並行開発・比較検証用
npm run dev2

# ターミナル3: テストデータで動作確認
npm run dev:test
```

詳細は **[開発ガイド - 多重起動](docs/setup/development.md#多重起動)** を参照してください。

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
- `group-item-register` - グループアイテム登録

## ドキュメント

ドキュメント一覧は **[docs/README.md](docs/README.md)** を参照してください。

### セットアップ・開発
- **[はじめに](docs/setup/getting-started.md)** - 環境構築・初回セットアップ
- **[開発ガイド](docs/setup/development.md)** - 開発フロー・コードガイドライン
- **[ビルド・デプロイ](docs/setup/build-deploy.md)** - ビルドとリリース

### 機能ドキュメント
- **[アイコンシステム](docs/features/icons.md)** - アイコン取得・管理
- **[グループ起動](docs/features/group-launch.md)** - 複数アイテムの一括起動
- **[フォルダ取込](docs/features/folder-import.md)** - フォルダ内容のインポート
- **[アプリケーション設定](docs/features/settings.md)** - 設定項目の使い方と仕様
- **[アイテム管理](docs/features/item-management.md)** - 編集モードの操作
- **[キーボードショートカット](docs/features/keyboard-shortcuts.md)** - ショートカット一覧

### アーキテクチャ
- **[システム概要](docs/architecture/overview.md)** - プロセス構造とデータ処理
- **[データ形式](docs/architecture/data-format.md)** - データファイル形式仕様
- **[IPC通信](docs/architecture/ipc-channels.md)** - プロセス間通信
- **[ウィンドウ制御](docs/architecture/window-control.md)** - ウィンドウ管理
- **[CSSデザイン](docs/architecture/css-design.md)** - スタイル管理

### 画面仕様
- **[画面一覧](docs/screens/README.md)** - 全画面の仕様書インデックス

### テスト
- **[テストガイド](docs/testing/README.md)** - E2E・単体テストの実行方法
- **[手動テスト](docs/testing/manual-checklist.md)** - 手動テストチェックリスト

## 技術スタック・開発時の注意事項

### プラットフォーム・フレームワーク
- **Windows専用アプリケーション**（Electron + React + TypeScript + Vite）
- **テストフレームワーク**: Vitest（単体）、Playwright（E2E）

### 開発時の重要な制約
- **カスタムURIスキーマ対応**: `obsidian://`, `ms-excel://`, `vscode://` 等の非HTTPスキーマに対応
- **パスエイリアス**: `@common/*` で共通型定義にアクセス（`src/common/types.ts`）
- **CSSデザインシステム**: CSS変数ベース（`src/renderer/styles/variables.css`）。ハードコード値の使用禁止
  - 詳細な命名規則・ベストプラクティスは **[CSSデザインシステム](docs/architecture/css-design.md)** を参照
- **設定ファイルパス**: `PathManager`クラスで一元管理。環境変数`QUICK_DASH_CONFIG_DIR`でカスタマイズ可能

詳細なアーキテクチャは **[システム概要](docs/architecture/overview.md)** を参照してください。

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

**コミット・プッシュ前**には、品質チェックを実施するかユーザーに確認してください。実施する場合は、**`quality-checker`サブエージェント**を使用してください。

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


## コードレビュー

**大きな変更や重要な機能追加後**、包括的なコードレビューを実施する場合は、**`code-reviewer`サブエージェント**を使用してください。

```
Task tool with subagent_type="code-reviewer"
```

このサブエージェントは以下を自動的に実行します：
- コード品質の総合評価
- セキュリティ脆弱性の検出
- デザインパターンとベストプラクティスの確認
- パフォーマンス最適化の提案
- 保守性と技術的負債の評価
- 優先度付きの改善提案

詳細は `.claude/agents/code-reviewer.md` を参照してください。

**quality-checkerとの違い:**
- **quality-checker**: コミット前の軽量チェック（型・Lint・テスト）
- **code-reviewer**: 包括的なコードレビュー（設計・セキュリティ・パフォーマンス）

## ドキュメント更新

機能追加・変更時、ドキュメント更新を実施するかユーザーに確認してください。実施する場合は、**`documentation-updater`サブエージェント**を使用してください。

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

コミット・プッシュ前やコード変更後、E2Eテストを実施するかユーザーに確認してください。実施する場合は、**`e2e-test-runner`サブエージェント**を使用してください。

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

## カスタムコマンド構成

`.claude/commands/` 配下には、開発ワークフローを効率化するカスタムコマンドが整理されています。

### カテゴリ構成

```
.claude/commands/
├── git-workflow/       - Git操作（ブランチ作成、コミット、PR、リリース）
├── github/             - GitHub連携（Issue作成・参照）
├── refactoring/        - コード改善（対話型リファクタリング）
├── routine/            - 定期実行タスク（品質チェック、依存関係確認、テスト）
└── documentation/      - ドキュメント作成・整理
```

**合計: 15個のコマンド**

### 主要コマンド

#### git-workflow/ (3個)
- `/start-branch` - 新機能開発開始（ブランチ作成）
- `/commit-pr` - コミット・PR作成（3モード: simple/interactive/full）
- `/release-version` - バージョンリリース

#### github/ (2個)
- `/create-issue` - GitHub Issue作成
- `/read-issue` - Issue読み込み・対応方針分析

#### refactoring/ (1個)
- `/refactor` - 対話型リファクタリング（命名、複雑度、重複、パス、ファイル分割、コメント）

#### routine/ (7個)
- `/sync-and-validate` - リモート同期・総合検証
- `/review-recent-commits` - 直近のコミットを分析し品質・ドキュメント確認
- `/check-dependencies` - 依存関係更新確認
- `/audit-security` - セキュリティ監査（npm audit）
- `/quality-check-all` - 総合品質チェック
- `/test-e2e-all` - 全E2Eテスト実行
- `/verify-docs` - ドキュメントとコードの整合性検証

#### documentation/ (2個)
- `/create-screen-spec` - 画面仕様書作成
- `/organize-docs` - ドキュメント整理

### コマンド使用ガイド

#### 開発フロー
1. **新機能開始**: `/start-branch feature/xxx` でブランチ作成
2. **コード変更**: 機能を実装
3. **リファクタリング**: `/refactor` で品質改善
4. **コミット・PR**: `/commit-pr full` で品質チェック付きPR作成

#### 定期メンテナンス
- `/review-recent-commits` - 週1回、直近のコミット振り返り
- `/check-dependencies` - 週1回、依存関係確認
- `/audit-security` - 週1回、セキュリティチェック
- `/sync-and-validate` - main同期・総合検証

詳細は各コマンドファイルを参照してください。