# ファイル形式一覧

QuickDashLauncherで使用される主要なファイル形式の概要とドキュメントへのリンクです。

## 概要

QuickDashLauncherは主に以下の 3 種類のファイルを使用してアプリケーションの状態を管理します（置き場所は [設定フォルダの場所](#設定フォルダの場所)）：

| ファイル種別 | 主な用途 | 対象ファイル |
| --- | --- | --- |
| **[設定ファイル](settings-format.md)** | アプリケーション設定 | `settings.json` |
| **[データファイル](data-format.md)** | ランチャーアイテムの定義 | `datafiles/data.json`, `datafiles/data2.json`, ... |
| **[ワークスペースファイル](workspace-format.md)** | ワークスペース機能のデータ | `workspace.json`, `workspace-archive.json`（UI 状態は `workspace-ui-state.json`） |

JSON ファイルはすべて **UTF-8（BOMなし）** で保存されます。

---

## 設定ファイル

**→ [設定ファイル形式](settings-format.md)**

- **ファイル**: `settings.json`
- **パス**: 設定フォルダ直下の `settings.json`（[設定フォルダの場所](#設定フォルダの場所)）
- **内容**: ホットキー、ウィンドウサイズ、バックアップ設定、タブ設定、ワークスペース設定など

---

## データファイル

**→ [データファイル形式](data-format.md)**

- **フォルダ**: `config/datafiles/`
- **ファイル**: `datafiles/data.json` (必須), `datafiles/data2.json`, `datafiles/data3.json`, ... (オプション)
- **内容**: ランチャーに表示するアイテムの定義
- **アイテムタイプ**: `item` (通常), `dir` (フォルダ取込), `set` (セット), `clipboard` (クリップボード)。旧形式の `group`（旧グループ）・`layout`（旧ウィンドウ配置）は読み込み時に `set` に、廃止した `window`（ウィンドウ操作）はパスの無い `item` に変換される

---

## ワークスペースファイル

**→ [ワークスペースファイル形式](workspace-format.md)**

- **workspace.json**（version 2.0）: ワークスペース（タブ）・グループ・アイテム。アイテムはデータファイルと同じ語彙（`type: item / clipboard / set`）
- **workspace-archive.json**（version 2.0）: アーカイブされたグループとアイテム
- **workspace-ui-state.json**: グループの折りたたみ・切り離しウィンドウの位置（QDL 管理）

ワークスペースアイテムはメイン画面のアイテムをコピーし、独立して管理されます。旧形式（version なし）は起動時に 1 回だけ 2.0 に変換され、変換前は `backup/*_pre-migration/` に残ります。旧グループ・旧ウィンドウ配置は読み込み時にセットに変換され、変換前は `backup/*_pre-set-migration/` に残ります。単一アイテムの旧形式 `windowConfig` も読み込み時に新しいキーに変換され、変換前は `backup/*_pre-window-migration/`（セットへの変換と一緒なら `_pre-set-migration`）に残ります。

---

## その他のファイル

### 検索履歴

- **ファイル**: `search-history.json`
- **形式**: `{ "version": "1.0", "entries": [{ "query": "...", "timestamp": "..." }, ...] }`
- **内容**: 検索クエリ履歴（最大100件）

### 起動の記録

- **ファイル**: `item-usage.json`
- **形式**: `{ "version": 1, "since": <記録を始めた日時>, "byId": { "<id>": { "lastLaunchedAt": <日時>, "count": <回数> } }, "byPath": { "<パス>\u0000<引数>": { ... } } }`（日時は Unix ミリ秒）
- **内容**: アイテムを開いた記録（QDL 管理）。メイン画面・セットから開いたものは `byId`（データファイルの id）、ワークスペース・フォルダ取込の展開から開いたものは `byPath`（パスは小文字にし、パスと引数を前後の空白を除いてつなぐ）。アイテム管理は両方を足して最終起動・起動回数に出す。設定の `recordLaunchUsage` が `false` の間は書かない

### 拡張子の無いファイルのメモ

- **ファイル**: `path-type-cache.json`
- **形式**: `{ "version": 1, "extensionlessFiles": ["C:\\Windows\\System32\\drivers\\etc\\hosts", ...] }`
- **内容**: 拡張子が無いのにファイルだったパスの一覧（QDL 管理）。読み込みのたびにディスクを読まずに、拡張子の無いファイルをフォルダと取り違えないためのもの。書き換えるタイミングは [データファイル形式 3.1.2](data-format.md#312-サポートされるパス種類)

### アイコンキャッシュ

- **フォルダ**: `config/icon-cache/`（apps, favicons, custom, extensions）
- **ファイル**: `config/icon-cache/icon-fetch-errors.json`
- **内容**: アイコン取得エラー記録（`{ "errors": [{ "key": "...", "type": "...", "errorMessage": "...", "errorAt": ..., "failCount": ... }] }`）

### クリップボードデータ

- **フォルダ**: `config/clipboard-data/`
- **ファイル**: `config/clipboard-data/{id}.json`
- **内容**: クリップボードアイテムのデータ本体（保存のたびに採番した ID ごとに 1 ファイル。アイテムの `dataFileRef` から参照する。メインウィンドウとワークスペースの間で写すときは複製し、1 つのファイルを複数のアイテムで共有しない）

### バックアップ

- **フォルダ**: `config/backup/`
- **形式**: スナップショット方式。タイムスタンプ名のサブフォルダ（`YYYY-MM-DDTHH-MM-SS/`。時刻は UTC）に対象ファイルをまとめて保存
- **バックアップ対象**: `datafiles/data*.json`、`settings.json`、`workspace.json`、`workspace-archive.json`、`workspace-ui-state.json`、（旧形式の `workspace-detached.json` が残っていれば）それも、（設定により）`clipboard-data/*.json`
- **変更検知トリガー**: `datafiles/data*.json`・`settings.json`・`workspace.json`・`workspace-archive.json`の変更で判定
- **作成タイミング**: 起動時に1日1回（ローカル時刻の日付で判定）、変更がある場合のみ（`backupEnabled` が無効なら作らない）
- **保持件数**: 設定可能（`backupRetention`、既定値は設定ファイルを参照）。超えた古いものから消す。`_pre-external` と、`_pre-set-migration`・`_pre-window-migration` それぞれの新しい 2 つは数えない（消さない）
- **復元前の自動バックアップ**: 復元の実行時に `YYYY-MM-DDTHH-MM-SS_pre-restore/` フォルダを自動作成（`backupEnabled` に関係なく作る）
- **外部変更前スナップショット**: データファイル・ワークスペースファイルが QDL 外で変更されたことを読み込み時に検知すると、変更前の内容を `YYYY-MM-DDTHH-MM-SS_pre-external/` に保存（`backupEnabled` が無効なら作らない。変更されたファイルのみ。`backupRetention` とは別枠で最新 10 件を保持。QDL 起動中の編集のみ検知し、終了中の編集は対象外）
- **移行前スナップショット**: ワークスペースファイルを旧形式から 2.0 に変換する前に `YYYY-MM-DDTHH-MM-SS_pre-migration/` を作成（`backupEnabled` に関係なく作る）
- **セット変換前スナップショット**: データファイル・ワークスペースファイルの旧グループ・旧ウィンドウ配置をセットに変換する前に `YYYY-MM-DDTHH-MM-SS_pre-set-migration/` を作成（`backupEnabled` に関係なく作る。作れなければ変換しない）。新しい 2 つ（データファイル用とワークスペース用）は前の版に戻すときの拠り所なので `backupRetention` で数えずに残し、3 つ目より古いものは通常のスナップショットと一緒に数える（`src/main/services/backupService.ts` の `cleanupOldSnapshots`）
- **ウィンドウ切り替え変換前スナップショット**: データファイル・ワークスペースファイルの単一アイテムの旧形式 `windowConfig` を新しいキーに変換する前に `YYYY-MM-DDTHH-MM-SS_pre-window-migration/` を作成（セットへの変換も要るときは `_pre-set-migration` の 1 回で済ませ、これは作らない。`backupEnabled` に関係なく作る。作れなければ変換しない）。新しい 2 つは `backupRetention` で数えずに残す
- **同じ秒に作ったとき**: サフィックス付き（`_pre-restore`・`_pre-external`・`_pre-migration`・`_pre-set-migration`・`_pre-window-migration`）のフォルダは、同じ名前がすでにあれば `YYYY-MM-DDTHH-MM-SS-2_pre-external/` のように連番を付けて別に作る（上書きしない）。一覧では連番の大きい方を新しいものとして並べる

### ログ

- **フォルダ**: `config/logs/`
- **ファイル**: `main.log`（今書いているもの）・`main.1.log`・`main.2.log`（古いもの）
- **中身**: メインプロセスのログ（pino の JSON 1 行 1 件、info 以上。開発時は debug 以上）と、`console.warn`・`console.error` の出力（`"context":"console"`）、捕まえられなかった例外。起動直後（準備完了の前）から書く。二重起動で終わる側は書かない
- **大きさ**: 書く前に大きさを数え、1MB を超えそうなら `main.log` → `main.1.log` → `main.2.log` と回し、一番古いものを消す。動いている間も回すので、合計はおよそ 3MB まで（1 行が 1MB より大きいときだけ、その 1 行分超える）（`src/main/services/rotatingLogFile.ts`）
- **書けないとき**: 回すのに失敗したら（ほかのアプリがファイルを掴んでいるなど）今のファイルに書き続けて 30 秒後にもう一度回す。書くのに失敗したら（ディスクがいっぱい・権限が無いなど）その行は捨てて 30 秒後に開き直す。QDL は止まらない

### 読み込みレポート

ファイルには書き出さない。直近の読み込み結果（受理数・スキップしたアイテムと理由・採番した ID・外部変更の有無）をメモリに持ち、CLI の `qdl reload`・`qdl check` が返す。形式は [データファイル形式 5.3](data-format.md#53-qdl-の外での変更への備え)。

---

## QDL の外での変更

設定フォルダのファイルを手で編集する使い方はサポートしない。AI にアイテムやワークスペースを変えさせたいときは CLI（`qdl`）を使い、CLI に無い操作（基本設定）は画面から行う。

それでもファイルが QDL の外で変わることはある（古い版の QDL・同期ツール・手で直した場合）。そのときの備えとして、寛容な読み込み・採番・変更前スナップショット・破損時に上書きしない・保存時の楽観ロックが働く（[データファイル形式 5.3](data-format.md#53-qdl-の外での変更への備え)、[ワークスペースファイル形式](workspace-format.md)）。

v0.8.0-beta.5 までの QDL は、直接編集する人・AI 向けに `config/README.md`・`config/schemas/*.schema.json`・`config/last-load-report.json` を書き出し、各ファイルに `$schema` を補っていた。今の版はこれらを作らず、残っていても消さない（使わない）。ファイル内の `$schema` は読み飛ばす。

---

## 設定フォルダの場所

このページの `config/` は設定フォルダを指す。設定フォルダは次の順で決まる（[src/main/config/pathManager.ts](../../../src/main/config/pathManager.ts)、[src/main/main.ts](../../../src/main/main.ts) の起動直後）。

1. 環境変数 `QUICK_DASH_CONFIG_DIR` があれば、そのフォルダ。Windows のシステムフォルダ（`C:\Windows`・`C:\Program Files` など）を指したときは無視して既定に戻す
2. なければ、userData フォルダの下の `config\`。userData は既定で `%APPDATA%\quick-dash-launcher\`（`package.json` の `name`。Store 版で新しく作る場合はパッケージ専用の場所に振り替えられる。[ビルドとデプロイ - Store 版（MSIX）](../../setup/build-deploy.md#store-版msix)）なので、設定フォルダは `%APPDATA%\quick-dash-launcher\config\`
3. 多重起動用の環境変数 `APP_INSTANCE` があると、userData が `%APPDATA%\<APP_INSTANCE>-quick-dash-launcher\` に変わり、設定フォルダもその下の `config\` になる（`npm run dev` は `APP_INSTANCE=dev` なので `%APPDATA%\dev-quick-dash-launcher\config\`）

データファイル・ワークスペースファイル・バックアップなど、このページに出てくるファイルとフォルダはすべて設定フォルダの下に置かれる。パスの組み立ては `PathManager` にまとまっている。

---

## 関連ドキュメント

- **[システム概要](../overview.md)** - アプリケーション全体のアーキテクチャ
- **[用語集](../glossary.md)** - プロジェクト全体の用語定義
