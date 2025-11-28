# テストフィクスチャガイド

テストや開発時に使用する設定ファイルのテンプレート集とその使い方を説明します。

## フィクスチャの概要

`tests/` ディレクトリには、テストや開発時に使用する設定ファイルのテンプレートが含まれています。これにより：

- 本番環境の設定に影響を与えずにテスト・開発が可能
- 既知のテストデータで再現性のあるテストを実現
- チーム全体で共通のテストデータを共有

## ディレクトリ構成

```
tests/
├── README.md                    # 全体概要
├── dev/                        # 開発用設定（手動実行用）
│   ├── README.md
│   ├── minimal/               # 最小限のアイテムセット
│   ├── full/                  # フル機能セット
│   ├── full-featured/         # 全機能を含むセット
│   ├── multi-tab/            # マルチタブ機能のデモ
│   ├── with-groups/          # グループ起動のデモ
│   ├── large-dataset/        # 大量データでのパフォーマンステスト
│   └── empty/                # 空データセット
├── e2e/                        # E2Eテスト関連すべて
│   ├── specs/                # テストスペック
│   ├── helpers/              # テストヘルパー
│   ├── fixtures/             # テストフィクスチャ(コード)
│   ├── configs/              # E2Eテスト用設定
│   │   ├── default/
│   │   │   ├── README.md
│   │   │   └── data.txt
│   │   └── first-launch/
│   │       └── data.txt
│   └── templates/            # E2Eテスト用テンプレート
│       ├── data/            # データファイルテンプレート
│       │   ├── base.txt
│       │   ├── with-group.txt
│       │   ├── with-folder-import.txt
│       │   └── empty.txt
│       └── settings/        # 設定ファイルテンプレート
│           ├── default.json
│           ├── custom-hotkey.json
│           ├── with-tabs.json
│           └── with-backup.json
└── unit/                       # 単体テスト
```

## クイックスタート

### 開発用テンプレートで手動実行（推奨）

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

### テンプレート一覧

| テンプレート名 | 説明 | 用途 |
|-------------|------|------|
| `minimal` | 最小限のアイテムセット（5個） | 基本動作確認、バグ修正 |
| `full-featured` | 全機能を含む（30個+グループ） | デモ、機能確認 |
| `multi-tab` | 3タブ構成 | タブ機能の確認 |
| `with-groups` | グループ起動特化 | グループ機能の確認 |
| `large-dataset` | 大量データ（100個以上） | パフォーマンステスト |
| `empty` | 空データ | 初期状態の確認 |

### 使用シーン別の選び方

#### バグ修正の動作確認

```bash
npm run dev:minimal
```
- シンプルなデータセットで問題を切り分けやすい
- 素早く起動してテストできる

#### クライアントへのデモ

```bash
npm run dev:full
```
- すべての機能を網羅
- グループ起動などの高度な機能も含む
- 見栄えの良いデモができる

#### タブ機能の開発

```bash
npm run dev:tabs
```
- 3つのタブで構成
- タブごとに異なるカテゴリのアイテム
- タブ切り替えの動作確認に最適

#### グループ起動機能の開発

```bash
npm run dev:groups
```
- 複数のグループアイテムを含む
- グループ起動の挙動を確認しやすい

#### パフォーマンステスト

```bash
npm run dev:large
```
- 100個以上のアイテム
- 検索・スクロールの性能確認
- 大量データでの安定性テスト

#### 初期状態のテスト

```bash
npm run dev:empty
```
- アイテムが0個の状態
- 空状態のUIを確認
- エラーハンドリングのテスト

## E2Eテストでのフィクスチャ使用

### ConfigFileHelperクラス

E2Eテストで設定ファイルを操作するためのヘルパークラスです。

#### 基本的な使い方

```typescript
import { ConfigFileHelper } from '../helpers/config-file-helper';
import path from 'path';

test('基本テンプレートを読み込む', async ({ mainWindow }) => {
  const configDir = path.join(process.cwd(), 'tests', 'e2e', 'configs', 'default');
  const configHelper = new ConfigFileHelper(configDir);

  // データテンプレートを読み込み
  configHelper.loadDataTemplate('base');

  // アプリをリロード
  await mainWindow.reload();

  // テストを実行...
});
```

#### データテンプレート

| ファイル名 | 説明 | 用途 |
|-----------|------|------|
| `base.txt` | 基本的なアイテムセット | 標準的なテストケースで使用 |
| `with-group.txt` | グループアイテムを含む | グループ起動機能のテスト |
| `with-folder-import.txt` | フォルダ取込アイテムを含む | フォルダ取込機能のテスト |
| `empty.txt` | 空のデータファイル | アイテムがない状態のテスト |

#### 設定テンプレート

| ファイル名 | 説明 | 主な設定 |
|-----------|------|---------|
| `default.json` | デフォルト設定 | Alt+Space、600x400、タブ無効 |
| `custom-hotkey.json` | カスタムホットキー設定 | Ctrl+Shift+L |
| `with-tabs.json` | タブ機能有効 | 3つのタブ（メイン、サブ1、サブ2） |
| `with-backup.json` | バックアップ機能有効 | 自動バックアップ、3分間隔、10件保持 |

