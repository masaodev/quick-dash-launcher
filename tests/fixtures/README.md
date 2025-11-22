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
├── dev-templates/          # 開発用テンプレート集（手動実行用）⭐ NEW
│   ├── QUICKSTART.md      # クイックスタートガイド
│   ├── minimal/           # 最小限のアイテムセット
│   ├── full-featured/     # 全機能を含むセット
│   ├── multi-tab/         # マルチタブ機能のデモ
│   ├── with-groups/       # グループ起動のデモ
│   ├── large-dataset/     # 大量データでのパフォーマンステスト
│   └── empty/             # 空データセット
├── data-templates/         # E2Eテスト用データテンプレート
│   └── (base.txt, with-group.txt, etc.)
├── settings-templates/     # E2Eテスト用設定テンプレート
│   └── (default.json, with-tabs.json, etc.)
├── e2e-config/             # E2Eテスト用設定テンプレート
│   ├── README.md          # E2Eテスト用設定の説明
│   └── data.txt           # E2Eテスト用サンプルデータ
└── first-launch-config/    # 初回起動E2Eテスト専用設定
    └── data.txt           # 初回起動テスト用サンプルデータ
```

## 🚀 クイックスタート

### 開発用テンプレートで手動実行（推奨）⭐ NEW

開発時に汎用的なテンプレートを使って素早くテストできます：

```bash
# 最小限のセットで起動
npm run dev:minimal

# 全機能を含むセットで起動
npm run dev:full

# タブ機能のデモ
npm run dev:tabs

# グループ起動のデモ
npm run dev:groups

# 大量データでパフォーマンステスト
npm run dev:large

# 空データで初期状態確認
npm run dev:empty
```

📖 詳しい使い方は **[dev-templates/QUICKSTART.md](./dev-templates/QUICKSTART.md)** をご覧ください。

### 従来の開発モードでの起動

```bash
# カスタム設定で起動
npm run dev:custom

# テスト用設定で起動
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
