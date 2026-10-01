# 開発用テンプレート

開発時にテストデータとして使用できるテンプレートファイルです。

## 開発用インスタンス（v0.5.3以降）

v0.5.3以降、開発時に複数のインスタンスを同時に起動できるようになりました：

```bash
npm run dev        # メイン開発環境（ポート9001、ホットキー: Ctrl+Alt+A）
npm run dev2       # 比較検証用（ポート9002、ホットキー: Ctrl+Alt+S）
npm run dev:test   # テストデータで起動（全機能を含む）
```

各インスタンスは完全に独立しており、異なる設定・データファイル・キャッシュを持ちます。

詳細は **[開発ガイド - 多重起動](../../docs/setup/development.md#多重起動)** を参照してください。

## テンプレート一覧

このディレクトリには、以下のテンプレートが含まれています：

| テンプレート | 説明 | 用途 |
|------------|------|------|
| `full` | 全機能を含む（複数タブ・グループ・ワークスペース） | デモ・機能確認（`npm run dev:test` が使う。詳細は [full/README.md](./full/README.md)） |

E2E テスト用のテンプレートは `tests/e2e/templates/` にあります（[tests/e2e/README.md](../e2e/README.md)）。

## カスタムテンプレートの作成

独自のテンプレートを作成する場合：

```bash
# 1. 新しいフォルダを作成
mkdir tests/dev/my-custom

# 2. datafiles/data.json を作成
# 自分用のアイテムを記述（形式は docs/architecture/file-formats/data-format.md）

# 3. settings.jsonを作成（オプション）

# 4. 起動
# PowerShell:
$env:QUICK_DASH_CONFIG_DIR="./tests/dev/my-custom"; npm run dev

# Bash:
QUICK_DASH_CONFIG_DIR=./tests/dev/my-custom npm run dev
```

## 詳細ドキュメント

より詳しい情報は以下を参照してください：

- **[開発ガイド](../../docs/setup/development.md)** - 開発フロー・多重起動の詳細
- **[テストドキュメント](../../docs/testing/README.md)** - テスト全般のドキュメント
