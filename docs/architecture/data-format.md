# データファイル形式仕様

QuickDashLauncherのデータファイル形式の完全な仕様です。

## ファイル概要

### 対象ファイル

QuickDashLauncherは複数のデータファイルをサポートしています：

- **data.txt**: メインのデータファイル（必須、削除不可）
- **data2.txt, data3.txt, data4.txt...**: 追加のデータファイル（オプション）
- **tempdata.txt**: 一時データファイル（実行時生成）

#### 複数データファイルのサポート

- **ファイル名パターン**: `data*.txt`（例: data.txt, data2.txt, data3.txt...）
- **配置場所**: `%APPDATA%/quick-dash-launcher/config/`
- **自動検出**: アプリケーション起動時に設定フォルダ内のすべての`data*.txt`ファイルを自動的に検出
- **タブ表示**: 設定でタブ表示を有効にすると、各データファイルをタブで切り替えて使用可能
- **ファイル管理**: 設定画面でデータファイルの追加・削除・タブ名のカスタマイズが可能

#### 必須ファイルと追加ファイル

- **data.txt**: 常に必要な必須ファイル。削除不可
- **data2.txt以降**: 任意で追加可能。設定画面または手動でファイルを作成
- **作成方法**:
  - 設定画面の「データファイル管理」セクションで➕行追加ボタンをクリック
  - または、設定フォルダに手動でdata*.txtファイルを作成

### 文字エンコーディング
- **UTF-8** (BOMなし)
- **改行コード**: CRLF (`\r\n`)、LF (`\n`)、CR (`\r`) のいずれにも対応

## 基本構文

### 行の種類
データファイルには以下の6種類の行が存在します：

1. **コメント行** (`//` で開始)
2. **空行** (空白文字のみまたは完全に空)
3. **単一アイテム行** (通常のアイテム定義)
4. **フォルダ取込アイテム行** (`dir,` で開始)
5. **グループアイテム行** (`group,` で開始)
6. **ウィンドウ操作アイテム行** (`window,` で開始)

### 基本フォーマット
```
// コメント行
<空行>
表示名,パスまたはURL[,引数][,カスタムアイコン]
dir,ディレクトリパス[,オプション1=値1][,オプション2=値2]...
group,グループ名,アイテム名1,アイテム名2,アイテム名3,...
window,{JSON形式の設定}
```

## 重複排除ルール

QuickDashLauncherは、アイテムの重複を自動的に排除します。

### 重複判定の基準

以下の3つの要素が一致するアイテムを「重複」と判定します：

- **表示名** (`name`)
- **パスまたはURL** (`path`)
- **引数** (`args`) ※ 存在する場合のみ

### 重複排除の単位

v0.4.2以降、重複排除は**タブ単位**で実行されます：

- **同一タブ内**: 重複するアイテムは1つのみ表示されます
  - 例: メインタブ = [data.txt, data3.txt] の場合、両ファイルに同じアイテムがあれば1つだけ表示
- **異なるタブ間**: 重複するアイテムが複数のタブに表示されます
  - 例: メインタブとサブ1タブに同じアイテムがあれば、両方のタブで表示される

### 具体例

**設定:**
```json
{
  "dataFileTabs": [
    { "files": ["data.txt", "data3.txt"], "name": "メイン" },
    { "files": ["data2.txt"], "name": "サブ1" }
  ]
}
```

**データファイル:**
- data.txt: `GitHub,https://github.com/`
- data2.txt: `GitHub,https://github.com/`
- data3.txt: `GitHub,https://github.com/`

**表示結果:**
- **メインタブ**: GitHub 1つ（data.txtとdata3.txtの重複を排除）
- **サブ1タブ**: GitHub 1つ（data2.txtから）

### タブに属さないファイル

タブ設定に含まれていないデータファイル（例: data4.txt）は、独立したタブとして扱われます：

- ファイル内では重複排除が行われます
- 他のタブとは独立して重複判定が行われます
- ただし、タブ表示が有効な場合、UIには表示されません

### グループアイテムの扱い

グループアイテム（`group,グループ名,アイテム1,アイテム2,...`）は重複チェックの対象外です：

- 同じ名前のグループが複数のタブに存在しても、すべて表示されます
- これは、同じ名前でも参照するアイテムが異なる可能性があるためです

## 単一アイテム行の詳細

### フィールド構成
```
表示名,パスまたはURL[,引数][,カスタムアイコン][,ウィンドウ設定]
```

| フィールド | 位置 | 必須 | 説明 |
|------------|------|------|------|
| **表示名** | 1 | ✓ | アプリケーション内での表示名 |
| **パスまたはURL** | 2 | ✓ | ターゲットのパス、URL、またはコマンド |
| **引数** | 3 | - | コマンドライン引数（オプション） |
| **カスタムアイコン** | 4 | - | カスタムアイコンファイル名（custom-iconsフォルダ内） |
| **ウィンドウ設定** | 5 | - | ウィンドウ制御設定（文字列形式またはJSON形式） |