#### ConfigFileHelperの主なメソッド

```typescript
// データファイル操作
configHelper.readData()                    // data.txt読み込み
configHelper.writeData(lines)              // data.txt書き込み
configHelper.loadDataTemplate('base')      // テンプレート読み込み

// 設定ファイル操作
configHelper.readSettings()                // settings.json読み込み
configHelper.updateSetting('key', value)   // 設定を1つ更新
configHelper.updateSettings({ ... })       // 複数の設定を更新
configHelper.loadSettingsTemplate('default') // テンプレート読み込み

// バックアップと復元
configHelper.backupAll()                   // 全ファイルをバックアップ
configHelper.restoreAll()                  // バックアップから復元
```

### テストでの使用例

```typescript
import { test } from '@playwright/test';
import { ConfigFileHelper } from '../helpers/config-file-helper';

test.beforeEach(async () => {
  const configHelper = new ConfigFileHelper(configDir);

  // テスト開始前にバックアップ
  configHelper.backupAll();

  // テンプレートを読み込み
  configHelper.loadDataTemplate('with-group');
  configHelper.loadSettingsTemplate('default');
});

test.afterEach(async () => {
  const configHelper = new ConfigFileHelper(configDir);

  // テスト後に元に戻す
  configHelper.restoreAll();
});

test('グループ起動機能のテスト', async ({ mainWindow }) => {
  // テストコード
});
```

## カスタムテンプレートの作成

独自のテンプレートを作成する場合：

### 開発用テンプレート

1. **新しいフォルダを作成**
   ```bash
   mkdir tests/dev/my-custom
   ```

2. **data.txtを作成**
   ```
   # 自分用のアイテムを記述
   My App,C:\path\to\app.exe
   My Website,https://example.com
   ```

3. **settings.json を作成（オプション）**
   ```json
   {
     "hotkey": "Alt+Space",
     "windowWidth": 600,
     "windowHeight": 400
   }
   ```

4. **起動**
   ```bash
   # PowerShellの場合
   $env:QUICK_DASH_CONFIG_DIR="./tests/dev/my-custom"; npm run dev
   ```

### E2Eテスト用テンプレート

新しいテストケースに必要なデータセットがある場合：

1. `tests/e2e/templates/data/` に新しい `.txt` ファイルを作成
2. 必要なデータを記述（data.txtと同じ形式）
3. `configHelper.loadDataTemplate('ファイル名（拡張子なし）')` で読み込み

## テンプレートのリセット

開発中にデータや設定を変更した後、元のテンプレートに戻したい場合：

```bash
# 方法1: settings.jsonだけ削除（再起動で再生成）
rm tests/dev/minimal/settings.json

# 方法2: iconsフォルダも削除（完全リセット）
rm -rf tests/dev/minimal/icons/
rm -rf tests/dev/minimal/favicons/
rm tests/dev/minimal/settings.json

# 方法3: Gitでリセット（テンプレートファイルを管理している場合）
git checkout tests/dev/minimal/
```

## 注意事項

### 本番環境への影響なし

これらのテンプレートはすべて`tests/`内にあり、本番環境の設定には影響しません。

本番環境の設定は `%APPDATA%/QuickDashLauncher/` にあります。

### Gitで管理されるもの

- ✅ data.txt（各テンプレートの初期データ）
- ✅ settings.json（各テンプレートの初期設定）
- ✅ README.md

### Gitで管理されないもの

- ❌ icons/, favicons/, custom-icons/（自動生成）
- ❌ backup/（バックアップフォルダ）
- ❌ *.backup（バックアップファイル）

詳細は [Git管理詳細](./git-management.md) を参照してください。

## トラブルシューティング

### Q: テンプレートを変更したのに反映されない

A: アプリをリロードしてください（開発者ツールで `Ctrl+R`）、または再起動してください。

### Q: 設定が保存されてしまう

A: `settings.json` は `.gitignore` で除外されていますが、テンプレートフォルダ内の `settings.json` は管理対象です。変更したくない場合は、別のフォルダにコピーして使用してください。

### Q: 本番環境の設定を壊したくない

A: 心配無用です。これらのテンプレートは `tests/` 内にあり、本番環境（`%APPDATA%/QuickDashLauncher/`）とは完全に分離されています。

### Q: 複数のテンプレートを同時に使いたい

A: 同じホットキーを使用するため、複数のインスタンスを同時に起動することは推奨しません。テンプレートを切り替えながら使用してください。

## 関連ドキュメント

- [E2Eテストガイド](./e2e-guide.md) - E2Eテストの実行方法
- [Git管理詳細](./git-management.md) - フィクスチャのGit管理方針
- [tests/README.md](../../tests/README.md) - テスト全体の基本概要
- [tests/dev/README.md](../../tests/dev/README.md) - 開発用テンプレートの詳細
