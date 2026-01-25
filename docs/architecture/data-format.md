# データファイル形式仕様

QuickDashLauncherのデータファイル形式の完全な仕様です。

## 1. ファイル概要

### 1.1. 対象ファイル

QuickDashLauncherは複数のJSON形式のデータファイルをサポートしています：

- **data.json**: メインのデータファイル（必須、削除不可）
- **data2.json, data3.json, data4.json...**: 追加のデータファイル（オプション）

**データ形式**: v0.6.0以降、全てのデータファイルはJSON形式（data*.json）で管理されます。

#### 1.1.1. 複数データファイルのサポート

- **ファイル名パターン**: `data*.json`（例: data.json, data2.json, data3.json...）
- **配置場所**: `%APPDATA%/quick-dash-launcher/config/`
- **自動検出**: アプリケーション起動時に設定フォルダ内のすべての`data*.json`ファイルを自動的に検出
- **タブ表示**: 設定でタブ表示を有効にすると、各データファイルをタブで切り替えて使用可能
- **ファイル管理**: 設定画面でデータファイルの追加・削除・タブ名のカスタマイズが可能

#### 1.1.2. 必須ファイルと追加ファイル

- **data.json**: 常に必要な必須ファイル。削除不可
- **data2.json以降**: 任意で追加可能。設定画面または手動でファイルを作成
- **作成方法**:
  - 設定画面の「データファイル管理」セクションで➕行追加ボタンをクリック
  - または、設定フォルダに手動でdata*.jsonファイルを作成

### 1.2. 文字エンコーディング

- **UTF-8** (BOMなし)
- **JSON形式**: 標準的なJSON仕様に準拠

## 2. JSON基本構造

### 2.1. ファイルフォーマット

データファイルは以下のJSON構造を持ちます：

```json
{
  "version": "1.0",
  "items": [
    // アイテムの配列
  ]
}
```

### 2.2. トップレベルフィールド

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| **version** | string | ✓ | ファイルフォーマットのバージョン（現在は "1.0"） |
| **items** | array | ✓ | アイテムの配列（JsonItem型） |

### 2.3. アイテムID

各アイテムには一意の8文字のIDが自動的に割り当てられます：

- **形式**: 英数字（A-Z, a-z, 0-9）のランダムな組み合わせ
- **長さ**: 8文字固定
- **例**: `a1B2c3D4`, `xY9z8W7v`
- **用途**: アイテムの編集・削除・並び替え時の識別子

### 2.4. アイテムタイプ

データファイルには以下の4種類のアイテムが存在します：

1. **通常アイテム** (`type: "item"`) - アプリケーション、URL、ファイル、フォルダを起動
2. **フォルダ取込アイテム** (`type: "dir"`) - 指定フォルダ内のファイル/フォルダを自動取込
3. **グループアイテム** (`type: "group"`) - 複数のアイテムをまとめて一括起動
4. **ウィンドウ操作アイテム** (`type: "window"`) - 既存ウィンドウの検索・制御

### 2.5. 基本的な使用例

```json
{
  "version": "1.0",
  "items": [
    {
      "id": "a1B2c3D4",
      "type": "item",
      "displayName": "Google",
      "path": "https://www.google.com"
    },
    {
      "id": "e5F6g7H8",
      "type": "item",
      "displayName": "VSCode",
      "path": "C:\\Program Files\\Microsoft VS Code\\Code.exe",
      "args": "--new-window"
    }
  ]
}
```

## 3. アイテムタイプ詳細

### 3.1. 通常アイテム（JsonLauncherItem）

通常のランチャーアイテムで、アプリケーション、URL、ファイル、フォルダなどを起動します。

#### 3.1.1. フィールド構成

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| **id** | string | ✓ | 8文字の一意ID |
| **type** | "item" | ✓ | アイテムタイプ（常に "item"） |
| **displayName** | string | ✓ | アプリケーション内での表示名 |
| **path** | string | ✓ | ファイルパス、URL、またはコマンド |
| **args** | string | - | コマンドライン引数（オプション） |
| **customIcon** | string | - | カスタムアイコンファイル名（オプション） |
| **windowConfig** | object | - | ウィンドウ制御設定（オプション） |

#### 3.1.2. サポートされるパス種類

