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
- **配置場所**: `config/datafiles/`（`config/` は設定フォルダ。場所は [設定フォルダの場所](README.md#設定フォルダの場所)）
- **自動検出**: データの読み込み時に `config/datafiles/` 直下のすべての`data*.json`ファイルを自動的に検出
- **タブ表示**: 設定でタブ表示を有効にすると、各データファイルをタブで切り替えて使用可能
- **ファイル管理**: 管理画面のアイテム管理（タブの列・データファイルの札）で、データファイルの作成・追加・削除とタブ名のカスタマイズが可能
- **ファイル名の制約**: 設定（`dataFileTabs` など）に書くファイル名は、`datafiles/` で始まる設定フォルダからの相対パス。アプリが作成・削除・登録するのは `datafiles/` 直下の `.json` だけで、それ以外の名前（`../` を含むものなど）は拒否する

#### 1.1.2. 必須ファイルと追加ファイル

- **data.json**: 常に必要な必須ファイル。削除不可
- **data2.json以降**: 任意で追加可能。管理画面のアイテム管理、または手動でファイルを作成
- **作成方法**:
  - 管理画面のアイテム管理で、タブの列からデータファイルを作成する（タブの右クリックまたは「＋ ファイル」から「新しいデータファイルを作る」）
  - または、`config/datafiles/` に手動でdata*.jsonファイルを作成する。メイン画面に出すには、タブに入れる（同じメニューの「既存のファイルを入れる」。4.4）

### 1.2. アイコンキャッシュの構造

アイコンは `config/icon-cache/` 以下にサブフォルダで分類されます：

| サブフォルダ | 説明 | ファイル名形式 |
| --- | --- | --- |
| `icon-cache/apps/` | EXEファイルのアイコン | `{basename}_icon.png` |
| `icon-cache/apps/` | ショートカット（.lnk）のアイコン | `{name}_lnk_icon.png` |
| `icon-cache/apps/` | カスタムURIスキームのアイコン | `uri_{scheme}_icon.png` |
| `icon-cache/apps/` | 登録アプリ（UWP）のアイコン | `uwp_{PackageFamilyName}_icon.png` |
| `icon-cache/favicons/` | WebサイトのFavicon | URL由来のファイル名 |
| `icon-cache/custom/` | カスタムアイコン（手動設定） | 任意のファイル名 |
| `icon-cache/extensions/` | ファイル拡張子のアイコン | `ext_{ext}_icon.png` |

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
  "version": "1.0",
  "items": [
    // アイテムの配列
  ]
}
```

### 2.2. トップレベルフィールド

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| **version** | string | ✓ | ファイルフォーマットのバージョン（現在は "1.0"） |
| **items** | array | ✓ | アイテムの配列（JsonItem型） |

書き戻し時のキー順は `version` → `items` に固定されます（`serializeJsonDataFile`）。v0.8.0-beta.5 までの QDL が書いた `$schema` は読み飛ばし、次に QDL が書き戻すときに消えます。

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
3. **セット** (`type: "set"`) - 複数のアイテムをまとめて開き、必要ならウィンドウを決まった位置に並べる
4. **クリップボードアイテム** (`type: "clipboard"`) - クリップボードの内容を保存・復元

旧グループ（`type: "group"`）と旧ウィンドウ配置（`type: "layout"`）は、読み込み時にセットへ変換して書き戻す（[3.3.6](#336-旧形式からの変換)）。廃止したウィンドウ操作（`type: "window"`）は、読み込み時にパスの無い単一アイテムへ変換して書き戻す（[3.4](#34-ウィンドウ操作廃止読み込み時に変換)）。

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

フィールドの一覧・型は、型定義（`src/common/types/json-data.ts`。`ItemWindowSwitch`・`SetEntry` は `src/common/types/launcher.ts`）を正とします（[6 章](#6-データ型定義typescript)）。この章には、各アイテムの必須フィールド・既定値・省略時の扱い・注意点と、実行時の挙動だけを書きます。

- 全アイテムが `id`（必須。8 文字の英数字、2.3）と、任意の `memo`（自由記述メモ）・`updatedAt`（更新日時、Unix タイムスタンプ ms）を持つ
- 読み込み時の検証は `src/common/utils/jsonParser.ts` が行う。必須フィールドが欠けた・型が違うアイテムはスキップされる（5.1）。スキーマにない未知のフィールドは黙って落ちる

### 3.1. 通常アイテム（JsonLauncherItem）

通常のランチャーアイテムで、アプリケーション、URL、ファイル、フォルダなどを起動します。

#### 3.1.1. フィールドの要点

- **必須**: `type: "item"`・`displayName`（表示名）・`path`（ファイルパス・URL・コマンド）。`displayName` は空文字不可
- `path` は、ウィンドウ切り替えの `window`（`processName` か `title`）があれば空文字でもよい（パスの無い単一アイテム、3.1.5.7）。どちらも空のアイテムは不正（5.1）
- **任意**: `args`（コマンドライン引数）・`customIcon`（3.1.4）・ウィンドウ切り替えの `window`・`placement`・`ifOpen`・`activateWindow`・`waitSeconds`・`pinToAllDesktops`（3.1.5）・`autoImportRuleId`
- `autoImportRuleId` は自動取込ルールの ID。このフィールドがあるアイテムは自動取込の管理対象になる

#### 3.1.2. サポートされるパス種類

- **ファイルパス**: `C:\path\to\file.exe`
- **フォルダパス**: `C:\path\to\folder`
  - 起動種別は保存せず、読み込むたびに `path` から判定する。最後の要素にドット（`.`）を含むフォルダ名（例: `C:\Projects\ver.0.39`）は、文字列だけでは拡張子つきのファイルと区別できない
  - そのため、ドット入りのフォルダ名は**末尾に区切り文字を付けて保存する**（例: `C:\Projects\ver.0.39\`。末尾が区切り文字のパスはフォルダと判定される）。QDL は登録・編集のときにディスクで確かめて付ける（ネットワークパスも対象。応答がないときは付けない）
  - 末尾の区切り文字がないものも、ドライブ文字で始まるパスは読み込みのときにディスクで確かめてフォルダと判定する。`\\server\...` のネットワークパスは、応答待ちで読み込みが止まらないよう確かめない（ファイルと判定される）
  - 読み込みのときの確認は時間切れつきで、結果は起動中覚えておく（起動時・F5・完全リフレッシュで確かめ直す）
- **拡張子の無いファイル**: `C:\Windows\System32\drivers\etc\hosts`
  - 文字列だけでは拡張子の無いフォルダと区別できず、パスにも印を付けられない。そこで、ディスクで確かめて**ファイルと分かったパスだけを `config/path-type-cache.json` に残し**、読み込みのときはこれを見てファイルと判定する（読み込みのたびにディスクは読まない）。載っていないパスはフォルダと判定する
  - 確かめるのは、登録・編集のとき（ネットワークパスも対象）と、アイテムを起動したとき。起動時・F5 では `path-type-cache.json` に載っているパスだけを確かめ直し、メイン画面の「完全リフレッシュ」では拡張子の無いパスをすべて確かめ直す（どちらもドライブ文字で始まるパスだけ）
  - データファイル・ワークスペース（アーカイブを含む）のどこからも消えたアイテムのパスは、次の読み込みで `path-type-cache.json` から外す（読めなかったファイルがあるときは外さない）。パスの照合は大文字・小文字を区別しない
  - フォルダ取込で展開したアイテムと、ショートカット（`.lnk`）のリンク先は、読み込みのたびにディスクで確かめているので、拡張子が無くてもファイルと判定される
- **HTTP/HTTPS URL**: `https://example.com`
- **カスタムURIスキーマ**: `obsidian://`, `vscode://`, `ms-todo:` など
- **Office の URI**: `ms-excel:ofe|u|https://contoso.sharepoint.com/.../Book.xlsx`
  - パス欄の「変換」で SharePoint・OneDrive の URL から作る形。`ofe|u|` は編集用、`ofv|u|` は読み取り専用、`ofe|ofc|u|` は SharePoint 標準の編集用（Excel だけ）。Word は `ms-word:`、PowerPoint は `ms-powerpoint:` で始まる
