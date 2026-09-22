# ファイル形式一覧

QuickDashLauncherで使用される主要なファイル形式の概要とドキュメントへのリンクです。

## 概要

QuickDashLauncherは以下の3種類のファイルを使用してアプリケーションの状態を管理します：

| ファイル種別                                      | 主な用途                   | 対象ファイル                                                                      |
| ------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| **[設定ファイル](settings-format.md)**            | アプリケーション設定       | `settings.json`                                                                   |
| **[データファイル](data-format.md)**              | ランチャーアイテムの定義   | `datafiles/data.json`, `datafiles/data2.json`, ...                                |
| **[ワークスペースファイル](workspace-format.md)** | ワークスペース機能のデータ | `workspace.json`, `workspace-archive.json`（UI 状態は `workspace-ui-state.json`） |

すべてのファイルは **UTF-8（BOMなし）** のJSON形式で保存されます。

---

## 設定ファイル

**→ [設定ファイル形式](settings-format.md)**

- **ファイル**: `settings.json`
- **パス**: `%APPDATA%/quick-dash-launcher/config/settings.json`
- **内容**: ホットキー、ウィンドウサイズ、バックアップ設定、タブ設定、ワークスペース設定など

---

## データファイル

**→ [データファイル形式](data-format.md)**

- **フォルダ**: `config/datafiles/`
- **ファイル**: `datafiles/data.json` (必須), `datafiles/data2.json`, `datafiles/data3.json`, ... (オプション)
- **内容**: ランチャーに表示するアイテムの定義
- **アイテムタイプ**: `item` (通常), `dir` (フォルダ取込), `group` (グループ), `window` (ウィンドウ操作), `clipboard` (クリップボード), `layout` (レイアウト)

---

## ワークスペースファイル

**→ [ワークスペースファイル形式](workspace-format.md)**

- **workspace.json**（version 2.0）: ワークスペース（タブ）・グループ・アイテム。アイテムはデータファイルと同じ語彙（`type: item / window / group / clipboard / layout`）
- **workspace-archive.json**（version 2.0）: アーカイブされたグループとアイテム
- **workspace-ui-state.json**: グループの折りたたみ・切り離しウィンドウの位置（QDL 管理、AI 編集対象外）

ワークスペースアイテムはメイン画面のアイテムをコピーし、独立して管理されます。旧形式（version なし）は起動時に 1 回だけ 2.0 に変換され、変換前は `backup/*_pre-migration/` に残ります。

---

## その他のファイル

### 検索履歴

- **ファイル**: `search-history.json`
- **形式**: `{ "version": "1.0", "entries": [{ "query": "...", "timestamp": "..." }, ...] }`
- **内容**: 検索クエリ履歴（最大100件）

### アイコンキャッシュ

- **フォルダ**: `config/icon-cache/`（apps, favicons, custom, extensions）
- **ファイル**: `config/icon-cache/icon-fetch-errors.json`
- **内容**: アイコン取得エラー記録（`{ "errors": [{ "key": "...", "type": "...", "errorMessage": "...", "errorAt": ..., "failCount": ... }] }`）

### クリップボードデータ

- **フォルダ**: `config/clipboard-data/`
- **ファイル**: `config/clipboard-data/{id}.json`
- **内容**: クリップボードアイテムのデータ本体（アイテムIDごとに1ファイル）

### バックアップ

- **フォルダ**: `config/backup/`
- **形式**: スナップショット方式。タイムスタンプ名のサブフォルダ（`YYYY-MM-DDTHH-MM-SS/`）に対象ファイルをまとめて保存
- **バックアップ対象**: `datafiles/data*.json`、`settings.json`、`workspace.json`、`workspace-archive.json`、`workspace-ui-state.json`、（設定により）`clipboard-data/*.json`
- **変更検知トリガー**: `datafiles/data*.json`・`settings.json`・`workspace.json`・`workspace-archive.json`（人・AI が編集するファイル）の変更で判定
- **作成タイミング**: 起動時に1日1回、変更がある場合のみ
- **保持件数**: 設定可能（`backupRetention`、デフォルト値は設定ファイルを参照）
- **リストア前自動バックアップ**: リストア実行時に `YYYY-MM-DDTHH-MM-SS_pre-restore/` フォルダを自動作成
- **外部変更前スナップショット**: データファイル・ワークスペースファイルが QDL 外で変更されたことを読み込み時に検知すると、変更前の内容を `YYYY-MM-DDTHH-MM-SS_pre-external/` に保存（変更されたファイルのみ。`backupRetention` とは別枠で最新 10 件を保持。QDL 起動中の編集のみ検知し、終了中の編集は対象外）
- **移行前スナップショット**: ワークスペースファイルを旧形式から 2.0 に変換する前に `YYYY-MM-DDTHH-MM-SS_pre-migration/` を作成（`backupEnabled` に関係なく作る）

### 読み込みレポート

