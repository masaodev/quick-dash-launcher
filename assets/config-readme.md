# QuickDashLauncher 設定フォルダ — 直接編集する人・AI 向け

> このファイルは QuickDashLauncher v{{APP_VERSION}} が起動時に生成します。編集しても次回起動で上書きされます。
> 設定フォルダ: `{{CONFIG_DIR}}`

## まず守ること

- 編集していいのは `datafiles/data*.json`・`settings.json`・`workspace.json`・`workspace-archive.json` だけ。
  `icon-cache/`・`backup/`・`clipboard-data/`・`workspace-ui-state.json`・`last-load-report.json`・`schemas/`・この `README.md` は触らない
- QuickDashLauncher（以下 QDL）の「アイテム管理」画面やワークスペース画面を操作しながら編集しない
  （QDL 側の保存が競合として拒否される。QDL が起動中でも、操作していなければ編集してよい）
- ファイルは丸ごと有効な JSON として書く（途中状態で保存しない）。文字コードは UTF-8（BOM なし）
- `"$schema"` キーはそのまま残す。エディタがこれを見て補完・検証する（無ければ QDL が補う）

## ファイル

| ファイル                 | 役割                                                    | スキーマ                                |
| ------------------------ | ------------------------------------------------------- | --------------------------------------- |
| `datafiles/data.json`    | ランチャーのアイテム（必須）                            | `schemas/data.schema.json`              |
| `datafiles/data2.json` … | 追加のデータファイル（タブ。ファイル名は `data*.json`） | 同上                                    |
| `settings.json`          | ホットキー・ウィンドウ・バックアップ・タブ設定          | `schemas/settings.schema.json`          |
| `workspace.json`         | ワークスペース画面のタブ・グループ・アイテム            | `schemas/workspace.schema.json`         |
| `workspace-archive.json` | アーカイブしたグループとアイテム（通常は触らない）      | `schemas/workspace-archive.schema.json` |

フィールドの意味・必須/任意・取れる値はスキーマの `description` に書いてある。迷ったらスキーマを読む。

## アイテムの書き方（最小の完全例）

データファイルは `{ "$schema", "version", "items": [...] }`。`items` の各要素は `type` で種類が決まる。

```json
{
  "$schema": "../schemas/data.schema.json",
  "version": "1.0",
  "items": [
    {
      "id": "Ab3dEf9h",
      "type": "item",
      "displayName": "GitHub",
      "path": "https://github.com/",
      "memo": "path には URL・ファイル・フォルダ・実行ファイル・shell:Desktop 等のコマンドを書ける"
    },
    {
      "id": "Kq7mNp2r",
      "type": "item",
      "displayName": "メモ帳で TODO を開く",
      "path": "notepad.exe",
      "args": "C:\\Users\\me\\todo.txt"
    },
    {
      "id": "Zx8cVb4n",
      "type": "dir",
      "path": "C:\\Tools",
      "options": { "depth": 0, "types": "file", "filter": "*.exe" }
    },
    {
      "id": "Wd5sFg1j",
      "type": "group",
      "displayName": "朝の作業セット",
      "itemNames": ["GitHub", "メモ帳で TODO を開く"]
    },
    {
      "id": "Ty6uIo3p",
      "type": "window",
      "displayName": "ブラウザを左半分に",
      "windowTitle": "*Google Chrome",
      "x": 0,
      "y": 0,
      "width": 1280,
      "height": 1400
    }
  ]
}
```

- `id`: 8 文字の英数字（A-Z a-z 0-9）。新規アイテムには重複しない値を生成して書く。既存の `id` は変えない
  （省略すると QDL が採番して書き戻すが、スキーマ検証ではエラーになる）
- `type: "dir"` は指定フォルダの中身を展開して表示する。`displayName` は持たない
- `type: "group"` の `itemNames` には、起動したい `type: "item"` / `type: "window"` アイテムの `displayName` を書く
- `type: "window"` の `windowTitle` は `*`・`?` のワイルドカードが使える
- `type: "clipboard"` と `type: "layout"` は QDL が画面操作で生成する型。手で書かない
- スキーマに無いキーは書かない。未知のフィールドは QDL が次に書き戻すときに消える
- メイン画面は表示名順にソートされる。`items` の配列順は「アイテム管理」画面の一覧順にだけ影響する

