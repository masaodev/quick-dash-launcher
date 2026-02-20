# ファイル形式一覧

QuickDashLauncherで使用される主要なファイル形式の概要とドキュメントへのリンクです。

## 概要

QuickDashLauncherは以下の3種類のファイルを使用してアプリケーションの状態を管理します：

| ファイル種別 | 主な用途 | 対象ファイル |
|------------|---------|------------|
| **[設定ファイル](settings-format.md)** | アプリケーション設定 | `settings.json` |
| **[データファイル](data-format.md)** | ランチャーアイテムの定義 | `datafiles/data.json`, `datafiles/data2.json`, ... |
| **[ワークスペースファイル](workspace-format.md)** | ワークスペース機能のデータ | `workspace.json`, `workspace-archive.json` |

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
- **アイテムタイプ**: `item` (通常), `dir` (フォルダ取込), `group` (グループ), `window` (ウィンドウ操作), `clipboard` (クリップボード)

---

## ワークスペースファイル

**→ [ワークスペースファイル形式](workspace-format.md)**

- **workspace.json**: ワークスペースアイテムとグループ
- **workspace-archive.json**: アーカイブされたグループとアイテム

ワークスペースアイテムはメイン画面のアイテムを完全にコピーし、独立して管理されます。

---

## その他のファイル

### 検索履歴
- **ファイル**: `search-history.json`
- **形式**: `{ "version": "1.0", "entries": [{ "query": "...", "timestamp": "..." }, ...] }`
- **内容**: 検索クエリ履歴（最大100件）

### アイコンキャッシュ
- **フォルダ**: `config/icon-cache/`（apps, favicons, custom, schemes, extensions）
- **ファイル**: `config/icon-cache/icon-fetch-errors.json`
- **内容**: アイコン取得エラー記録（`{ "errors": [{ "key": "...", "type": "...", "errorMessage": "...", "errorAt": ..., "failCount": ... }] }`）

### クリップボードデータ
- **フォルダ**: `config/clipboard-data/`
- **ファイル**: `config/clipboard-data/{id}.json`
- **内容**: クリップボードアイテムのデータ本体（アイテムIDごとに1ファイル）

### バックアップ
- **フォルダ**: `config/backup/`
- **形式**: スナップショット方式。タイムスタンプ名のサブフォルダ（`YYYY-MM-DDTHH-MM-SS/`）に対象ファイルをまとめて保存
- **バックアップ対象**: `datafiles/data*.json`、`settings.json`、`workspace.json`、`workspace-archive.json`、（設定により）`clipboard-data/*.json`
- **変更検知トリガー**: `datafiles/data*.json` と `settings.json` の変更のみで判定
- **作成タイミング**: 起動時に1日1回、変更がある場合のみ
- **保持件数**: 設定可能（`backupRetention`、デフォルト値は設定ファイルを参照）
- **リストア前自動バックアップ**: リストア実行時に `YYYY-MM-DDTHH-MM-SS_pre-restore/` フォルダを自動作成

---

## パス管理

すべてのファイルパスは `PathManager` クラスで一元管理されています。

```typescript
import { PathManager } from '@main/config/pathManager';

PathManager.getConfigFolder();         // %APPDATA%/quick-dash-launcher/config/
PathManager.getDataFilesFolder();      // config/datafiles/
PathManager.getDataFilePath();         // config/datafiles/data.json
PathManager.getWorkspaceFilePath();    // config/workspace.json
PathManager.getBackupFolder();         // config/backup/
PathManager.getClipboardDataFolder();  // config/clipboard-data/
PathManager.getIconCacheFolder();      // config/icon-cache/
```

詳細: **[src/main/config/pathManager.ts](../../../src/main/config/pathManager.ts)**

---

## 関連ドキュメント

- **[システム概要](../overview.md)** - アプリケーション全体のアーキテクチャ
- **[用語集](../glossary.md)** - プロジェクト全体の用語定義
