# ワークスペースファイル形式

QuickDashLauncherのワークスペース機能で使用されるデータファイルの形式を説明します。

## 1. ファイル概要

### 1.1. 対象ファイル

| ファイル名 | 用途 | 保存場所 |
|-----------|------|---------|
| **workspace.json** | ワークスペースアイテムとグループ | `%APPDATA%/quick-dash-launcher/config/` |
| **execution-history.json** | アイテム実行履歴（最大10件） | `%APPDATA%/quick-dash-launcher/config/` |
| **workspace-archive.json** | アーカイブされたグループとアイテム | `%APPDATA%/quick-dash-launcher/config/` |

### 1.2. 文字エンコーディング

すべてのファイルは **UTF-8（BOMなし）** で保存されます。

---

## 2. workspace.json

ワークスペースアイテムとグループを保存するJSONファイル。

### 2.1. ファイル構造

```json
{
  "items": [
    {
      "id": "uuid",
      "displayName": "表示名",
      "originalName": "元の名前",
      "path": "パスまたはURL",
      "type": "url | file | folder | app | customUri | windowOperation | group",
      "icon": "base64エンコードされたアイコン（オプション）",
      "customIcon": "カスタムアイコンファイル名（オプション）",
      "args": "引数（オプション）",
      "originalPath": "ショートカットのリンク先（オプション）",
      "itemNames": ["アイテム名1", "アイテム名2"],
      "order": 0,
      "addedAt": 1234567890,
      "groupId": "グループID（オプション）",
      "windowConfig": {
        "title": "ウィンドウタイトル（ワイルドカード対応）",
        "processName": "プロセス名（オプション）",
        "x": 100,
        "y": 100,
        "width": 800,
        "height": 600,
        "moveToActiveMonitorCenter": false,
        "virtualDesktopNumber": 1,
        "activateWindow": true,
        "pinToAllDesktops": false
      }
    }
  ],
  "groups": [
    {
      "id": "uuid",
      "displayName": "グループ名",
      "color": "色（CSS変数名またはカラーコード）",
      "order": 0,
      "collapsed": false,
      "createdAt": 1234567890
    }
  ]
}
```

### 2.2. WorkspaceItem フィールド

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| **id** | string | ✓ | アイテムの一意識別子（UUID） |
| **displayName** | string | ✓ | ワークスペース内での表示名（編集可能） |
| **originalName** | string | ✓ | 元のアイテム名（参照用） |
| **path** | string | ✓ | アイテムのパス、URL、またはコマンド |
| **type** | string | ✓ | アイテムタイプ（url, file, folder, app, customUri, windowOperation, group） |
| **icon** | string | - | base64エンコードされたアイコン（オプション） |
| **customIcon** | string | - | カスタムアイコンファイル名（オプション） |
| **args** | string | - | 実行時のコマンドライン引数（オプション） |
| **originalPath** | string | - | ショートカットファイルのリンク先のパス（オプション） |
| **order** | number | ✓ | 並び順（0から開始） |
| **addedAt** | number | ✓ | 追加日時（timestamp） |
| **groupId** | string | - | 所属グループID（未設定の場合は未分類） |
| **windowConfig** | object | - | ウィンドウ制御設定（オプション） |
| **itemNames** | string[] | - | グループ内のアイテム名リスト（group専用） |
| **windowX** | number | - | ウィンドウX座標（windowOperation専用） |
| **windowY** | number | - | ウィンドウY座標（windowOperation専用） |
| **windowWidth** | number | - | ウィンドウ幅（windowOperation専用） |
| **windowHeight** | number | - | ウィンドウ高さ（windowOperation専用） |
| **virtualDesktopNumber** | number | - | 仮想デスクトップ番号（windowOperation専用） |
| **activateWindow** | boolean | - | ウィンドウをアクティブにするか（windowOperation専用） |
| **processName** | string | - | プロセス名で検索（windowOperation専用） |
| **moveToActiveMonitorCenter** | boolean | - | アクティブモニターの中央に移動（windowOperation専用） |
| **pinToAllDesktops** | boolean | - | 全仮想デスクトップにピン止め（windowOperation専用） |

### 2.3. WorkspaceGroup フィールド

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| **id** | string | ✓ | グループの一意識別子（UUID） |
| **displayName** | string | ✓ | グループ名 |
| **color** | string | ✓ | グループの色（CSS変数名またはカラーコード） |
| **order** | number | ✓ | 並び順（0から開始） |
| **collapsed** | boolean | ✓ | 折りたたみ状態（true: 折りたたみ） |
| **createdAt** | number | ✓ | 作成日時（timestamp） |

### 2.4. バージョン履歴

| バージョン | 変更内容 |
|-----------|---------|
| **v0.5.1** | クリップボードからのペースト機能追加（Ctrl+V） |
| **v0.5.19** | `type` に `'group'` を追加、グループアイテムのワークスペース登録が可能に |
| **v0.5.19** | `itemNames` フィールド追加（group専用） |

---

## 3. execution-history.json

