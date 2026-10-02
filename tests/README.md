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
│   └── templates/            # E2Eテスト用テンプレート（目的別。一覧は e2e/README.md）
└── unit/                       # 単体テスト（Vitest。src/**/*.test.ts も対象）
    ├── main/                  # メインプロセス側（config など）
    ├── renderer/              # レンダラー側
    ├── *.test.ts
    └── setup.ts               # Vitest のセットアップ
```

## 詳細ドキュメント

テストの実行コマンド・書き方は、このフォルダではなくテストガイドにまとめています。

- **[テストガイド](../docs/testing/README.md)** - テスト全般（実行コマンド、E2Eテストの書き方、トレース、Git管理方針、トラブルシューティング）
- **[E2Eテストの構成](./e2e/README.md)** - フィクスチャ・ヘルパー・テンプレートの構成
- **[開発用テンプレート](./dev/README.md)** - 開発用テンプレートの詳細
- **[開発ガイド - 多重起動](../docs/setup/development.md#多重起動)** - dev / dev2 / dev:test の違い
