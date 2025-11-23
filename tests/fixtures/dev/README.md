# 開発用テンプレート - 手動実行用

開発時に手動で読み込んで実行できるテンプレートファイルです。

## テンプレート一覧

| コマンド | テンプレート | 説明 | 用途 |
|---------|------------|------|------|
| `npm run dev:minimal` | minimal | 最小限のアイテム（5個） | 基本動作確認 |
| `npm run dev:full` | full-featured | 全機能を含む（30個+グループ） | デモ・機能確認 |
| `npm run dev:tabs` | multi-tab | 3タブ構成 | タブ機能の確認 |
| `npm run dev:groups` | with-groups | グループ起動特化 | グループ機能の確認 |
| `npm run dev:large` | large-dataset | 大量データ（100個以上） | パフォーマンステスト |
| `npm run dev:empty` | empty | 空データ | 初期状態の確認 |

## 使い方

### 最も簡単な方法（推奨）

```bash
# 最小限のセットで起動
npm run dev:minimal

# 全機能を試す
npm run dev:full

# タブ機能を確認
npm run dev:tabs
```

### カスタムテンプレートの作成

独自のテンプレートを作成する場合：

```bash
# 1. 新しいフォルダを作成
mkdir tests/fixtures/dev/my-custom

# 2. data.txtを作成
# 自分用のアイテムを記述

# 3. settings.jsonを作成（オプション）

# 4. 起動（PowerShell）
$env:QUICK_DASH_CONFIG_DIR="./tests/fixtures/dev/my-custom"; npm run dev
```

## 詳細ドキュメント

より詳しい情報は以下を参照してください：

- **[フィクスチャガイド](../../../docs/testing/fixtures-guide.md)** - 詳細な使い方、全テンプレート一覧
- **[Git管理詳細](../../../docs/testing/git-management.md)** - Git管理方針
- **[テストドキュメント](../../../docs/testing/README.md)** - テスト全般のドキュメント
