# データファイル形式仕様

QuickDashLauncherのデータファイル（data.txt、data2.txt）の完全な形式仕様です。

## ファイル概要

### 対象ファイル
- **data.txt**: メインのデータファイル
- **data2.txt**: セカンダリのデータファイル
- **tempdata.txt**: 一時データファイル（実行時生成）

### 文字エンコーディング
- **UTF-8** (BOMなし)
- **改行コード**: CRLF (`\r\n`)、LF (`\n`)、CR (`\r`) のいずれにも対応

## 基本構文

### 行の種類
データファイルには以下の4種類の行が存在します：

1. **コメント行** (`//` で開始)
2. **空行** (空白文字のみまたは完全に空)
3. **単一アイテム行** (通常のアイテム定義)
4. **フォルダ取込アイテム行** (`dir,` で開始)

### 基本フォーマット
```
// コメント行
<空行>
表示名,パスまたはURL[,引数][,カスタムアイコン]
dir,ディレクトリパス[,オプション1=値1][,オプション2=値2]...
```

## 単一アイテム行の詳細

### フィールド構成
```
表示名,パスまたはURL[,引数][,カスタムアイコン]
```

| フィールド | 位置 | 必須 | 説明 |
|------------|------|------|------|
| **表示名** | 1 | ✓ | アプリケーション内での表示名 |
| **パスまたはURL** | 2 | ✓ | ターゲットのパス、URL、またはコマンド |
| **引数** | 3 | - | コマンドライン引数（オプション） |
| **カスタムアイコン** | 4 | - | カスタムアイコンファイル名（custom-iconsフォルダ内） |

### サポートされるパス種類
- **ファイルパス**: `C:\path\to\file.exe`
- **フォルダパス**: `C:\path\to\folder`
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

## フォルダ取込アイテム行の詳細

### 基本構文
```
dir,ディレクトリパス[,オプション1=値1][,オプション2=値2]...
```

### オプション一覧

| オプション | デフォルト値 | 説明 |
|------------|-------------|------|
| **depth** | `0` | スキャン深度（`0`: 直下のみ、`-1`: 無制限） |
| **types** | `both` | 対象タイプ（`file`, `folder`, `both`） |
| **filter** | なし | インクルードパターン（glob形式） |
| **exclude** | なし | 除外パターン（glob形式） |
| **prefix** | なし | 表示名プレフィックス |
| **suffix** | なし | 表示名サフィックス |

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
[prefix: ]basename[ (suffix)],targetpath,args,shortcutpath
```

#### 実行可能ファイル（.exe, .bat, .cmd）
```
[prefix: ]basename[ (suffix)],filepath,,filepath
```

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
MyApp,C:\Program Files\MyApp\app.exe,--config=default,C:\path\to\MyApp.lnk
```

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
  sourceFile: 'data.txt' | 'data2.txt';
  customIcon?: string;       // カスタムアイコンファイル名
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
  sourceFile?: 'data.txt' | 'data2.txt';
  lineNumber?: number;       // 元ファイルの行番号
  isDirExpanded?: boolean;   // フォルダ取込アイテム展開フラグ
  isEdited?: boolean;        // 編集フラグ
}
```

## 関連ドキュメント

- **[アイテム管理](../features/item-management.md)** - データファイルの編集機能
- **[フォルダ取込アイテム](../features/folder-import-item.md)** - フォルダ取込機能の詳細
- **[開発ガイド](../guides/development.md)** - 開発時の注意事項
- **[APIリファレンス](api-reference.md)** - データ処理API一覧