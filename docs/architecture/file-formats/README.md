# ファイル形式一覧

QuickDashLauncherで使用される主要なファイル形式の概要とドキュメントへのリンクです。

## 概要

QuickDashLauncherは以下の3種類のファイルを使用してアプリケーションの状態を管理します：

| ファイル種別 | 主な用途 | 対象ファイル |
|------------|---------|------------|
| **[設定ファイル](settings-format.md)** | アプリケーション設定 | `config.json` |
| **[データファイル](data-format.md)** | ランチャーアイテムの定義 | `data.json`, `data2.json`, ... |
| **[ワークスペースファイル](workspace-format.md)** | ワークスペース機能のデータ | `workspace.json`, `execution-history.json`, `workspace-archive.json` |

すべてのファイルは **UTF-8（BOMなし）** のJSON形式で保存されます。

---

## 設定ファイル

**→ [設定ファイル形式](settings-format.md)**

- **ファイル**: `config.json`
- **管理**: electron-store
- **内容**: ホットキー、ウィンドウサイズ、バックアップ設定、タブ設定、ワークスペース設定など

---

## データファイル

**→ [データファイル形式](data-format.md)**

- **ファイル**: `data.json` (必須), `data2.json`, `data3.json`, ... (オプション)
- **内容**: ランチャーに表示するアイテムの定義
- **アイテムタイプ**: `item` (通常), `dir` (フォルダ取込), `group` (グループ), `window` (ウィンドウ操作)

---

## ワークスペースファイル

**→ [ワークスペースファイル形式](workspace-format.md)**

- **workspace.json**: ワークスペースアイテムとグループ
- **execution-history.json**: アイテム実行履歴（最大10件）
- **workspace-archive.json**: アーカイブされたグループとアイテム

ワークスペースアイテムはメイン画面のアイテムを完全にコピーし、独立して管理されます。

---

## その他のファイル

### 検索履歴
- **ファイル**: `search-history.json`
- **形式**: `{ "version": "1.0", "entries": [{ "query": "...", "timestamp": "..." }, ...] }`
- **内容**: 検索クエリ履歴（最大100件）

### アイコンキャッシュ
- **フォルダ**: `icon-cache/`（apps, favicons, custom, schemes, extensions）

### バックアップ
- **フォルダ**: `backup/`
- **形式**: `data_YYYYMMDD_HHMMSS.json`（最大20件、設定可能）

---

## パス管理

すべてのファイルパスは `PathManager` クラスで一元管理されています。

```typescript
import { PathManager } from '@main/config/pathManager';

PathManager.getDataFilePath();      // data.json
PathManager.getWorkspaceFilePath(); // workspace.json
PathManager.getConfigFolder();      // 設定フォルダ
PathManager.getBackupFolder();      // バックアップフォルダ
```

詳細: **[PathManager](../../src/main/config/pathManager.ts)**

---

## 関連ドキュメント

- **[システム概要](../overview.md)** - アプリケーション全体のアーキテクチャ
- **[用語集](../glossary.md)** - プロジェクト全体の用語定義