### サポートされるパス種類
- **ファイルパス**: `C:\path\to\file.exe`
- **フォルダパス**: `C:\path\to\folder`
  - パス中にドット（`.`）が含まれるフォルダ名も正しく認識されます（例: `C:\Projects\ver.0.39`）
  - 拡張子の判定はファイル名部分のみから行われます
- **HTTP/HTTPS URL**: `https://example.com`
- **カスタムURIスキーマ**: `obsidian://`, `vscode://`, `ms-excel://` など
- **ショートカットファイル**: `C:\path\to\shortcut.lnk`

### 引数フィールドの記述方法

引数フィールド（第3フィールド）には2つの記述方法があります：

#### 方法1: シンプルな記述（推奨）
引数をそのまま記述します。引数内のダブルクォートもそのまま記述できます。

```
表示名,実行ファイル,-p "Git Bash" -d "C:\path"
```

**利点**: 記述が簡単で読みやすい
**制約**: 引数にカンマ (`,`) を含む場合は使用できません

#### 方法2: CSV形式での記述
フィールド全体をダブルクォートで囲み、内部のダブルクォートは `""` でエスケープします。

```
表示名,実行ファイル,"-p ""Git Bash"" -d ""C:\path"""
```

**利点**: 引数にカンマを含む場合でも使用可能
**制約**: エスケープが必要で記述が複雑

### CSV形式のエスケープルール

data.txtファイルは標準的なCSV形式に準拠しており、以下のエスケープルールが適用されます：

#### エスケープが必要な場合
以下のいずれかの条件を満たすフィールドは、ダブルクォートで囲む必要があります：

1. **ダブルクォート (`"`) を含む場合**
2. **カンマ (`,`) を含む場合**

#### エスケープ方法
- フィールド全体をダブルクォート (`"`) で囲む
- フィールド内のダブルクォートは2つ重ねて表記 (`""`)

#### エスケープの具体例

**例1: ダブルクォートを含む引数**
```
入力: -p "Git Bash" -d "C:\Projects"
保存: "-p ""Git Bash"" -d ""C:\Projects"""
読込: -p "Git Bash" -d "C:\Projects"
```

**例2: カンマを含む引数**
```
入力: --options value1,value2
保存: "--options value1,value2"
読込: --options value1,value2
```

**例3: ダブルクォートとカンマの両方を含む引数**
```
入力: --data "item1,item2"
保存: "--data ""item1,item2"""
読込: --data "item1,item2"
```

**例4: エスケープ不要な場合**
```
入力: --new-window
保存: --new-window
読込: --new-window
```

#### 自動エスケープ処理
アプリケーション内でアイテムを登録・編集する場合、CSVエスケープ処理は自動的に行われます：

- **登録時・更新時**: 必要に応じて自動的にエスケープされてファイルに保存
- **読み込み時**: 自動的にエスケープが解除されて表示
- **ユーザー操作**: ユーザーは通常の文字列として入力するだけで、エスケープ処理を意識する必要はありません

### 使用例

```
// 基本的なアプリケーション
Notepad,C:\Windows\System32\notepad.exe

// 引数付きアプリケーション（スペースなし）
VSCode,C:\Program Files\Microsoft VS Code\Code.exe,--new-window

// カスタムアイコン付き
MyApp,C:\MyApp\app.exe,,custom-icon.png

// Windows Terminal（シンプルな記述）
Git Bash,wt.exe,-p "Git Bash"
PowerShell,wt.exe,-p PowerShell
Obsidian Git Bash,wt.exe,-p "Git Bash" -d "C:\Projects\obsidian"

// Windows Terminal（CSV形式での記述）
Git Bash,wt.exe,"-p ""Git Bash"""

// 引数とカスタムアイコン両方
Terminal,wt.exe,-p PowerShell,terminal.ico

// 複数の引数（スペースを含む - シンプルな記述）
VSCode Project,C:\Program Files\Microsoft VS Code\Code.exe,--new-window "C:\Projects\MyProject"

// Webサイト
Google,https://www.google.com

// フォルダ
Documents,C:\Users\Username\Documents

// カスタムURI
Obsidian Vault,obsidian://open?vault=MyVault

// ショートカットファイル（自動解析）
Desktop App,C:\Users\Username\Desktop\MyApp.lnk
```

#### 記述方法の選択

**シンプルな記述を使う場合**（推奨）:
```
Git Bash,wt.exe,-p "Git Bash" -d "C:\Projects"
```

**CSV形式を使う場合**（引数にカンマが含まれる場合のみ）:
```
Custom App,app.exe,"-p ""value1,value2"" --flag"
```

### ウィンドウ設定フィールドの記述方法

ウィンドウ設定フィールド（第5フィールド）は、アイテム起動時のウィンドウ検索・位置・サイズ制御に使用されます。

#### 記述形式

ウィンドウ設定は以下の2つの形式で記述できます：

**1. 文字列形式（後方互換）**

ウィンドウタイトルのみを指定する場合、文字列形式で記述できます。

```
表示名,パス,引数,カスタムアイコン,ウィンドウタイトル
```

