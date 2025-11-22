# Settings Templates - 設定ファイルテンプレート

このディレクトリには、E2Eテストで使用するsettings.jsonのテンプレートファイルが含まれています。

## テンプレート一覧

| ファイル名 | 説明 | 主な設定 |
|-----------|------|---------|
| `default.json` | デフォルト設定 | Alt+Space、600x400、タブ無効 |
| `custom-hotkey.json` | カスタムホットキー設定 | Ctrl+Shift+L |
| `with-tabs.json` | タブ機能有効 | 3つのタブ（メイン、サブ1、サブ2） |
| `with-backup.json` | バックアップ機能有効 | 自動バックアップ、3分間隔、10件保持 |

## 使い方

### ConfigFileHelperを使用してテンプレートを読み込む

```typescript
import { ConfigFileHelper } from '../helpers/config-file-helper';
import path from 'path';

test('カスタムホットキー設定を読み込む', async ({ electronApp }) => {
  const configDir = path.join(process.cwd(), 'tests', 'fixtures', 'e2e-config');
  const configHelper = new ConfigFileHelper(configDir);

  // テンプレートを読み込み
  configHelper.loadSettingsTemplate('custom-hotkey');

  // 設定が反映されていることを確認
  const settings = configHelper.readSettings();
  expect(settings.hotkey).toBe('Ctrl+Shift+L');
});
```

### 個別設定を変更する場合

```typescript
// 特定の設定項目だけを変更
configHelper.updateSetting('autoLaunch', true);

// 複数の設定項目を一括変更
configHelper.updateSettings({
  windowWidth: 800,
  windowHeight: 600,
  backupEnabled: true,
});
```

## 設定項目の詳細

settings.jsonに含まれる主な設定項目:

- **hotkey**: グローバルホットキー（例: 'Alt+Space'）
- **windowWidth / windowHeight**: 通常モードのウィンドウサイズ
- **editModeWidth / editModeHeight**: 編集モードのウィンドウサイズ
- **autoLaunch**: Windows起動時の自動起動
- **backupEnabled**: バックアップ機能の有効/無効
- **backupOnStart**: アプリ起動時のバックアップ
- **backupOnEdit**: データ編集時のバックアップ
- **backupInterval**: バックアップ間隔（分）
- **backupRetention**: バックアップ保持件数
- **showDataFileTabs**: タブ表示の有効/無効
- **defaultFileTab**: デフォルトタブ
- **dataFileTabs**: タブ設定の配列

詳細は `src/common/types.ts` の `AppSettings` インターフェースを参照してください。

## 新しいテンプレートの追加

新しいテストケースに必要な設定セットがある場合、このディレクトリに新しいテンプレートファイルを追加できます。

1. `tests/fixtures/settings-templates/` に新しい `.json` ファイルを作成
2. 必要な設定を記述（JSON形式）
3. `configHelper.loadSettingsTemplate('ファイル名（拡張子なし）')` で読み込み

## 注意事項

- テンプレートファイルは有効なJSON形式で記述してください
- 必須項目はすべて含めることを推奨（デフォルト値を参考に）
- テンプレートファイルは読み取り専用として扱われ、テスト実行中に変更されることはありません
- テスト環境では一部の設定（グローバルホットキーなど）は環境変数で無効化される場合があります
