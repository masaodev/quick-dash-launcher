# 設定ファイル形式

QuickDashLauncherのアプリケーション設定ファイルの形式を説明します。

## 1. ファイル概要

### 1.1. 対象ファイル

| ファイル名 | 用途 | 管理方法 |
|-----------|------|---------|
| **settings.json** | アプリケーション設定 | electron-store |

**保存場所**: `%APPDATA%/quick-dash-launcher/config/settings.json`

### 1.2. 文字エンコーディング

ファイルは **UTF-8（BOMなし）** で保存されます。

### 1.3. 管理ライブラリ

設定ファイルは **electron-store** ライブラリを使用して管理されます。アプリケーションから直接ファイルを編集する必要はありません。

---

## 2. ファイル構造

```json
{
  "createdWithVersion": "0.7.0",
  "updatedWithVersion": "0.7.13",
  "hotkey": "",
  "windowWidth": 600,
  "windowHeight": 400,
  "editModeWidth": 1200,
  "editModeHeight": 1000,
  "autoLaunch": false,
  "backupEnabled": false,
  "backupRetention": 10,
  "showDataFileTabs": false,
  "defaultFileTab": "datafiles/data.json",
  "dataFileTabs": [
    {
      "files": ["datafiles/data.json"],
      "name": "メイン"
    }
  ],
  "dataFileLabels": {
    "datafiles/data.json": "メイン用データファイル"
  },
  "windowPositionMode": "cursorMonitorCenter",
  "windowPositionX": 0,
  "windowPositionY": 0,
  "workspaceOpacity": 100,
  "workspaceBackgroundTransparent": false,
  "autoShowWorkspace": false,
  "workspacePositionMode": "displayRight",
  "workspaceTargetDisplayIndex": 0,
  "workspacePositionX": 0,
  "workspacePositionY": 0,
  "workspaceVisibleOnAllDesktops": true,
  "parallelGroupLaunch": false,
  "itemSearchHotkey": "",
  "backupIncludeClipboard": false
}
```

---

## 3. フィールド定義

### 3.1. バージョン情報

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **createdWithVersion** | string | - | この設定ファイルを作成したアプリバージョン（初回作成時のみ記録） |
| **updatedWithVersion** | string | - | この設定ファイルを最後に更新したアプリバージョン |

### 3.2. ホットキー設定

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **hotkey** | string | "" | ランチャー起動ホットキー<br>空の場合はホットキー未設定（初回セットアップで設定）<br>例: "Alt+Space", "Ctrl+Shift+L" |

### 3.3. ウィンドウサイズ設定

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **windowWidth** | number | 600 | ウィンドウの初期幅（ピクセル） |
| **windowHeight** | number | 400 | ウィンドウの初期高さ（ピクセル） |
| **editModeWidth** | number | 1200 | 編集モード時のウィンドウ幅（ピクセル） |
| **editModeHeight** | number | 1000 | 編集モード時のウィンドウ高さ（ピクセル） |

### 3.4. 自動起動設定

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **autoLaunch** | boolean | false | Windows起動時にアプリを自動起動するか |

### 3.5. バックアップ設定

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **backupEnabled** | boolean | false | バックアップ機能の有効/無効 |
| **backupRetention** | number | 10 | バックアップファイルの保存件数上限<br>古いバックアップから自動削除 |
| **backupIncludeClipboard** | boolean | false | クリップボードデータもバックアップに含めるか |

### 3.6. データファイルタブ設定

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **showDataFileTabs** | boolean | false | タブ表示の有効/無効 |
| **defaultFileTab** | string | "datafiles/data.json" | デフォルトで表示するタブ（タブ表示ON時のみ有効） |
| **dataFileTabs** | DataFileTab[] | `[{files: ["datafiles/data.json"], name: "メイン"}]` | データファイルタブの設定 |
| **dataFileLabels** | Record<string, string> | `{"datafiles/data.json": "メイン用データファイル"}` | データファイルの名前定義（物理ファイル名 → 表示名） |

#### 3.6.1. DataFileTab 構造

```typescript
interface DataFileTab {
  /** データファイル名のリスト（例: ['datafiles/data.json'], ['datafiles/data2.json', 'datafiles/data3.json']） */
  files: string[];
  /** タブに表示する名前（例: "メイン", "サブ1"） */
  name: string;
}
```

### 3.7. ウィンドウ表示位置設定

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **windowPositionMode** | WindowPositionMode | "cursorMonitorCenter" | ウィンドウ表示位置モード |
| **windowPositionX** | number | 0 | 固定位置のX座標（windowPositionMode='fixed'時に使用） |
| **windowPositionY** | number | 0 | 固定位置のY座標（windowPositionMode='fixed'時に使用） |

