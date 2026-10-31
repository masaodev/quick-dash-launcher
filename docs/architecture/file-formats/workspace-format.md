# ワークスペースファイル形式（2.0）

QuickDashLauncher のワークスペース機能で使用されるファイルの形式を説明します。

## 1. ファイル概要

### 1.1. 対象ファイル

| ファイル名 | 用途 |
| --- | --- |
| **workspace.json** | ワークスペース（タブ）・グループ・アイテム |
| **workspace-archive.json** | アーカイブしたグループとアイテム |
| **workspace-ui-state.json** | グループの折りたたみ・ワークスペースウィンドウの開閉/ピン・切り離しウィンドウの位置/ピン |

手で編集する使い方はサポートしない。AI にアイテム・グループを変えさせたいときは CLI（`qdl`）を使う。QDL の外で変わったときの備えは 5 章。

保存場所は設定フォルダ直下（[設定フォルダの場所](README.md#設定フォルダの場所)）。すべて **UTF-8（BOMなし）** の JSON（BOM 付きでも読める）。

旧形式（`version` を持たない v1: UUID の id、`path` に埋め込んだ疑似文字列、`groups[].collapsed`、別ファイル `workspace-detached.json`）は起動時に 1 回だけ 2.0 に変換される（[6. 旧形式からの移行](#6-旧形式からの移行)）。

### 1.2. 設計方針

- **アイテムの語彙はデータファイルと同じ**: `type`（`item` / `clipboard` / `set`。ワークスペースだけの参照アイテム `ref` を除く）と型ごとのフィールド名は `datafiles/data*.json` の `JsonItem` と一致する。ワークスペース側は所属（`workspaceId` / `groupId`）と並び順（`order` / `addedAt`）を足し、`updatedAt` / `autoImportRuleId` を除いたもの（`type: item` のみ `originalPath` を追加で持つ）。一致は `src/common/types/json-workspace.ts` のコンパイル時アサーションで担保
- **ファイルには判定結果を保存しない**: `url / file / app / …` の起動種別は保存せず、読込時に `path` から判定する（実行時の `launcherType`）
- **UI 状態はデータに混ぜない**: 折りたたみ・ウィンドウ位置は `workspace-ui-state.json` に分離
- **色は CSS 変数名ではなくトークン**: `primary` などの名前で保存し、レンダラーで `var(--group-color-<token>)` に解決する（`src/common/groupColors.ts`）
- **id は 8 文字英数字**（データファイルと同じ規則・`generateUniqueId()`）。`workspace.json` と `workspace-archive.json` で 1 つの名前空間（復元で id がそのまま戻るため）。データファイルとは別名前空間で、参照アイテムの `refItemId` だけがデータファイルの名前空間の id を指す

---

## 2. workspace.json

### 2.1. ファイル構造

```json
{
  "version": "2.0",
  "workspaces": [
    { "id": "Ws1Ab2Cd", "displayName": "メイン", "order": 0, "createdAt": 1700000000000 }
  ],
  "groups": [
    {
      "id": "Gr1Ab2Cd",
      "displayName": "開発",
      "color": "primary",
      "order": 0,
      "createdAt": 1700000000000,
      "workspaceId": "Ws1Ab2Cd",
      "parentGroupId": "Gr0Ab2Cd"
    }
  ],
  "items": [
    {
      "id": "It1Ab2Cd",
      "type": "item",
      "displayName": "GitHub",
      "path": "https://github.com/",
      "workspaceId": "Ws1Ab2Cd",
      "groupId": "Gr1Ab2Cd",
      "order": 0,
      "addedAt": 1700000000000
    }
  ]
}
```

### 2.2. トップレベル

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| **version** | string | ✓ | `"2.0"`。無いファイルは旧形式として移行される。これより新しい版のファイルは、表示はするが書き換えない（5 章） |
| **workspaces** | Workspace[] | ✓ | 1 件以上。0 件なら既定ワークスペースを作る（名前は作るときの表示言語で「既定」／「Default」） |
| **groups** | WorkspaceGroup[] | ✓ | |
| **items** | WorkspaceItem[] | ✓ | |

v0.8.0-beta.5 までの QDL が書いた `$schema` は読み飛ばし、次に QDL が書き戻すときに消える。

書き出し時のキー順は固定（`version` → `workspaces` → `groups` → `items`。アイテム内は `id, type, displayName, <型固有>, memo, workspaceId, groupId, order, addedAt`。参照アイテムの型固有は `refItemId, lastKnownName`）。

### 2.3. Workspace（タブ）

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| **id** | string | ✓ | 8 文字英数字 |
| **displayName** | string | ✓ | タブ名 |
| **order** | number | ✓* | 並び順。省略時は QDL が補う |
| **createdAt** | number | ✓* | 作成日時（ms）。省略時は QDL が補う |

`*` スキーマ上は必須だが、寛容パースは省略を補完する（`normalized`）。

### 2.4. WorkspaceGroup

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| **id** | string | ✓ | 8 文字英数字 |
| **displayName** | string | ✓ | グループ名 |
| **color** | string | ✓ | 色トークン（一覧は [src/common/groupColors.ts](../../../src/common/groupColors.ts) の `GROUP_COLOR_TOKENS`）または 6 桁 hex。不正な値は既定色に補正（`normalized`） |
| **order** | number | ✓* | 同じ親の中での並び順 |
| **createdAt** | number | ✓* | 作成日時（ms） |
| **workspaceId** | string | ✓ | 所属ワークスペース。存在しなければ既定ワークスペースへ寄せる（`normalized`） |
| **parentGroupId** | string | - | 親グループ（2 段まで）。存在しない・自分自身・循環・深さ超過（`MAX_GROUP_DEPTH`）なら外す（`normalized`）。循環・深さ超過で最上位へ移したときは issue に `code: "groupFlattened"` を付け、読み込みレポートの `summary.groupsFlattened` に数え、トーストで知らせ、ログにグループの ID を warn で残す。不正（`invalid`）なグループを指すときも外して最上位に出す（`workspace.json`。アーカイブでは残す） |

折りたたみ状態（旧 `collapsed`）はここには無い（[4. workspace-ui-state.json](#4-workspace-ui-statejson)）。

### 2.5. WorkspaceItem（`type` で判別する union）

共通フィールド:

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| **id** | string | ✓ | 8 文字英数字。無い・不正・重複なら採番（`idAssigned`） |
| **type** | string | ✓ | `item` / `clipboard` / `set` / `ref`（参照アイテム。[2.6](#26-参照アイテムtype-ref)）。廃止した `window`（ウィンドウ操作）は読み込み時にパスの無い `item` に変換する（6 章） |
| **displayName** | string | ✓ | 表示名（参照アイテムでは任意。[2.6](#26-参照アイテムtype-ref)） |
| **memo** | string | - | 自由記述（参照アイテムは持たない） |
| **workspaceId** | string | ✓ | 所属ワークスペース |
| **groupId** | string | - | 所属グループ。無い・存在しないグループや不正（`invalid`）なグループを指すときは、`workspace.json` の読み込みでワークスペースごとの「未分類」という名前のグループ（作るときの表示言語。ワークスペースの最後に作る普通のグループ）を作って入れ、読み込みレポートに `normalized`（「グループに入っていないアイテム {N} 件を、グループ「未分類」に入れました」）を残す。省略できるのは古いファイル・手編集のためで、読み込み後はどのアイテムも持つ |
| **order** | number | ✓* | 同じグループ内での並び順 |
| **addedAt** | number | ✓* | 追加日時（ms） |

`item` / `clipboard` / `set`（コピー）の型固有フィールドはデータファイルと同じなので、[データファイル形式 3 章](data-format.md#3-アイテムタイプ詳細) の各アイテムタイプ（`item`＝[3.1](data-format.md#31-通常アイテムjsonlauncheritem)、`clipboard`＝[3.5](data-format.md#35-クリップボードアイテムjsonclipboarditem)、`set`＝[3.3](data-format.md#33-セットjsonsetitem)）を参照。ワークスペースに固有の違いは次のとおり。

- `type: item` は、ショートカット（.lnk）のリンク先 `originalPath` を持てる。実行時の起動種別（url/file/folder/app/customUri/windowSwitch）は `originalPath` があればそれ、なければ `path` から判定する。`path` は、ウィンドウ切り替えの `window` があれば空でもよい（パスの無い単一アイテム。起動種別は `windowSwitch`、[データファイル形式 3.1.5.7](data-format.md#3157-パスの無い単一アイテム)）。ドット入りのフォルダ名と拡張子の無いファイルの扱い（末尾の区切り文字・読み込み時のディスク確認・`path-type-cache.json`）はデータファイルと同じ（[データファイル形式 3.1.2](data-format.md#312-サポートされるパス種類)）
- データファイルの `updatedAt`・`autoImportRuleId` は持たない
- `type: item` の `runAsAdmin`（常に管理者として実行）はデータファイルと同じ。参照アイテムは持たず、指すメインウィンドウのアイテムの値に従う
- `clipboard` は QDL が生成する。手で書かない
- `set` の行の `itemId` は、ワークスペースのアイテムの id か、データファイルのアイテムの id を指す。実行時はワークスペースのアイテムを先に探す（`src/main/ipc/workspaceHandlers.ts`）。行が参照アイテムを指すときは、参照を解決した中身で開く
- `type: item` のウィンドウ切り替え（`window`・`placement` など、[データファイル形式 3.1.5](data-format.md#315-ウィンドウ切り替えitemwindowswitch)）も、データファイルと同じ処理で実行する

アイテム本体の検証はデータファイルの検証関数（`validateJson*Item`）を共用しており、判定はデータファイルと一致する。

### 2.6. 参照アイテム（`type: "ref"`）

メインウィンドウのアイテム（データファイルのアイテム）を id で指すアイテム。中身（パス・メモなど）は書かず、表示・起動のたびにメインウィンドウのアイテムの中身を使う。

```json
{
  "id": "It2Ab2Cd",
  "type": "ref",
  "displayName": "作業用の GitHub",
  "refItemId": "Dt1Ab2Cd",
  "lastKnownName": "GitHub",
  "workspaceId": "Ws1Ab2Cd",
  "groupId": "Gr1Ab2Cd",
  "order": 1,
  "addedAt": 1700000000000
}
```

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| **id** / **workspaceId** / **groupId** / **order** / **addedAt** | | | 共通フィールドと同じ。アーカイブでは `archivedAt`・`archivedGroupId` も持つ（3 章） |
| **type** | string | ✓ | `"ref"` |
| **refItemId** | string | ✓ | 指すメインウィンドウのアイテムの id（データファイルの名前空間。8 文字英数字）。無い・形が違うときは `invalid` |
| **displayName** | string | - | ワークスペースでの表示名。省略するとメインウィンドウのアイテムの表示名を使う。空白だけなら読み込みで落とす |
| **lastKnownName** | string | - | 最後に見たメインウィンドウのアイテムの表示名。元のアイテムが見つからないときの表示に使う。QDL が書く |

- `memo` は持たない（メインウィンドウのアイテムのメモを使う）。書いてあっても読み込みで落とす。ほかの型固有フィールド（`path` など）も書かない
- 解決（`src/main/services/workspace/workspaceRefResolver.ts`）: データファイルを読み直すたび（`reloadConfigFiles`）に、id を持つメインウィンドウのアイテム（通常アイテム・クリップボード・セット。フォルダ取込で展開したアイテムとウィンドウ検索の結果は除く）の表を作る。ワークスペースの画面・CLI・起動に渡すときに、参照をその表で埋める
  - 見つかれば、指す先の種別（`item` / `clipboard` / `set`）の形になる。id・所属・並び順はワークスペースのもの、`displayName` はワークスペースでの表示名（無ければメインウィンドウの表示名）、メモはメインウィンドウのもの。実行時だけの `ref`（`status: "ok"`・`mainDisplayName`・`tabName` など。型は `WorkspaceRefInfo`）が付く
  - 見つからなければ `type: "ref"` のまま（`status: "missing"`。フォルダ取込の行を指していれば `"unsupported"`）
  - 書き戻すときは、解決した形でも参照アイテムとして書く（中身をファイルに残さない）
- データファイルを読み直したあと（`WorkspaceService.syncRefs()`）、参照アイテム（アーカイブを含む）を解決した中身が前回から変わったときだけ、ワークスペースの画面に読み直しを知らせる（メインウィンドウの関係ないアイテムが変わっただけでは知らせない）。`lastKnownName` は、今のメインウィンドウの表示名と違う参照だけ書き直す（見つからない参照は書き直さない）
- アイテム管理の「重複を削除」で消したアイテムを指す参照は、保存したあとに残したアイテムを指すよう `refItemId` を付け替える（アーカイブを含む。`workspace:remap-refs`、`WorkspaceService.remapRefs()`）
- クリップボードの参照は、メインウィンドウのアイテムの実データ（`clipboard-data/<id>.json`）をそのまま使う（複製しない）
- ワークスペースのクリップボードアイテム（コピー）を消す・本文を書き換える・参照に置き換えると、使わなくなった実データは、メインウィンドウのアイテムも使っていなければ消える（[データファイル形式 3.5.3](data-format.md#353-データファイル)）

---

## 3. workspace-archive.json

```json
{
  "version": "2.0",
  "groups": [/* WorkspaceGroup + archivedAt, originalOrder, itemCount */],
  "items": [/* WorkspaceItem + archivedAt, archivedGroupId */]
}
```

| 追加フィールド | 対象 | 説明 |
| --- | --- | --- |
| **archivedAt** | groups / items | アーカイブ日時（ms） |
| **originalOrder** | groups | アーカイブ前の `order` |
| **itemCount** | groups | アーカイブ時のアイテム数（表示用） |
| **archivedGroupId** | items | 所属していたアーカイブグループ。無い・存在しなければそのアイテムは読み込みから外す（`invalid`。ファイルには残り、グループを直せば戻る） |

参照解決: `workspaceId` は `workspace.json` のワークスペース、`parentGroupId` はアーカイブ内＋`workspace.json` のグループで解決する。アーカイブ・復元は 2 ファイルを 1 トランザクションで書く（`WorkspaceFileStore.updateBoth`）。

---

## 4. workspace-ui-state.json

QDL が管理する UI 状態。壊れている・読めないときは警告して空として扱う。次に書くときは、読めなかったファイルを同じフォルダに `workspace-ui-state.broken-YYYYMMDDTHHmmss.json` の名前で退避してから書く（元に戻す手がかりを残す）。退避できなければ書かない（`JsonFileStore`）。

```json
{
  "version": 1,
  "collapsedGroups": { "Gr1Ab2Cd": true },
  "detachedWindows": {
    "Gr1Ab2Cd": {
      "collapsedStates": { "Gr1Ab2Cd": false, "Gr2Ab2Cd": true },
      "bounds": { "x": 10, "y": 20, "width": 300, "height": 400 },
      "pinMode": 1,
      "anchor": { "horizontal": "start", "offsetX": 10, "vertical": "center", "offsetY": -300 }
    }
  },
  "workspaceWindow": { "open": true, "pinLevel": 1 }
}
```

- `collapsedGroups`: メインのワークスペースウィンドウでの折りたたみ（true のものだけ持つ）
- `detachedWindows`: 切り離しウィンドウの状態（ルートグループ id → 状態）
  - `anchor`: 最後に動かしたときの、載っていたディスプレイの作業領域に対する位置。`horizontal`・`vertical` は基準（`start`＝左端・上端、`center`＝中央、`end`＝右端・下端）、`offsetX`・`offsetY` は基準からの距離。設定 `detachedPositionMode` が `mainDisplay` のときに使う（[ウィンドウ制御 - 切り離しウィンドウの表示位置](../window-control.md#切り離しウィンドウの表示位置)）。この項目を足す前のファイルには無く、無ければ今の位置から求める
  - `pinMode`: ピン留めの段階（0＝なし、1＝表示固定、2＝常に最前面。無ければ 0）
- `workspaceWindow`: ワークスペースウィンドウの状態。無ければ `{ "open": false, "pinLevel": 1 }`（閉じていて、📌 は表示固定）
  - `open`: 開いているか。⭐・`Ctrl+W`・× で閉じると false。メインウィンドウと一緒に隠れただけなら true のまま
  - `pinLevel`: ピン留めの段階（0・1・2）。閉じても覚えている
- 存在しなくなったグループの状態は、グループ削除・アーカイブ・再読み込みのたびに捨てる（`pruneMissingGroups`）

---

## 5. 読み込み・書き込みの仕組み

実装: `src/main/services/workspace/WorkspaceFileStore.ts`（データ本体）、`WorkspaceUiStateStore.ts`（UI 状態）、`src/common/utils/workspaceParser.ts`（寛容パース）。

| 仕組み | 内容 |
| --- | --- |
| 読み込みタイミング | 起動時と**メイン画面の F5**（`reloadConfigFiles`）。ファイルは監視しない。electron-store のように操作のたびにディスクを読むことはない |
| 寛容パース | JSON 構文エラー・ルート構造の不正・配列フィールドの型違い（配列以外）だけ `corrupted`。配列フィールドが無ければ空配列を補う（`normalized`）。要素単位の不正は `invalid`（読み込みから外し、書き戻し時に配列の末尾へ残す）。ただしオブジェクトでない要素は残さず削除する。id の欠落/不正/重複は採番（`idAssigned`）し、参照（`groupId` / `parentGroupId` / `workspaceId` / `archivedGroupId`）を追随させる。宙に浮いた参照・`version`・省略した `order` 等は補正（`normalized`）。ただし扱える版より新しい `version` は直さない（下の「新しい版のファイル」） |
| 新しい版のファイル | どちらかの `version` が扱える版（`"2.0"`）より新しければ、新しい版の QDL が保存したものとして、読んで表示はするが両ファイルとも書かない。旧形式からの変換・採番の書き戻しもしない。書き込む操作は「QDL を最新の版に更新してください」で止まる（`WorkspaceNewerFormatError`。トーストで知らせる）。読み込みレポートの `newerFormat` に載る（[形式の版と互換](README.md#形式の版と互換)） |
| 知らない項目 | 新しい版の QDL が足した項目（ファイル直下と、タブ・グループ・アイテムの直下）は、書き込んでも消さずに要素の最後に残す。アーカイブ・復元で両ファイルの間を移した要素も同じ（[知らない項目は残す](README.md#知らない項目は残す)） |
| レポート | 読み込みレポート（[データファイル形式 5.3](data-format.md#53-qdl-の外での変更への備え)。CLI の `qdl reload`・`qdl check` が返す）の `files[]` に `workspace.json` / `workspace-archive.json` がデータファイルと並ぶ。ワークスペースの `issues[]` は `section`（`workspaces` / `groups` / `items`）を持ち、`index` はその配列内の位置 |
| 外部変更検知 | データファイルと同じ `dataFileTracker`。前回読んだ/書いた内容と違えば `externallyChanged`、`backupEnabled` なら変更前を `backup/*_pre-external/` に残す |
| 楽観ロック | 書き込み前に現在のファイル内容を確認し、QDL の外で変更されていれば書かずに拒否（メイン画面で F5 を押して再読み込みするよう促すトーストを出す）。読み直せば再び書ける |
| 破損時 | どちらか 1 ファイルでも読めなければ両ファイルの書き込みを拒否する（空のキャッシュで上書きして復旧不能にしない）。ワークスペース画面は空になり、エラーのトースト「設定ファイルの読み込みに失敗しました（破損の可能性）: <ファイル名>」で通知（`src/main/services/data/dataFileLoader.ts`） |
| バックアップ | `workspace.json` / `workspace-archive.json` は日次スナップショットの変更検知トリガー。`workspace-ui-state.json` はバックアップには含むがトリガーではない |

---

## 6. 旧形式からの移行

`workspace.json` / `workspace-archive.json` のどちらか片方でも `version` を持たない旧形式なら、`WorkspaceFileStore` が変換・検証したあと、書き込む前に `backup/<日時>_pre-migration/`（`backupEnabled` に関係なく作る）へスナップショットを取り、書き戻す。スナップショットに失敗したら移行せず `corrupted` として扱う。変換は純粋関数 `workspaceMigration.ts` で、読み込みレポートに `normalized` として 1 行載る。

| 旧形式（v1） | 2.0 |
| --- | --- |
| `id`: UUID、ワークスペース `"default"` | 8 文字英数字に採番し直し、全参照（`groupId` / `parentGroupId` / `workspaceId` / `archivedGroupId` / UI 状態のキー）を追随 |
| `type: "url" / "file" / "folder" / "app" / "customUri"` | `type: "item"`（起動種別は読込時に判定） |
| `type: "windowOperation"`、`path: "[ウィンドウ操作: <title>]"` | いったん `type: "window"`（`windowTitle: "<title>"`。タイトル空で `processName` だけなら `"*"`）にし、このあと下のウィンドウ操作の変換でパスの無い単一アイテム（`type: "item"`・`path: ""`・`window`）になる |
| `windowX / windowY / windowWidth / windowHeight` | `x / y / width / height` |
| `clipboardDataRef / clipboardFormats / clipboardSavedAt` | `dataFileRef / formats / savedAt` |
| `layoutEntries` | `entries`（`icon` は除去。このあと下のセットへの変換で `set` になる） |
| `path: "[グループ: N件]"` 等の表示用文字列 | 保存しない（表示時に組み立てる） |
| `originalName`, `label`, `icon` | 削除 |
| `groups[].collapsed` | `workspace-ui-state.json` の `collapsedGroups` |
| `groups[].name`（さらに古い形式） | `displayName` |
| `color: "var(--color-primary)"` / パレットの hex | 色トークン（`primary` / `teal` など）。その他の hex はそのまま |
| `workspace-detached.json` | `workspace-ui-state.json` の `detachedWindows`（移行後に削除） |

**旧グループ・旧ウィンドウ配置からセットへの変換**: 2.0 への移行のあと、`workspace.json` / `workspace-archive.json` の `type: "group"` と `type: "layout"` を `type: "set"` に変換して書き戻す（`WorkspaceFileStore`・`src/main/services/data/setMigration.ts`）。変換の規則はデータファイルと同じ（[データファイル形式 3.3.6](data-format.md#336-旧形式からの変換)）で、所属・並び順（`workspaceId` / `groupId` / `order` / `addedAt` / `archivedAt` / `archivedGroupId`）はそのまま残す。データファイルとの違いは次のとおり。

- 旧グループの名前は、データファイルの通常アイテム（まだ変換していないウィンドウ操作を含む）の表示名から探して `itemId` の行にする。データファイルは読み込み処理に通さずに中身だけを読むので、フォルダ取込で展開したアイテムの名前は見つからない行になる（`src/main/services/workspace/WorkspaceService.ts`）
- 2 ファイルとも読み込みの状態が `ok` のときだけ変換する（`corrupted`・`unreadable` のときはしない）
- 変換の前に `backup/<日時>_pre-set-migration/` のスナップショットを作る（`backupEnabled` に関係なく作る）。作れなければ変換せず、旧形式のアイテムは未知の `type` として `invalid` になる（ファイルには残る）

**単一アイテムの windowConfig とウィンドウ操作の変換**: セットへの変換に続けて、`type: "item"` の `windowConfig` をウィンドウ切り替えの新しいキー（`window`・`placement` など）に、廃止したウィンドウ操作（`type: "window"`）をパスの無い単一アイテムに変換して書き戻す（`WorkspaceFileStore` の `migrateLegacyItems`・`src/common/utils/itemWindowConversion.ts`）。規則はデータファイルと同じ（[データファイル形式 3.1.5.6](data-format.md#3156-旧形式windowconfigからの変換)・[3.4](data-format.md#34-ウィンドウ操作廃止読み込み時に変換)）。ウィンドウ操作の `id`・所属・並び順（`workspaceId` / `groupId` / `order` / `addedAt` / `archivedAt` / `archivedGroupId`）はそのまま残すので、指していたセットの行もそのまま変換後のアイテムを指す。

- セットへの変換と同じく、2 ファイルとも読み込みの状態が `ok` のときだけ変換する
- スナップショットは 1 回だけ作る。セットへの変換もあれば `backup/<日時>_pre-set-migration/`、`windowConfig`・ウィンドウ操作だけなら `backup/<日時>_pre-window-migration/`（`backupEnabled` に関係なく作る）。作れなければ書き換えないが、読み込みの検証（`src/common/utils/workspaceParser.ts` の `validateItemBody`）がその場で新しい形に直すので動きは変わらない

---

## 7. データ型定義（TypeScript）

- ファイル形式: `src/common/types/json-workspace.ts`（`JsonWorkspaceFile`, `JsonWorkspaceItem`, `JsonWorkspaceArchiveFile`, `WorkspaceUiStateFile`）
- 実行時: `src/common/types/workspace.ts`（`WorkspaceItem` = ファイル形式 + `launcherType` / `icon`（参照から解決したものは `ref` も。解決できない参照は `WorkspaceRefItem`）、`WorkspaceGroupView` = グループ + `collapsed`）
- 変換: `src/common/utils/workspaceConverters.ts`（AppItem → 本体、WorkspaceItem ⇄ RegisterItem、表示文字列 `describeWorkspaceItem`）

---

## 8. 関連ドキュメント

- **[ファイル形式一覧](README.md)** - 全ファイル形式の概要と AI・手動編集
- **[データファイル形式](data-format.md)** - アイテム型の詳細（ワークスペースと共通）
