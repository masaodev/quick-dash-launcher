# テスト関連ディレクトリ - 概要

テストと開発に使用するディレクトリ構成の説明です。

## ディレクトリ構成

```
tests/
├── README.md                    # このファイル
├── dev/                        # 開発用設定（手動実行用）
│   ├── full/                  # 全機能を含むセット（npm run dev:test が使用）
│   └── with-groups/          # グループ起動のデモ（QUICK_DASH_CONFIG_DIR で指定して起動）
├── e2e/                        # E2Eテスト関連
│   ├── specs/                # テストスペック（*.spec.ts）
│   ├── helpers/              # テストヘルパー
│   ├── fixtures/             # テストフィクスチャ（TypeScriptコード）とサンプルファイル
│   ├── configs/              # E2Eテスト実行時の一時ディレクトリ（Git管理外）
│   │   ├── .gitignore        # 全ファイルを除外
│   │   ├── .gitkeep          # ディレクトリ維持用
│   │   └── .temp/            # テスト失敗時のデバッグ用（自動生成）
│   └── templates/            # E2Eテスト用テンプレート（目的別）
│       ├── base/             # 基本テンプレート
│       │   ├── datafiles/data.json
│       │   └── settings.json
│       ├── with-tabs/        # タブ機能テスト用
│       │   ├── datafiles/data.json, data2.json
│       │   └── settings.json
│       ├── with-multi-file-tabs/  # 複数ファイルのタブ用
│       ├── with-groups/      # グループ機能テスト用
│       ├── with-shortcuts/   # ショートカット用
│       ├── with-workspace-v1/  # ワークスペース移行テスト用
│       ├── with-backup/      # バックアップ機能テスト用
│       ├── with-folder-import/  # フォルダ取込テスト用
│       ├── custom-hotkey/    # カスタムホットキーテスト用
│       ├── empty/            # 空データテスト用
│       └── first-launch/     # 初回起動テスト用
└── unit/                       # 単体テスト（Vitest。src/**/*.test.ts も対象）
    ├── main/                  # メインプロセス側（config など）
    ├── renderer/              # レンダラー側
    ├── *.test.ts
    └── setup.ts               # Vitest のセットアップ
```

## クイックスタート

### 開発時に使う

```bash
# 開発用データ（tests/dev/full）で起動
npm run dev:test

# 通常の開発インスタンス（インスタンスごとの設定ディレクトリを使う）
npm run dev
npm run dev2   # 比較検証用の2つ目
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

- **[テストガイド](../docs/testing/README.md)** - テスト全般（テンプレート一覧、E2Eテストの書き方、トレース、Git管理方針）
- **[E2Eテスト クイックリファレンス](./e2e/README.md)** - E2Eテストの実行コマンドと構成
- **[開発用テンプレート](./dev/README.md)** - 開発用テンプレートの詳細
- **[開発ガイド - 多重起動](../docs/setup/development.md#多重起動)** - dev / dev2 / dev:test の違い