アイテムの実行履歴を保存するJSONファイル（最大10件）。

### 3.1. ファイル構造

```json
{
  "history": [
    {
      "id": "uuid",
      "itemName": "アイテム名",
      "itemPath": "パスまたはURL",
      "itemType": "url | file | folder | app | customUri | group | windowOperation",
      "icon": "base64エンコードされたアイコン（オプション）",
      "customIcon": "カスタムアイコンファイル名（オプション）",
      "args": "引数（オプション）",
      "itemNames": ["アイテム名1", "アイテム名2"],
      "executedAt": 1234567890
    }
  ]
}
```

### 3.2. ExecutionHistoryItem フィールド

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| **id** | string | ✓ | 履歴アイテムの一意識別子（UUID） |
| **itemName** | string | ✓ | アイテム名 |
| **itemPath** | string | ✓ | アイテムのパス、URL、またはコマンド |
| **itemType** | string | ✓ | アイテムタイプ |
| **icon** | string | - | base64エンコードされたアイコン（オプション） |
| **customIcon** | string | - | カスタムアイコンファイル名（オプション） |
| **args** | string | - | 実行時のコマンドライン引数（オプション） |
| **executedAt** | number | ✓ | 実行日時（timestamp） |
| **itemNames** | string[] | - | グループ内のアイテム名リスト（group専用） |
| **windowX** | number | - | ウィンドウX座標（windowOperation専用） |
| **windowY** | number | - | ウィンドウY座標（windowOperation専用） |
| **windowWidth** | number | - | ウィンドウ幅（windowOperation専用） |
| **windowHeight** | number | - | ウィンドウ高さ（windowOperation専用） |
| **virtualDesktopNumber** | number | - | 仮想デスクトップ番号（windowOperation専用） |
| **activateWindow** | boolean | - | ウィンドウをアクティブにするか（windowOperation専用） |
| **processName** | string | - | プロセス名で検索（windowOperation専用） |
| **moveToActiveMonitorCenter** | boolean | - | アクティブモニターの中央に移動（windowOperation専用） |
| **pinToAllDesktops** | boolean | - | 全仮想デスクトップにピン止め（windowOperation専用） |

### 3.3. 特徴

- 最大10件まで保持
- 古い履歴から自動削除
- メイン画面でアイテムを起動するたびに自動追加
- **v0.5.19以降**: `itemType` に `'group'` が追加され、グループアイテムの実行履歴も記録可能
- **v0.5.19以降**: `itemNames` フィールドはグループアイテム専用（`itemType='group'` の場合のみ使用）

---

## 4. workspace-archive.json

アーカイブされたワークスペースグループとアイテムを保存するJSONファイル。

### 4.1. ファイル構造

```json
{
  "archivedGroups": [
    {
      "id": "uuid",
      "displayName": "グループ名",
      "color": "色（CSS変数名またはカラーコード）",
      "order": 0,
      "collapsed": false,
      "createdAt": 1234567890,
      "archivedAt": 1234567890,
      "originalOrder": 0,
      "itemCount": 3
    }
  ],
  "archivedItems": [
    {
      "id": "uuid",
      "displayName": "表示名",
      "originalName": "元の名前",
      "path": "パスまたはURL",
      "type": "url | file | folder | app | customUri | windowOperation | group",
      "icon": "base64エンコードされたアイコン（オプション）",
      "customIcon": "カスタムアイコンファイル名（オプション）",
      "args": "引数（オプション）",
      "originalPath": "ショートカットのリンク先（オプション）",
      "order": 0,
      "addedAt": 1234567890,
      "groupId": "グループID",
      "archivedAt": 1234567890,
      "archivedGroupId": "アーカイブグループID"
    }
  ]
}
```

### 4.2. ArchivedWorkspaceGroup フィールド

WorkspaceGroup のすべてのフィールドに加えて：

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| **archivedAt** | number | ✓ | アーカイブ日時（timestamp） |
| **originalOrder** | number | ✓ | アーカイブ前のorder（復元時の参考用） |
| **itemCount** | number | ✓ | アーカイブ時のアイテム数（表示用） |

### 4.3. ArchivedWorkspaceItem フィールド

WorkspaceItem のすべてのフィールドに加えて：

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| **archivedAt** | number | ✓ | アーカイブ日時（timestamp） |
| **archivedGroupId** | string | ✓ | アーカイブグループID（どのグループと一緒にアーカイブされたか） |

### 4.4. 特徴

- グループ単位でアーカイブ
- グループとその中のアイテムが一緒に保存される
- 復元時に同名グループが存在する場合、「(復元)」サフィックスが自動付加される

---

## 5. データ型定義（TypeScript）

### 5.1. WorkspaceItem