**例:**
```
VSCode,code.exe,,,Visual Studio Code
Chrome,chrome.exe,,,Google Chrome
```

**2. JSON形式（位置・サイズ指定）**

ウィンドウの位置やサイズも制御する場合、JSON形式で記述します。

```
表示名,パス,引数,カスタムアイコン,"{""title"":""ウィンドウタイトル"",""x"":100,""y"":200,""width"":800,""height"":600}"
```

**JSON形式の構造:**
```json
{
  "title": "ウィンドウタイトル（必須）",
  "exactMatch": false,      // 完全一致で検索（省略可能、既定: false=部分一致）
  "processName": "",        // プロセス名で絞り込み（省略可能）
  "activateWindow": true,   // ウィンドウをアクティブ化（省略可能、既定: true）
  "virtualDesktopNumber": 1, // 仮想デスクトップ番号（省略可能）
  "x": 100,                 // X座標（省略可能）
  "y": 200,                 // Y座標（省略可能）
  "width": 800,             // 幅（省略可能）
  "height": 600             // 高さ（省略可能）
}
```

#### フィールド詳細

| フィールド | 必須 | 既定値 | 説明 |
|-----------|------|--------|------|
| `title` | ✓ | - | ウィンドウ検索用のタイトル文字列（大文字小文字を区別しない） |
| `exactMatch` | - | `false` | `true`の場合は完全一致、`false`の場合は部分一致で検索 |
| `processName` | - | - | プロセス名で検索対象を絞り込み（例: `chrome.exe`） |
| `activateWindow` | - | `true` | ウィンドウを前面に表示してフォーカス |
| `virtualDesktopNumber` | - | - | 対象の仮想デスクトップ番号（1から開始） |
| `x` | - | - | X座標（仮想スクリーン座標系、省略時は位置変更なし） |
| `y` | - | - | Y座標（仮想スクリーン座標系、省略時は位置変更なし） |
| `width` | - | - | 幅（ピクセル単位、省略時はサイズ変更なし） |
| `height` | - | - | 高さ（ピクセル単位、省略時はサイズ変更なし） |

#### 動作仕様

1. **ウィンドウ検索**: アイテム起動前に、`title`で指定されたウィンドウを検索
   - `exactMatch`が`false`の場合は部分一致、`true`の場合は完全一致
   - スペース区切りでAND検索
   - 大文字小文字を区別しない
   - `processName`が指定されている場合、プロセス名でも絞り込み
2. **ウィンドウ発見時**:
   - `activateWindow`がtrueの場合、ウィンドウをアクティブ化（前面に表示）
   - `x`, `y`, `width`, `height`が指定されている場合は、ウィンドウの位置・サイズを変更
   - 通常起動は実行しない
3. **ウィンドウ未発見時**: 通常通りアイテムを起動

#### オプションの組み合わせ例

| activateWindow | 位置・サイズ指定 | 動作 |
|---------------|-----------------|------|
| true (既定) | なし | ウィンドウをアクティブ化のみ |
| true | あり | ウィンドウをアクティブ化し、位置・サイズを変更 |
| false | あり | 位置・サイズのみ変更（アクティブ化しない） |

#### マルチモニタ対応

座標系は仮想スクリーン座標（Virtual Screen Coordinates）を使用します：

- プライマリモニターの左上が原点 (0, 0)
- セカンダリモニターは相対位置に配置（例: プライマリが1920x1080、セカンダリが右側なら X=1920 から開始）
- 負の座標も使用可能（プライマリの左側・上側にモニターがある場合）

