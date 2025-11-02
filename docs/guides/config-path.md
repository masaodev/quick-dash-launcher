# 設定ファイルの場所の変更

QuickDashLauncherの設定ファイルやアイコンキャッシュなどの保存場所は、環境変数を使用してカスタマイズできます。

## デフォルトの保存場所

デフォルトでは、設定ファイルは以下の場所に保存されます：

```
Windows: %APPDATA%\quick-dash-launcher\config
```

具体的には、以下のようなパスになります：
```
C:\Users\<ユーザー名>\AppData\Roaming\quick-dash-launcher\config
```

この中に以下のファイル・フォルダが作成されます：
- `data.txt` - メインのアイテムリスト
- `data2.txt` - サブのアイテムリスト（任意）
- `settings.json` - アプリケーション設定
- `icons/` - アイコンキャッシュ
- `favicons/` - ファビコンキャッシュ
- `custom-icons/` - カスタムアイコン
- `backup/` - バックアップファイル

## カスタムパスの設定

### 環境変数を使用する方法

環境変数 `QUICK_DASH_CONFIG_DIR` を設定することで、任意の場所に設定ファイルを保存できます。

**Windowsでの設定方法（PowerShell）:**

```powershell
# 一時的に設定（現在のセッションのみ有効）
$env:QUICK_DASH_CONFIG_DIR = "D:\MyApps\quick-dash-config"

# アプリケーションを起動
& "C:\Program Files\quick-dash-launcher\QuickDashLauncher.exe"
```

**永続的に設定する方法:**

1. スタートメニューで「環境変数」を検索
2. 「システム環境変数の編集」を開く
3. 「環境変数」ボタンをクリック
4. 「ユーザー環境変数」の「新規」をクリック
5. 変数名: `QUICK_DASH_CONFIG_DIR`
6. 変数値: `D:\MyApps\quick-dash-config` (任意のパス)
7. OKをクリックして保存

設定後、アプリケーションを再起動すると新しいパスが使用されます。

## 開発時の利用

### package.jsonに定義済みのコマンド

よく使う設定パスは`package.json`に事前定義されています：

```bash
# カスタム設定（./test-config）で起動
npm run dev:custom

# テスト用設定（./dev-config）で起動
npm run dev:test

# デフォルト設定で起動
npm run dev
```

### 任意のパスで起動

環境変数を直接指定して起動することもできます：

```bash
# 開発用の設定を別フォルダで管理
npx cross-env QUICK_DASH_CONFIG_DIR=./my-config npm run dev

# 本番環境の設定をテスト
npx cross-env QUICK_DASH_CONFIG_DIR=./prod-config npm run dev

# 複数の設定を切り替えてテスト
npx cross-env QUICK_DASH_CONFIG_DIR=./config-a npm run dev
npx cross-env QUICK_DASH_CONFIG_DIR=./config-b npm run dev
```

## テスト時の利用

単体テストでは、`PathTestHelper`を使用して自動的に一時フォルダを作成・管理できます：

```typescript
import { PathTestHelper } from '../../src/test/helpers/pathTestHelper';

describe('My Test', () => {
  let pathHelper: PathTestHelper;

  beforeEach(() => {
    pathHelper = new PathTestHelper();
    pathHelper.setup('my-test'); // 一時フォルダを作成
  });

  afterEach(() => {
    pathHelper.cleanup(); // 一時フォルダを削除
  });

  it('should work', () => {
    // テストコード
    // PathManagerは自動的に一時フォルダを使用
  });
});
```

## ユースケース

### 1. ポータブル版の作成

USBメモリなどに設定を保存してポータブルに使用する場合：

```powershell
# USBメモリのパスを指定
$env:QUICK_DASH_CONFIG_DIR = "E:\PortableApps\QuickDash\config"
```

### 2. 複数の設定プロファイル

仕事用とプライベート用で設定を分ける場合：

```powershell
# 仕事用
$env:QUICK_DASH_CONFIG_DIR = "D:\Work\quick-dash-config"

# プライベート用
$env:QUICK_DASH_CONFIG_DIR = "D:\Personal\quick-dash-config"
```

### 3. クラウド同期

Dropboxなどのクラウドストレージに設定を保存して複数のPCで同期する場合：

```powershell
$env:QUICK_DASH_CONFIG_DIR = "$env:USERPROFILE\Dropbox\QuickDash\config"
```

## 注意事項

### セキュリティ

設定フォルダへのアクセス権限に注意してください。以下のパスは安全のため使用が制限されています：

- `C:\Windows`
- `C:\Program Files`
- `/usr`, `/bin`, `/etc` など

これらのパスを指定した場合、自動的にデフォルトパスにフォールバックします。

### パスの形式

- 相対パスを指定した場合、絶対パスに自動変換されます
- パスにスペースが含まれる場合は引用符で囲んでください
- Windowsではバックスラッシュ（`\`）とスラッシュ（`/`）の両方が使用できます

### 既存データの移行

設定パスを変更した場合、既存のデータは自動的に移行されません。手動で以下の手順で移行してください：

1. 旧フォルダの内容をすべてコピー
2. 新しいフォルダに貼り付け
3. アプリケーションを起動

## トラブルシューティング

### 設定パスが認識されない

- 環境変数が正しく設定されているか確認
- アプリケーションを再起動
- パスが存在し、書き込み権限があるか確認

### 設定ファイルが見つからない

```powershell
# 現在の設定パスを確認（開発モード）
npm run dev
# ログに "Config folder: ..." と表示されます
```

### 書き込み権限エラー

指定したフォルダに書き込み権限があることを確認してください。管理者権限が必要な場所は避けてください。