```typescript
/**
 * ワークスペースに追加されたアイテム
 * メイン画面のアイテムを完全にコピーし、独立して管理される
 * 元のアイテムが変更・削除されても影響を受けない
 */
export interface WorkspaceItem {
  /** アイテムの一意識別子（UUID） */
  id: string;
  /** ワークスペース内での表示名（編集可能） */
  displayName: string;
  /** 元のアイテム名（参照用） */
  originalName: string;
  /** アイテムのパス、URL、またはコマンド */
  path: string;
  /** アイテムのタイプ */
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'windowOperation' | 'group';
  /** アイテムのアイコン（base64エンコードされたデータURL、オプション） */
  icon?: string;
  /** カスタムアイコンのファイル名（オプション） */
  customIcon?: string;
  /** 実行時のコマンドライン引数（オプション） */
  args?: string;
  /** ショートカットファイルのリンク先のパス（オプション） */
  originalPath?: string;
  /** 並び順（0から開始） */
  order: number;
  /** 追加日時（timestamp） */
  addedAt: number;
  /** 所属グループID（未設定の場合はundefined = 未分類） */
  groupId?: string;
  /** ウィンドウ制御設定（ウィンドウ検索・位置・サイズ制御） */
  windowConfig?: WindowConfig;
  /** グループ内のアイテム名リスト（group専用） */
  itemNames?: string[];
  // ... windowOperation専用フィールド（windowX, windowY等）
}
```

### 5.2. WorkspaceGroup

```typescript
/**
 * ワークスペースのグループ
 * アイテムを論理的にグループ化して整理する
 */
export interface WorkspaceGroup {
  /** グループの一意識別子（UUID） */
  id: string;
  /** グループ名 */
  displayName: string;
  /** グループの色（CSS変数名またはカラーコード） */
  color: string;
  /** 並び順（0から開始） */
  order: number;
  /** 折りたたみ状態（true: 折りたたみ） */
  collapsed: boolean;
  /** 作成日時（timestamp） */
  createdAt: number;
}
```

### 5.3. ExecutionHistoryItem

```typescript
/**
 * 実行履歴アイテム
 * メインウィンドウで実行されたアイテムの履歴を記録する
 */
export interface ExecutionHistoryItem {
  /** 履歴アイテムの一意識別子（UUID） */
  id: string;
  /** アイテム名 */
  itemName: string;
  /** アイテムのパス、URL、またはコマンド */
  itemPath: string;
  /** アイテムのタイプ */
  itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'group' | 'windowOperation';
  /** アイテムのアイコン（base64エンコードされたデータURL、オプション） */
  icon?: string;
  /** カスタムアイコンのファイル名（オプション） */
  customIcon?: string;
  /** 実行時のコマンドライン引数（オプション） */
  args?: string;
  /** 実行日時（timestamp） */
  executedAt: number;
  /** グループ内のアイテム名リスト（group専用） */
  itemNames?: string[];
  // ... windowOperation専用フィールド（windowX, windowY等）
}
```

### 5.4. DragItemData

```typescript
/**
 * ドラッグ&ドロップで転送されるデータの型
 * ワークスペース内のアイテム、実行履歴、グループのドラッグを型安全に扱う
 */
export type DragItemData =
  | { type: 'workspace-item'; itemId: string; currentGroupId?: string }
  | { type: 'history-item'; historyItem: LauncherItem }
  | { type: 'group'; groupId: string };
```

### 5.5. DropTargetData

```typescript
/**
 * ドロップターゲットのデータ型
 * ドロップ先の種別と識別子を表す
 */
export interface DropTargetData {
  /** ドロップ先のタイプ */
  targetType: 'group' | 'item' | 'uncategorized';
  /** グループID（targetType='group'の場合） */
  groupId?: string;
  /** アイテムID（targetType='item'の場合） */
  itemId?: string;
}
```

### 5.6. ArchivedWorkspaceGroup

```typescript
/**
 * アーカイブされたワークスペースグループ
 * WorkspaceGroupを拡張し、アーカイブ関連の情報を追加
 */
export interface ArchivedWorkspaceGroup extends WorkspaceGroup {
  /** アーカイブ日時（timestamp） */
  archivedAt: number;
  /** アーカイブ前のorder（復元時の参考用） */
  originalOrder: number;
  /** アーカイブ時のアイテム数（表示用） */
  itemCount: number;
}
```

### 5.7. ArchivedWorkspaceItem

```typescript
/**
 * アーカイブされたワークスペースアイテム
 * WorkspaceItemを拡張し、アーカイブ関連の情報を追加
 */
export interface ArchivedWorkspaceItem extends WorkspaceItem {
  /** アーカイブ日時（timestamp） */
  archivedAt: number;
  /** アーカイブグループID（どのグループと一緒にアーカイブされたか） */
  archivedGroupId: string;
}
```

---

## 6. 関連ドキュメント

- **[ワークスペース機能](../features/workspace.md)** - ワークスペース機能の使い方
- **[ワークスペースウィンドウ](../screens/workspace-window.md)** - UI操作ガイド
- **[データファイル形式](data-format.md)** - data.json仕様
- **[設定ファイル形式](settings-format.md)** - config.json仕様
- **[ファイル形式一覧](README.md)** - すべてのファイル形式の概要
