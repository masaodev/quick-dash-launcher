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
│   ├── fixtures/             # テストフィクスチャ（TypeScriptコード）
│   ├── configs/              # E2Eテスト実行時の一時ディレクトリ（Git管理外）
│   │   ├── .gitignore        # 全ファイルを除外
│   │   ├── .gitkeep          # ディレクトリ維持用
│   │   └── .temp/            # テスト失敗時のデバッグ用（自動生成）
│   └── templates/            # E2Eテスト用テンプレート（目的別）
│       ├── base/             # 基本テンプレート
│       │   ├── data.txt
│       │   └── settings.json
│       ├── with-tabs/        # タブ機能テスト用
│       │   ├── data.txt
│       │   ├── data2.txt
│       │   └── settings.json
│       ├── empty/            # 空データテスト用
│       ├── with-groups/      # グループ機能テスト用
│       ├── with-backup/      # バックアップ機能テスト用
│       ├── custom-hotkey/    # カスタムホットキーテスト用
│       ├── with-folder-import/  # フォルダ取込テスト用
│       └── first-launch/     # 初回起動テスト用
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

各テストは自動的に一時ディレクトリを作成して使用します：

```bash
# 単体テスト（Vitest）
# → PathTestHelperが一時フォルダを自動作成
npm run test:unit

# E2Eテスト（Playwright）
# → tests/e2e/configs/.temp/ 配下に一時ディレクトリを自動作成
# → テンプレートから設定ファイルをコピー
# → テスト成功時は自動削除、失敗時はデバッグ用に残す
npm run test:e2e
```

## 詳細ドキュメント

より詳しい情報は以下を参照してください：

- **[フィクスチャガイド](../docs/testing/fixtures-guide.md)** - フィクスチャの詳細な使い方、テンプレート一覧
- **[Git管理詳細](../docs/testing/git-management.md)** - Git管理方針、コミット対象/除外ファイル
- **[開発用テンプレート](./dev/README.md)** - 開発用テンプレートの詳細
- **[テストドキュメント](../docs/testing/README.md)** - テスト全般のドキュメント