- **ファイルパス**: `C:\path\to\file.exe`
- **フォルダパス**: `C:\path\to\folder`
  - パス中にドット（`.`）が含まれるフォルダ名も正しく認識されます（例: `C:\Projects\ver.0.39`）
- **HTTP/HTTPS URL**: `https://example.com`
- **カスタムURIスキーマ**: `obsidian://`, `vscode://`, `ms-excel://` など
- **ショートカットファイル**: `C:\path\to\shortcut.lnk`

#### 3.1.3. 基本的な使用例

```json
{
  "version": "1.0",
  "items": [
    {
      "id": "a1B2c3D4",
      "type": "item",
      "displayName": "Notepad",
      "path": "C:\\Windows\\System32\\notepad.exe"
    },
    {
      "id": "e5F6g7H8",
      "type": "item",
      "displayName": "VSCode",
      "path": "C:\\Program Files\\Microsoft VS Code\\Code.exe",
      "args": "--new-window"
    },
    {
      "id": "i9J0k1L2",
      "type": "item",
      "displayName": "Google",
      "path": "https://www.google.com"
    },
    {
      "id": "m3N4o5P6",
      "type": "item",
      "displayName": "Documents",
      "path": "C:\\Users\\Username\\Documents"
    }
  ]
}
```

#### 3.1.4. カスタムアイコンの使用

カスタムアイコンを使用する場合、`customIcon`フィールドにファイル名を指定します：

```json
{
  "id": "q7R8s9T0",
  "type": "item",
  "displayName": "MyApp",
  "path": "C:\\MyApp\\app.exe",
  "customIcon": "custom-icon.png"
}
```

- **配置場所**: `%APPDATA%/quick-dash-launcher/config/custom-icons/`
- **対応形式**: `.png`, `.jpg`, `.jpeg`, `.ico`, `.svg`

#### 3.1.5. ウィンドウ制御設定（WindowConfig）

アイテム起動時のウィンドウ検索・位置・サイズ制御を設定できます。

##### 3.1.5.1. フィールド詳細

| フィールド | 型 | 必須 | 既定値 | 説明 |
|-----------|-----|------|--------|------|
| **title** | string | ✓ | - | ウィンドウ検索用のタイトル文字列 |
| **exactMatch** | boolean | - | false | true=完全一致、false=部分一致で検索 |
| **processName** | string | - | - | プロセス名で検索対象を絞り込み |
| **activateWindow** | boolean | - | true | ウィンドウを前面に表示してフォーカス |
| **virtualDesktopNumber** | number | - | - | 対象の仮想デスクトップ番号（1から開始） |
| **x** | number | - | - | X座標（仮想スクリーン座標系） |
| **y** | number | - | - | Y座標（仮想スクリーン座標系） |
| **width** | number | - | - | 幅（ピクセル単位） |
| **height** | number | - | - | 高さ（ピクセル単位） |
| **moveToActiveMonitorCenter** | boolean | - | false | アクティブモニター中央に移動（x/y座標は無視） |

##### 3.1.5.2. 動作仕様

1. **ウィンドウ検索**: アイテム起動前に、`title`で指定されたウィンドウを検索
   - `exactMatch`がfalseの場合は部分一致、trueの場合は完全一致
   - 大文字小文字を区別しない
   - `processName`が指定されている場合、プロセス名でも絞り込み
2. **ウィンドウ発見時**:
   - `activateWindow`がtrueの場合、ウィンドウをアクティブ化（前面に表示）
   - `x`, `y`, `width`, `height`が指定されている場合は、ウィンドウの位置・サイズを変更
   - 通常起動は実行しない
3. **ウィンドウ未発見時**: 通常通りアイテムを起動

##### 3.1.5.3. 使用例

```json
{
  "id": "u1V2w3X4",
  "type": "item",
  "displayName": "Chrome (右半分)",
  "path": "chrome.exe",
  "windowConfig": {
    "title": "Google Chrome",
    "x": 960,
    "y": 0,
    "width": 960,
    "height": 1080
  }
}
```

##### 3.1.5.4. マルチモニタ対応

座標系は仮想スクリーン座標（Virtual Screen Coordinates）を使用します：

- プライマリモニターの左上が原点 (0, 0)
- セカンダリモニターは相対位置に配置（例: プライマリが1920x1080、セカンダリが右側なら X=1920 から開始）
- 負の座標も使用可能（プライマリの左側・上側にモニターがある場合）

