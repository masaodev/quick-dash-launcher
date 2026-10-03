# データファイル形式仕様

QuickDashLauncherのデータファイル形式の完全な仕様です。

## 1. ファイル概要

### 1.1. 対象ファイル

QuickDashLauncherは複数のJSON形式のデータファイルをサポートしています：

- **data.json**: メインのデータファイル（必須、削除不可）
- **data2.json, data3.json, data4.json...**: 追加のデータファイル（オプション）

CSV 形式（`data*.txt`）は v0.6.1 で廃止しました。経緯は v0.6.1 のリリースノートと git の履歴にあります。

#### 1.1.1. 複数データファイルのサポート

- **ファイル名パターン**: `data*.json`（例: data.json, data2.json, data3.json...）
- **配置場所**: `%APPDATA%/quick-dash-launcher/config/datafiles/`
- **自動検出**: アプリケーション起動時に設定フォルダ内のすべての`data*.json`ファイルを自動的に検出
- **タブ表示**: 設定でタブ表示を有効にすると、各データファイルをタブで切り替えて使用可能
- **ファイル管理**: 設定画面でデータファイルの追加・削除・タブ名のカスタマイズが可能

#### 1.1.2. 必須ファイルと追加ファイル

- **data.json**: 常に必要な必須ファイル。削除不可
- **data2.json以降**: 任意で追加可能。設定画面または手動でファイルを作成
- **作成方法**:
  - 設定画面の「データファイル管理」セクションで➕行追加ボタンをクリック
  - または、設定フォルダに手動でdata*.jsonファイルを作成

### 1.2. アイコンキャッシュの構造

アイコンは `%APPDATA%/quick-dash-launcher/config/icon-cache/` 以下にサブフォルダで分類されます：

| サブフォルダ             | 説明                             | ファイル名形式                     |
| ------------------------ | -------------------------------- | ---------------------------------- |
| `icon-cache/apps/`       | EXEファイルのアイコン            | `{basename}_icon.png`              |
| `icon-cache/apps/`       | ショートカット（.lnk）のアイコン | `{name}_lnk_icon.png`              |
| `icon-cache/apps/`       | カスタムURIスキームのアイコン    | `uri_{scheme}_icon.png`            |
| `icon-cache/apps/`       | 登録アプリ（UWP）のアイコン      | `uwp_{PackageFamilyName}_icon.png` |
| `icon-cache/favicons/`   | WebサイトのFavicon               | URL由来のファイル名                |
| `icon-cache/custom/`     | カスタムアイコン（手動設定）     | 任意のファイル名                   |
| `icon-cache/extensions/` | ファイル拡張子のアイコン         | `ext_{ext}_icon.png`               |

ショートカットの `{name}` は `.lnk` を除いたファイル名です（リンク先が `.lnk` のときはそちらの名前。`src/main/utils/iconCacheKeys.ts`）。

データファイルの `customIcon` フィールドは `icon-cache/custom/` 内のファイル名を指定します。

### 1.3. 文字エンコーディング

- **UTF-8** (BOMなし)
- **JSON形式**: 標準的なJSON仕様に準拠

## 2. JSON基本構造

### 2.1. ファイルフォーマット

データファイルは以下のJSON構造を持ちます：

```json
{
  "$schema": "../schemas/data.schema.json",
  "version": "1.0",
  "items": [
    // アイテムの配列
  ]
}
```

### 2.2. トップレベルフィールド

| フィールド  | 型     | 必須 | 説明                                                                                                                                                                                                                                               |
| ----------- | ------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **$schema** | string | -    | JSON Schema への参照（エディタ補完・検証用）。QDL が書き戻すときに `../schemas/data.schema.json`（`config/schemas/` に起動時コピーされる同梱スキーマ）を補う。無い・違う値のときは読み込み時に補正して書き戻し、レポートに `normalized` として載る |
| **version** | string | ✓    | ファイルフォーマットのバージョン（現在は "1.0"）                                                                                                                                                                                                   |
| **items**   | array  | ✓    | アイテムの配列（JsonItem型）                                                                                                                                                                                                                       |

書き戻し時のキー順は `$schema` → `version` → `items` に固定されます（`serializeJsonDataFile`）。

### 2.3. アイテムID

各アイテムには一意の8文字のIDが自動的に割り当てられます：

- **形式**: 英数字（A-Z, a-z, 0-9）のランダムな組み合わせ
- **長さ**: 8文字固定
- **例**: `a1B2c3D4`, `xY9z8W7v`
- **用途**: アイテムの編集・削除・並び替え時の識別子

