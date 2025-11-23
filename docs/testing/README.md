# テストドキュメント - QuickDashLauncher

このディレクトリには、QuickDashLauncherのテスト関連ドキュメントが含まれています。

## クイックスタート

### テスト実行コマンド

```bash
# 単体テスト（Vitest）
npm run test            # インタラクティブモード
npm run test:unit       # ワンショット実行
npm run test:coverage   # カバレッジレポート付き

# E2Eテスト（Playwright）
npm run test:e2e        # ヘッドレス実行
npm run test:e2e:ui     # テストUI表示
npm run test:e2e:debug  # デバッグモード
```

## テストの種類

### 1. 手動テスト

新機能の追加や大きな変更を行った場合、手動でチェックする項目があります。

**詳細**: [手動テストチェックリスト](./manual-checklist.md)

### 2. 単体テスト（Vitest）

個別のモジュールや関数レベルのテスト。高速で実行でき、開発中の即座なフィードバックに最適です。

- **テストファイル**: `src/**/*.test.ts`
- **ヘルパー**: `src/test/helpers/pathTestHelper.ts`
- **実行方法**: `npm run test:unit`

### 3. E2Eテスト（Playwright）

エンドツーエンドのシナリオテスト。実際のアプリケーション動作を検証します。

**詳細**: [E2Eテストガイド](./e2e-guide.md)

## テストフィクスチャ

テストや開発時に使用する設定ファイルのテンプレート集です。

**詳細**: [フィクスチャガイド](./fixtures-guide.md)

### よく使うフィクスチャ

```bash
# 最小限のセットで開発
npm run dev:minimal

# 全機能を含むセットで開発
npm run dev:full

# タブ機能のデモ
npm run dev:tabs

# グループ起動のデモ
npm run dev:groups
```

## Git管理方針

テストフィクスチャファイルのGit管理について。

**詳細**: [Git管理詳細](./git-management.md)

### 管理対象

- ✅ `data.txt`（初期テストデータ）
- ✅ テンプレートファイル（`templates/data/`, `templates/settings/`）
- ✅ README.md等のドキュメント

### 管理対象外

- ❌ `settings.json`（自動生成）
- ❌ `icons/`, `favicons/`, `custom-icons/`（自動生成）
- ❌ `backup/`（テスト実行時の一時ファイル）

## ドキュメント一覧

| ドキュメント | 説明 | 対象者 |
|------------|------|--------|
| [手動テストチェックリスト](./manual-checklist.md) | リリース前の手動テスト項目 | 開発者・QA |
| [E2Eテストガイド](./e2e-guide.md) | Playwrightを使ったE2Eテストの詳細 | 開発者 |
| [フィクスチャガイド](./fixtures-guide.md) | テスト用設定ファイルの使い方 | 開発者 |
| [Git管理詳細](./git-management.md) | フィクスチャのGit管理方針 | 開発者 |

## 関連ドキュメント

- [開発ガイド](../guides/development.md) - 開発プロセス全般
- [プロジェクト概要](../guides/project-overview.md) - プロジェクトの全体像
- [tests/e2e/README.md](../../tests/e2e/README.md) - E2Eテストの基本（クイックリファレンス）
- [tests/fixtures/README.md](../../tests/fixtures/README.md) - フィクスチャの基本（概要）