詳細は **[ウィンドウ制御システム](window-control.md#ウィンドウ位置サイズ制御)** を参照してください。

#### CSVエスケープ処理

JSON形式の場合、ダブルクォートとカンマを含むため、CSVエスケープが必要です：

**エスケープ前（JSON）:**
```json
{"title":"Google Chrome","x":100,"y":200,"width":1920,"height":1080}
```

**エスケープ後（CSV行）:**
```
Chrome,chrome.exe,,,"{""title"":""Google Chrome"",""x"":100,""y"":200,""width"":1920,""height"":1080}"
```

アプリケーション内でアイテムを登録・編集する場合、CSVエスケープ処理は自動的に行われます。

#### 使用例

**文字列形式の例:**
```
VSCode,code.exe,,,Visual Studio Code
Chrome,chrome.exe,--new-window,,Google Chrome
Slack,slack://,,,Slack
```

**JSON形式の例:**
```
Chrome (マルチモニタ),chrome.exe,,,"{""title"":""Google Chrome"",""x"":1920,""y"":0,""width"":1920,""height"":1080}"
VSCode (左半分),code.exe,,,"{""title"":""Visual Studio Code"",""x"":0,""y"":0,""width"":960,""height"":1080}"
Slack (右半分),slack://,,,"{""title"":""Slack"",""x"":960,""y"":0,""width"":960,""height"":1080}"
VSCode (仮想デスクトップ2),code.exe,,,"{""title"":""Visual Studio Code"",""switchDesktop"":true}"
Chrome (アクティブ化なし),chrome.exe,,,"{""title"":""Google Chrome"",""activateWindow"":false,""x"":0,""y"":0}"
```

#### 位置・サイズのみ指定する場合

位置やサイズを指定する場合、`title`フィールドは必須です。タイトル検索を無効にしたい場合でも、空文字列ではなく適切なタイトルを指定してください。

**非推奨:**
```json
{"title":"","x":100,"y":200}  // titleが空文字列
```

**推奨:**
```json
{"title":"My App","x":100,"y":200}  // 適切なタイトルを指定
```

## フォルダ取込アイテム行の詳細

### 基本構文
```
dir,ディレクトリパス[,オプション1=値1][,オプション2=値2]...
```

### オプション一覧

| オプション | デフォルト値 | 指定可能な値 | 説明 |
|------------|-------------|-------------|------|
| **depth** | `0` | `0`, `1`, `2`, ..., `-1` | スキャン深度<br>`0`: 指定ディレクトリ直下のみ<br>`1`: 1階層下まで<br>`-1`: 無制限（全サブディレクトリ） |
| **types** | `both` | `file`, `folder`, `both` | インポートするアイテムのタイプ<br>`file`: ファイルのみ<br>`folder`: フォルダのみ<br>`both`: ファイルとフォルダの両方 |
| **filter** | なし | globパターン | インポートするアイテムをフィルタリングするglobパターン<br>例: `*.ps1`, `*.{doc,docx,pdf}` |
| **exclude** | なし | globパターン | 除外するアイテムのglobパターン<br>例: `node_modules`, `*.{tmp,temp,bak}` |
| **prefix** | なし | 任意の文字列 | インポートされるアイテムの表示名に付けるプレフィックス<br>結果: `プレフィックス: アイテム名` |
| **suffix** | なし | 任意の文字列 | インポートされるアイテムの表示名に付けるサフィックス<br>結果: `アイテム名 (サフィックス)` |

### 使用例
```
// 基本的な使用（直下のみ）
dir,C:\Users\Username\Documents

// 深度指定（2階層下まで）
dir,C:\Projects,depth=2

// タイプ指定（ファイルのみ）
dir,C:\Scripts,types=file

// フィルター指定（PowerShellスクリプトのみ）
dir,C:\Scripts,filter=*.ps1

// 複数拡張子フィルター
dir,C:\Documents,filter=*.{doc,docx,pdf}

// 除外パターン
dir,C:\Projects,exclude=node_modules

// プレフィックス追加
dir,C:\Tools,prefix=Dev

// サフィックス追加
dir,C:\Projects,suffix=Work

// 複合オプション
dir,C:\Source,depth=2,types=file,filter=*.{js,ts},exclude=node_modules,prefix=Src
```

### 生成される行の形式
フォルダ取込アイテムは展開時に以下の形式の行に変換されます：

#### 通常ファイル・フォルダ
```
[prefix: ]basename[ (suffix)],fullpath,,originalpath
```

#### ショートカットファイル（.lnk）
```
[prefix: ]basename[ (suffix)],shortcutpath,args,targetpath
```
- **フィールド2（path）**: ショートカットファイル自身のパス
- **フィールド3（args）**: ショートカットに設定された引数
- **フィールド4（originalPath）**: リンク先のパス

#### 実行可能ファイル（.exe, .bat, .cmd）
```
[prefix: ]basename[ (suffix)],filepath,,filepath
```

## グループアイテム行の詳細

### 基本構文
```
group,グループ名,アイテム名1,アイテム名2,アイテム名3,...
```

### フィールド構成

| フィールド | 位置 | 必須 | 説明 |
|------------|------|------|------|
| **グループ名** | 1 | ✓ | グループの表示名 |
| **アイテム名1〜N** | 2〜 | ✓ | 既存アイテムの名前（参照） |

### 動作仕様

グループアイテムは、複数の既存アイテムをまとめて一括起動する機能です：

1. **参照解決**: グループ内のアイテム名は、データファイル内の既存アイテム名を参照します
2. **順次実行**: グループ実行時、リストされたアイテムを順番に起動します
3. **実行間隔**: 各アイテムの起動間隔は500ms（固定）です
4. **エラー処理**: 存在しないアイテム名は警告ログを出力してスキップします

### 使用例

```
// 個別アイテムの定義
Visual Studio Code,code.exe
Slack,slack://
Chrome,chrome.exe,--new-window https://localhost:3000
開発フォルダ,C:\dev
Zoom,zoom://
Teams,teams://
議事録フォルダ,C:\meetings
Google,https://google.com
GitHub,https://github.com

// グループ定義（既存アイテム名を参照）
group,開発環境,Visual Studio Code,Slack,Chrome,開発フォルダ
group,会議準備,Zoom,Teams,議事録フォルダ
group,Web閲覧,Google,GitHub
```

### 表示形式

グループアイテムは、アイテムリストに以下のように表示されます：

- **アイコン**: 📦（デフォルト）
- **表示名**: `グループ名 (N個)`
- **ツールチップ**: `グループ: アイテム名1, アイテム名2, ...`

### 設計上の利点

- **DRY原則**: アイテム情報の重複がありません
- **保守性**: アイテムのパス変更時は個別定義のみ修正すればOK
- **可読性**: グループ定義が非常に簡潔
- **一貫性**: 既存アイテムと完全に同じ動作を保証

### エラーハンドリング

- **存在しないアイテム名**: 警告ログを出力し、該当アイテムをスキップ
- **部分的な参照エラー**: エラーがあっても残りのアイテムは実行継続
- **循環参照**: グループ内でグループは参照できません（LauncherItemのみ）

## ウィンドウ操作アイテム行の詳細

### 基本構文
```
window,{JSON形式の設定}
```

### JSON設定フィールド

| フィールド | 必須 | デフォルト値 | 説明 |
|------------|------|-------------|------|
| **name** | ✓ | - | アイテムリストでの表示名 |
| **windowTitle** | ✓ | - | ウィンドウタイトル（検索用、部分一致、スペース区切りでAND検索） |
| **x** | - | undefined | X座標（仮想スクリーン座標系、省略時は位置変更なし） |
| **y** | - | undefined | Y座標（仮想スクリーン座標系、省略時は位置変更なし） |
| **width** | - | undefined | 幅（ピクセル単位、省略時はサイズ変更なし） |
| **height** | - | undefined | 高さ（ピクセル単位、省略時はサイズ変更なし） |
| **virtualDesktopNumber** | - | undefined | 仮想デスクトップ番号（1から開始、省略時は移動なし） |
| **activateWindow** | - | true | ウィンドウをアクティブにするか（`true` または `false`） |

### 動作仕様

ウィンドウ操作アイテムは、既存のウィンドウを検索・制御する機能です：

1. **ウィンドウ検索**: `ウィンドウタイトル`で指定されたウィンドウを検索します
   - 部分一致、スペース区切りでAND検索
   - 大文字小文字を区別しない
2. **ウィンドウ発見時**:
   - ウィンドウを復元（最小化解除）
   - `virtualDesktopNumber`が指定されていれば仮想デスクトップを移動
   - `x`, `y`, `width`, `height`が指定されていれば位置・サイズを変更
   - `activateWindow`が`true`（デフォルト）の場合、ウィンドウをアクティブ化
   - **通常起動は実行しません**
3. **ウィンドウ未発見時**: 警告ログを出力し、何も実行しません

### マルチモニタ対応

座標系は仮想スクリーン座標（Virtual Screen Coordinates）を使用します：

- プライマリモニターの左上が原点 (0, 0)
- セカンダリモニターは相対位置に配置（例: プライマリが1920x1080、セカンダリが右側なら X=1920 から開始）
- 負の座標も使用可能（プライマリの左側・上側にモニターがある場合）

詳細は **[ウィンドウ制御システム](window-control.md#ウィンドウ位置サイズ制御)** を参照してください。

### 使用例

```
// 基本的な使用（表示名とウィンドウタイトル）
window,{"name":"VSCode","windowTitle":"Visual Studio Code"}

// 位置・サイズ指定
window,{"name":"Chrome右半分","windowTitle":"Google Chrome","x":960,"y":0,"width":960,"height":1080}

// 仮想デスクトップ指定（デスクトップ2に移動）
window,{"name":"開発用Slack","windowTitle":"Slack","virtualDesktopNumber":2}

// アクティブ化無効（位置・サイズ変更のみ）
window,{"name":"Terminal","windowTitle":"Windows PowerShell","x":100,"y":100,"width":800,"height":600,"activateWindow":false}

// フル指定（位置・サイズ・仮想デスクトップ・アクティブ化）
window,{"name":"メインVSCode","windowTitle":"Visual Studio Code","x":960,"y":0,"width":960,"height":1080,"virtualDesktopNumber":1,"activateWindow":true}

// マルチモニタ - セカンダリモニター（右側）に配置
window,{"name":"セカンダリChrome","windowTitle":"Google Chrome","x":1920,"y":0,"width":1920,"height":1080}

// 画面左半分に配置
window,{"name":"左VSCode","windowTitle":"Visual Studio Code","x":0,"y":0,"width":960,"height":1080}

// 画面右半分に配置
window,{"name":"右Slack","windowTitle":"Slack","x":960,"y":0,"width":960,"height":1080}
```

### データ形式の変更履歴

#### v0.5.10以降: JSON形式専用化

**変更内容:**

| バージョン | 変更内容 |
|-----------|---------|
| **v0.5.9** | JSON形式を導入。新規保存時はJSON形式で保存され、旧CSV形式も読み込み可能（後方互換性あり） |
| **v0.5.10** | **JSON形式専用に変更**。CSV形式のサポートを終了し、自動移行機能を実装 |

**自動移行処理（v0.5.10以降）:**
- アプリケーション起動時に全データファイル（data.txt, data2.txt, ...）をスキャン
- 旧CSV形式の`window`ディレクティブを検出すると自動的にJSON形式に変換
- 変換後のファイルを保存（元のファイルは上書きされます）
- 移行処理はログに記録されます（`%APPDATA%/quick-dash-launcher/logs/data.log`）

**移行例:**
```
// 移行前（旧CSV形式）
window,VSCode,Visual Studio Code,100,100,1920,1080,1,true

// 移行後（JSON形式）
window,{"name":"VSCode","windowTitle":"Visual Studio Code","x":100,"y":100,"width":1920,"height":1080,"virtualDesktopNumber":1,"activateWindow":true}
```

**JSON形式専用化の理由:**
- **フィールド順序エラーの防止**: CSV形式では8つのフィールドの順序を厳格に守る必要があり、設定値のズレが発生しやすかった
- **将来的な拡張性**: JSON形式では新しいフィールド追加が容易で、後方互換性を保ちやすい
- **データ整合性**: JSON形式では`name`と`windowTitle`が必須フィールドとして明示され、不正なデータを防止
- **エスケープ処理の一貫性**: JSON文字列全体をCSVエスケープするシンプルな処理に統一

### 表示形式

ウィンドウ操作アイテムは、アイテムリストに以下のように表示されます：

- **アイコン**: 🪟（デフォルト）
- **表示名**: `🪟 ウィンドウタイトル`
- **ツールチップ**: ウィンドウタイトル、位置・サイズ、仮想デスクトップ番号などの設定内容

### 設計上の利点

- **アプリケーション起動不要**: 既存ウィンドウのみを制御するため、アプリケーションの起動は不要です
- **高速な切り替え**: 新規起動よりも高速にウィンドウを表示できます
- **ウィンドウ配置の自動化**: マルチモニタ環境でのウィンドウ配置を自動化できます
- **仮想デスクトップ対応**: Windows 10以降の仮想デスクトップ機能を活用できます

### 制約事項

- **グループからの参照**: グループアイテムからは参照できません（LauncherItemのみ）
- **ワークスペース**: 現時点ではワークスペース機能には対応していません
- **実行履歴**: 実行履歴には記録されません
- **インライン編集**: 管理画面（EditableRawItemList）では、JSON文字列の破損を防ぐため、ウィンドウ操作アイテムのインライン編集はできません。編集する場合は、✏️ボタンから詳細編集モーダル（RegisterModal）を開いてください。

### エラーハンドリング

- **ウィンドウ未検出時**: 警告ログを出力し、何も実行しません
- **無効な座標・サイズ**: 無効な値（負の幅・高さなど）は無視されます
- **無効なvirtualDesktopNumber**: 1未満の値や存在しないデスクトップ番号は無視されます

## 特殊処理

### ショートカットファイルの自動解析
`.lnk` ファイルが検出された場合、以下の処理が実行されます：

1. **ターゲットパス抽出**: ショートカットが指すファイル・フォルダのパス
2. **引数抽出**: ショートカットに設定されたコマンドライン引数
3. **表示名生成**: ショートカットファイル名（.lnk拡張子を除く）

```
// 元のショートカット
MyApp.lnk → target: C:\Program Files\MyApp\app.exe, args: --config=default

// 生成される行
MyApp,C:\path\to\MyApp.lnk,--config=default,C:\Program Files\MyApp\app.exe
```

**フィールド構成:**
- **フィールド1（表示名）**: ショートカットファイル名（拡張子除く）
- **フィールド2（path）**: ショートカットファイル自身のパス（例: `C:\path\to\MyApp.lnk`）
- **フィールド3（args）**: ショートカットに設定された引数
- **フィールド4（originalPath）**: リンク先のパス（例: `C:\Program Files\MyApp\app.exe`）

### カスタムアイコンの処理
カスタムアイコンフィールドに値が設定されている場合：

1. **相対パス**: `custom-icons` フォルダからの相対パス
2. **対応形式**: `.png`, `.jpg`, `.jpeg`, `.ico`, `.svg`
3. **ダブルクォート**: 値にカンマが含まれる場合は `"filename.png"` で囲む
4. **エスケープ**: ダブルクォート文字は `""` でエスケープ

## エラー処理とフォールバック

### 無効な行の処理
- **構文エラー**: 最低限必要なフィールドが不足している行はスキップ
- **存在しないパス**: ログに警告を出力してアイテムリストから除外
- **アクセス権限エラー**: 該当アイテムをスキップして処理続行

### フォルダ取込アイテムのエラー処理
- **存在しないディレクトリ**: 該当行をスキップ
- **アクセス権限不足**: アクセス可能なアイテムのみ処理
- **無効なオプション値**: デフォルト値を使用して処理続行

## データ型定義（TypeScript）

### RawDataLine
```typescript
interface RawDataLine {
  lineNumber: number;        // 行番号（1から開始）
  content: string;           // 行の内容（改行文字除く）
  type: 'directive' | 'item' | 'comment' | 'empty';
  sourceFile: string;        // 元データファイル名（例: 'data.txt', 'data2.txt', 'data3.txt'...）
  customIcon?: string;       // カスタムアイコンファイル名
}
```

### WindowConfig
```typescript
interface WindowConfig {
  title: string;             // ウィンドウタイトル（検索用、必須）
  exactMatch?: boolean;      // 完全一致で検索するか（省略時はfalse = 部分一致）
  processName?: string;      // プロセス名で検索（部分一致、省略時は検索なし）
  x?: number;                // X座標（仮想スクリーン座標系、省略時は位置変更なし）
  y?: number;                // Y座標（仮想スクリーン座標系、省略時は位置変更なし）
  width?: number;            // 幅（省略時はサイズ変更なし）
  height?: number;           // 高さ（省略時はサイズ変更なし）
  virtualDesktopNumber?: number; // 仮想デスクトップ番号（1から開始、省略時は移動なし、Windows 10以降）
  activateWindow?: boolean;  // ウィンドウをアクティブにするかどうか（省略時はtrue）
}
```

### LauncherItem
```typescript
interface LauncherItem {
  name: string;              // 表示名
  path: string;              // パス・URL・コマンド
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  icon?: string;             // base64アイコンデータ
  customIcon?: string;       // カスタムアイコンファイル名
  args?: string;             // コマンドライン引数
  originalPath?: string;     // ショートカットの元パス
  sourceFile?: string;       // 元データファイル名
  lineNumber?: number;       // データファイル内の行番号
  isDirExpanded?: boolean;   // フォルダ取込アイテム展開フラグ
  expandedFrom?: string;     // フォルダ取込元ディレクトリパス
  expandedOptions?: string;  // フォルダ取込オプション（人間が読める形式）
  isEdited?: boolean;        // 編集フラグ
  windowTitle?: string;      // 【非推奨】ウィンドウタイトル（後方互換性のため残存、windowConfigを使用すること）
  windowConfig?: WindowConfig; // ウィンドウ制御設定（ウィンドウ検索・位置・サイズ制御）
}
```

### GroupItem
```typescript
interface GroupItem {
  name: string;              // グループの表示名
  type: 'group';             // アイテムタイプ（常に'group'）
  itemNames: string[];       // グループ内で参照するアイテム名のリスト
  sourceFile?: string;       // 元データファイル名
  lineNumber?: number;       // データファイル内の行番号
  isEdited?: boolean;        // 編集フラグ
}
```

### WindowOperationItem
```typescript
interface WindowOperationItem {
  type: 'windowOperation';   // アイテムタイプ（常に'windowOperation'）
  name: string;              // アイテムリストでの表示名（必須）
  windowTitle: string;       // ウィンドウタイトル（検索用、必須）
  exactMatch?: boolean;      // 完全一致で検索するか（省略時はfalse = 部分一致）
  processName?: string;      // プロセス名で検索（部分一致、省略時は検索なし）
  x?: number;                // X座標（仮想スクリーン座標系、省略時は位置変更なし）
  y?: number;                // Y座標（仮想スクリーン座標系、省略時は位置変更なし）
  width?: number;            // 幅（省略時はサイズ変更なし）
  height?: number;           // 高さ（省略時はサイズ変更なし）
  virtualDesktopNumber?: number; // 仮想デスクトップ番号（1から開始、省略時は移動なし）
  activateWindow?: boolean;  // ウィンドウをアクティブにするかどうか（省略時はtrue）
  sourceFile?: string;       // 元データファイル名
  lineNumber?: number;       // データファイル内の行番号
  isEdited?: boolean;        // 編集フラグ
}
```

### AppItem
```typescript
// LauncherItem、GroupItem、WindowOperationItemの統合型
type AppItem = LauncherItem | GroupItem | WindowOperationItem | WindowInfo;
```

### DragItemData
```typescript
/**
 * ドラッグアイテムのデータ型
 * ドラッグされているアイテムの種別と情報を表す
 */
export type DragItemData =
  | { type: 'workspace-item'; itemId: string; currentGroupId?: string }
  | { type: 'history-item'; historyItem: LauncherItem }
  | { type: 'group'; groupId: string };
```

### DropTargetData
```typescript
/**
 * ドロップターゲットのデータ型
 * ドロップ先の種別と識別子を表す
 */
export interface DropTargetData {
  /** ドロップ先のタイプ */
  targetType: 'group' | 'item' | 'uncategorized';
  /** グループID（targetType='group'の場合） */
  groupId?: string;
  /** アイテムID（targetType='item'の場合） */
  itemId?: string;
}
```

**用途**: ワークスペース機能のドラッグ&ドロップで使用される型安全なデータ構造です。

### ArchivedWorkspaceGroup
```typescript
/**
 * アーカイブされたワークスペースグループ
 * WorkspaceGroupを拡張し、アーカイブ関連の情報を追加
 */
export interface ArchivedWorkspaceGroup extends WorkspaceGroup {
  /** アーカイブ日時（timestamp） */
  archivedAt: number;
  /** アーカイブ前のorder（復元時の参考用） */
  originalOrder: number;
  /** アーカイブ時のアイテム数（表示用） */
  itemCount: number;
}
```

### ArchivedWorkspaceItem
```typescript
/**
 * アーカイブされたワークスペースアイテム
 * WorkspaceItemを拡張し、アーカイブ関連の情報を追加
 */
export interface ArchivedWorkspaceItem extends WorkspaceItem {
  /** アーカイブ日時（timestamp） */
  archivedAt: number;
  /** アーカイブグループID（どのグループと一緒にアーカイブされたか） */
  archivedGroupId: string;
}
```

### SearchMode
```typescript
/**
 * 検索モードを表す型
 * normal: 通常のアイテム検索モード
 * window: ウィンドウ検索モード
 * history: 実行履歴検索モード
 */
export type SearchMode = 'normal' | 'window' | 'history';
```

### SearchHistoryEntry
```typescript
/**
 * 検索履歴のエントリーを表すインターフェース
 * ユーザーが実行時に入力した検索クエリと実行日時を保持する
 */
export interface SearchHistoryEntry {
  /** 検索クエリ文字列 */
  query: string;
  /** 実行日時（ISO文字列形式） */
  timestamp: string;
}
```

### SearchHistoryState
```typescript
/**
 * 検索履歴の状態管理用インターフェース
 * キーボードナビゲーションでの履歴巡回に使用される
 */
export interface SearchHistoryState {
  /** 履歴エントリーのリスト（最新が先頭） */
  entries: SearchHistoryEntry[];
  /** 現在選択中の履歴インデックス（-1は履歴を使用していない状態） */
  currentIndex: number;
}
```

## ワークスペースデータ

ワークスペース機能で使用されるデータファイルの形式です。

### workspace.json

ワークスペースアイテムとグループを保存するJSONファイル。

**保存場所**: `%APPDATA%/quick-dash-launcher/config/workspace.json`

**形式**:
```json
{
  "items": [
    {
      "id": "uuid",
      "displayName": "表示名",
      "originalName": "元の名前",
      "path": "パスまたはURL",
      "type": "url | file | folder | app | customUri",
      "icon": "base64エンコードされたアイコン（オプション）",
      "customIcon": "カスタムアイコンファイル名（オプション）",
      "args": "引数（オプション）",
      "originalPath": "ショートカットのリンク先（オプション）",
      "order": 0,
      "addedAt": 1234567890,
      "groupId": "グループID（オプション）"
    }
  ],
  "groups": [
    {
      "id": "uuid",
      "name": "グループ名",
      "color": "色（CSS変数名またはカラーコード）",
      "order": 0,
      "collapsed": false,
      "createdAt": 1234567890
    }
  ]
}
```

### execution-history.json

アイテムの実行履歴を保存するJSONファイル（最大10件）。

**保存場所**: `%APPDATA%/quick-dash-launcher/config/execution-history.json`

**形式**:
```json
{
  "history": [
    {
      "id": "uuid",
      "itemName": "アイテム名",
      "itemPath": "パスまたはURL",
      "itemType": "url | file | folder | app | customUri | group",
      "icon": "base64エンコードされたアイコン（オプション）",
      "executedAt": 1234567890
    }
  ]
}
```

**特徴**:
- 最大10件まで保持
- 古い履歴から自動削除
- メイン画面でアイテムを起動するたびに自動追加

### workspace-archive.json

アーカイブされたワークスペースグループとアイテムを保存するJSONファイル。

**保存場所**: `%APPDATA%/quick-dash-launcher/config/workspace-archive.json`

**形式**:
```json
{
  "archivedGroups": [
    {
      "id": "uuid",
      "name": "グループ名",
      "color": "色（CSS変数名またはカラーコード）",
      "order": 0,
      "collapsed": false,
      "createdAt": 1234567890,
      "archivedAt": 1234567890,
      "originalOrder": 0,
      "itemCount": 3
    }
  ],
  "archivedItems": [
    {
      "id": "uuid",
      "displayName": "表示名",
      "originalName": "元の名前",
      "path": "パスまたはURL",
      "type": "url | file | folder | app | customUri",
      "icon": "base64エンコードされたアイコン（オプション）",
      "customIcon": "カスタムアイコンファイル名（オプション）",
      "args": "引数（オプション）",
      "originalPath": "ショートカットのリンク先（オプション）",
      "order": 0,
      "addedAt": 1234567890,
      "groupId": "グループID",
      "archivedAt": 1234567890,
      "archivedGroupId": "アーカイブグループID"
    }
  ]
}
```

**特徴**:
- グループ単位でアーカイブ
- グループとその中のアイテムが一緒に保存される
- 復元時に同名グループが存在する場合、「(復元)」サフィックスが自動付加される

## 関連ドキュメント

- **[アイテム管理](../features/item-management.md)** - データファイルの編集機能
- **[フォルダ取込](../features/folder-import.md)** - フォルダ取込機能の詳細
- **[ワークスペース](../features/workspace.md)** - ワークスペース機能の使い方
- **[開発ガイド](../setup/development.md)** - 開発時の注意事項