## ワークスペース（workspace.json）

`{ "$schema", "version", "workspaces": [...], "groups": [...], "items": [...] }`。
アイテムの書き方はデータファイルと**同じ**（`type` と型ごとのフィールドが共通）。違いは所属と並び順を持つこと。

```json
{
  "$schema": "./schemas/workspace.schema.json",
  "version": "2.0",
  "workspaces": [{ "id": "Ws1Ab2Cd", "displayName": "メイン", "order": 0, "createdAt": 0 }],
  "groups": [
    {
      "id": "Gr1Ab2Cd",
      "displayName": "開発",
      "color": "primary",
      "order": 0,
      "createdAt": 0,
      "workspaceId": "Ws1Ab2Cd"
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
      "addedAt": 0
    }
  ]
}
```

- `workspaces` は 1 件以上必要。`groups[].workspaceId`・`items[].workspaceId` は存在するワークスペースの `id`
- `items[].groupId` は省略可（未分類）。`groups[].parentGroupId` で 2 段までネストできる
- `order`（同じ親の中での並び）・`createdAt`・`addedAt` は省略すると QDL が補う
- `color` は `primary / success / danger / warning / info / secondary / purple / teal / pink / indigo / orange / cyan` または `#rrggbb`
- id はデータファイルと別の名前空間。ワークスペース内（archive 含む）で重複しなければよい
- 折りたたみや切り離しウィンドウの位置は `workspace-ui-state.json`（QDL 管理）にあり、ここには無い

## settings.json

- キーは省略できる（QDL がデフォルト値で補う）。存在するキーの型だけ守る
- `hotkey` は `Alt+Space`・`Ctrl+Alt+Q` のように修飾キー + キーで書く
- `dataFileTabs`・`dataFileLabels` のファイル名は `datafiles/data2.json` のように `datafiles/` 付きで書く
- `createdWithVersion`・`updatedWithVersion`・`$schema` は QDL が管理する。触らない

## 反映

- QDL はファイルを監視しない。編集後はメイン画面で **F5**、または QDL を再起動する
  （`workspace.json` も F5 で読み直され、ワークスペース画面に反映される）
- `settings.json` の変更も F5 で再適用される（ホットキー・自動起動・ワークスペースの位置/透過など）。
  ウィンドウサイズ・タブ構成などは QDL の再起動が必要

## 結果の確認

- 読み込みのたびに `last-load-report.json` が書き直される。編集後は必ず読む
- `files[]` にはデータファイルと `workspace.json`・`workspace-archive.json` が並ぶ。
  `summary.skipped` が 0 で、`files[].issues` に `kind: "invalid"` が無ければ全部受理された
- ワークスペースの `issues[]` には `section`（`workspaces` / `groups` / `items`）が付き、`index` はその配列内の位置
- `issues[].kind` の意味:
  - `invalid`: そのアイテムはスキップ（ファイル上には残る）。`reason` に理由、`id` に対象。直して F5
  - `idAssigned`: `id` が無い・不正・重複だったので QDL が採番した。`id` が新しい値
  - `normalized`: `$schema`・`version` の補完、存在しない `groupId` の除去などの補正。対応不要
    （ワークスペースの不正な要素は読み込みから外され、書き戻し時に配列の末尾へ移る）
- `summary.corruptedFiles` にファイルがあれば JSON として壊れている。そのファイルは読み込まれず、
  直すまで QDL からの保存も拒否される

## 壊したとき

- 設定の `backupEnabled` が有効なら、QDL 起動中に外で変更されたファイルを F5 で読んだとき、変更前の内容が
  `backup/<日時>_pre-external/` に残る（変更されたファイルだけ）。
  QDL を終了した状態で編集した場合はこのスナップショットは作られない（下の日次スナップショットだけ）
- 該当ファイルを元の場所に戻して F5。QDL の「基本設定」タブ →「バックアップ」の
  スナップショット一覧からも復元できる
- 日次のスナップショットは `backup/<日時>/` にある（`backupEnabled` が有効なとき、起動時に 1 日 1 回）