#### 3.7.1. WindowPositionMode 値

| 値 | 説明 |
|----|------|
| **center** | 画面中央に表示 |
| **cursor** | マウスカーソルの位置に表示 |
| **cursorMonitorCenter** | カーソルのモニター中央に表示 |
| **fixed** | 固定位置に表示（手動で移動した位置を記憶） |

### 3.8. ワークスペース設定

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **workspaceOpacity** | number | 100 | ワークスペースウィンドウの不透明度（0-100%） |
| **workspaceBackgroundTransparent** | boolean | false | ワークスペースウィンドウの背景のみを透過するか |
| **autoShowWorkspace** | boolean | false | メイン画面表示時にワークスペースを自動表示するか |
| **workspacePositionMode** | WorkspacePositionMode | "displayRight" | ワークスペースウィンドウの表示位置モード |
| **workspaceTargetDisplayIndex** | number | 0 | ターゲットディスプレイ番号（displayLeft/displayRight時に使用、0始まり） |
| **workspacePositionX** | number | 0 | 固定位置のX座標（workspacePositionMode='fixed'時に使用） |
| **workspacePositionY** | number | 0 | 固定位置のY座標（workspacePositionMode='fixed'時に使用） |
| **workspaceVisibleOnAllDesktops** | boolean | true | ワークスペースウィンドウを全仮想デスクトップに表示するか |

#### 3.8.1. WorkspacePositionMode 値

| 値 | 説明 |
|----|------|
| **displayLeft** | 指定ディスプレイの左端に配置 |
| **displayRight** | 指定ディスプレイの右端に配置（デフォルト） |
| **fixed** | 固定位置に表示（手動で移動した位置を記憶） |
| **primaryLeft** | @deprecated プライマリディスプレイの左端に配置（後方互換性のため、displayLeftに移行） |
| **primaryRight** | @deprecated プライマリディスプレイの右端に配置（後方互換性のため、displayRightに移行） |

### 3.9. グループ起動設定

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **parallelGroupLaunch** | boolean | false | グループアイテムを並列起動するか<br>true: 全アイテムを同時起動<br>false: 順次起動（500msディレイ） |

### 3.10. 追加ホットキー設定

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| **itemSearchHotkey** | string | "" | ウィンドウ検索の起動ホットキー<br>空の場合は無効<br>例: "Ctrl+Alt+W" |

---

## 4. データ型定義（TypeScript）

### 4.1. AppSettings

```typescript
/**
 * アプリケーションの設定を管理するインターフェース
 * electron-storeを使用して永続化される
 */
export interface AppSettings {
  /** この設定ファイルを作成したアプリバージョン（初回作成時のみ記録） */
  createdWithVersion?: string;
  /** この設定ファイルを最後に更新したアプリバージョン */
  updatedWithVersion?: string;
  /** ランチャー起動ホットキー（デフォルト: ''、空の場合は未設定） */
  hotkey: string;
  /** ウィンドウの初期幅（デフォルト: 600） */
  windowWidth: number;
  /** ウィンドウの初期高さ（デフォルト: 400） */
  windowHeight: number;
  /** 編集モード時のウィンドウ幅（デフォルト: 1200） */
  editModeWidth: number;
  /** 編集モード時のウィンドウ高さ（デフォルト: 1000） */
  editModeHeight: number;
  /** アプリの自動起動設定 */
  autoLaunch: boolean;
  /** バックアップ機能の有効/無効（デフォルト: false） */
  backupEnabled: boolean;
  /** バックアップファイルの保存件数上限（デフォルト: 10） */
  backupRetention: number;
  /** クリップボードデータもバックアップに含めるか（デフォルト: false） */
  backupIncludeClipboard: boolean;
  /** タブ表示の有効/無効（デフォルト: false） */
  showDataFileTabs: boolean;
  /** デフォルトで表示するタブ（タブ表示ON時のみ有効、デフォルト: 'datafiles/data.json'） */
  defaultFileTab: string;
  /** データファイルタブの設定（ファイル名リスト、タブ名、表示順序） */
  dataFileTabs: DataFileTab[];
  /** データファイルの名前定義（物理ファイル名 → データファイル名） */
  dataFileLabels: Record<string, string>;
  /** ウィンドウ表示位置モード（デフォルト: 'cursorMonitorCenter'） */
  windowPositionMode: WindowPositionMode;
  /** 固定位置のX座標（windowPositionMode='fixed'時に使用、デフォルト: 0） */
  windowPositionX: number;
  /** 固定位置のY座標（windowPositionMode='fixed'時に使用、デフォルト: 0） */
  windowPositionY: number;
  /** ワークスペースウィンドウの不透明度（0-100%、デフォルト: 100） */
  workspaceOpacity: number;
  /** ワークスペースウィンドウの背景のみを透過（デフォルト: false） */
  workspaceBackgroundTransparent: boolean;
  /** メイン画面表示時にワークスペースを自動表示（デフォルト: false） */
  autoShowWorkspace: boolean;
  /** ワークスペースウィンドウの表示位置モード（デフォルト: 'displayRight'） */
  workspacePositionMode: WorkspacePositionMode;
  /** ワークスペースのターゲットディスプレイ番号（displayLeft/displayRight時に使用、デフォルト: 0） */
  workspaceTargetDisplayIndex: number;
  /** 固定位置のX座標（workspacePositionMode='fixed'時に使用、デフォルト: 0） */
  workspacePositionX: number;
  /** 固定位置のY座標（workspacePositionMode='fixed'時に使用、デフォルト: 0） */
  workspacePositionY: number;
  /** ワークスペースウィンドウを全仮想デスクトップに表示（デフォルト: true） */
  workspaceVisibleOnAllDesktops: boolean;
  /** グループアイテムを並列起動する（デフォルト: false） */
  parallelGroupLaunch: boolean;
  /** ウィンドウ検索の起動ホットキー（デフォルト: ''、空の場合は無効） */
  itemSearchHotkey: string;
  /** ブックマーク自動取込設定 */
  bookmarkAutoImport: BookmarkAutoImportSettings;
}
```

