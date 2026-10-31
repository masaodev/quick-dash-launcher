# ファイル形式一覧

QuickDashLauncherで使用される主要なファイル形式の概要とドキュメントへのリンクです。

## 概要

QuickDashLauncherは主に以下の 3 種類のファイルを使用してアプリケーションの状態を管理します（置き場所は [設定フォルダの場所](#設定フォルダの場所)）：

| ファイル種別 | 主な用途 | 対象ファイル |
| --- | --- | --- |
| **[設定ファイル](settings-format.md)** | アプリケーション設定 | `settings.json` |
| **[データファイル](data-format.md)** | ランチャーアイテムの定義 | `datafiles/data.json`, `datafiles/data2.json`, ... |
| **[ワークスペースファイル](workspace-format.md)** | ワークスペース機能のデータ | `workspace.json`, `workspace-archive.json`（UI 状態は `workspace-ui-state.json`） |

JSON ファイルはすべて **UTF-8（BOMなし）** で保存されます。手で直して BOM 付きで保存したファイルも読めます（読むときに先頭の BOM を外す）。

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

- **workspace.json**（version 2.0）: ワークスペース（タブ）・グループ・アイテム。アイテムはデータファイルと同じ語彙（`type: item / clipboard / set`）と、メインウィンドウのアイテムを id で指す参照アイテム（`type: ref`）
- **workspace-archive.json**（version 2.0）: アーカイブされたグループとアイテム
- **workspace-ui-state.json**: グループの折りたたみ・切り離しウィンドウの位置（QDL 管理）

ワークスペースアイテムはメイン画面のアイテムをコピーし、独立して管理されます。旧形式（version なし）は起動時に 1 回だけ 2.0 に変換され、変換前は `backup/*_pre-migration/` に残ります。旧グループ・旧ウィンドウ配置は読み込み時にセットに変換され、変換前は `backup/*_pre-set-migration/` に残ります。単一アイテムの旧形式 `windowConfig` も読み込み時に新しいキーに変換され、変換前は `backup/*_pre-window-migration/`（セットへの変換と一緒なら `_pre-set-migration`）に残ります。

---

## その他のファイル

### 検索履歴

- **ファイル**: `search-history.json`
- **形式**: `{ "version": "1.0", "entries": [{ "query": "...", "timestamp": "..." }, ...] }`
- **内容**: 検索クエリ履歴（最大100件）。新しい版の QDL が書いたファイルは上書きしない（[形式の版と互換](#形式の版と互換)）

### 起動の記録

- **ファイル**: `item-usage.json`
- **形式**: `{ "version": 1, "since": <記録を始めた日時>, "byId": { "<id>": { "lastLaunchedAt": <日時>, "count": <回数> } }, "byPath": { "<パス>": { ... } }, "pausedAt": <記録を切った日時。切っている間だけ> }`（日時は Unix ミリ秒）
- **内容**: アイテムを開いた記録（QDL 管理）。メイン画面・セットから開いたものは `byId`（データファイルの id）、ワークスペースの参照アイテムから開いたものは指すメインウィンドウのアイテムの `byId`、ワークスペースのそれ以外のアイテムから開いたものは `byPath`（パスは前後の空白と末尾の区切り文字を除いて小文字にする。引数は含めない）。フォルダ取込で展開したアイテムは、フォルダ取込の行の id で `byId` に数える。登録・編集画面の「試しに実行」は数えない。初めて読んだときに `since` を書いておく。中身が壊れて読めないファイルは `item-usage.json.broken-<日時>` に移してから記録を始め直す（移せないときと、ロックなどで読めないときは、上書きしないよう次に読めるまで記録しない）。アイテム管理は、単一アイテム・セット・クリップボードの行には `byId` と同じパスの `byPath` を足したもの、フォルダ取込の行には `byId` を最終起動・起動回数に出す。設定の `recordLaunchUsage` が `false` の間は記録しない（切った日時を `pausedAt` に残し、入れ直したら `since` をその日に進める）。新しい版の QDL が書いたファイルは読んで使うが、上書きしない（[形式の版と互換](#形式の版と互換)）

### 更新の知らせ

- **ファイル**: `update-check.json`
- **形式**: `{ "version": 1, "lastCheckedAt": <最後に確かめた日時>, "latest": { "version": "0.8.1", "url": "https://github.com/masaodev/quick-dash-launcher/releases/tag/v0.8.1" }, "notifiedVersion": "0.8.1" }`（日時は Unix ミリ秒。`latest` は今の版より新しい版が無ければ `null`）
- **内容**: 新しい版の確認の状態（QDL 管理。`src/main/services/updateCheckService.ts`）。GitHub の releases API（`https://api.github.com/repos/masaodev/quick-dash-launcher/releases`。ログインなし）を起動の 1 分後と、前回から 24 時間たったら（1 時間ごとに見る）読み、今の版より新しい版を `latest` に残す。下書きは除き、ベータ版は設定の `updateCheckIncludeBeta` か、今の版がベータ版のときだけ含める。初めて見つけた版はトーストで 1 回知らせ（`notifiedVersion`）、新しい版がある間はトレイのメニューの先頭と、管理ウィンドウのヘルプタブに出す。リリースのページを開くだけで、入れ替えはしない。つながらない・GitHub が応えないときは何も出さず、ログに残して次の回に確かめ直す（失敗した回も `lastCheckedAt` を進める）。設定の `updateCheckEnabled` が `false` の間は読まず、知らせも出さない。Store 版（Store が更新する）と開発版では動かない（開発版で試すときは環境変数 `QDL_UPDATE_CHECK_IN_DEV=1`）。壊れたファイルは無視して初めからやり直す。新しい版の QDL が書いたファイルは上書きしない（[形式の版と互換](#形式の版と互換)）。バックアップの対象ではない

### 拡張子の無いファイルのメモ

- **ファイル**: `path-type-cache.json`
- **形式**: `{ "version": 1, "extensionlessFiles": ["C:\\Windows\\System32\\drivers\\etc\\hosts", ...] }`
- **内容**: 拡張子が無いのにファイルだったパスの一覧（QDL 管理）。読み込みのたびにディスクを読まずに、拡張子の無いファイルをフォルダと取り違えないためのもの。書き換えるタイミングは [データファイル形式 3.1.2](data-format.md#312-サポートされるパス種類)。新しい版の QDL が書いたメモは上書きしない（[形式の版と互換](#形式の版と互換)）

### アイコンキャッシュ

- **フォルダ**: `config/icon-cache/`（apps, favicons, custom, extensions）
- **ファイル**: `config/icon-cache/icon-fetch-errors.json`
- **内容**: アイコン取得エラー記録（`{ "errors": [{ "key": "...", "type": "...", "errorMessage": "...", "errorAt": ..., "failCount": ... }] }`）

### クリップボードデータ

- **フォルダ**: `config/clipboard-data/`
- **ファイル**: `config/clipboard-data/{id}.json`
- **内容**: クリップボードアイテムのデータ本体（保存のたびに採番した ID ごとに 1 ファイル。アイテムの `dataFileRef` から参照する。メインウィンドウとワークスペースの間でコピーとして写すときは複製し、1 つのファイルを複数のアイテムで共有しない。ワークスペースの参照アイテムはファイルを持たず、メインウィンドウのアイテムのファイルを使う）

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

## 形式の版と互換

同じ設定フォルダを、版の違う QDL が読むことがある（別の PC と同期フォルダで共有する、更新した版を前の版に戻す、など）。古い版の QDL が新しい版のファイルを壊さないよう、次の 2 つの備えがある。

### 新しい版のファイルは書き換えない

各ファイルは形式の版を持つ。自分（その QDL）が扱える版より新しい版のファイルは、新しい版の QDL が保存したものとみなし、読んで使うが書き換えない。版の比べ方は 1 つの関数にまとめてある（`src/common/utils/formatVersion.ts`。`"1.0"` と `1` と `"1"` は同じ版。足りない桁は 0 とみなす）。版が無い・版として読めないファイルは、今までどおり読み込みで補う。

| ファイル | 版の項目（今の版） | 新しい版のときの動き |
| --- | --- | --- |
| `datafiles/data*.json` | `version`（`"1.0"`） | 表示はするが書き込まない。採番・旧形式からの変換の書き戻しもしない。アイテムの追加・編集・削除・移動、編集画面の保存は「QDL を最新の版に更新してください」のエラーで止まる |
| `workspace.json`・`workspace-archive.json` | `version`（`"2.0"`） | 表示はするが、片方でも新しい版なら両方とも書き込まない（参照が両ファイルにまたがるため）。版を `"2.0"` に直すこともしない |
| `settings.json` | `settingsVersion`（`1`） | ファイルには一切書かない（既定値の書き足しもしない）。画面や CLI で変えた設定は QDL を終了するまでだけ効く |
| `item-usage.json`・`path-type-cache.json` | `version`（`1`） | 上書きしない（起動の記録は読んで使い、足した分は保存しない） |
| `search-history.json` | `version`（`"1.0"`） | 上書きしない（検索履歴は残らない） |
| `update-check.json` | `version`（`1`） | 上書きしない（最後に確かめた日時と知らせ済みの版は残らない） |

データファイル・ワークスペースファイルは、QDL の書き込みがすべて通る `writeDataFile`（`src/main/services/dataFileTracker.ts`）がディスク上のファイルの版を確かめ、新しければ書かない。読み込みで見つけたときは、読み込みレポートの `newerFormat`・`summary.newerFormatFiles`（[データファイル形式 5.3](data-format.md#53-qdl-の外での変更への備え)）に載せ、トーストで知らせる。`settings.json` が新しい版のときは起動時にトーストで知らせる。

### 知らない項目は残す

新しい版の QDL が足した項目（古い版から見て知らない項目）は、古い版の QDL が保存しても消さない。`writeDataFile` が書く直前に、ディスク上の今の内容から同じ id の要素が持っていた知らない項目を、書く内容に付け直す（`src/common/utils/unknownKeys.ts`）。

- 対象は、データファイル・ワークスペースファイルのファイル直下と、アイテム・グループ・ワークスペース（タブ）の直下の項目。`options`・`window`・`entries[]` のような入れ子の中は対象外
- 知っている項目は付け直さない（空にした値を戻さないため）。廃止した項目（旧形式からの変換で消す項目）も「知っている項目」に含める
- ほかのファイルへ移した要素（データファイル同士、`workspace.json` と `workspace-archive.json` の間）も、同じ id なら付け直す
- `settings.json` は electron-store がファイル全体を読んで書くので、知らない項目はもともと残る

### 形式を変えるときの決まり

- **項目を足すだけなら版を上げない**。古い版は知らない項目として残すので、版を上げると古い版で書けなくなるだけ損になる
- **版を上げるのは、古い版の QDL に書かせると困る変更のとき**（項目の意味や形を変える、入れ子の中に項目を足す、要素の並びや参照の規則を変える）。上げた版より古い QDL は、そのファイルを読むだけになる
- 型（`src/common/types/json-data.ts`・`json-workspace.ts`）に項目を足したら、`unknownKeys.ts` の知っている項目の一覧にも足す（足し忘れは型チェックで止まる）。項目をやめるときも一覧には残す

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
