# E2Eテスト - クイックリファレンス

QuickDashLauncherのE2Eテスト（End-to-End Test）のクイックリファレンスです。

## テスト実行コマンド

```bash
# 基本コマンド
npm run test:e2e        # ヘッドレス実行
npm run test:e2e:ui     # テストUI表示
npm run test:e2e:debug  # デバッグモード
npm run test:e2e:headed # ヘッド付き実行
npm run test:e2e:single first-launch  # 1ファイルだけ実行（引数なしで一覧表示）

# 特定のテストを実行（npx で直接実行する場合は事前に npm run build が必要）
npx playwright test tests/e2e/specs/item-registration.spec.ts
npx playwright test -g "アイテムの名前を編集できる"
```

## テストファイル構成

```
tests/e2e/
├── configs/              # テスト実行時の一時ディレクトリ（Git管理外）
│   ├── .gitignore       # 全ファイルを除外
│   ├── .gitkeep         # ディレクトリ維持用
│   └── .temp/           # テスト失敗時のデバッグ用（自動生成）
├── fixtures/            # テストフィクスチャ（TypeScriptコード）とサンプルファイル
│   ├── electron-app.ts      # 通常のElectronアプリフィクスチャ
│   ├── first-launch-app.ts  # 初回起動用フィクスチャ
│   └── bookmarks-sample.html  # ブックマークインポート用サンプル
├── helpers/             # ヘルパークラス
│   ├── config-file-helper.ts  # 設定ファイル操作ヘルパー
│   └── test-utils.ts          # テストユーティリティ
├── templates/           # テスト用テンプレート（目的別）
│   ├── base/            # 基本テンプレート（既定）
│   ├── with-tabs/       # タブ機能テスト用
│   ├── with-multi-file-tabs/  # 複数ファイルのタブ用
│   ├── with-groups/     # グループ機能テスト用
│   ├── with-shortcuts/  # ショートカット用
│   ├── with-workspace-v1/  # ワークスペース移行テスト用
│   ├── with-backup/     # バックアップ機能テスト用
│   ├── with-folder-import/  # フォルダ取込テスト用
│   ├── custom-hotkey/   # カスタムホットキーテスト用
│   ├── empty/           # 空データテスト用
│   └── first-launch/    # 初回起動テスト用
└── specs/               # テスト仕様（機能別の *.spec.ts。playwright.config.ts の testDir）
```

## テンプレートシステム

E2Eテストでは目的別のテンプレートを使用します：

- **templates/**配下に目的別のフォルダがあり、各フォルダに`datafiles/data.json`（タブ用に`data2.json`など）, `settings.json`などが含まれます
- 既定は`base`です。別のテンプレートは`test.use({ configTemplate: '...' })`または`configHelper.loadTemplate()`で指定します
- テスト実行時に`configs/.temp/`配下に一時ディレクトリが自動作成されます
- テンプレートから設定ファイルがコピーされます
- テスト成功時は自動削除、失敗時はデバッグ用に残されます

## トレース・スクリーンショット

失敗したテストのスクリーンショット・動画・トレースは`test-results/test-artifacts/`に、フィクスチャが記録するトレースは`test-results/traces/`に保存されます。

```bash
# トレースファイルを開く
npx playwright show-trace test-results/test-artifacts/<テスト名>/trace.zip
npx playwright show-trace test-results/traces/trace-<タイムスタンプ>.zip
```

## 詳細ドキュメント

より詳しい情報は以下を参照してください：

- **[テストガイド](../../docs/testing/README.md)** - E2Eテストの書き方、ConfigFileHelperの使い方、トレース機能、トラブルシューティング
- **[テスト関連ディレクトリの概要](../README.md)** - tests/ 全体の構成

## 関連リンク

- [Playwright公式ドキュメント](https://playwright.dev/)
- [Electron Testing with Playwright](https://playwright.dev/docs/api/class-electron)
