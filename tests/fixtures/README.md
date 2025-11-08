# Test Fixtures - テスト・開発用設定テンプレート

このディレクトリには、開発・テスト時に使用する設定ファイルのテンプレートが含まれています。

## ディレクトリ構成

```
tests/fixtures/
├── README.md               # このファイル
├── test-config/            # 単体テスト用設定テンプレート
│   └── data.txt           # 単体テスト用サンプルデータ
├── dev-config/             # 開発用設定テンプレート
│   └── data.txt           # 開発用サンプルデータ
├── e2e-config/             # E2Eテスト用設定テンプレート
│   ├── README.md          # E2Eテスト用設定の説明
│   └── data.txt           # E2Eテスト用サンプルデータ
└── first-launch-config/    # 初回起動E2Eテスト専用設定
    └── data.txt           # 初回起動テスト用サンプルデータ
```

## 使い方

### 1. 開発モードでの起動（package.jsonコマンド使用）

```bash
# テスト用設定で起動
npm run dev:custom

# 開発用設定で起動
npm run dev:test
```

### 2. テスト実行時

各テストは自動的に対応する設定フォルダを使用します：

```bash
# 単体テスト（Vitest）
# → PathTestHelperが一時フォルダを自動作成
npm run test:unit

# E2Eテスト（Playwright）
# → tests/fixtures/e2e-config を使用（通常テスト）
# → tests/fixtures/first-launch-config を使用（初回起動テスト）
npm run test:e2e
```

**注:** 初回起動テストは専用の`first-launch-config`フォルダを使用することで、他のE2Eテストと分離されています。これにより、並列実行時の競合を防いでいます。

## 参考資料

- [設定パス変更ガイド](../../docs/guides/config-path.md)
- [開発ガイド](../../docs/guides/development.md)
