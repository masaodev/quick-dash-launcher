# 開発用テンプレート - 手動実行用

このディレクトリには、開発時に手動で読み込んで実行できるテンプレートファイルが含まれています。

## 📁 テンプレート一覧

| テンプレート名 | 説明 | 用途 |
|-------------|------|------|
| `minimal` | 最小限のアイテムセット | 基本動作確認 |
| `full-featured` | 全機能を網羅したサンプル | 機能デモ・テスト |
| `multi-tab` | マルチタブ機能のサンプル | タブ機能の動作確認 |
| `with-groups` | グループ起動のサンプル | グループ機能の動作確認 |
| `large-dataset` | 大量アイテムのサンプル | パフォーマンステスト |
| `empty` | 空のデータセット | 初期状態の確認 |

## 🚀 使い方

### 方法1: npmスクリプトで直接起動（推奨）

新しいnpmスクリプトを使用して、テンプレートを指定して起動できます。

```bash
# 最小限のセットで起動
npm run dev:minimal

# 全機能を含むセットで起動
npm run dev:full

# マルチタブ機能で起動
npm run dev:tabs

# グループ起動機能で起動
npm run dev:groups

# 大量データで起動
npm run dev:large

# 空データで起動
npm run dev:empty
```

### 方法2: 手動コピー方式

テンプレートを手動でコピーして使用する方法です。

```bash
# 1. 使いたいテンプレートをdev-configにコピー
cp tests/fixtures/dev-templates/minimal/data.txt tests/fixtures/dev-config/
cp tests/fixtures/dev-templates/minimal/settings.json tests/fixtures/dev-config/

# 2. 開発モードで起動
npm run dev:test
```

### 方法3: 環境変数で直接指定

任意のテンプレートフォルダを環境変数で指定して起動できます。

**Windows (PowerShell):**
```powershell
$env:QUICK_DASH_CONFIG_DIR="./tests/fixtures/dev-templates/minimal"; npm run dev
```

**Windows (コマンドプロンプト):**
```cmd
set QUICK_DASH_CONFIG_DIR=./tests/fixtures/dev-templates/minimal && npm run dev
```

**Unix/Mac:**
```bash
QUICK_DASH_CONFIG_DIR=./tests/fixtures/dev-templates/minimal npm run dev
```

## 📝 カスタムテンプレートの作成

独自のテンプレートを作成する場合:

1. **新しいフォルダを作成**
   ```bash
   mkdir tests/fixtures/dev-templates/my-custom
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
   $env:QUICK_DASH_CONFIG_DIR="./tests/fixtures/dev-templates/my-custom"; npm run dev
   ```

## 🔧 テンプレートのリセット

開発中にデータや設定を変更した後、元のテンプレートに戻したい場合:

```bash
# 方法1: settings.jsonだけ削除（再起動で再生成）
rm tests/fixtures/dev-config/settings.json

# 方法2: iconsフォルダも削除（完全リセット）
rm -rf tests/fixtures/dev-config/icons/
rm -rf tests/fixtures/dev-config/favicons/
rm tests/fixtures/dev-config/settings.json

# 方法3: テンプレートを再コピー
cp tests/fixtures/dev-templates/minimal/data.txt tests/fixtures/dev-config/
```

## 💡 Tips

### 開発中によく使うパターン

**パターン1: 最小限で動作確認**
```bash
npm run dev:minimal
```
- 基本機能だけを確認したい場合
- バグ修正の動作確認

**パターン2: 全機能でデモ**
```bash
npm run dev:full
```
- クライアントへのデモ
- スクリーンショット撮影
- 全機能の統合テスト

**パターン3: 特定機能の検証**
```bash
# タブ機能を検証
npm run dev:tabs

# グループ起動を検証
npm run dev:groups
```

### データのみ変更したい場合

settings.jsonはそのままで、data.txtだけを変更したい場合:

```bash
# data.txtだけコピー
cp tests/fixtures/dev-templates/full-featured/data.txt tests/fixtures/dev-config/

# 開発モードで起動
npm run dev:test
```

## ⚠️ 注意事項

1. **本番環境への影響なし**
   - これらのテンプレートはすべて`tests/fixtures/`内にあり、本番環境の設定には影響しません

2. **Gitで管理されるもの**
   - ✅ data.txt（各テンプレートの初期データ）
   - ✅ settings.json（各テンプレートの初期設定）
   - ✅ README.md

3. **Gitで管理されないもの**
   - ❌ icons/, favicons/, custom-icons/（自動生成）
   - ❌ backup/（バックアップフォルダ）

4. **テンプレートの編集**
   - テンプレートファイルを直接編集してもOK
   - 変更はGitでコミット可能
   - チーム全体で共有される

## 🔗 関連ドキュメント

- [data-templates/README.md](../data-templates/README.md) - E2Eテスト用データテンプレート
- [settings-templates/README.md](../settings-templates/README.md) - E2Eテスト用設定テンプレート
- [GIT_MANAGEMENT.md](../GIT_MANAGEMENT.md) - Git管理方針
