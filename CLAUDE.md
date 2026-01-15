# CLAUDE.md

## プロジェクト概要（WHAT）

**QuickDashLauncher** - グローバルホットキー（Alt+Space）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスするWindows用ランチャー。

**技術スタック**: Electron + React + TypeScript + Vite
**テスト**: Vitest（単体）、Playwright（E2E）

## ディレクトリ構造

```
src/
├── main/           # Electronメインプロセス
├── renderer/       # React UI（コンポーネント、フック、状態管理）
├── preload/        # IPC橋渡し
├── common/         # 共通型定義（@common/*エイリアス）
└── test/           # テストヘルパー
docs/               # 詳細ドキュメント
e2e/                # E2Eテスト
```

## 開発コマンド（HOW）

```bash
npm run dev              # 開発モード起動
npm run dev:test         # テストデータで起動
npm run build            # ビルド
npm run test:unit        # 単体テスト
npm run test:e2e         # E2Eテスト
npm run lint && npm run type-check  # 品質チェック
```

## 設計方針（WHY）

- **CSSデザインシステム**: CSS変数ベース（`src/renderer/styles/variables.css`）。ハードコード値禁止
- **パス管理**: `PathManager`クラスで一元管理
- **カスタムURIスキーマ対応**: `obsidian://`, `vscode://`等の非HTTPスキーマをサポート
- **Electron MCP使用**: QuickDashLauncherのブラウザ操作には`electron-playwright`を使用（Chrome MCPではない）

## コミット前の確認事項

- コミット・プッシュ前にユーザー承認を得る
- 品質チェックを実施するか確認する

## サブエージェント

| エージェント | 用途 |
|-------------|------|
| `quality-checker` | コミット前の軽量チェック（型・Lint） |
| `code-reviewer` | 包括的コードレビュー（設計・セキュリティ） |
| `e2e-test-runner` | E2Eテスト実行・失敗分析 |
| `documentation-updater` | 機能変更時のドキュメント更新 |

## カスタムコマンド（/スラッシュコマンド）

- `/start-branch` - ブランチ作成
- `/commit-pr` - コミット・PR作成
- `/refactor` - 対話型リファクタリング
- `/quality-check-all` - 総合品質チェック
- `/test-e2e-all` - 全E2Eテスト

全コマンド一覧: `.claude/commands/`

## ドキュメント

詳細は **[docs/README.md](docs/README.md)** を参照。

- [はじめに](docs/setup/getting-started.md) - 環境構築
- [開発ガイド](docs/setup/development.md) - 開発フロー・多重起動
- [システム概要](docs/architecture/overview.md) - アーキテクチャ
- [CSSデザイン](docs/architecture/css-design.md) - スタイル規則
- [テストガイド](docs/testing/README.md) - テスト実行方法