- **ブラウザの exe ＋引数で URL を渡す形**: `path` に `C:\Program Files\Google\Chrome\Application\chrome.exe`、`args` に `--new-window https://example.com`
  - パス欄の「変換」で作る形。アプリのウィンドウは `--app=https://example.com`、シークレットは `--incognito https://example.com`（Edge は `--inprivate`。Firefox は `-new-window`・`-private-window` で、アプリのウィンドウの形は無い）
  - 関連付けがブラウザのファイル（`.md` など）は、引数の URL が `file:///C:/path/to/note.md` の形になる（ネットワークパスは `file://server/share/...`）。ファイルはシークレットの形にしない
- **スタートメニューのアプリ**: `shell:AppsFolder\<AppID>`
  - アプリ取込で登録する形。これ以外の `shell:` で始まるパスはフォルダと判定する
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

- **配置場所**: `config/icon-cache/custom/`
- **対応形式**: `.png`, `.jpg`, `.jpeg`, `.ico`, `.svg`

#### 3.1.5. ウィンドウ切り替え（ItemWindowSwitch）

開く前に既存のウィンドウを探し、見つかればそれを前に出します（位置があれば位置も合わせます）。キーの形はセットの行（3.3.2）と同じで、実行もセットの行と同じ処理です。

##### 3.1.5.1. フィールドの要点

| キー | 意味 | 既定値・省略時 |
| --- | --- | --- |
| `window` | 探すウィンドウ（`processName`＝exe 名、部分一致／`title`＝ウィンドウタイトル、ワイルドカード可、3.1.5.2）。`title` を省略するとプロセス名だけで探す | ウィンドウ切り替えをしない（普通に開くだけ） |
| `placement` | ウィンドウ位置（`x`・`y`・`width`・`height`＝仮想スクリーン座標系、3.1.5.5／`virtualDesktopNumber`＝1 始まりの整数／`state: "maximized"`＝最大化） | 位置を合わせない（見つかれば前に出すだけ） |
| `ifOpen` | ウィンドウが既に開いていたとき。`"move"`＝開かずに前に出す（位置があれば合わせる）／`"openNew"`＝いつも開く | `"move"` |
| `activateWindow` | 見つけたウィンドウを前面に出すか | `true`（出す。セットの行の既定 `false` とは違う） |
| `waitSeconds` | 位置があるとき、開いてからウィンドウが出るのを待つ秒数 | 30 |
| `pinToAllDesktops` | 全仮想デスクトップに表示する。全デスクトップに表示したときは `placement.virtualDesktopNumber` を使わない | `false` |

- `window` が無い（`processName`・`title` のどちらも無い）アイテムでは、ほかのキーがあっても使わない
- `path` が空のときは開くものが無いので、`ifOpen`・`waitSeconds` は使わない（3.1.5.7）
- 型の合わない値は、セットの行と同じく黙って捨てる（3.3.4。`pinToAllDesktops` は真偽値だけ）

##### 3.1.5.2. ワイルドカード検索

タイトル検索では以下のワイルドカード文字が使用可能です：

| 文字 | 説明 | 例 |
| --- | --- | --- |
| `*` | 任意の0文字以上の文字列 | `*Chrome*` は "Google Chrome - タブ名" にマッチ |
| `?` | 任意の1文字 | `Chrome ?` は "Chrome 1" にマッチ |

- ワイルドカード文字が含まれていない場合は完全一致検索
- 大文字小文字は区別しない

##### 3.1.5.3. 動作仕様

アイテムを「セットの 1 行」（`itemId` がそのアイテムで、`window`・`placement`・`ifOpen`・`waitSeconds` はアイテムの値、`activateWindow` はアイテムの値か `true`）として実行します（`executeLauncherItem`、`src/main/services/launch/setExecutor.ts`）。メイン画面・ワークスペース・登録画面の「試しに実行」のどれから開いても同じです。

