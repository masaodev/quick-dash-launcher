# CLAUDE.md

## プロジェクト概要（WHAT）

**QuickDashLauncher** - 起動ホットキー（Alt+Space）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスするWindows用ランチャー。

**技術スタック**: Electron + React + TypeScript + Vite
**テスト**: Vitest（単体）、Playwright（E2E）

## ディレクトリ構造

```
src/
├── main/           # Electronメインプロセス（preload.ts含む）
├── renderer/       # React UI（コンポーネント、フック、状態管理）
├── common/         # 共通型定義（@common/*エイリアス）
└── test/           # テストヘルパー
docs/               # 詳細ドキュメント
tests/e2e/          # E2Eテスト
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

## コミット・PR

- 作業ブランチへのコミットと PR 作成までは進めてよい。main へのマージとリリースはユーザーの承認を得てから行う
- PR では CI（型チェック・lint・単体テスト）が走る。編集時は hook（`.claude/settings.json`）が eslint・prettier を自動で実行する
- コードレビューは組み込みの `/code-review` を使う

## サブエージェント

| エージェント | 用途 |
|-------------|------|
| `e2e-test-runner` | E2Eテスト実行・失敗分析（出力が大きいので分離する） |
| `documentation-updater` | 機能変更時のドキュメント更新 |
| `doc-verifier` | ドキュメント 1 本をコードと照合し、指定の範囲で直して報告（`docs-check` スキルが、照合する文書が多いときに使う） |

## カスタムコマンド・スキル

- `/release-version` - バージョン更新・タグ作成・リリース
- `/create-issue` - GitHub Issue の作成
- `/create-screen-spec` - 画面仕様書の作成
- `docs-check`（スキル） - docs の点検と修正（体系・画面一覧の網羅・リンク・コードとの食い違い。`quick`／`full`、`fix`／`fix-all` で深さと直す範囲を選ぶ）

## ドキュメント

詳細は **[docs/README.md](docs/README.md)** を参照。

- [開発ガイド](docs/setup/development.md) - 技術スタック・開発フロー・多重起動
- [システム概要](docs/architecture/overview.md) - アーキテクチャ
- [CSSデザイン](docs/architecture/css-design.md) - スタイル規則
- [テストガイド](docs/testing/README.md) - テスト実行方法