### 2.4. アイテムタイプ

データファイルには以下の6種類のアイテムが存在します：

1. **通常アイテム** (`type: "item"`) - アプリケーション、URL、ファイル、フォルダを起動
2. **フォルダ取込アイテム** (`type: "dir"`) - 指定フォルダ内のファイル/フォルダを自動取込
3. **グループアイテム** (`type: "group"`) - 複数のアイテムをまとめて一括起動
4. **ウィンドウアイテム** (`type: "window"`) - 既存ウィンドウの検索・制御
5. **クリップボードアイテム** (`type: "clipboard"`) - クリップボードの内容を保存・復元
6. **レイアウトアイテム** (`type: "layout"`) - 複数ウィンドウの位置・サイズを一括でキャプチャ・復元

### 2.5. 基本的な使用例

```json
{
  "$schema": "../schemas/data.schema.json",
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

フィールドの一覧・型は、型定義（`src/common/types/json-data.ts`。`WindowConfig`・`LayoutWindowEntry` は `src/common/types/launcher.ts`）と JSON Schema（`assets/schemas/data.schema.json`）を正とします（[6 章](#6-データ型定義typescript)）。この章には、各アイテムの必須フィールド・既定値・省略時の扱い・注意点と、実行時の挙動だけを書きます。

- 全アイテムが `id`（必須。8 文字の英数字、2.3）と、任意の `memo`（自由記述メモ）・`updatedAt`（更新日時、Unix タイムスタンプ ms）を持つ
- 読み込み時の検証は `src/common/utils/jsonParser.ts` が行う。必須フィールドが欠けた・型が違うアイテムはスキップされる（5.1）。スキーマにない未知のフィールドは黙って落ちる

### 3.1. 通常アイテム（JsonLauncherItem）

通常のランチャーアイテムで、アプリケーション、URL、ファイル、フォルダなどを起動します。

#### 3.1.1. フィールドの要点

- **必須**: `type: "item"`・`displayName`（表示名）・`path`（ファイルパス・URL・コマンド）。`displayName` と `path` は空文字不可
- **任意**: `args`（コマンドライン引数）・`customIcon`（3.1.4）・`windowConfig`（3.1.5）・`autoImportRuleId`
- `autoImportRuleId` は自動取込ルールの ID。このフィールドがあるアイテムは自動取込の管理対象になる

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

- **配置場所**: `%APPDATA%/quick-dash-launcher/config/icon-cache/custom/`
- **対応形式**: `.png`, `.jpg`, `.jpeg`, `.ico`, `.svg`

#### 3.1.5. ウィンドウ制御設定（WindowConfig）

アイテム起動時のウィンドウ検索・位置・サイズ制御を設定できます。

##### 3.1.5.1. フィールドの要点

- **`title`**: 検索するウィンドウタイトル（ワイルドカード可、3.1.5.2）。型定義と JSON Schema では必須だが、読み込み時は古いデータとの互換のため省略を許し、`''` で補う（`validateWindowConfig`）
- **`processName`**: プロセス名で絞り込む（部分一致）
- **`x`・`y`・`width`・`height`**: 指定した値だけ変更する（仮想スクリーン座標、3.1.5.5）。省略時は変更しない
- **`moveToActiveMonitorCenter`**（既定 false）: マウスカーソルのあるモニターの中央へ移動する。`x`・`y` は計算した中央座標で置き換わる
- **`virtualDesktopNumber`**: 移動先の仮想デスクトップ番号（1 始まり）。省略時は移動しない。`pinToAllDesktops` が true のときは使わない
- **`activateWindow`**（既定 true）: false のときは前面化しない
- **`pinToAllDesktops`**（既定 false）: 全仮想デスクトップにピン止めする

##### 3.1.5.2. ワイルドカード検索

タイトル検索では以下のワイルドカード文字が使用可能です：

| 文字 | 説明                    | 例                                              |
| ---- | ----------------------- | ----------------------------------------------- |
| `*`  | 任意の0文字以上の文字列 | `*Chrome*` は "Google Chrome - タブ名" にマッチ |
| `?`  | 任意の1文字             | `Chrome ?` は "Chrome 1" にマッチ               |

- ワイルドカード文字が含まれていない場合は完全一致検索
- 大文字小文字は区別しない

##### 3.1.5.3. 動作仕様

1. **ウィンドウ検索**: アイテム起動前に、`title`で指定されたウィンドウを検索
   - ワイルドカード文字（`*` または `?`）が含まれている場合はワイルドカードマッチング
   - 含まれていない場合は完全一致検索
   - 大文字小文字を区別しない
   - `processName`が指定されている場合、プロセス名でも絞り込み
2. **ウィンドウ発見時**:
   - 3.4.2 の「ウィンドウ発見時」と同じ手順（復元 → ピン止め → 位置・サイズ → 仮想デスクトップ移動 → アクティブ化）でウィンドウを操作する（`tryActivateWindow`、`src/main/utils/windowActivator.ts`）
   - 通常起動は実行しない。ただし `activateWindow` が true で前面化に失敗したときは、通常起動に進む（`src/main/ipc/itemHandlers.ts` の `openItem`）
3. **ウィンドウ未発見時**: 通常通りアイテムを起動

##### 3.1.5.4. 使用例

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

##### 3.1.5.5. マルチモニタ対応

座標系は仮想スクリーン座標（Virtual Screen Coordinates）を使用します：

- プライマリモニターの左上が原点 (0, 0)
- セカンダリモニターは相対位置に配置（例: プライマリが1920x1080、セカンダリが右側なら X=1920 から開始）
- 負の座標も使用可能（プライマリの左側・上側にモニターがある場合）

詳細は **[ウィンドウ制御システム](../window-control.md#ウィンドウ位置サイズ制御)** を参照してください。

#### 3.1.6. ショートカットファイルの自動解析

`path` が実在する `.lnk` ファイルのとき、読み込み時にショートカットを解析します（`processShortcut`、`src/main/ipc/directoryScanner.ts`）：

1. **ターゲットパス抽出**: ショートカットが指すファイル・フォルダのパスを取り出す（`path` は `.lnk` のまま）
2. **引数抽出**: ショートカットに設定されたコマンドライン引数を使う
3. **表示名**: JSON の `displayName` をそのまま使う。ショートカットのファイル名（`.lnk` を除く）を表示名にするのは、フォルダ取込（3.2）で展開したときだけ

解析できなかったときは、通常のアイテムとして扱います。

### 3.2. フォルダ取込アイテム（JsonDirItem）

指定フォルダ内のファイル/フォルダを自動的にスキャンして取り込むアイテムです。

#### 3.2.1. フィールドの要点

- **必須**: `type: "dir"`・`path`（スキャン対象のフォルダパス。空文字不可）
- **任意**: `options`（3.2.2）
- `displayName` は持たない。表示名は取り込んだファイル・フォルダの名前になる

#### 3.2.2. スキャンオプション（JsonDirOptions）

すべて任意です。省略時の既定値は `DIR_OPTIONS_DEFAULTS`（`src/common/types/json-data.ts`）にあります。

- **`depth`**（既定 0）: スキャンの深さ。0 は直下のみ、-1 は無制限
- **`types`**（既定 `"both"`）: 取り込む種類。`"file"`・`"folder"`・`"both"` のどれか
- **`filter`**: 取り込むファイル名の glob パターン（例: `"*.ps1"`、`"*.{doc,docx,pdf}"`）
- **`exclude`**: 除外する glob パターン（例: `"node_modules"`、`"*.{tmp,temp,bak}"`）
- **`prefix`**: 表示名の前に付ける。結果は `プレフィックス: アイテム名`
- **`suffix`**: 表示名の後に付ける。結果は `アイテム名 (サフィックス)`

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

フォルダ取込アイテムはデータファイルの読み込み時に以下のように展開されます（`processDirectoryItem`、`src/main/ipc/directoryScanner.ts`）：

1. **スキャン実行**: 指定されたフォルダをオプションに従ってスキャン
2. **アイテム生成**: 検出されたファイル/フォルダをアイテムとして生成（`.lnk` は 3.1.6 の解析を行い、ファイル名を表示名にする）
3. **表示名生成**: prefix/suffixがあれば表示名に適用
4. **アイコン**: 読み込み時は、キャッシュ済みのアイコンを読み込むだけ（`src/renderer/App.tsx` の `loadItems`）。キャッシュにないアイコンの取得・抽出は、利用者がアイコンの取得を操作したときに行う（`src/renderer/hooks/useIconFetcher.ts`）

### 3.3. グループアイテム（JsonGroupItem）

複数のアイテムをまとめて一括起動するアイテムです。

#### 3.3.1. フィールドの要点

- **必須**: `type: "group"`・`displayName`（空文字不可）・`itemNames`（文字列の配列）
- `itemNames` には、起動するアイテムの `displayName` を並べる

#### 3.3.2. 動作仕様

グループアイテムは、複数の既存アイテムをまとめて一括起動する機能です（`executeGroup`、`src/main/ipc/itemHandlers.ts`）：

1. **参照解決**: `itemNames`内のアイテム名は、既存の通常アイテム（フォルダ取込で展開した項目を含む）とウィンドウアイテムの`displayName`を参照します
2. **実行方式**: 設定 `parallelGroupLaunch` が false（既定）のときは、リストの順に1件ずつ起動します。true のときは全件を同時に（並列で）起動します
3. **実行間隔**: 順次起動のときだけ、各アイテムの間に100ms（`GROUP_LAUNCH_DELAY_MS`、`src/common/constants.ts`）待ちます。並列起動では待ちません
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
      "itemNames": ["Visual Studio Code", "Slack", "Chrome"]
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
- **参照できる種類**: 通常アイテムとウィンドウアイテムだけ。グループ・クリップボード・レイアウトの名前は見つからない扱いになる（グループからグループは参照できないため、循環参照は起きない）

### 3.4. ウィンドウアイテム（JsonWindowItem）

既存のウィンドウを検索・制御するアイテムです。アプリケーションを起動せず、既存ウィンドウのみを操作します。

#### 3.4.1. フィールドの要点

- **必須**: `type: "window"`・`displayName`（表示名）・`windowTitle`（検索するウィンドウタイトル）。どちらも空文字不可。ただし `windowTitle` が空でも `processName` があれば、読み込み時に `"*"` へ補正する（下の「プロセス名だけで検索したいとき」）
- **任意**: `processName`・`x`・`y`・`width`・`height`・`moveToActiveMonitorCenter`・`virtualDesktopNumber`・`activateWindow`・`pinToAllDesktops`。意味と既定値は `windowConfig`（3.1.5.1）と同じ（`activateWindow` は既定 true、`moveToActiveMonitorCenter`・`pinToAllDesktops` は既定 false）

#### 3.4.2. 動作仕様

ウィンドウ操作アイテムは、既存のウィンドウを検索・制御する機能です（`tryActivateWindow`、`src/main/utils/windowActivator.ts`）：

1. **ウィンドウ検索**: `windowTitle`で指定されたウィンドウを検索します
   - ワイルドカード文字（`*` または `?`）が含まれている場合はワイルドカードマッチング
   - 含まれていない場合は大文字小文字を区別しない**完全一致**検索
   - `processName`が指定されている場合、小文字化した**部分一致**でさらに絞り込み（タイトル条件とのAND）
2. **ウィンドウ発見時**: 次の順に操作します
   1. ウィンドウを復元（最小化解除）
   2. `pinToAllDesktops`がtrueなら全仮想デスクトップにピン止め
   3. `x`, `y`, `width`, `height`（または`moveToActiveMonitorCenter`）が指定されていれば位置・サイズを変更
   4. `virtualDesktopNumber`が指定されていれば仮想デスクトップを移動。位置・サイズの指定があれば、移動後に指定値で設定し直す。ピン止めしたときは移動しない
   5. `activateWindow`がtrue（デフォルト）の場合、ウィンドウをアクティブ化
   - **通常起動は実行しません**
3. **ウィンドウ未発見時**: 警告ログを出力し、何も実行しません

##### プロセス名だけで検索したいとき

タイトルを指定せずプロセス名だけで探したい場合は、`windowTitle` を全一致ワイルドカード `"*"` にします（空文字は完全一致で何にもマッチしないため）。

- 登録フォームでタイトルを空にしてプロセス名だけ指定すると、保存時に自動的に `"*"` へ正規化されます（`normalizeWindowTitleForProcessOnly`）
- データファイルを直接編集してタイトルを空のままにした場合も、読み込み時（寛容パース）に `"*"` へ補正され、書き戻されます。この補正は読み込みレポート（`last-load-report.json`）に `kind: "normalized"` として記録されます

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

詳細は **[ウィンドウ制御システム](../window-control.md#ウィンドウ位置サイズ制御)** を参照してください。

#### 3.4.5. 表示形式

ウィンドウ操作アイテムは、アイテムリストに以下のように表示されます：

- **アイコン**: 🪟（アイコン欄に表示）
- **表示名**: `displayName`（`src/renderer/components/LauncherItemList.tsx`）
- **ツールチップ**: ウィンドウタイトル、位置・サイズ、仮想デスクトップ番号などの設定内容

#### 3.4.6. 設計上の利点

- **アプリケーション起動不要**: 既存ウィンドウのみを制御するため、アプリケーションの起動は不要です
- **高速な切り替え**: 新規起動よりも高速にウィンドウを表示できます
- **ウィンドウ配置の自動化**: マルチモニタ環境でのウィンドウ配置を自動化できます
- **仮想デスクトップ対応**: 仮想デスクトップ機能を活用できます

#### 3.4.7. 制約事項

- **グループからの参照**: グループアイテムの `itemNames` から参照できます（3.3.2）
- **ワークスペース**: ワークスペースにも追加できます（`src/common/types/json-workspace.ts` の `type: "window"`。`windowTitle` の補正は `src/common/utils/workspaceParser.ts` も同じ）。詳細は[ワークスペースファイル形式](workspace-format.md)を参照
- **セル編集**: アイテム管理の一覧では、名前はセルで編集できますが、パス欄（ウィンドウタイトルなど）はセルで編集できません。✏️ボタンかダブルクリックで詳細編集を開いて編集してください（`src/renderer/components/AdminItemManagerRow.tsx`）

#### 3.4.8. エラーハンドリング

- **ウィンドウ未検出時**: 警告ログを出力し、何も実行しません
- **無効な座標・サイズ**: 無効な値（負の幅・高さなど）は無視されます
- **無効なvirtualDesktopNumber**: 1未満の値や存在しないデスクトップ番号は無視されます

### 3.5. クリップボードアイテム（JsonClipboardItem）

クリップボードの内容（テキスト、HTML、RTF、画像）を保存し、後から復元できるアイテムです。

#### 3.5.1. フィールドの要点

- **必須**: `type: "clipboard"`・`displayName`（空文字不可）・`dataFileRef`・`savedAt`（保存日時、Unix タイムスタンプ ms）・`formats`（3.5.4 のフォーマット名の配列）
- **任意**: `preview`（プレビュー文字列、最初の100文字程度）・`customIcon`
- `dataFileRef` は実データファイルへの参照で、QDL が保存時に `clipboard-data/<ID>.json` の形で書く（3.5.3。`src/main/services/clipboardService.ts`）。通常は手で書かない

#### 3.5.2. 基本的な使用例

```json
{
  "version": "1.0",
  "items": [
    {
      "id": "a1B2c3D4",
      "type": "clipboard",
      "displayName": "コピーしたテキスト",
      "dataFileRef": "clipboard-data/k3M4n5P6.json",
      "savedAt": 1706832000000,
      "formats": ["text", "html"],
      "preview": "Hello, World! This is..."
    }
  ]
}
```

#### 3.5.3. データファイル

クリップボードの実データは別ファイル（`clipboard-data/{id}.json`）に保存されます：

**保存場所**: `%APPDATA%/quick-dash-launcher/config/clipboard-data/`

**データ形式**:

```json
{
  "formats": ["text", "html"],
  "text": "Hello, World!",
  "html": "<p>Hello, World!</p>",
  "savedAt": 1706832000000,
  "dataSize": 1024
}
```

#### 3.5.4. サポートされるフォーマット

| フォーマット | 説明                                   |
| ------------ | -------------------------------------- |
| **text**     | プレーンテキスト                       |
| **html**     | HTML形式                               |
| **rtf**      | リッチテキスト形式                     |
| **image**    | 画像（Base64エンコード、最大10MB）     |
| **file**     | ファイルパス（参照のみ、復元は非対応） |

#### 3.5.5. 制約事項

- **画像サイズ**: 最大10MBまで
- **ファイル復元**: Electronの制限により、ファイルの復元は非対応（パスの参照のみ）
- **グループからの参照**: グループアイテムからは参照できません

### 3.6. レイアウトアイテム（JsonLayoutItem）

複数ウィンドウの位置・サイズを一括でキャプチャ・復元するアイテムです。ウィンドウのキャプチャ操作（ウィンドウ管理画面）でQDLが生成し、通常は手で書きません。

#### 3.6.1. フィールドの要点

- **必須**: `type: "layout"`・`displayName`（空文字不可）・`entries`（3.6.2 の配列）
- **任意**: `customIcon`
- `entries` は読み込み時に配列であることだけを確かめる（中身は検証しない）。編集画面での保存時は 1 件以上が必要（3.6.4）

#### 3.6.2. ウィンドウエントリ（LayoutWindowEntry）

`entries` の各要素は、キャプチャした1ウィンドウ分の位置・サイズとアプリ起動設定を保持します。

- **必須**: `windowTitle`（検索するウィンドウタイトル）・`launchApp`（アプリを起動するか。false のときは既存ウィンドウの位置変更だけ）
- **任意**: `processName`（部分一致）・`executablePath`（起動する実行ファイル）・`args`・`x`・`y`・`width`・`height`・`virtualDesktopNumber`
- `icon` は UI 表示専用のランタイム情報（base64 データ URL）で、**JSON 保存時に除去される**（`stripIconFromLayoutEntries`）。読み込み時に `executablePath` からキャッシュ済みアイコンを補う

#### 3.6.3. 使用例

```json
{
  "version": "1.0",
  "items": [
    {
      "id": "n7O8p9Q0",
      "type": "layout",
      "displayName": "開発レイアウト",
      "entries": [
        {
          "windowTitle": "Visual Studio Code",
          "processName": "code",
          "x": 0,
          "y": 0,
          "width": 960,
          "height": 1080,
          "launchApp": false
        },
        {
          "windowTitle": "*Slack*",
          "processName": "slack",
          "executablePath": "C:\\Users\\Username\\AppData\\Local\\slack\\slack.exe",
          "x": 960,
          "y": 0,
          "width": 960,
          "height": 1080,
          "launchApp": true
        }
      ]
    }
  ]
}
```

#### 3.6.4. 検証

- `validateJsonLayoutItem`（`src/common/utils/jsonParser.ts`）: `displayName` が空でない文字列であること、`entries` が配列であることを検証
- `validateEditableItem`（`src/common/types/editableItem.ts`）: 編集画面での保存時、`entries` が空だとエラー（`layoutのentriesが空です`）

#### 3.6.5. 制約事項

- **グループからの参照**: グループアイテムからは参照できません（参照できるのは通常アイテムとウィンドウアイテムだけ）
- **アイコンの非永続化**: `icon` フィールドはランタイム表示専用で、JSON保存時は常に除去されます

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
    { "files": ["datafiles/data.json", "datafiles/data3.json"], "name": "メイン" },
    { "files": ["datafiles/data2.json"], "name": "サブ1" }
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

タブ設定に含まれていないデータファイル（例: data4.json）は、すべてまとめて 1 つのタブ番号（`-1`）として扱われます（`src/main/services/data/dataFileLoader.ts`）：

- タブに属さないファイル同士は、重複判定の集合を 1 つ共有する（ファイルをまたいで重複が排除される）
- 設定上のタブとは独立して重複判定が行われる
- ただし、タブ表示が有効な場合、UIには表示されません

### 4.5. 重複チェックの対象

重複チェックの対象は、通常アイテム（`type: "item"`）とフォルダ取込の展開分だけです（`src/main/services/data/jsonItemConverter.ts`）。グループ・ウィンドウ・クリップボード・レイアウトは重複チェックせずに追加します：

- 同じ名前のグループが同じタブに複数あっても、すべて表示されます
- グループは、同じ名前でも参照するアイテムが異なる可能性があるためです

## 5. エラー処理とフォールバック

### 5.1. 無効なアイテムの処理

読み込みは「寛容パース」（`parseJsonDataFileLenient`）で行い、JSON として壊れていない限りファイル全体を捨てません。

- **JSON 構文エラー・root/items の構造不正**: ファイル全体を「破損」として扱い、読み込みをスキップ。破損中は編集画面の保存・アイテム登録を拒否する（空データでの上書きを防ぐため）
- **必須フィールド不足・未知の `type` などのアイテム単位の不正**: そのアイテムだけスキップし、他のアイテムは読み込む。不正なアイテムはファイル上には残す（人や AI が直せるように）。編集画面ではエラー付きで表示される
- **`id` の欠落・不正・重複**: 8 文字の英数字 ID を採番し、ファイルへ 1 回だけ書き戻す。重複はファイル横断で判定し、2 件目以降を採番し直す
- **`version` の欠落**: `"1.0"` を補って書き戻す
- **`$schema` の欠落・不一致**: 同梱スキーマへの相対参照（`../schemas/data.schema.json`）に直して書き戻す
- **`items` の要素がオブジェクトでない（`null` や文字列）**: 保持しようがないため削除して書き戻す
- **JSON アイテムから表示用アイテムへの変換に失敗**: そのアイテムだけスキップし、読み込みレポートに `invalid` として記録する
- **存在しないパス**: 読み込み時には確かめず、そのまま表示する。リンク切れはアイテム管理の「リンク切れを確認」で調べる。`.lnk` のパスが存在しないときは、リンク先を解析せず通常のアイテムとして扱う

### 5.2. フォルダ取込アイテムのエラー処理

- **存在しない（またはフォルダでない）パス**: 展開結果を 0 件として扱う（ログは出さない）
- **アクセスできないファイル・フォルダ**: 警告をログに出してその項目だけ飛ばし、残りを展開する
- **オプションの省略**: `depth`・`types` は既定値で展開する
- **オプションの型が不正**（`depth` が数値でない、`types` が `file`/`folder`/`both` 以外など）: アイテム単位の不正として、フォルダ取込アイテムごとスキップする（5.1）

### 5.3. 外部編集（人・AI による直接編集）への対応

データファイルはテキストエディタや AI エージェントで直接編集できます。QDL はファイルを監視しないので、**反映はメイン画面の再読込（F5）か再起動時**です。

| 仕組み                 | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 反映タイミング         | F5 または起動時。編集画面（アイテム管理）は表示のたびに読み直す                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 読み込みレポート       | 起動時・F5 のたびに `config/last-load-report.json` を書き出す（アプリ内の操作による再読込では、補正・書き戻し・外部変更・破損など報告することがあるときだけ更新する）。直接編集した側が「受理されたか・何がスキップされたか」を確認する用途（トーストは AI から見えないため）。`files[]` にはデータファイルに加えてワークスペースファイル（`workspace.json` / `workspace-archive.json`）も並ぶ。詳細は[ワークスペースファイル形式](workspace-format.md)を参照                                                             |
| トースト               | スキップまたは採番があったときだけ「N 件読込・M 件スキップ・K 件に ID を採番」を表示                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 変更前スナップショット | 前回読み込み時（または QDL 自身の書き込み時）と内容が違うファイルを検知すると、**変更前の内容**を `config/backup/YYYY-MM-DDTHH-MM-SS_pre-external/` に保存する（`backupEnabled` が true のとき。`backupRetention` とは別枠で最新 10 件を保持）。直接編集で壊したときの戻し先。**検知は QDL 起動中の編集 → F5 のときだけ**（前回の内容はメモリ上で覚えているため、QDL 終了中に編集した内容は起動時に反映はされるが外部変更としては検知されず、スナップショットも作られない）                                               |
| 楽観ロック             | 編集画面の保存は全ファイルを全量上書きするため、読み込み時のファイル内容ハッシュを保存時に照合し、読み込み後に外部で変更されていれば保存を拒否して再読込する（`saveEditableItems` の `expectedHashes`）                                                                                                                                                                                                                                                                                                                   |
| ID 指定の更新          | メイン画面からの編集・削除は毎回ディスクを読み直して該当 ID だけ差し替えるため、外部変更と共存できる                                                                                                                                                                                                                                                                                                                                                                                                                      |
| JSON Schema            | 同梱スキーマ（`assets/schemas/data.schema.json`）を起動時に `config/schemas/` へコピーし、データファイルの `$schema` から相対参照する。アイテムは `type` で判別する `oneOf`、各アイテムは `additionalProperties: false`（寛容パースが黙って落とす未知フィールドを、書く前にエディタで気づけるように）。**アプリ実行時にはスキーマ検証しない**（検証器を 2 つ持たない）。スキーマは型定義から `npm run schema:generate` で生成し、単体テストがドリフトを検知する。詳細は [README の「AI・手動編集」](README.md#ai手動編集) |
| config/README.md       | 直接編集する人・AI 向けの作業指示を起動時に生成する（雛形は `assets/config-readme.md`）                                                                                                                                                                                                                                                                                                                                                                                                                                   |

#### last-load-report.json の形式

```json
{
  "reportVersion": 1,
  "loadedAt": "2026-09-21T12:34:56.000Z",
  "summary": {
    "accepted": 42,
    "skipped": 1,
    "idAssigned": 2,
    "corruptedFiles": [],
    "externallyChangedFiles": ["datafiles/data.json"]
  },
  "files": [
    {
      "file": "datafiles/data.json",
      "status": "ok",
      "accepted": 42,
      "issues": [
        {
          "index": 3,
          "kind": "invalid",
          "id": "a1B2c3D4",
          "reason": "path is required and must be a non-empty string"
        },
        {
          "index": 7,
          "kind": "idAssigned",
          "id": "xY9z8W7v",
          "reason": "id が無いため採番しました"
        }
      ],
      "externallyChanged": true,
      "rewritten": true
    },
    {
      "file": "workspace.json",
      "status": "ok",
      "accepted": 5,
      "issues": [
        {
          "index": 1,
          "kind": "idAssigned",
          "id": "q7R8s9T0",
          "reason": "id が無いため採番しました",
          "section": "groups"
        }
      ],
      "externallyChanged": false,
      "rewritten": true
    }
  ],
  "preChangeSnapshot": "2026-09-21T12-34-50_pre-external"
}
```

| フィールド                 | 説明                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `files[]`                  | データファイル（`datafiles/data*.json`）に加えて、ワークスペースファイル（`workspace.json` / `workspace-archive.json`）も同じ形式で並ぶ    |
| `files[].status`           | `ok` / `corrupted`（JSON として壊れている。`error` に理由） / `unreadable`（読めない）                                                     |
| `files[].accepted`         | 受理したアイテム数（`dir` の展開前。JSON 上の要素数）                                                                                      |
| `files[].issues[].kind`    | `invalid`（スキップ） / `idAssigned`（採番） / `normalized`（構造の補正。`version` や `$schema` の補完）                                   |
| `files[].issues[].index`   | 書き戻し後の `items` 配列内の位置。ファイル単位の問題や削除した要素は `-1`（`reason` に元の位置）                                          |
| `files[].issues[].section` | 問題があった配列名（`workspaces` / `groups` / `items`）。ワークスペースファイルのときだけ付く（データファイルは `items` しか無いため省略） |
| `files[].rewritten`        | 採番・補正のためファイルを書き戻したか                                                                                                     |
| `preChangeSnapshot`        | 外部変更の検知時に作った変更前スナップショットのフォルダ名。なければ `null`                                                                |

## 6. データ型定義（TypeScript）

型定義の正本はコードです。フィールドの一覧・型・コメントは次のファイルを参照してください（このドキュメントには写しを置きません）。

| 対象                     | 場所                              | 主な型                                                                                                                                                                                       |
| ------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ファイルに書く JSON の形 | `src/common/types/json-data.ts`   | `JsonDataFile`、`JsonItem`（union）、`JsonLauncherItem`・`JsonDirItem`・`JsonGroupItem`・`JsonWindowItem`・`JsonClipboardItem`・`JsonLayoutItem`、`JsonDirOptions`、型ガード `isJson*Item()` |
| JSON Schema              | `assets/schemas/data.schema.json` | `json-data.ts` から `npm run schema:generate`（`scripts/generate-schemas.ts`）で生成。起動時に設定フォルダの `schemas/` へコピーされ、データファイルの `$schema` から参照される              |
| 表示・実行用の内部型     | `src/common/types/launcher.ts`    | `LauncherItem`・`GroupItem`・`WindowItem`・`ClipboardItem`・`LayoutItem`・`AppItem`、`WindowConfig`、`LayoutWindowEntry`                                                                     |
| 検索                     | `src/common/types/search.ts`      | `SearchMode`・`SearchHistoryEntry`・`SearchHistoryState`                                                                                                                                     |

**要点:**

- `JsonItem` は `type`（`item` / `dir` / `group` / `window` / `clipboard` / `layout`）で判別する union。全アイテム共通のフィールドは `id`（8 文字の英数字）・`memo`・`updatedAt`
- ファイル上の型（`Json*`）と画面で扱う内部型は別。読み込み時に `src/main/services/data/jsonItemConverter.ts` が JSON アイテムを内部型へ変換する（フォルダ取込の展開・`.lnk` の解析を含む）
- 内部型の `type` は JSON 側と語彙が違う。`JsonLauncherItem`（`type: "item"`）は、パスから判定した実行タイプ（`url` / `file` / `folder` / `app` / `customUri`）を `type` に持つ `LauncherItem` になる
- 内部型の `sourceFile`・`id` は、編集・削除のときに元のファイルとアイテムを特定するために使う（`lineNumber` は非推奨）
- `json-data.ts` を変えたら `npm run schema:generate` でスキーマを再生成してコミットする。生成結果とコミット済みファイルの一致は単体テストが検証する

## 7. 関連ドキュメント

- **[アイテム管理](../../screens/admin-window.md#6-アイテム管理の詳細)** - データファイルの編集機能
- **[フォルダ取込](../../screens/register-modal.md#12-フォルダ取込アイテムの詳細)** - フォルダ取込機能の詳細
- **[ワークスペースファイル形式](workspace-format.md)** - workspace.json仕様
- **[設定ファイル形式](settings-format.md)** - settings.json仕様
- **[ファイル形式一覧](README.md)** - すべてのファイル形式の概要
- **[開発ガイド](../../setup/development.md)** - 開発時の注意事項