1. **位置が無いとき**: `window` に合うウィンドウが見つかれば前に出して終わり（Windows に前面化を断られても開き直さない）。見つからなければ開く。開いたウィンドウは動かさない
2. **位置があるとき**: 見つかれば位置を合わせて前に出す。見つからなければ開き、`waitSeconds` 秒まで待って出てきたウィンドウに位置を合わせる。位置の当て方（画面に入らない位置・今は無い仮想デスクトップの扱いなど）はセットの位置のある行（3.3.5 の 3）と同じ
3. **`ifOpen` が `"openNew"`**: 開いていても開く（位置があれば、開く前からあったウィンドウを除いて新しいものを待つ）
4. **前に出すとき**: `placement.virtualDesktopNumber` の指定も全デスクトップに表示の指定も無く、ウィンドウが別の仮想デスクトップにあれば、そのデスクトップへ切り替える（セットの実行では切り替えない）
5. **知らせ方**: 進み具合の表示は出さない。うまくいかなかったとき（待ちきれなかった、位置を当てられなかった、など）だけ警告のトーストで出す（待ちきれなかったときは「ウィンドウが出るのを N 秒待ちましたが、見つかりませんでした」）
6. **重ねて実行しない**: 同じアイテム（同じ `id`）を実行中にもう一度実行しても何もしない（セットと同じ）

##### 3.1.5.4. 使用例

```json
{
  "id": "u1V2w3X4",
  "type": "item",
  "displayName": "Chrome (右半分)",
  "path": "chrome.exe",
  "window": { "processName": "chrome.exe", "title": "*Google Chrome" },
  "placement": { "x": 960, "y": 0, "width": 960, "height": 1080 },
  "activateWindow": true
}
```

##### 3.1.5.5. マルチモニタ対応

座標系は仮想スクリーン座標（Virtual Screen Coordinates）を使用します：

- プライマリモニターの左上が原点 (0, 0)
- セカンダリモニターは相対位置に配置（例: プライマリが1920x1080、セカンダリが右側なら X=1920 から開始）
- 負の座標も使用可能（プライマリの左側・上側にモニターがある場合）

