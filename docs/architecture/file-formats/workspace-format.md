# ワークスペースファイル形式（2.0）

QuickDashLauncher のワークスペース機能で使用されるファイルの形式を説明します。

## 1. ファイル概要

### 1.1. 対象ファイル

| ファイル名                  | 用途                                                | 人・AI の編集        | スキーマ                                       |
| --------------------------- | --------------------------------------------------- | -------------------- | ---------------------------------------------- |
| **workspace.json**          | ワークスペース（タブ）・グループ・アイテム          | 可                   | `config/schemas/workspace.schema.json`         |
| **workspace-archive.json**  | アーカイブしたグループとアイテム                    | 可（通常は触らない） | `config/schemas/workspace-archive.schema.json` |
| **workspace-ui-state.json** | グループの折りたたみ・切り離しウィンドウの位置/ピン | 不可（QDL 管理）     | なし                                           |

保存場所は `%APPDATA%/quick-dash-launcher/config/` 直下。すべて **UTF-8（BOMなし）** の JSON。

旧形式（`version` を持たない v1: UUID の id、`path` に埋め込んだ疑似文字列、`groups[].collapsed`、別ファイル `workspace-detached.json`）は起動時に 1 回だけ 2.0 に変換される（[6. 旧形式からの移行](#6-旧形式からの移行)）。

### 1.2. 設計方針

- **アイテムの語彙はデータファイルと同じ**: `type`（`item` / `window` / `group` / `clipboard` / `layout`）と型ごとのフィールド名は `datafiles/data*.json` の `JsonItem` と一致する。ワークスペース側は所属（`workspaceId` / `groupId`）と並び順（`order` / `addedAt`）を足しただけ。一致は `src/common/types/json-workspace.ts` のコンパイル時アサーションで担保
- **ファイルには判定結果を保存しない**: `url / file / app / …` の起動種別は保存せず、読込時に `path` から判定する（実行時の `launcherType`）
- **UI 状態はデータに混ぜない**: 折りたたみ・ウィンドウ位置は `workspace-ui-state.json` に分離
- **色は CSS 変数名ではなくトークン**: `primary` などの名前で保存し、レンダラーで `var(--group-color-<token>)` に解決する（`src/common/groupColors.ts`）
- **id は 8 文字英数字**（データファイルと同じ規則・`generateId()`）。`workspace.json` と `workspace-archive.json` で 1 つの名前空間（復元で id がそのまま戻るため）。データファイルとは別名前空間

---

## 2. workspace.json

### 2.1. ファイル構造

```json
{
  "$schema": "./schemas/workspace.schema.json",
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

| フィールド     | 型               | 必須 | 説明                                                                       |
| -------------- | ---------------- | ---- | -------------------------------------------------------------------------- |
| **$schema**    | string           | -    | `./schemas/workspace.schema.json`。無い・違えば QDL が補う（`normalized`） |
| **version**    | string           | ✓    | `"2.0"`。無いファイルは旧形式として移行される                              |
| **workspaces** | Workspace[]      | ✓    | 1 件以上。0 件なら既定ワークスペース「デフォルト」を作る                   |
| **groups**     | WorkspaceGroup[] | ✓    |                                                                            |
| **items**      | WorkspaceItem[]  | ✓    |                                                                            |

書き出し時のキー順は固定（`$schema` → `version` → `workspaces` → `groups` → `items`。アイテム内は `id, type, displayName, <型固有>, memo, workspaceId, groupId, order, addedAt`）。

### 2.3. Workspace（タブ）

| フィールド      | 型     | 必須 | 説明                                |
| --------------- | ------ | ---- | ----------------------------------- |
| **id**          | string | ✓    | 8 文字英数字                        |
| **displayName** | string | ✓    | タブ名                              |
| **order**       | number | ✓*   | 並び順。省略時は QDL が補う         |
| **createdAt**   | number | ✓*   | 作成日時（ms）。省略時は QDL が補う |

`*` スキーマ上は必須だが、寛容パースは省略を補完する（`normalized`）。

### 2.4. WorkspaceGroup

| フィールド        | 型     | 必須 | 説明                                                                                                                                                                           |
| ----------------- | ------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **id**            | string | ✓    | 8 文字英数字                                                                                                                                                                   |
| **displayName**   | string | ✓    | グループ名                                                                                                                                                                     |
| **color**         | string | ✓    | 色トークン（`primary / success / danger / warning / info / secondary / purple / teal / pink / indigo / orange / cyan`）または 6 桁 hex。不正な値は既定色に補正（`normalized`） |
| **order**         | number | ✓*   | 同じ親の中での並び順                                                                                                                                                           |
| **createdAt**     | number | ✓*   | 作成日時（ms）                                                                                                                                                                 |
| **workspaceId**   | string | ✓    | 所属ワークスペース。存在しなければ既定ワークスペースへ寄せる（`normalized`）                                                                                                   |
| **parentGroupId** | string | -    | 親グループ（2 段まで）。存在しない・自分自身なら外す（`normalized`）                                                                                                           |

折りたたみ状態（旧 `collapsed`）はここには無い（[4. workspace-ui-state.json](#4-workspace-ui-statejson)）。

### 2.5. WorkspaceItem（`type` で判別する union）

共通フィールド:

| フィールド      | 型     | 必須 | 説明                                                   |
| --------------- | ------ | ---- | ------------------------------------------------------ |
| **id**          | string | ✓    | 8 文字英数字。無い・不正・重複なら採番（`idAssigned`） |
| **type**        | string | ✓    | `item` / `window` / `group` / `clipboard` / `layout`   |
| **displayName** | string | ✓    | 表示名                                                 |
| **memo**        | string | -    | 自由記述                                               |
| **workspaceId** | string | ✓    | 所属ワークスペース                                     |
| **groupId**     | string | -    | 所属グループ（未分類なら省略）。存在しなければ外す     |
| **order**       | number | ✓*   | 同じグループ内での並び順                               |
| **addedAt**     | number | ✓*   | 追加日時（ms）                                         |

型固有フィールド（データファイルと同じ。詳細は [データファイル形式 3 章](data-format.md#3-アイテムタイプ詳細)）:

| type          | フィールド                                                                                                                                                    | 備考                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **item**      | `path`, `args?`, `originalPath?`, `customIcon?`, `windowConfig?`                                                                                              | `originalPath` はショートカット（.lnk）のリンク先。実行時の起動種別 `launcherType`（url/file/folder/app/customUri）は `originalPath ?? path` から判定 |
| **window**    | `windowTitle`, `processName?`, `x?`, `y?`, `width?`, `height?`, `moveToActiveMonitorCenter?`, `virtualDesktopNumber?`, `activateWindow?`, `pinToAllDesktops?` | `windowTitle` はワイルドカード対応                                                                                                                    |
| **group**     | `itemNames`                                                                                                                                                   | データファイル側の `type: item / window` を表示名で参照                                                                                               |
| **clipboard** | `dataFileRef`, `savedAt`, `preview?`, `formats`, `customIcon?`                                                                                                | QDL が生成。手で書かない                                                                                                                              |
| **layout**    | `entries`, `customIcon?`                                                                                                                                      | QDL が生成。手で書かない                                                                                                                              |

アイテム本体の検証はデータファイルの検証関数（`validateJson*Item`）を共用しており、判定はデータファイルと一致する。

---

## 3. workspace-archive.json

```json
{
  "$schema": "./schemas/workspace-archive.schema.json",
  "version": "2.0",
  "groups": [/* WorkspaceGroup + archivedAt, originalOrder, itemCount */],
  "items": [/* WorkspaceItem + archivedAt, archivedGroupId */]
}
```

| 追加フィールド      | 対象           | 説明                                                                             |
| ------------------- | -------------- | -------------------------------------------------------------------------------- |
| **archivedAt**      | groups / items | アーカイブ日時（ms）                                                             |
| **originalOrder**   | groups         | アーカイブ前の `order`                                                           |
| **itemCount**       | groups         | アーカイブ時のアイテム数（表示用）                                               |
| **archivedGroupId** | items          | 所属していたアーカイブグループ。存在しなければそのアイテムは削除（`normalized`） |

参照解決: `workspaceId` は `workspace.json` のワークスペース、`parentGroupId` はアーカイブ内＋`workspace.json` のグループで解決する。アーカイブ・復元は 2 ファイルを 1 トランザクションで書く（`WorkspaceFileStore.updateBoth`）。

---

## 4. workspace-ui-state.json

QDL が管理する UI 状態。AI 編集対象外・スキーマなし。壊れていれば警告して空として扱う（上書きしない）。

```json
{
  "version": 1,
  "collapsedGroups": { "Gr1Ab2Cd": true },
  "detachedWindows": {
    "Gr1Ab2Cd": {
      "collapsedStates": { "Gr1Ab2Cd": false, "Gr2Ab2Cd": true },
      "bounds": { "x": 10, "y": 20, "width": 300, "height": 400 },
      "pinMode": 1
    }
  }
}
```

- `collapsedGroups`: メインのワークスペースウィンドウでの折りたたみ（true のものだけ持つ）
- `detachedWindows`: 切り離しウィンドウの状態（ルートグループ id → 状態）
- 存在しなくなったグループの状態は、グループ削除・アーカイブ・再読込のたびに捨てる（`pruneMissingGroups`）

---

## 5. 読み込み・書き込みの仕組み

実装: `src/main/services/workspace/WorkspaceFileStore.ts`（データ本体）、`WorkspaceUiStateStore.ts`（UI 状態）、`src/common/utils/workspaceParser.ts`（寛容パース）。

| 仕組み             | 内容                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 読み込みタイミング | 起動時と**メイン画面の F5**（`reloadConfigFiles`）。ファイルは監視しない。electron-store のように操作のたびにディスクを読むことはない                                                                                                                                                                                                              |
| 寛容パース         | JSON 構文エラーとルート構造の不正だけ `corrupted`。要素単位の不正は `invalid`（読み込みから外し、書き戻し時に配列の末尾へ残す）。id の欠落/不正/重複は採番（`idAssigned`）し、参照（`groupId` / `parentGroupId` / `workspaceId` / `archivedGroupId`）を追随させる。宙に浮いた参照・`$schema`・`version`・省略した `order` 等は補正（`normalized`） |
| レポート           | `config/last-load-report.json` の `files[]` に `workspace.json` / `workspace-archive.json` がデータファイルと並ぶ。ワークスペースの `issues[]` は `section`（`workspaces` / `groups` / `items`）を持ち、`index` はその配列内の位置                                                                                                                 |
| 外部変更検知       | データファイルと同じ `dataFileTracker`。前回読んだ/書いた内容と違えば `externallyChanged`、`backupEnabled` なら変更前を `backup/*_pre-external/` に残す                                                                                                                                                                                            |
| 楽観ロック         | 書き込み前に現在のファイル内容を確認し、QDL の外で変更されていれば書かずに拒否（トースト「F5 を押して再読込してください」）。読み直せば再び書ける                                                                                                                                                                                                  |
| 破損時             | どちらか 1 ファイルでも読めなければ両ファイルの書き込みを拒否する（空のキャッシュで上書きして復旧不能にしない）。ワークスペース画面は空になり、トーストで通知                                                                                                                                                                                      |
| バックアップ       | `workspace.json` / `workspace-archive.json` は日次スナップショットの変更検知トリガー。`workspace-ui-state.json` はバックアップには含むがトリガーではない                                                                                                                                                                                           |

---

## 6. 旧形式からの移行

`version` を持たないファイルを読んだとき、`WorkspaceFileStore` が `backup/<日時>_pre-migration/`（`backupEnabled` に関係なく作る）にスナップショットを取ってから変換し、書き戻す。スナップショットに失敗したら移行せず `corrupted` として扱う。変換は純粋関数 `workspaceMigration.ts` で、`last-load-report.json` に `normalized` として 1 行載る。

| 旧形式（v1）                                                   | 2.0                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`: UUID、ワークスペース `"default"`                         | 8 文字英数字に採番し直し、全参照（`groupId` / `parentGroupId` / `workspaceId` / `archivedGroupId` / UI 状態のキー）を追随 |
| `type: "url" / "file" / "folder" / "app" / "customUri"`        | `type: "item"`（起動種別は読込時に判定）                                                                                  |
| `type: "windowOperation"`、`path: "[ウィンドウ操作: <title>]"` | `type: "window"`、`windowTitle: "<title>"`。タイトル空で `processName` だけなら `windowTitle: "*"`                        |
| `windowX / windowY / windowWidth / windowHeight`               | `x / y / width / height`                                                                                                  |
| `clipboardDataRef / clipboardFormats / clipboardSavedAt`       | `dataFileRef / formats / savedAt`                                                                                         |
| `layoutEntries`                                                | `entries`（`icon` は除去）                                                                                                |
| `path: "[グループ: N件]"` 等の表示用文字列                     | 保存しない（表示時に組み立てる）                                                                                          |
| `originalName`, `label`, `icon`                                | 削除                                                                                                                      |
| `groups[].collapsed`                                           | `workspace-ui-state.json` の `collapsedGroups`                                                                            |
| `groups[].name`（さらに古い形式）                              | `displayName`                                                                                                             |
| `color: "var(--color-primary)"` / パレットの hex               | 色トークン（`primary` / `teal` など）。その他の hex はそのまま                                                            |
| `workspace-detached.json`                                      | `workspace-ui-state.json` の `detachedWindows`（移行後に削除）                                                            |

---

## 7. データ型定義（TypeScript）

- ファイル形式: `src/common/types/json-workspace.ts`（`JsonWorkspaceFile`, `JsonWorkspaceItem`, `JsonWorkspaceArchiveFile`, `WorkspaceUiStateFile`）。JSON Schema はここから生成（`npm run schema:generate`）
- 実行時: `src/common/types/workspace.ts`（`WorkspaceItem` = ファイル形式 + `launcherType` / `icon`、`WorkspaceGroupView` = グループ + `collapsed`）
- 変換: `src/common/utils/workspaceConverters.ts`（AppItem → 本体、WorkspaceItem ⇄ RegisterItem、表示文字列 `describeWorkspaceItem`）

---

## 8. 関連ドキュメント

- **[ファイル形式一覧](README.md)** - 全ファイル形式の概要と AI・手動編集
- **[データファイル形式](data-format.md)** - アイテム型の詳細（ワークスペースと共通）
- **[ワークスペース機能](../../features/workspace.md)** - 機能の使い方
