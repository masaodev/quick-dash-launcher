# E2Eテスト - クイックリファレンス

QuickDashLauncherのE2Eテスト（End-to-End Test）のクイックリファレンスです。

## テスト実行コマンド

```bash
# 基本コマンド
npm run test:e2e        # ヘッドレス実行
npm run test:e2e:ui     # テストUI表示
npm run test:e2e:debug  # デバッグモード
npm run test:e2e:headed # ヘッド付き実行

# 特定のテストを実行
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
├── fixtures/            # テストフィクスチャ（TypeScriptコード）
│   ├── electron-app.ts      # 通常のElectronアプリフィクスチャ
│   └── first-launch-app.ts  # 初回起動用フィクスチャ
├── helpers/             # ヘルパークラス
│   ├── config-file-helper.ts  # 設定ファイル操作ヘルパー
│   └── test-utils.ts          # テストユーティリティ
├── templates/           # テスト用テンプレート（目的別）
│   ├── base/            # 基本テンプレート
│   ├── with-tabs/       # タブ機能テスト用
│   ├── empty/           # 空データテスト用
│   ├── with-groups/     # グループ機能テスト用
│   ├── with-backup/     # バックアップ機能テスト用
│   ├── custom-hotkey/   # カスタムホットキーテスト用
│   ├── with-folder-import/  # フォルダ取込テスト用
│   └── first-launch/    # 初回起動テスト用
└── specs/               # テスト仕様
    ├── alert-dialog.spec.ts
    ├── app-launch.spec.ts
    ├── config-modification.spec.ts
    ├── confirm-dialog.spec.ts
    ├── first-launch-setup.spec.ts
    ├── item-display.spec.ts
    ├── item-registration.spec.ts
    ├── item-tab-change.spec.ts
    ├── multi-tab.spec.ts
    ├── search.spec.ts
    └── settings-tab.spec.ts
```

## テンプレートシステム

E2Eテストでは目的別のテンプレートを使用します：

- **templates/**配下に目的別のフォルダがあり、各フォルダに`data.txt`, `data2.txt`, `settings.json`などが含まれます
- テスト実行時に`configs/.temp/`配下に一時ディレクトリが自動作成されます
- テンプレートから設定ファイルがコピーされます
- テスト成功時は自動削除、失敗時はデバッグ用に残されます

## トレース・レポート

```bash
# HTMLレポートを開く
npx playwright show-report test-results/html-report

# トレースファイルを開く
npx playwright show-trace test-results/test-artifacts/<テスト名>/trace.zip
```

## 詳細ドキュメント

より詳しい情報は以下を参照してください：

- **[E2Eテストガイド](../../docs/testing/e2e-guide.md)** - 詳細な使い方、トレース機能、トラブルシューティング
- **[フィクスチャガイド](../../docs/testing/fixtures-guide.md)** - テストフィクスチャの使い方
- **[テストドキュメント](../../docs/testing/README.md)** - テスト全般のドキュメント

## 関連リンク

- [Playwright公式ドキュメント](https://playwright.dev/)
- [Electron Testing with Playwright](https://playwright.dev/docs/api/class-electron)