詳細は **[ウィンドウ制御システム](../window-control.md#ウィンドウ位置サイズ制御)** を参照してください。

##### 3.1.5.6. 旧形式（windowConfig）からの変換

v0.8.0-beta.12 までは、ウィンドウ切り替えを `windowConfig` オブジェクト（`title`・`processName`・`x`・`y`・`width`・`height`・`virtualDesktopNumber`・`activateWindow`・`pinToAllDesktops`・`moveToActiveMonitorCenter`）に書いていました。データファイルの読み込みの最後に 1 回だけ新しいキーへ変換して書き戻します（`src/main/services/data/dataFileLoader.ts`、変換の中身は `src/common/utils/itemWindowConversion.ts`）。ワークスペースも同じ規則で変換します（[ワークスペースファイル形式](workspace-format.md#6-旧形式からの移行)）。

| 元（`windowConfig` の中） | 変換後 |
| --- | --- |
| `title` | `window.title`。空と `"*"` は書かない（プロセス名だけで探す） |
| `processName` | `window.processName` |
| `x`・`y`・`width`・`height`・`virtualDesktopNumber` | `placement` にまとめる（1 つも無ければ `placement` を付けない） |
| `activateWindow` | `false` ならそのまま、省略・`true` なら `true` を書く |
| `pinToAllDesktops` | `true` のときだけ書く |
| `moveToActiveMonitorCenter` | 捨てる（単一アイテムでは廃止） |

- `title`・`processName` のどちらも無い（空の）`windowConfig` は、何にも合わない設定なので消すだけにする
- `windowConfig` と新しいキーが両方あれば `windowConfig` を優先する（`ifOpen`・`waitSeconds` は残す）
- 変換は戻せないので、書き換える前に全設定ファイルのスナップショットを 1 回だけ作る。旧グループ・旧ウィンドウ配置のセットへの変換（3.3.6）も要るときは `backup/<日時>_pre-set-migration/`、`windowConfig`・ウィンドウ操作（3.4）の変換だけのときは `backup/<日時>_pre-window-migration/`（`BackupService.createPreWindowMigrationSnapshot`）。`backupEnabled` に関係なく作り、作れなければ変換しない
- 読めないデータファイルがあってセットへの変換と一緒に保留したとき、変換前に QDL の外で書いたとき、CLI で `--set windowConfig=…` を渡したときも、読み込み時の検証がその場で新しいキーに直すので、動きは変わらない（`validateJsonLauncherItem`）。型の合わない `windowConfig`（オブジェクトでない、`x` が数値でない など）は今までどおりアイテムごと不正にする

##### 3.1.5.7. パスの無い単一アイテム

`path` が空文字で、`window` だけを持つ単一アイテムです。開くものが無く、開いているウィンドウに切り替えるだけです。`type` は `"item"` のまま書きます（起動種別は読み込み時に `path` から判定し、空なら `windowSwitch` になる。`src/common/utils/itemTypeDetector.ts`）。

```json
{
  "id": "t1O2d3O4",
  "type": "item",
  "displayName": "MS To Do",
  "path": "",
  "window": { "processName": "ApplicationFrameHost.exe", "title": "Microsoft To Do" },
  "activateWindow": true
}
```

- **開いたとき**: セットの「開くものの無い行」（3.3.5 の 2・3）として実行する。`window` に合うウィンドウが開いていれば、`placement` があれば位置を合わせて切り替える（前面に出すかは `activateWindow`）。開いていなければ何も開かず、情報のトースト「開いていないので切り替えませんでした」を出す（`notifyLauncherItemFailure`）
- **セットの行が指したとき**: 行は開くものの無い行（動かすだけ）になる。行に `window` が無ければ、アイテムの `window` で探す。位置の無い行はアイテムの `placement`・`activateWindow`・`pinToAllDesktops` も当てる（パスのあるアイテムと同じ、3.3.5 の 2）。開いていなければ飛ばす（3.3.5 の 7）
- **path を入れたとき**: 普通の単一アイテム（開いていれば切り替え、無ければ開く）になる

#### 3.1.6. ショートカットファイルの自動解析

`path` が実在する `.lnk` ファイルのとき、読み込み時にショートカットを解析します（`processShortcut`、`src/main/services/data/directoryScanner.ts`）：

1. **ターゲットパス抽出**: ショートカットが指すファイル・フォルダのパスを取り出す（`path` は `.lnk` のまま）
2. **引数抽出**: ショートカットに設定されたコマンドライン引数を使う（JSON の `args` は使わない）
3. **表示名**: JSON の `displayName` をそのまま使う。ショートカットのファイル名（`.lnk` を除く）を表示名にするのは、フォルダ取込（3.2）で展開したときだけ
4. **その他の項目**: `id`・`memo`・`customIcon`・ウィンドウ切り替え（3.1.5）・`autoImportRuleId` は JSON の値を使う

解析できなかったときは、通常のアイテムとして扱います。

### 3.2. フォルダ取込アイテム（JsonDirItem）

指定フォルダ内のファイル/フォルダを自動的にスキャンして取り込むアイテムです。

#### 3.2.1. フィールドの要点

- **必須**: `type: "dir"`・`path`（スキャン対象のフォルダパス。空文字不可）
- **任意**: `options`（3.2.2）
- `displayName` は持たない。表示名は取り込んだファイル・フォルダの名前になる

#### 3.2.2. スキャンオプション（JsonDirOptions）

すべて任意です。省略時の既定値は `DIR_OPTIONS_DEFAULTS`（`src/common/types/json-data.ts`）にあります。

- **`depth`**（既定 0）: スキャンの深さ。0 は直下のみ、-1 は無制限。-1 か 0 以上の整数だけ受け付ける
- **`types`**（既定 `"both"`）: 取り込む種類。`"file"`・`"folder"`・`"both"` のどれか
- **`filter`**: 取り込むファイル名の glob パターン（例: `"*.ps1"`、`"*.{doc,docx,pdf}"`）
- **`exclude`**: 除外する glob パターン（例: `"node_modules"`、`"*.{tmp,temp,bak}"`）
- **`prefix`**: 表示名の前に付ける文字。区切りや括弧は足さず、`prefix` ＋ アイテム名とそのままつなぐ（例: `"【仕事】"` → `【仕事】アイテム名`）
- **`suffix`**: 表示名の後に付ける文字。同じく、アイテム名 ＋ `suffix` とそのままつなぐ（例: `"（Dev）"` → `アイテム名（Dev）`）

以前は `プレフィックス: アイテム名`・`アイテム名 (サフィックス)` の形に区切りと括弧を足していた。今ある値は書き換えていないので、以前に設定した `prefix`・`suffix` は区切りと括弧の無い表示名になる。

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
        "prefix": "【Src】"
      }
    },
    {
      "id": "g3H4i5J6",
      "type": "dir",
      "path": "C:\\Scripts",
      "options": {
        "filter": "*.ps1",
        "prefix": "【Script】"
      }
    }
  ]
}
```

#### 3.2.4. 展開時の動作

フォルダ取込アイテムはデータファイルの読み込み時に以下のように展開されます（`processDirectoryItem`、`src/main/services/data/directoryScanner.ts`）：

1. **スキャン実行**: 指定されたフォルダをオプションに従ってスキャン
2. **アイテム生成**: 検出されたファイル/フォルダをアイテムとして生成（`.lnk` は 3.1.6 の解析を行い、ファイル名を表示名にする）
3. **表示名生成**: prefix/suffixがあれば、表示名の前後にそのままつなぐ（3.2.2）
4. **アイコン**: 読み込み時は、キャッシュ済みのアイコンを読み込むだけ（`src/renderer/App.tsx` の `loadItems`）。キャッシュにないアイコンの取得・抽出は、利用者がアイコンの取得を操作したときに行う（`src/renderer/hooks/useIconFetcher.ts`）

### 3.3. セット（JsonSetItem）

複数のアイテムをまとめて開き、必要ならウィンドウを決まった位置に並べるアイテムです（旧グループと旧ウィンドウ配置をまとめたもの）。ウィンドウ位置は登録・編集画面の「ウィンドウを追加」「ウィンドウ位置を更新」で QDL が書くので、座標を手で書くことは想定していません。

#### 3.3.1. フィールドの要点

- **必須**: `type: "set"`・`displayName`（空文字不可）・`entries`（行の配列。3.3.2）
- **任意**: `launchMode`（`"sequential"`＝順番に開く／`"parallel"`＝同時に開く。省略時は順番に開く）・`customIcon`
- 読み込み時は `entries` が配列であることだけを求める（空でもよい）。登録・編集画面と CLI では、行が 1 つ以上必要

#### 3.3.2. 行（SetEntry）

行は「開くもの」「対象ウィンドウ」「ウィンドウ位置」と、開くときの動きを持つ。すべて任意。

| キー | 意味 | 既定値・省略時 |
| --- | --- | --- |
| `itemId` | 開くもの（登録済みのアイテムの id。どのデータファイルのアイテムでもよい） | 開くものを指さない |
| `open` | 開くもの（`{ "path": ..., "args": ... }`。この行の中だけに書くパス。`path` 必須） | 同上。`itemId` と両方あれば `itemId` を使う |
| `label` | 行の名前。`open` の行や、アイテムが見つからない行の表示に使う | パスの最後の部分など |
| `window` | 対象ウィンドウ（`processName`＝exe 名、部分一致／`title`＝ウィンドウタイトル、大文字小文字を区別しない全体一致で `*`・`?` を使える） | パスの無い単一アイテムを指す行はそのアイテムの `window`（3.1.5.7）、開くものが exe（`.exe` で終わるパス）ならその exe 名で探す。それ以外は探さない（`buildSetWindowConfig`） |
| `placement` | ウィンドウ位置（`x`・`y`・`width`・`height`＝仮想スクリーン座標系の物理ピクセル、`virtualDesktopNumber`＝1 始まりの整数、`state: "maximized"`＝最大化） | 位置を合わせず、開くだけ |
| `ifOpen` | 対象ウィンドウが既に開いていたとき。`"move"`＝開かずに位置だけ合わせる／`"openNew"`＝もう 1 つ開く | `"move"` |
| `activateWindow` | 位置を合わせたウィンドウを前面に出すか | `false`（出さない。v0.8.0-beta.10 までは `true`） |
| `waitSeconds` | 開いてからウィンドウが出るのを待つ秒数 | 30 |
| `pinToAllDesktops` | 対象ウィンドウを全仮想デスクトップに表示する（位置のある行・無い行のどちらも）。全デスクトップに表示する行は `placement.virtualDesktopNumber` を使わない（画面からは書かない）。`true` のときだけ書く | `false` |

- `itemId` で指せるのは通常アイテム（`type: "item"`）。セット・クリップボードを指した行は実行時に失敗する（`src/main/services/launch/setExecutor.ts`）。ウィンドウ操作を指していた行は、変換後も同じ `id` のパスの無い単一アイテムを指す（3.4）
- `itemId`・`open`・`window`・`placement` をどれも持たない行は、旧グループの見つからない名前を `label` だけ残したもの。実行時に「アイテムが見つかりません」で失敗する
- `open` を持たず `window` と `placement` を持つ行は、何も開かずにウィンドウを動かすだけの行になる。「ウィンドウを追加」で足す行はこの形（開くものは書かない）

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
      "id": "w9X0y1Z2",
      "type": "set",
      "displayName": "開発環境",
      "entries": [
        {
          "itemId": "k7L8m9N0",
          "window": { "processName": "Code.exe" },
          "placement": { "x": 0, "y": 0, "width": 960, "height": 1040 }
        },
        {
          "open": { "path": "C:\\dev" },
          "label": "dev"
        },
        {
          "window": { "processName": "WindowsTerminal.exe" },
          "placement": { "x": 960, "y": 0, "width": 960, "height": 1040, "virtualDesktopNumber": 1 },
          "activateWindow": false
        }
      ]
    }
  ]
}
```

