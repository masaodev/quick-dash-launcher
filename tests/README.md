# テスト関連ディレクトリ - 概要

テストと開発に使用するディレクトリ構成の説明です。

## ディレクトリ構成

```
tests/
├── README.md                    # このファイル
├── dev/                        # 開発用設定（手動実行用）
│   ├── minimal/               # 最小限のアイテムセット
│   ├── full/                  # フル機能セット
│   ├── full-featured/         # 全機能を含むセット
│   ├── multi-tab/            # マルチタブ機能のデモ
│   ├── with-groups/          # グループ起動のデモ
│   ├── large-dataset/        # 大量データでのパフォーマンステスト
│   └── empty/                # 空データセット
├── e2e/                        # E2Eテスト関連
│   ├── specs/                # テストスペック
│   ├── helpers/              # テストヘルパー
│   ├── fixtures/             # テストフィクスチャ（コード）
│   ├── configs/              # E2Eテスト用設定
│   │   ├── default/         # 通常のE2Eテスト用
│   │   └── first-launch/    # 初回起動テスト専用
│   └── templates/            # E2Eテスト用テンプレート
│       ├── data/            # データファイルテンプレート
│       └── settings/        # 設定ファイルテンプレート
└── unit/                       # 単体テスト
    ├── components/
    └── utils/
```

## クイックスタート

### 開発時に使う

```bash
# 最小限のセットで起動
npm run dev:minimal

# 全機能を含むセットで起動
npm run dev:full

# タブ機能のデモ
npm run dev:tabs

# グループ起動のデモ
npm run dev:groups
```

詳細は [dev/README.md](./dev/README.md) を参照してください。

### テスト実行時

各テストは自動的に対応する設定フォルダを使用します：

```bash
# 単体テスト（Vitest）
# → PathTestHelperが一時フォルダを自動作成
npm run test:unit

# E2Eテスト（Playwright）
# → tests/e2e/configs/default を使用
npm run test:e2e
```

## 詳細ドキュメント

より詳しい情報は以下を参照してください：

- **[フィクスチャガイド](../docs/testing/fixtures-guide.md)** - フィクスチャの詳細な使い方、テンプレート一覧
- **[Git管理詳細](../docs/testing/git-management.md)** - Git管理方針、コミット対象/除外ファイル
- **[開発用テンプレート](./dev/README.md)** - 開発用テンプレートの詳細
- **[テストドキュメント](../docs/testing/README.md)** - テスト全般のドキュメント