詳細は **[ウィンドウ制御システム](window-control.md#ウィンドウ位置サイズ制御)** を参照してください。

#### 3.1.6. ショートカットファイルの自動解析

`.lnk` ファイルが検出された場合、以下の処理が実行されます：

1. **ターゲットパス抽出**: ショートカットが指すファイル・フォルダのパス
2. **引数抽出**: ショートカットに設定されたコマンドライン引数
3. **表示名生成**: ショートカットファイル名（.lnk拡張子を除く）

システムは自動的にショートカットを解析し、ターゲットパスと引数を取得します。

### 3.2. フォルダ取込アイテム（JsonDirItem）

指定フォルダ内のファイル/フォルダを自動的にスキャンして取り込むアイテムです。

#### 3.2.1. フィールド構成

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| **id** | string | ✓ | 8文字の一意ID |
| **type** | "dir" | ✓ | アイテムタイプ（常に "dir"） |
| **path** | string | ✓ | スキャン対象のフォルダパス |
| **options** | object | - | スキャンオプション（オプション） |

#### 3.2.2. スキャンオプション（JsonDirOptions）

| オプション | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **depth** | number | 0 | スキャン深度（0=直下のみ、-1=無制限） |
| **types** | string | "both" | `"file"`, `"folder"`, `"both"` |
| **filter** | string | - | ファイル名フィルタ（globパターン）<br>例: `"*.ps1"`, `"*.{doc,docx,pdf}"` |
| **exclude** | string | - | 除外フィルタ（globパターン）<br>例: `"node_modules"`, `"*.{tmp,temp,bak}"` |
| **prefix** | string | - | 表示名のプレフィックス<br>結果: `プレフィックス: アイテム名` |
| **suffix** | string | - | 表示名のサフィックス<br>結果: `アイテム名 (サフィックス)` |

#### 3.2.3. 使用例

```json
{
  "version": "1.0",
  "items": [
    {
      "id": "y5Z6a7B8",
      "type": "dir",
      "path": "C:\\Users\\Username\\Documents"
    },
    {
      "id": "c9D0e1F2",
      "type": "dir",
      "path": "C:\\Projects",
      "options": {
        "depth": 2,
        "types": "file",
        "filter": "*.{js,ts}",
        "exclude": "node_modules",
        "prefix": "Src"
      }
    },
    {
      "id": "g3H4i5J6",
      "type": "dir",
      "path": "C:\\Scripts",
      "options": {
        "filter": "*.ps1",
        "prefix": "Script"
      }
    }
  ]
}
```

#### 3.2.4. 展開時の動作

フォルダ取込アイテムは実行時に以下のように展開されます：

1. **スキャン実行**: 指定されたフォルダをオプションに従ってスキャン
2. **アイテム生成**: 検出されたファイル/フォルダをアイテムとして生成
3. **表示名生成**: prefix/suffixがあれば表示名に適用
4. **アイコン取得**: 各アイテムのアイコンを自動取得

### 3.3. グループアイテム（JsonGroupItem）

複数のアイテムをまとめて一括起動するアイテムです。

#### 3.3.1. フィールド構成

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| **id** | string | ✓ | 8文字の一意ID |
| **type** | "group" | ✓ | アイテムタイプ（常に "group"） |
| **displayName** | string | ✓ | グループの表示名 |
| **itemNames** | array | ✓ | 既存アイテムの名前のリスト |

#### 3.3.2. 動作仕様

グループアイテムは、複数の既存アイテムをまとめて一括起動する機能です：

1. **参照解決**: `itemNames`内のアイテム名は、データファイル内の既存アイテムの`displayName`を参照します
2. **順次実行**: グループ実行時、リストされたアイテムを順番に起動します
3. **実行間隔**: 各アイテムの起動間隔は500ms（固定）です
4. **エラー処理**: 存在しないアイテム名は警告ログを出力してスキップします

#### 3.3.3. 使用例

```json
{
  "version": "1.0",
  "items": [
    {
      "id": "k7L8m9N0",
      "type": "item",
      "displayName": "Visual Studio Code",
      "path": "code.exe"
    },
    {
      "id": "o1P2q3R4",
      "type": "item",
      "displayName": "Slack",
      "path": "slack://"
    },
    {
      "id": "s5T6u7V8",
      "type": "item",
      "displayName": "Chrome",
      "path": "chrome.exe",
      "args": "--new-window https://localhost:3000"
    },
    {
      "id": "w9X0y1Z2",
      "type": "group",
      "displayName": "開発環境",
      "itemNames": [
        "Visual Studio Code",
        "Slack",
        "Chrome"
      ]
    }
  ]
}
```

#### 3.3.4. 表示形式

グループアイテムは、アイテムリストに以下のように表示されます：

- **アイコン**: 📦（デフォルト）
- **表示名**: `グループ名 (N個)`
- **ツールチップ**: `グループ: アイテム名1, アイテム名2, ...`

#### 3.3.5. 設計上の利点

- **DRY原則**: アイテム情報の重複がありません
- **保守性**: アイテムのパス変更時は個別定義のみ修正すればOK
- **可読性**: グループ定義が非常に簡潔
- **一貫性**: 既存アイテムと完全に同じ動作を保証

#### 3.3.6. エラーハンドリング

- **存在しないアイテム名**: 警告ログを出力し、該当アイテムをスキップ
- **部分的な参照エラー**: エラーがあっても残りのアイテムは実行継続
- **循環参照**: グループ内でグループは参照できません（通常アイテムのみ）

### 3.4. ウィンドウ操作アイテム（JsonWindowItem）

既存のウィンドウを検索・制御するアイテムです。アプリケーションを起動せず、既存ウィンドウのみを操作します。

#### 3.4.1. フィールド構成

| フィールド | 型 | 必須 | デフォルト値 | 説明 |
|-----------|-----|------|-------------|------|
| **id** | string | ✓ | - | 8文字の一意ID |
| **type** | "window" | ✓ | - | アイテムタイプ（常に "window"） |
| **displayName** | string | ✓ | - | アイテムリストでの表示名 |
| **windowTitle** | string | ✓ | - | ウィンドウタイトル（検索用） |
| **processName** | string | - | - | プロセス名で検索（部分一致） |
| **x** | number | - | - | X座標（仮想スクリーン座標系） |
| **y** | number | - | - | Y座標（仮想スクリーン座標系） |
| **width** | number | - | - | 幅（ピクセル単位） |
| **height** | number | - | - | 高さ（ピクセル単位） |
| **moveToActiveMonitorCenter** | boolean | - | false | アクティブモニター中央に移動 |
| **virtualDesktopNumber** | number | - | - | 仮想デスクトップ番号（1から開始） |
| **activateWindow** | boolean | - | true | ウィンドウをアクティブにするか |
| **pinToAllDesktops** | boolean | - | - | 全仮想デスクトップにピン止めするか |

#### 3.4.2. 動作仕様

ウィンドウ操作アイテムは、既存のウィンドウを検索・制御する機能です：

1. **ウィンドウ検索**: `windowTitle`で指定されたウィンドウを検索します
   - 部分一致で検索
   - 大文字小文字を区別しない
   - `processName`が指定されている場合、プロセス名でも絞り込み
2. **ウィンドウ発見時**:
   - ウィンドウを復元（最小化解除）
   - `virtualDesktopNumber`が指定されていれば仮想デスクトップを移動
   - `x`, `y`, `width`, `height`が指定されていれば位置・サイズを変更
   - `activateWindow`がtrue（デフォルト）の場合、ウィンドウをアクティブ化
   - **通常起動は実行しません**
3. **ウィンドウ未発見時**: 警告ログを出力し、何も実行しません

#### 3.4.3. 使用例

```json
{
  "version": "1.0",
  "items": [
    {
      "id": "a3B4c5D6",
      "type": "window",
      "displayName": "VSCode",
      "windowTitle": "Visual Studio Code"
    },
    {
      "id": "e7F8g9H0",
      "type": "window",
      "displayName": "Chrome右半分",
      "windowTitle": "Google Chrome",
      "x": 960,
      "y": 0,
      "width": 960,
      "height": 1080
    },
    {
      "id": "i1J2k3L4",
      "type": "window",
      "displayName": "開発用Slack",
      "windowTitle": "Slack",
      "virtualDesktopNumber": 2
    },
    {
      "id": "m5N6o7P8",
      "type": "window",
      "displayName": "Terminal",
      "windowTitle": "Windows PowerShell",
      "x": 100,
      "y": 100,
      "width": 800,
      "height": 600,
      "activateWindow": false
    }
  ]
}
```

#### 3.4.4. マルチモニタ対応

座標系は仮想スクリーン座標（Virtual Screen Coordinates）を使用します：

- プライマリモニターの左上が原点 (0, 0)
- セカンダリモニターは相対位置に配置（例: プライマリが1920x1080、セカンダリが右側なら X=1920 から開始）
- 負の座標も使用可能（プライマリの左側・上側にモニターがある場合）

詳細は **[ウィンドウ制御システム](window-control.md#ウィンドウ位置サイズ制御)** を参照してください。

#### 3.4.5. 表示形式

ウィンドウ操作アイテムは、アイテムリストに以下のように表示されます：

- **アイコン**: 🪟（デフォルト）
- **表示名**: `🪟 ウィンドウタイトル`
- **ツールチップ**: ウィンドウタイトル、位置・サイズ、仮想デスクトップ番号などの設定内容

#### 3.4.6. 設計上の利点

- **アプリケーション起動不要**: 既存ウィンドウのみを制御するため、アプリケーションの起動は不要です
- **高速な切り替え**: 新規起動よりも高速にウィンドウを表示できます
- **ウィンドウ配置の自動化**: マルチモニタ環境でのウィンドウ配置を自動化できます
- **仮想デスクトップ対応**: 仮想デスクトップ機能を活用できます

#### 3.4.7. 制約事項

- **グループからの参照**: グループアイテムからは参照できません（通常アイテムのみ）
- **ワークスペース**: 現時点ではワークスペース機能には対応していません
- **実行履歴**: 実行履歴には記録されません
- **インライン編集**: 管理画面（EditableRawItemList）では、JSON文字列の破損を防ぐため、ウィンドウ操作アイテムのインライン編集はできません。編集する場合は、✏️ボタンから詳細編集モーダル（RegisterModal）を開いてください。

#### 3.4.8. エラーハンドリング

- **ウィンドウ未検出時**: 警告ログを出力し、何も実行しません
- **無効な座標・サイズ**: 無効な値（負の幅・高さなど）は無視されます
- **無効なvirtualDesktopNumber**: 1未満の値や存在しないデスクトップ番号は無視されます

## 4. 重複排除ルール

QuickDashLauncherは、アイテムの重複を自動的に排除します。

### 4.1. 重複判定の基準

以下の3つの要素が一致するアイテムを「重複」と判定します：

- **表示名** (`displayName`)
- **パスまたはURL** (`path`)
- **引数** (`args`) ※ 存在する場合のみ

### 4.2. 重複排除の単位

v0.4.2以降、重複排除は**タブ単位**で実行されます：

- **同一タブ内**: 重複するアイテムは1つのみ表示されます
  - 例: メインタブ = [data.json, data3.json] の場合、両ファイルに同じアイテムがあれば1つだけ表示
- **異なるタブ間**: 重複するアイテムが複数のタブに表示されます
  - 例: メインタブとサブ1タブに同じアイテムがあれば、両方のタブで表示される

### 4.3. 具体例

**設定:**
```json
{
  "dataFileTabs": [
    { "files": ["data.json", "data3.json"], "name": "メイン" },
    { "files": ["data2.json"], "name": "サブ1" }
  ]
}
```

**データファイル:**
- data.json: アイテム「GitHub」（https://github.com/）
- data2.json: アイテム「GitHub」（https://github.com/）
- data3.json: アイテム「GitHub」（https://github.com/）

**表示結果:**
- **メインタブ**: GitHub 1つ（data.jsonとdata3.jsonの重複を排除）
- **サブ1タブ**: GitHub 1つ（data2.jsonから）

### 4.4. タブに属さないファイル

タブ設定に含まれていないデータファイル（例: data4.json）は、独立したタブとして扱われます：

- ファイル内では重複排除が行われます
- 他のタブとは独立して重複判定が行われます
- ただし、タブ表示が有効な場合、UIには表示されません

### 4.5. グループアイテムの扱い

グループアイテム（`type: "group"`）は重複チェックの対象外です：

- 同じ名前のグループが複数のタブに存在しても、すべて表示されます
- これは、同じ名前でも参照するアイテムが異なる可能性があるためです

## 5. エラー処理とフォールバック

### 5.1. 無効なアイテムの処理

- **構文エラー**: 必須フィールドが不足しているアイテムはスキップ
- **存在しないパス**: ログに警告を出力してアイテムリストから除外
- **アクセス権限エラー**: 該当アイテムをスキップして処理続行

### 5.2. フォルダ取込アイテムのエラー処理

- **存在しないディレクトリ**: 該当アイテムをスキップ
- **アクセス権限不足**: アクセス可能なアイテムのみ処理
- **無効なオプション値**: デフォルト値を使用して処理続行

## 6. データ型定義（TypeScript）

### 6.1. JSON形式の型定義

#### 6.1.1. JsonDataFile

```typescript
interface JsonDataFile {
  /** ファイルフォーマットのバージョン */
  version: string; // "1.0"
  /** アイテムの配列 */
  items: JsonItem[];
}
```

#### 6.1.2. JsonItem

```typescript
type JsonItem = JsonLauncherItem | JsonDirItem | JsonGroupItem | JsonWindowItem;
```

#### 6.1.3. JsonLauncherItem

```typescript
interface JsonLauncherItem {
  /** 8文字の一意ID */
  id: string;
  /** アイテムタイプ */
  type: 'item';
  /** 表示名 */
  displayName: string;
  /** ファイルパス、URL、またはコマンド */
  path: string;
  /** コマンドライン引数（オプション） */
  args?: string;
  /** カスタムアイコンファイル名（オプション） */
  customIcon?: string;
  /** ウィンドウ制御設定（オプション） */
  windowConfig?: WindowConfig;
}
```

#### 6.1.4. JsonDirItem

```typescript
interface JsonDirItem {
  /** 8文字の一意ID */
  id: string;
  /** アイテムタイプ */
  type: 'dir';
  /** スキャン対象のフォルダパス */
  path: string;
  /** スキャンオプション（オプション） */
  options?: JsonDirOptions;
}

interface JsonDirOptions {
  /** スキャンする深さ（0=サブフォルダなし、デフォルト） */
  depth?: number;
  /** 取り込むアイテムの種類 */
  types?: 'file' | 'folder' | 'both';
  /** ファイル名フィルタ（ワイルドカード対応、例: "*.exe"） */
  filter?: string;
  /** 除外フィルタ（ワイルドカード対応、例: "*.tmp"） */
  exclude?: string;
  /** 表示名のプレフィックス */
  prefix?: string;
  /** 表示名のサフィックス */
  suffix?: string;
}
```

#### 6.1.5. JsonGroupItem

```typescript
interface JsonGroupItem {
  /** 8文字の一意ID */
  id: string;
  /** アイテムタイプ */
  type: 'group';
  /** グループの表示名 */
  displayName: string;
  /** グループ内で参照するアイテム名のリスト */
  itemNames: string[];
}
```

#### 6.1.6. JsonWindowItem

```typescript
interface JsonWindowItem {
  /** 8文字の一意ID */
  id: string;
  /** アイテムタイプ */
  type: 'window';
  /** アイテムリストでの表示名 */
  displayName: string;
  /** ウィンドウタイトル（検索用、ワイルドカード対応） */
  windowTitle: string;
  /** プロセス名で検索（部分一致、オプション） */
  processName?: string;
  /** X座標（仮想スクリーン座標系、オプション） */
  x?: number;
  /** Y座標（仮想スクリーン座標系、オプション） */
  y?: number;
  /** 幅（オプション） */
  width?: number;
  /** 高さ（オプション） */
  height?: number;
  /** アクティブモニターの中央に移動するか（オプション） */
  moveToActiveMonitorCenter?: boolean;
  /** 仮想デスクトップ番号（1から開始、オプション） */
  virtualDesktopNumber?: number;
  /** ウィンドウをアクティブにするか（デフォルト: true、オプション） */
  activateWindow?: boolean;
  /** 全仮想デスクトップにピン止めするか（オプション） */
  pinToAllDesktops?: boolean;
}
```

#### 6.1.7. WindowConfig

```typescript
interface WindowConfig {
  /** ウィンドウタイトル（検索用、必須） */
  title: string;
  /** 完全一致で検索するか（省略時はfalse = 部分一致） */
  exactMatch?: boolean;
  /** プロセス名で検索（部分一致、省略時は検索なし） */
  processName?: string;
  /** X座標（仮想スクリーン座標系、省略時は位置変更なし） */
  x?: number;
  /** Y座標（仮想スクリーン座標系、省略時は位置変更なし） */
  y?: number;
  /** 幅（省略時はサイズ変更なし） */
  width?: number;
  /** 高さ（省略時はサイズ変更なし） */
  height?: number;
  /** 仮想デスクトップ番号（1から開始、省略時は移動なし） */
  virtualDesktopNumber?: number;
  /** ウィンドウをアクティブにするかどうか（省略時はtrue） */
  activateWindow?: boolean;
  /** アクティブモニター中央に移動するか（省略時はfalse） */
  moveToActiveMonitorCenter?: boolean;
}
```

### 6.2. 内部型定義

#### 6.2.1. LauncherItem（内部型）

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
  jsonItemId?: string;       // JSON形式のアイテムID（8文字）
  windowConfig?: WindowConfig; // ウィンドウ制御設定
}
```

#### 6.2.2. GroupItem（内部型）

```typescript
interface GroupItem {
  name: string;              // グループの表示名
  type: 'group';             // アイテムタイプ（常に'group'）
  itemNames: string[];       // グループ内で参照するアイテム名のリスト
  sourceFile?: string;       // 元データファイル名
  lineNumber?: number;       // データファイル内の行番号
  isEdited?: boolean;        // 編集フラグ
  jsonItemId?: string;       // JSON形式のアイテムID（8文字）
}
```

#### 6.2.3. WindowOperationItem（内部型）

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
  jsonItemId?: string;       // JSON形式のアイテムID（8文字）
}
```

#### 6.2.4. AppItem

```typescript
// LauncherItem、GroupItem、WindowOperationItemの統合型
type AppItem = LauncherItem | GroupItem | WindowOperationItem | WindowInfo;
```

### 6.3. ワークスペース関連型

#### 6.3.1. DragItemData

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

#### 6.3.2. DropTargetData

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

#### 6.3.3. ArchivedWorkspaceGroup

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

#### 6.3.4. ArchivedWorkspaceItem

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

### 6.4. 検索関連型

#### 6.4.1. SearchMode

```typescript
/**
 * 検索モードを表す型
 * normal: 通常のアイテム検索モード
 * window: ウィンドウ検索モード
 * history: 実行履歴検索モード
 */
export type SearchMode = 'normal' | 'window' | 'history';
```

#### 6.4.2. SearchHistoryEntry

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

#### 6.4.3. SearchHistoryState

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

## 7. ワークスペースデータ

ワークスペース機能で使用されるデータファイルの形式です。

### 7.1. workspace.json

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
      "type": "url | file | folder | app | customUri | group",
      "icon": "base64エンコードされたアイコン（オプション）",
      "customIcon": "カスタムアイコンファイル名（オプション）",
      "args": "引数（オプション）",
      "originalPath": "ショートカットのリンク先（オプション）",
      "itemNames": ["アイテム名1", "アイテム名2"],
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

**備考**:
- **v0.5.19以降**: `type` に `'group'` が追加され、グループアイテムをワークスペースに追加可能
- **v0.5.19以降**: `itemNames` フィールドはグループアイテム専用（`type='group'` の場合のみ使用）

### 7.2. execution-history.json

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
      "itemNames": ["アイテム名1", "アイテム名2"],
      "executedAt": 1234567890
    }
  ]
}
```

**特徴**:
- 最大10件まで保持
- 古い履歴から自動削除
- メイン画面でアイテムを起動するたびに自動追加
- **v0.5.19以降**: `itemType` に `'group'` が追加され、グループアイテムの実行履歴も記録可能
- **v0.5.19以降**: `itemNames` フィールドはグループアイテム専用（`itemType='group'` の場合のみ使用）

### 7.3. workspace-archive.json

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

## 8. 関連ドキュメント

- **[アイテム管理](../screens/admin-window.md#6-アイテム管理の詳細)** - データファイルの編集機能
- **[フォルダ取込](../screens/register-modal.md#6-フォルダ取込アイテムの詳細)** - フォルダ取込機能の詳細
- **[ワークスペース](../features/workspace.md)** - ワークスペース機能の使い方
- **[開発ガイド](../setup/development.md)** - 開発時の注意事項
