# ファイル形式一覧

QuickDashLauncherで使用される主要なファイル形式の概要とドキュメントへのリンクです。

## 1. 概要

QuickDashLauncherは以下の3種類のファイルを使用してアプリケーションの状態を管理します：

| ファイル種別 | 主な用途 | 形式 | 保存場所 |
|------------|---------|------|---------|
| **データファイル** | ランチャーアイテムの定義 | JSON | `%APPDATA%/quick-dash-launcher/config/` |
| **ワークスペースファイル** | ワークスペース機能のデータ | JSON | `%APPDATA%/quick-dash-launcher/config/` |
| **設定ファイル** | アプリケーション設定 | JSON | `%APPDATA%/quick-dash-launcher/` |

---

## 2. データファイル

### 2.1. 概要

ランチャーに表示するアイテム（URL、アプリ、ファイル、フォルダ等）を定義するファイルです。

### 2.2. 対象ファイル

- `data.json` (必須)
- `data2.json`, `data3.json`, ... (オプション)

### 2.3. アイテムタイプ

| タイプ | 説明 |
|--------|------|
| **item** | 通常のランチャーアイテム（URL、ファイル、フォルダ等） |
| **dir** | フォルダ取込アイテム（フォルダ内容を動的にインポート） |
| **group** | グループアイテム（複数アイテムを一括起動） |
| **window** | ウィンドウ操作アイテム（既存ウィンドウを制御） |

### 2.4. 主要機能

- 8文字のランダムID（英数字、Math.random()で生成）
- 4種類のアイテムタイプをサポート
- タブごとの重複排除（displayName + path + args）
- カスタムアイコン対応
- ウィンドウ制御設定（WindowConfig）

### 2.5. 詳細ドキュメント

**→ [データファイル形式](data-format.md)**

---

## 3. ワークスペースファイル

### 3.1. 概要

ワークスペース機能で使用されるデータを保存するファイルです。メイン画面から独立してアイテムを管理します。

### 3.2. 対象ファイル

| ファイル名 | 用途 |
|-----------|------|
| **workspace.json** | ワークスペースアイテムとグループ |
| **execution-history.json** | アイテム実行履歴（最大10件） |
| **workspace-archive.json** | アーカイブされたグループとアイテム |

### 3.3. 主要機能

- UUID識別子によるアイテム管理
- グループによるアイテム整理（色分け、折りたたみ）
- ドラッグ&ドロップによる並び替え
- 実行履歴の自動記録
- グループのアーカイブ・復元

### 3.4. データの独立性

ワークスペースアイテムはメイン画面のアイテムを**完全にコピー**し、独立して管理されます。元のアイテムが変更・削除されてもワークスペース内のアイテムには影響しません。

### 3.5. 詳細ドキュメント

**→ [ワークスペースファイル形式](workspace-format.md)**

---

## 4. 設定ファイル

### 4.1. 概要

アプリケーション全体の設定を保存するファイルです。electron-storeライブラリで管理されます。

### 4.2. 対象ファイル

- `config.json`

### 4.3. 主要設定項目

| カテゴリ | 主な設定 |
|---------|---------|
| **ホットキー** | グローバルホットキー（デフォルト: Alt+Space） |
| **ウィンドウ** | サイズ、表示位置モード |
| **バックアップ** | 自動バックアップの設定 |
| **タブ** | データファイルタブの表示設定 |
| **ワークスペース** | 不透明度、表示位置 |
| **起動** | 自動起動設定 |

### 4.4. 設定の即座反映

v1.0.0以降、設定変更時に `settings-changed` イベントが全ウィンドウに送信され、即座に画面に反映されます。

### 4.5. 詳細ドキュメント

**→ [設定ファイル形式](settings-format.md)**

---

## 5. その他のファイル

### 5.1. 検索履歴

- **ファイル名**: `history.txt`
- **用途**: 検索クエリ履歴（最大100件）
- **形式**: テキストファイル（1行1エントリー）

### 5.2. アイコンキャッシュ

- **フォルダ**: `icon-cache/`
- **サブフォルダ**:
  - `apps/` - アプリケーションアイコン
  - `favicons/` - Webサイトファビコン
  - `custom/` - カスタムアイコン
  - `schemes/` - スキームアイコン (obsidian://, vscode://等)
  - `extensions/` - 拡張子アイコン

### 5.3. バックアップ

- **フォルダ**: `backup/`
- **形式**: `data_YYYYMMDD_HHMMSS.json`
- **自動削除**: 保存件数上限（デフォルト20件）を超えると古いものから削除

---

## 6. 文字エンコーディング

すべてのファイルは **UTF-8（BOMなし）** で保存されます。

---

## 7. ファイルパス管理

すべてのファイルパスは `PathManager` クラスで一元管理されています。

```typescript
import { PathManager } from '@main/config/pathManager';

// データファイル
const dataPath = PathManager.getDataFilePath(); // data.json
const allDataFiles = PathManager.getDataFiles(); // ['data.json', 'data2.json', ...]

// ワークスペースファイル
const workspacePath = PathManager.getWorkspaceFilePath(); // workspace.json

// フォルダ
const configFolder = PathManager.getConfigFolder();      // 設定フォルダ
const backupFolder = PathManager.getBackupFolder();      // バックアップフォルダ
const iconCacheFolder = PathManager.getIconCacheFolder(); // アイコンキャッシュ
```

詳細は **[PathManager (src/main/config/pathManager.ts)](../../src/main/config/pathManager.ts)** を参照してください。

---

## 8. バージョン管理

### 8.1. データファイル

- **version** フィールドでフォーマットバージョンを管理
- 現在のバージョン: `"1.0"`

### 8.2. 設定ファイル

- **createdWithVersion** - 初回作成時のアプリバージョン
- **updatedWithVersion** - 最終更新時のアプリバージョン

### 8.3. ワークスペースファイル

- バージョンフィールドなし（アプリバージョンで互換性管理）

---

## 9. 関連ドキュメント

### 9.1. ファイル形式仕様

- **[データファイル形式](data-format.md)** - data.json仕様
- **[ワークスペースファイル形式](workspace-format.md)** - workspace.json仕様
- **[設定ファイル形式](settings-format.md)** - config.json仕様

### 9.2. 機能ドキュメント

- **[アイテム管理](../screens/admin-window.md#6-アイテム管理の詳細)** - データファイルの編集機能
- **[ワークスペース機能](../features/workspace.md)** - ワークスペースの使い方
- **[アプリケーション設定](../screens/admin-window.md#7-設定機能の詳細)** - 設定画面の使い方
- **[バックアップ機能](../features/backup.md)** - バックアップの詳細

### 9.3. アーキテクチャ

- **[システム概要](overview.md)** - アプリケーション全体のアーキテクチャ
- **[用語集](glossary.md)** - プロジェクト全体の用語定義
