# 開発用テンプレート

開発時にテストデータとして使用できるテンプレートファイルです。

`npm run dev:test` はこのフォルダの `full` を設定フォルダとして起動します。dev / dev2 / dev:test のポート・ホットキー・設定フォルダの違いは **[開発ガイド - 多重起動](../../docs/setup/development.md#多重起動)** を参照してください。

## テンプレート一覧

このディレクトリには、以下のテンプレートが含まれています：

| テンプレート | 説明 | 用途 |
| --- | --- | --- |
| `full` | 複数タブ・ワークスペースの設定入り | デモ・機能確認（`npm run dev:test` が使う。下記） |

E2E テスト用のテンプレートは `tests/e2e/templates/` にあります（[tests/e2e/README.md](../e2e/README.md)）。

### full

`npm run dev:test` で起動する設定フォルダです。

- 起動ホットキーは Ctrl+Alt+T、Vite のポートは 9003（`dev`・`dev2` と重ならない）
- タブは「メイン」「仕事」「プライベート」の 3 つ（`datafiles/data.json`・`data2.json`・`data3.json`）
- バックアップは無効（テストデータを書き換えないため）
- 開発モードで起動するとリモートデバッグポート 9222 が開き、Playwright MCP から操作できる（[テストガイド - ブラウザ自動操作](../../docs/testing/README.md#3-ブラウザ自動操作playwright-mcp)）

起動すると、アプリがこのフォルダに設定ファイル用の `README.md` と `schemas/` を書き出します。履歴・ワークスペース・アイコンキャッシュなどと同じく実行時にできるファイルなので、git では管理しません（`.gitignore`）。

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