1 行目は登録済みのアイテムを開いて左半分へ、2 行目はセットに書いたフォルダを開くだけ、3 行目は何も開かずに既にあるターミナルを右半分へ動かす。

#### 3.3.4. 検証

`validateJsonSetItem`・`validateSetEntry`（`src/common/utils/jsonParser.ts`）が検証する。

- `displayName` が空でない文字列でない、`entries` が配列でない、行がオブジェクトでないときは、セット全体が不正（5.1）
- 行の中は知っているキーだけを写し、型の合わないものは黙って捨てる。捨てられるのは、空文字の文字列、有限の数でない数値、`path` の無い `open`、`"maximized"` 以外の `state`、`"move"`・`"openNew"` 以外の `ifOpen`、真偽値でない `activateWindow`、0 以下の `waitSeconds`、`true` でない `pinToAllDesktops`、1 以上の整数でない `placement.virtualDesktopNumber`（0・負の数・小数）、未知のキー。中身の無い `window`（`processName`・`title` のどちらも無い）と `placement`（キーが 1 つも無い）も捨てる（どのウィンドウにも合う・位置のある行に数えられるのを防ぐ）
- `launchMode` は `"sequential"`・`"parallel"` 以外なら捨てる（順番に開く扱い）

#### 3.3.5. 動作仕様

実行は `executeSet`（`src/main/services/launch/setExecutor.ts`）。

1. **開き方**: 順番に開くときは、行を開いてから次の行を開くまで 100ms（`GROUP_LAUNCH_DELAY_MS`、`src/common/constants.ts`）あける。ウィンドウを待って位置を合わせる処理は並行して続け、次の行はその完了を待たない。同時に開くときは全部の行を一度に始める
2. **位置の無い行**: 開くものの無い行（動かすだけ。パスの無い単一アイテムを指す行を含む、3.1.5.7）は、`window` に合うウィンドウを前に出す（行に `window` が無ければ、パスの無い単一アイテムの `window`・`placement`・`activateWindow`・`pinToAllDesktops` を使う。無ければ飛ばす。探す条件が空なら失敗）。それ以外は、`ifOpen` が `"move"` で `window`（無ければ指すアイテムのウィンドウ切り替えの `window`。そのときはアイテムの `placement`・`activateWindow`・`pinToAllDesktops` も当てる、3.1.5）に合うウィンドウが見つかれば前に出すだけ（Windows に前面化を断られても開き直さない）、無ければ開く。行の `pinToAllDesktops` が `true` なら、前に出すウィンドウに全デスクトップに表示も当てる
3. **位置のある行**: `window` で探す（3.3.2。行に `window` が無ければ、指すパスの無い単一アイテムの条件、または開く exe の名前で探す）。`ifOpen` が `"move"` で見つかれば開かずに動かす。見つからないとき、開くものの無い行は飛ばす。見つからない、または `"openNew"` なら開いて、500ms（`SET_WINDOW_POLL_MS`）おきに `waitSeconds` 秒まで探す。`"openNew"` のときは開く前からあったウィンドウを除く。合うウィンドウが複数あれば、`placement.virtualDesktopNumber` のデスクトップにあるものを先に使う。見つかったら、最小化の解除・全デスクトップに表示（`pinToAllDesktops`）・位置と大きさ・仮想デスクトップ・前面化を当て（`applyWindowConfig`、`src/main/utils/windowActivator.ts`）、`state` が `"maximized"` なら最大化する（前面に出さない行では、位置を当ててから最大化するまでの間に前面が移ったら、元の前面のウィンドウに戻す。Windows の最大化の解除と最大化は、前面に出さずに行う手段が無いため）。記録した位置の中心がどの画面にも入らない（モニターを外したなど）ときは、主画面（左上が 0,0 の画面）の作業領域に収まる大きさにして、その中央に当てる。当てた後に読み直した位置（x・y）がずれていれば（管理者権限で動くウィンドウなど）、その行は失敗（「ウィンドウを動かせませんでした」）にする。大きさは見ない。`virtualDesktopNumber` が今のデスクトップの数より大きい（今は無いデスクトップ）ときは、番号を外して位置だけ当て、その行は失敗（「デスクトップ N がありません。位置だけ合わせました」）にする。利用者の見ているデスクトップは切り替えない。行の `pinToAllDesktops` が `true` なら、仮想デスクトップは移さず（今は無いデスクトップの番号でも失敗にしない）全仮想デスクトップに表示する
4. **取り合わない**: 1 回の実行の中で、ある行が使うと決めたウィンドウは、ほかの行の候補から外す
5. **探す相手が決まらない行**: `window` が無く開くものが exe でない（URL など）行は、位置があっても開くだけ
6. **失敗**: 行ごとに失敗しても残りを続ける。開けなかった行（パスが無いなど）は、ウィンドウを待たずにその理由で失敗にする。位置のある行が 1 つでもあれば進み具合を画面の隅に出し（中止できる）、行ごとの結果はそこに出す。無ければ、失敗した行の名前を警告のトーストで出す
7. **飛ばした行**: 開くものの無い行でウィンドウが開いていなかったときは、何もせず飛ばす（進み具合では状態 `skipped`。理由は「開いていないので動かしませんでした」、`window` の exe のウィンドウはあってタイトルだけ合わないときは「タイトルが合うウィンドウがありません（{exe 名} は開いています）」。ほかの行の `window` に合うウィンドウは、その行のものとして数えない）。失敗とは数えないので、警告のトーストに出ず、ほかの行が成功なら進み具合は自動で閉じる
8. **重ねて実行しない**: 同じセット（同じ `id`）を実行中にもう一度実行しても何もしない（Enter の二度押しなどで、まだ出ていないウィンドウを「開いていない」と見てもう 1 つずつ開くのを防ぐ。開始のトーストも出さない）。`id` の無い実行（登録画面の試しに実行）は重ねても止めない