### 4.2. WindowPositionMode

```typescript
/**
 * ウィンドウの表示位置モードを表す列挙型
 */
export type WindowPositionMode =
  | 'center'              // 画面中央に表示
  | 'cursor'              // マウスカーソルの位置に表示
  | 'cursorMonitorCenter' // カーソルのモニター中央に表示
  | 'fixed';              // 固定位置に表示（手動で移動した位置を記憶）
```

### 4.3. WorkspacePositionMode

```typescript
/**
 * ワークスペースの表示位置モードを表す列挙型
 */
export type WorkspacePositionMode =
  | 'primaryLeft'   // @deprecated 後方互換性のため残存。displayLeftに移行
  | 'primaryRight'  // @deprecated 後方互換性のため残存。displayRightに移行
  | 'displayLeft'   // 指定ディスプレイの左端に配置
  | 'displayRight'  // 指定ディスプレイの右端に配置（デフォルト）
  | 'fixed';        // 固定位置に表示（手動で移動した位置を記憶）
```

### 4.4. DataFileTab

```typescript
/**
 * データファイルタブの設定
 */
export interface DataFileTab {
  /** データファイル名のリスト（例: ['datafiles/data.json'], ['datafiles/data2.json', 'datafiles/data3.json']） */
  files: string[];
  /** タブに表示する名前（例: "メイン", "サブ1"） */
  name: string;
}
```

---

## 5. 設定の読み書き

### 5.1. 設定の読み込み

設定は `SettingsService.getInstance()` を通じて読み込まれます。`getInstance()` は非同期メソッドです。

```typescript
import { SettingsService } from '@main/services/settingsService';

const settings = await SettingsService.getInstance();
const hotkey = await settings.get('hotkey'); // 例: "Alt+Space"
const allSettings = await settings.getAll();
```

### 5.2. 設定の更新

設定の更新は `SettingsService.setMultiple()` を使用します。

```typescript
import { SettingsService } from '@main/services/settingsService';

const settings = await SettingsService.getInstance();
await settings.setMultiple({
  hotkey: 'Ctrl+Shift+L',
  autoLaunch: true
});
```

### 5.3. 設定変更の即座反映

設定変更時、`settings-changed` イベントが全ウィンドウに送信され、各ウィンドウが設定を再読み込みして画面に反映します。このイベントはデータを伴わない通知のみで、受信側が改めて設定を取得します。

```typescript
// メインプロセス側（settingsHandlers.ts）
// setMultiple() 実行後に全ウィンドウへ通知
window.webContents.send('settings-changed');

// レンダラープロセス側（preload経由）
window.electron.onSettingsChanged(() => {
  // コールバックに引数はない。必要な設定は別途IPCで取得する。
});
```

---

## 6. 関連ドキュメント

- **[アプリケーション設定](../../screens/admin-window.md)** - 設定画面の使い方
- **[初回起動セットアップ](../../screens/first-launch-setup.md)** - ホットキー初期設定
- **[データファイル形式](data-format.md)** - data.json仕様
- **[ワークスペースファイル形式](workspace-format.md)** - workspace.json仕様
- **[ファイル形式一覧](README.md)** - すべてのファイル形式の概要
