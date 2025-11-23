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
├── fixtures/              # テスト用フィクスチャ
│   ├── e2e/              # E2E用設定ファイル
│   └── electron-app.ts   # Electronアプリフィクスチャ
├── helpers/              # ヘルパークラス
│   ├── config-file-helper.ts
│   └── test-utils.ts
└── specs/                # テスト仕様
    ├── app-launch.spec.ts
    ├── config-modification.spec.ts
    ├── first-launch-setup.spec.ts
    ├── item-display.spec.ts
    ├── item-registration.spec.ts
    ├── multi-tab.spec.ts
    ├── search.spec.ts
    └── settings-tab.spec.ts
```

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
