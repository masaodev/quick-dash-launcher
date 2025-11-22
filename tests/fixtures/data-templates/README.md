# Data Templates - データファイルテンプレート

このディレクトリには、E2Eテストで使用するdata.txtのテンプレートファイルが含まれています。

## テンプレート一覧

| ファイル名 | 説明 | 用途 |
|-----------|------|------|
| `base.txt` | 基本的なアイテムセット | 標準的なテストケースで使用 |
| `with-group.txt` | グループアイテムを含む | グループ起動機能のテスト |
| `with-folder-import.txt` | フォルダ取込アイテムを含む | フォルダ取込機能のテスト |
| `empty.txt` | 空のデータファイル | アイテムがない状態のテスト |

## 使い方

### ConfigFileHelperを使用してテンプレートを読み込む

```typescript
import { ConfigFileHelper } from '../helpers/config-file-helper';
import path from 'path';

test('基本テンプレートを読み込む', async ({ mainWindow }) => {
  const configDir = path.join(process.cwd(), 'tests', 'fixtures', 'e2e-config');
  const configHelper = new ConfigFileHelper(configDir);

  // テンプレートを読み込み
  configHelper.loadDataTemplate('base');

  // アプリをリロード
  await mainWindow.reload();

  // テストを実行...
});
```

## 新しいテンプレートの追加

新しいテストケースに必要なデータセットがある場合、このディレクトリに新しいテンプレートファイルを追加できます。

1. `tests/fixtures/data-templates/` に新しい `.txt` ファイルを作成
2. 必要なデータを記述（data.txtと同じ形式）
3. `configHelper.loadDataTemplate('ファイル名（拡張子なし）')` で読み込み

## 注意事項

- テンプレートファイルは実際のdata.txtと同じ形式で記述してください
- コメント行（`//` で始まる行）は自由に追加できます
- テンプレートファイルは読み取り専用として扱われ、テスト実行中に変更されることはありません