- **ファイル**: `last-load-report.json`
- **内容**: 直近の読み込み結果（受理数・スキップしたアイテムと理由・採番した ID・外部変更の有無）。`files[]` にはデータファイルと `workspace.json`・`workspace-archive.json` が並ぶ。ファイルを直接編集した人や AI が結果を確認するためのもの。詳細は [データファイル形式 5.3](data-format.md#53-外部編集人ai-による直接編集への対応)

---

## AI・手動編集

設定フォルダのファイル（`datafiles/data*.json`・`settings.json`・`workspace.json`・`workspace-archive.json`）はテキストエディタや AI エージェントで直接編集できる。そのための補助ファイルを **起動時に毎回** 配置する（`installConfigFolderDocs`、`src/main/services/configFolderDocsService.ts`）。

| ファイル                                       | 内容                                                                                                                                                                                                                   | 元                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `config/README.md`                             | 直接編集する人・AI 向けの作業指示（触っていいファイル、アイテムの最小例、反映方法 F5、`last-load-report.json` の読み方、壊したときの戻し方）。`{{CONFIG_DIR}}`・`{{APP_VERSION}}` を埋めて生成。内容が同じなら書かない | `assets/config-readme.md`                      |
| `config/schemas/data.schema.json`              | データファイルの JSON Schema。アイテムは `type` で判別する `oneOf`、`additionalProperties: false`                                                                                                                      | `assets/schemas/data.schema.json`              |
| `config/schemas/settings.schema.json`          | 設定ファイルの JSON Schema。`required` なし・`additionalProperties: true`                                                                                                                                              | `assets/schemas/settings.schema.json`          |
| `config/schemas/workspace.schema.json`         | ワークスペースファイルの JSON Schema。アイテムはデータファイルと同じ語彙の `oneOf`                                                                                                                                     | `assets/schemas/workspace.schema.json`         |
| `config/schemas/workspace-archive.schema.json` | アーカイブファイルの JSON Schema                                                                                                                                                                                       | `assets/schemas/workspace-archive.schema.json` |

**`$schema` の注入**: データファイルは `"$schema": "../schemas/data.schema.json"`、`settings.json` は `"$schema": "./schemas/settings.schema.json"`、ワークスペースは `"./schemas/workspace.schema.json"` / `"./schemas/workspace-archive.schema.json"` を QDL が補う（相対パス。URL にすると main の最新とアプリの版がずれるため）。既存利用者のファイルはアップグレード後の初回読み込みで 1 回書き戻される（`writeDataFile` 経由なので外部変更にはならず、`_pre-external` スナップショットも作られない）。

**スキーマの生成と検証**:

```bash
npm run schema:generate   # src/common/types/{json-data,settings,json-workspace}.ts → assets/schemas/*.schema.json
```

- 生成は `ts-json-schema-generator`（`scripts/generate-schemas.ts`）。`title` は固定、`description` は TS の JSDoc、`$id` は main の生ファイル URL（安定。アプリの版は入れない。版は隣の `config/README.md` 冒頭に書かれる）
- `tests/unit/schemas.test.ts` が「生成結果 = コミット済みファイル」を検証する（型を変えて再生成を忘れると落ちる）。同じテストで `tests/e2e/templates/**`・`tests/dev/**`・`dev-config/` の JSON をスキーマ検証し、寛容パースの判定と一致することも確認する
- **アプリ実行時にはスキーマ検証しない**。検証は寛容パース（`parseJsonDataFileLenient` / `parseWorkspaceFileLenient`）の一本。ワークスペースのアイテム本体はデータファイルの検証関数を共用する

導線: 管理画面「ヘルプ」タブの「設定フォルダを開く」の近くに、AI に `README.md` を読ませる案内がある。

---

## パス管理

すべてのファイルパスは `PathManager` クラスで一元管理されています。

```typescript
import { PathManager } from '@main/config/pathManager';

PathManager.getConfigFolder(); // %APPDATA%/quick-dash-launcher/config/
PathManager.getDataFilesFolder(); // config/datafiles/
PathManager.getDataFilePath(); // config/datafiles/data.json
PathManager.getWorkspaceFilePath(); // config/workspace.json
PathManager.getWorkspaceArchiveFilePath(); // config/workspace-archive.json
PathManager.getWorkspaceUiStateFilePath(); // config/workspace-ui-state.json
PathManager.getBackupFolder(); // config/backup/
PathManager.getClipboardDataFolder(); // config/clipboard-data/
PathManager.getIconCacheFolder(); // config/icon-cache/
PathManager.getSchemasFolder(); // config/schemas/
PathManager.getConfigReadmePath(); // config/README.md
PathManager.getAssetsFolder(); // アプリ同梱の assets/（パッケージ後は app.asar 内）
```

詳細: **[src/main/config/pathManager.ts](../../../src/main/config/pathManager.ts)**

---

## 関連ドキュメント

- **[システム概要](../overview.md)** - アプリケーション全体のアーキテクチャ
- **[用語集](../glossary.md)** - プロジェクト全体の用語定義