#### 3.3.6. 旧形式からの変換

旧グループ（`type: "group"`。`displayName`・`itemNames`＝アイテムの表示名の配列）と旧ウィンドウ配置（`type: "layout"`。`displayName`・`entries`＝ウィンドウの一覧・`customIcon`）は、データファイルの読み込みの最後に 1 回だけセットへ変換して書き戻し、読み直す（`src/main/services/data/dataFileLoader.ts`・`setMigration.ts`、変換の中身は `src/common/utils/setConversion.ts`）。ワークスペースも同じ規則で変換する（[ワークスペースファイル形式](workspace-format.md#6-旧形式からの移行)）。

| 元 | 変換後 |
| --- | --- |
| 旧グループの `itemNames` の名前 | 全データファイルのアイテムから同じ表示名の通常アイテム（ウィンドウ操作から変換したパスの無い単一アイテムを含む）を探し（同じ名前が複数あれば後のもの）、`itemId` の行にする。フォルダ取込で展開したアイテムは `open`（パスと引数）と `label` の行、見つからない名前は `label` だけの行 |
| 旧グループの開き方 | 削除した設定 `parallelGroupLaunch`（[設定ファイル形式 3.9](settings-format.md#39-旧グループの開き方削除した設定)）が true なら `launchMode: "parallel"`、それ以外は省略（順番に開く） |
| 旧ウィンドウ配置の各ウィンドウ | `processName` と `windowTitle` を `window` に写す。タイトルは前後に `*` を付けて部分一致にする（もともと付いていれば付けない）。前後の `*` と空白を除いたタイトルを `label` にする。`x`・`y`・`width`・`height`・`virtualDesktopNumber` を `placement` に写す（座標が 1 つも無ければ `placement` を付けない）。`launchApp` が true で `executablePath` があれば、`executablePath`・`args` を `open` にする |
| 旧ウィンドウ配置の開き方 | `launchMode: "parallel"` |

- `id`・`displayName`・`memo`・`updatedAt` は引き継ぐ。`customIcon` は旧ウィンドウ配置だけが持っていたので、そこからだけ引き継ぐ
- 有るのに読めない（ロック・権限）、または JSON として壊れたデータファイルが 1 つでもあれば、変換を保留する（そのファイルのアイテムを指す名前を解決できず、名前だけの行にしてしまうため）。直れば次の読み込みで変換する
- 検証に通らない旧グループ・旧ウィンドウ配置は変換せずに残す（未知の `type` として読み込みから外れる。5.1）
- 変換は戻せないので、書き換える前に全設定ファイルのスナップショット `backup/<日時>_pre-set-migration/` を作る（`backupEnabled` に関係なく作る。`BackupService.createPreSetMigrationSnapshot`）。作れなければ変換しない。単一アイテムの `windowConfig` の変換（3.1.5.6）も、同じ読み込みで続けて当て、スナップショットはこの 1 回で済ませる

### 3.4. ウィンドウ操作（廃止。読み込み時に変換）

v0.8.0-beta.12 までは、既にあるウィンドウを探して前面に出す・動かす種別「ウィンドウ操作」（`type: "window"`）がありました。今はこの種別を持たず、データファイルの読み込みの最後に 1 回だけパスの無い単一アイテム（3.1.5.7）へ変換して書き戻します（`src/main/services/data/dataFileLoader.ts` の `migrateLegacyItemsInDataFiles`、変換の中身は `src/common/utils/itemWindowConversion.ts` の `windowItemToPathlessItem`）。ワークスペースも同じ規則で変換します（[ワークスペースファイル形式](workspace-format.md#6-旧形式からの移行)）。

| 元（ウィンドウ操作のフィールド） | 変換後（パスの無い単一アイテム） |
| --- | --- |
| `type: "window"` | `type: "item"`・`path: ""` |
| `windowTitle` | `window.title`。空と `"*"` は書かない（タイトルを問わない）。ただし `processName` が無くタイトルが `"*"` のときは `"*"` を残す |
| `processName` | `window.processName` |
| `x`・`y`・`width`・`height`・`virtualDesktopNumber` | `placement` にまとめる（1 つも無ければ `placement` を付けない） |
| `activateWindow` | `false` のときだけ書く（単一アイテムの既定も前面に出す） |
| `pinToAllDesktops` | `true` のときだけ書く |
| `moveToActiveMonitorCenter` | 捨てる（単一アイテムでは廃止） |
| `id`・`displayName`・`customIcon`・`memo`・`updatedAt` | そのまま引き継ぐ |

- `id` を変えないので、ウィンドウ操作を指していたセットの行は、そのまま変換後のアイテムを指す。行は開くものの無い行（動かすだけ）になり、ウィンドウが開いていなければ失敗にせず飛ばす（3.3.5 の 7）
- 変換は戻せないので、書き換える前に全設定ファイルのスナップショット `backup/<日時>_pre-window-migration/` を 1 回だけ作る。旧グループ・旧ウィンドウ配置のセットへの変換（3.3.6）も要るときは、`backup/<日時>_pre-set-migration/` の 1 回で済ませる。`backupEnabled` に関係なく作り、作れなければ変換しない（3.1.5.6 と同じ）
- 有るのに読めない、または JSON として壊れたデータファイルが 1 つでもあれば、変換を保留する（3.3.6 と同じ）。保留している間と、CLI に古い形のアイテムを渡したときは、読み込み時の検証がその場でパスの無い単一アイテムに直すので、動きは変わらない（`validateJsonItem`、`src/common/utils/jsonParser.ts`）。このときファイルは書き戻さない
- 変換後に `window` が残らない（`windowTitle` が空で `processName` も無い）ものは、パスも `window` も無い単一アイテムなので不正としてスキップする（5.1）

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

**保存場所**: `config/clipboard-data/`

1 つのファイルを指すアイテムは 1 つだけにする。メインウィンドウとワークスペースの間でクリップボードアイテムを写すとき（ワークスペースへの追加・ワークスペースのアイテムのメインウィンドウへの登録）は、このファイルを新しい ID で複製し、写した先のアイテムの `dataFileRef`（ワークスペース側も同じ名前）を複製に向ける（`ClipboardService.duplicateClipboardData`。複製できなければ（元のファイルが無い・読めないなど）元の参照のまま）。データファイルのアイテムを消すとファイルも消える（`delete-items-by-id`・アイテム管理の保存）ので、共有するとワークスペース側が復元できなくなる。

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

| フォーマット | 説明 |
| --- | --- |
| **text** | プレーンテキスト |
| **html** | HTML形式 |
| **rtf** | リッチテキスト形式 |
| **image** | 画像（Base64エンコード、最大10MB） |
| **file** | ファイルパス（復元できるのは保存時のパスに実在するファイルだけ。ファイルだけをコピーしたときはパスの一覧を text としても保存する） |

#### 3.5.5. 制約事項

- **画像サイズ**: 最大10MBまで
- **ファイル復元**: 保存時のパスに実在するファイルだけを復元する（存在しないものは除外）。ファイルを復元したときは、ほかの形式は書き込まない。1 件も残らなければ、保存してあるテキストなどほかの形式だけを復元する。ファイルだけをコピーしたときは、パスの一覧を text としても保存する
- **復元できないとき**: 書き込める形式が 1 つもなければ（保存したファイルがすべて消えていたときなど）、クリップボードを変えずに失敗とする（失敗はログに残り、エラーのトーストで知らせる）
- **セットからの参照**: セットの行からは指せません

## 4. 重複排除ルール

QuickDashLauncherは、アイテムの重複を自動的に排除します。

### 4.1. 重複判定の基準

以下の3つの要素が一致するアイテムを「重複」と判定します：

- **表示名** (`displayName`)
- **パスまたはURL** (`path`)
- **引数** (`args`) ※ 存在する場合のみ

### 4.2. 重複排除の単位

重複排除は**タブ単位**で実行されます：

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
- ただし、メイン画面には表示されない。表示するアイテムはタブに含まれるファイルから選ぶため、タブ表示の有無にかかわらず出てこない

### 4.5. 重複チェックの対象

重複チェックの対象は、通常アイテム（`type: "item"`）とフォルダ取込の展開分だけです（`src/main/services/data/jsonItemConverter.ts`）。セット・クリップボードは重複チェックせずに追加します：

- 同じ名前のセットが同じタブに複数あっても、すべて表示されます
- セットは、同じ名前でも行の中身が異なる可能性があるためです

## 5. エラー処理とフォールバック

### 5.1. 無効なアイテムの処理

読み込みは「寛容パース」（`parseJsonDataFileLenient`）で行い、JSON として壊れていない限りファイル全体を捨てません。

- **JSON 構文エラー・root/items の構造不正**: ファイル全体を「破損」として扱い、読み込みをスキップ。破損中は編集画面の保存・アイテム登録を拒否する（空データでの上書きを防ぐため）。ID を指定した 1 件の編集・削除は、破損ファイルを飛ばして他のファイルで行う。目当てのアイテムが他のファイルに無ければ、破損ファイルにあるかもしれないので何も書かずにエラーにする
- **必須フィールド不足・未知の `type` などのアイテム単位の不正**: そのアイテムだけスキップし、他のアイテムは読み込む。不正なアイテムはファイル上には残す（消さずに直せるように）。編集画面ではエラー付きで表示される
- **`id` の欠落・不正・重複**: 8 文字の英数字 ID を採番し、ファイルへ 1 回だけ書き戻す。重複はファイル横断で判定し、2 件目以降を採番し直す
- **`version` の欠落**: `"1.0"` を補って書き戻す
- **`items` の要素がオブジェクトでない（`null` や文字列）**: 保持しようがないため削除して書き戻す
- **JSON アイテムから表示用アイテムへの変換に失敗**: そのアイテムだけスキップし、読み込みレポートに `invalid` として記録する
- **存在しないパス**: 読み込み時には確かめず、そのまま表示する。リンク切れはアイテム管理の「リンク切れを確認」で調べる。`.lnk` のパスが存在しないときは、リンク先を解析せず通常のアイテムとして扱う

### 5.2. フォルダ取込アイテムのエラー処理

- **存在しない（またはフォルダでない）パス**: 展開結果を 0 件として扱う（ログは出さない）
- **アクセスできないファイル・フォルダ**: 警告をログに出してその項目だけ飛ばし、残りを展開する
- **オプションの省略**: `depth`・`types` は既定値で展開する
- **オプションの値が不正**（`depth` が -1 か 0 以上の整数でない、`types` が `file`/`folder`/`both` 以外など）: アイテム単位の不正として、フォルダ取込アイテムごとスキップする（5.1）

### 5.3. QDL の外での変更への備え

データファイルを手で編集する使い方はサポートしません。AI にアイテムを変えさせたいときは CLI（`qdl`）を使います。それでも、古い版の QDL・同期ツール・手で直した場合など、ファイルが QDL の外で変わることはあるので、次の備えがあります。QDL はファイルを監視しないので、**反映は起動時・メイン画面の再読み込み（F5）・アプリ内の操作に伴う再読み込みのとき**です。

| 仕組み | 内容 |
| --- | --- |
| 反映タイミング | 起動時・F5・完全リフレッシュ・CLI の `qdl reload`、またはアプリ内の操作・CLI の書き込みに伴う再読み込み。編集画面（アイテム管理）は表示のたびに読み直す |
| 読み込みレポート | 読み込みのたびに結果（受理・スキップ・採番・補正・外部変更・破損）をまとめ、直近の 1 回分をメモリに持つ。ファイルには書き出さない。CLI の `qdl reload`・`qdl check` が返す。データファイルに加えてワークスペースファイル（`workspace.json` / `workspace-archive.json`）も並ぶ。詳細は[ワークスペースファイル形式](workspace-format.md)を参照 |
| トースト | スキップ・採番、またはワークスペースのグループの最上位への移動（深すぎる・循環）があったときだけ「データ: N 件読み込み・M 件スキップ・K 件に ID を採番・深すぎる・循環するグループ L 件を最上位へ移動」の形で表示する（0 件の部分は出さない。ほかの補正では出さない）（外部変更を検知したときは先頭が「外部編集されたデータ:」になる） |
| 変更前スナップショット | 前回読み込み時（または QDL 自身の書き込み時）と内容が違うファイルを検知すると、**変更前の内容**を `config/backup/YYYY-MM-DDTHH-MM-SS_pre-external/` に保存する（`backupEnabled` が true のとき。`backupRetention` とは別枠で最新 10 件を保持）。QDL の外の変更で壊れたときの戻し先。**検知は QDL 起動中の編集 → 次の再読み込み（F5・CLI の `qdl reload`、またはアプリ内の操作・CLI の書き込みに伴う再読み込み）のときだけ**（前回の内容はメモリ上で覚えているため、QDL 終了中に編集した内容は起動時に反映はされるが外部変更としては検知されず、スナップショットも作られない） |
| 楽観ロック | 編集画面の保存は全ファイルを全量上書きするため、読み込み時のファイル内容ハッシュを保存時に照合し、読み込み後に外部で変更されていれば保存を拒否して再読み込みする（`saveEditableItems` の `expectedHashes`） |
| ID 指定の更新 | メイン画面と CLI からの編集・削除は毎回ディスクを読み直して該当 ID だけ差し替えるため、外部変更と共存できる |

#### 読み込みレポートの形式

CLI の `qdl check` が返す `filesWithIssues` などは、この形式の一部です。

```json
{
  "reportVersion": 1,
  "loadedAt": "2026-09-21T12:34:56.000Z",
  "summary": {
    "accepted": 42,
    "skipped": 1,
    "idAssigned": 2,
    "groupsFlattened": 0,
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

| フィールド | 説明 |
| --- | --- |
| `summary.groupsFlattened` | 深すぎる・循環するため最上位へ移したワークスペースのグループの数（`code: "groupFlattened"` の issue の数） |
| `files[]` | データファイル（`datafiles/data*.json`）に加えて、ワークスペースファイル（`workspace.json` / `workspace-archive.json`）も同じ形式で並ぶ |
| `files[].status` | `ok` / `corrupted`（JSON として壊れている。`error` に理由） / `unreadable`（読めない） |
| `files[].accepted` | 受理したアイテム数（`dir` の展開前。JSON 上の要素数） |
| `files[].issues[].kind` | `invalid`（スキップ） / `idAssigned`（採番） / `normalized`（構造の補正。`version` の補完） |
| `files[].issues[].index` | 書き戻し後の `items` 配列内の位置。ファイル単位の問題や削除した要素は `-1`（`reason` に元の位置） |
| `files[].issues[].reason` | 問題の説明。表示言語の文（例は日本語）。項目の形の検証（必須の項目が無い等）は英語 |
| `files[].issues[].section` | 問題があった配列名（`workspaces` / `groups` / `items`）。ワークスペースファイルのときだけ付く（データファイルは `items` しか無いため省略） |
| `files[].issues[].code` | 画面で知らせる補正の種類。今は、深すぎる・循環するワークスペースのグループを最上位へ移したときの `groupFlattened` だけ（ほかの issue には付かない） |
| `files[].rewritten` | 採番・補正のためファイルを書き戻したか |
| `preChangeSnapshot` | 外部変更の検知時に作った変更前スナップショットのフォルダ名。なければ `null` |

## 6. データ型定義（TypeScript）

型定義の正本はコードです。フィールドの一覧・型・コメントは次のファイルを参照してください（このドキュメントには写しを置きません）。

| 対象 | 場所 | 主な型 |
| --- | --- | --- |
| ファイルに書く JSON の形 | `src/common/types/json-data.ts` | `JsonDataFile`、`JsonItem`（union）、`JsonLauncherItem`・`JsonDirItem`・`JsonSetItem`・`JsonClipboardItem`、`JsonDirOptions`（旧形式の `JsonGroupItem`・`JsonLayoutItem` は変換のためだけに残る）、型ガード `isJson*Item()` |
| 表示・実行用の内部型 | `src/common/types/launcher.ts` | `LauncherItem`・`SetItem`・`ClipboardItem`・`AppItem`、`ItemWindowSwitch`（単一アイテムのウィンドウ切り替え）、`SetEntry`、`WindowConfig`（ウィンドウを探して前面に出す・動かす処理 `src/main/utils/windowActivator.ts` に渡す内部の形） |
| 検索 | `src/common/types/search.ts` | `SearchMode`・`SearchHistoryEntry`・`SearchHistoryState` |

**要点:**

- `JsonItem` は `type`（`item` / `dir` / `set` / `clipboard`）で判別する union。全アイテム共通のフィールドは `id`（8 文字の英数字）・`memo`・`updatedAt`
- ファイル上の型（`Json*`）と画面で扱う内部型は別。読み込み時に `src/main/services/data/jsonItemConverter.ts` が JSON アイテムを内部型へ変換する（フォルダ取込の展開・`.lnk` の解析を含む）
- 内部型の `type` は JSON 側と語彙が違う。`JsonLauncherItem`（`type: "item"`）は、パスから判定した実行タイプ（`url` / `file` / `folder` / `app` / `customUri`、`path` が空なら `windowSwitch`＝パスの無い単一アイテム、3.1.5.7）を `type` に持つ `LauncherItem` になる
- 内部型の `sourceFile`・`id` は、編集・削除のときに元のファイルとアイテムを特定するために使う（`lineNumber` は非推奨）

## 7. 関連ドキュメント

- **[ワークスペースファイル形式](workspace-format.md)** - workspace.json仕様
- **[設定ファイル形式](settings-format.md)** - settings.json仕様
- **[ファイル形式一覧](README.md)** - すべてのファイル形式の概要
- **[開発ガイド](../../setup/development.md)** - 開発時の注意事項
