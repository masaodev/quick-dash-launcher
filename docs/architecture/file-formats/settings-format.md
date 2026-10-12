# 設定ファイル形式

QuickDashLauncherのアプリケーション設定ファイルの形式を説明します。

## 1. ファイル概要

### 1.1. 対象ファイル

| ファイル名 | 用途 | 管理方法 |
| --- | --- | --- |
| **settings.json** | アプリケーション設定 | electron-store |

**保存場所**: 設定フォルダ直下の `settings.json`。設定フォルダは既定で `%APPDATA%\quick-dash-launcher\config\`（パッケージ版も同じ。フォルダ名は `package.json` の `name`。Store 版は例外があり、[ビルドとデプロイ - Store 版（MSIX）](../../setup/build-deploy.md#store-版msix)を参照）だが、環境変数 `QUICK_DASH_CONFIG_DIR` や多重起動（`APP_INSTANCE`）で変わる。決まり方は [ファイル形式一覧の「設定フォルダの場所」](README.md#設定フォルダの場所) を参照

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
  "cliEnabled": false,
  "backupEnabled": false,
  "backupRetention": 10,
  "showDataFileTabs": true,
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
  "detachedVisibleOnAllDesktops": true,
  "parallelGroupLaunch": false,
  "showKeyboardHints": true,
  "itemSearchHotkey": "Ctrl+Alt+Space",
  "backupIncludeClipboard": false,
  "bookmarkAutoImport": {
    "autoRunOnStartup": false,
    "rules": []
  },
  "hideDetachedWithMainWindow": true,
  "windowSnapEnabled": true
}
```

---

## 3. フィールド定義

フィールドの一覧・型・コメントは [src/common/types/settings.ts](../../../src/common/types/settings.ts) の `AppSettings` を正とします（`WindowPositionMode`・`WorkspacePositionMode` も同じファイル。`DataFileTab` は [data.ts](../../../src/common/types/data.ts)、`BookmarkAutoImportSettings` は [bookmarkAutoImport.ts](../../../src/common/types/bookmarkAutoImport.ts)）。この章には項目の意味・既定値・制約だけを書き、型定義の写しは置きません。

### 3.1. バージョン情報

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **createdWithVersion** | string | - | この設定ファイルを作成したアプリバージョン（初回作成時のみ記録） |
| **updatedWithVersion** | string | - | この設定ファイルを最後に更新したアプリバージョン |

`createdWithVersion`・`updatedWithVersion` はメタ情報で、更新しても `updatedWithVersion` は進まない。

v0.8.0-beta.5 までの QDL が書いた `$schema` は使わない（electron-store が未知のキーとして残すので、ファイルからは消えない）。

### 3.2. ホットキー設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **hotkey** | string | "" | ランチャー起動ホットキー<br>空の場合はホットキー未設定（初回セットアップで設定）<br>修飾キー（Ctrl・Alt・Shift など）1 つ以上と通常キー 1 つを `+` でつなぐ。形が合わない値は登録しない<br>例: "Alt+Space", "Ctrl+Shift+L" |

### 3.3. ウィンドウサイズ設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **windowWidth** | number | 600 | ウィンドウの初期幅（ピクセル） |
| **windowHeight** | number | 400 | ウィンドウの初期高さ（ピクセル） |
| **editModeWidth** | number | 1200 | 管理ウィンドウの幅（ピクセル） |
| **editModeHeight** | number | 1000 | 管理ウィンドウの高さ（ピクセル） |

### 3.4. 自動起動・CLI 設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **autoLaunch** | boolean | false | Windows起動時にアプリを自動起動するか |
| **cliEnabled** | boolean | false | QuickDashLauncher CLI（`qdl` コマンド）を PATH から使えるようにするか |

OS への登録はポータブル版・インストーラー版ではスタートアップフォルダのショートカット、Store 版（MSIX）では Windows のスタートアップ アプリ（StartupTask）。Store 版で利用者が Windows 側で無効にしていると、この値が `true` でも自動起動しない。

ショートカット（`QuickDashLauncher.lnk`）はインスタンスを区別しない 1 つだけなので、パッケージ版でも `APP_INSTANCE` を付けて起動したインスタンスは自動起動の登録に触らず、この設定は効きません（試験用のインスタンスの設定で、本番のショートカットを作り直したり消したりしないため）。`cliEnabled` も、PATH と `qdl.exe` のコピー先がインスタンスを区別しない 1 つだけなので、同じく `APP_INSTANCE` 付きの起動とパッケージ化されていない起動では効きません。

### 3.5. バックアップ設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **backupEnabled** | boolean | false | バックアップ機能の有効/無効 |
| **backupRetention** | number | 10 | バックアップファイルの保存件数上限<br>古いバックアップから自動削除 |
| **backupIncludeClipboard** | boolean | false | クリップボードデータもバックアップに含めるか |

### 3.6. データファイルタブ設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **showDataFileTabs** | boolean | true | タブ表示の有効/無効<br>設定画面では基本設定の「表示」にある「複数タブを表示」 |
| **defaultFileTab** | string | "datafiles/data.json" | メイン画面を開いたとき（隠したあとも）に選ぶデータファイル。`dataFileTabs` のどれかに含まれていないときは `datafiles/data.json`、それもなければ最初のファイルになる<br>タブ表示が OFF のときは、このファイルのアイテムだけを表示する<br>設定画面に入力欄はなく、`settings.json` を直接書いたときだけ変わる |
| **dataFileTabs** | DataFileTab[] | `[{files: ["datafiles/data.json"], name: "メイン"}]` | データファイルタブの設定 |
| **dataFileLabels** | Record<string, string> | `{"datafiles/data.json": "メイン用データファイル"}` | データファイルの名前定義（物理ファイル名 → 表示名） |

#### 3.6.1. DataFileTab 構造

`dataFileTabs` の各要素。1 つのタブに複数のデータファイルをまとめられる。

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| **files** | string[] | ✓ | タブにまとめるデータファイルの一覧（設定フォルダからの相対パス）。例: `["datafiles/data.json"]`、`["datafiles/data2.json", "datafiles/data3.json"]` |
| **name** | string | ✓ | タブに表示する名前。例: `"メイン"`、`"サブ1"` |

メイン画面は設定を読むたびに、`files` にあって存在しないデータファイルを空で作る。`datafiles/` 直下の `.json` 以外の名前など、作れなかったファイルがあればメイン画面にエラーのトースト（「タブのデータファイルを作成できませんでした: 〈ファイル名〉（〈理由〉）」）を出す。

型定義: [src/common/types/data.ts](../../../src/common/types/data.ts) の `DataFileTab`

### 3.7. ウィンドウ表示位置設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **windowPositionMode** | WindowPositionMode | "cursorMonitorCenter" | ウィンドウ表示位置モード |
| **windowPositionX** | number | 0 | 固定位置のX座標（windowPositionMode='fixed'時に使用） |
| **windowPositionY** | number | 0 | 固定位置のY座標（windowPositionMode='fixed'時に使用） |

#### 3.7.1. WindowPositionMode 値

| 値 | 説明 |
| --- | --- |
| **center** | 画面中央に表示 |
| **cursor** | マウスカーソルの位置に表示 |
| **cursorMonitorCenter** | カーソルのモニター中央に表示 |
| **fixed** | 固定位置に表示（手動で移動した位置を記憶） |

### 3.8. ワークスペース設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **workspaceOpacity** | number | 100 | ワークスペースウィンドウの不透明度（0-100%） |
| **workspaceBackgroundTransparent** | boolean | false | ワークスペースウィンドウの背景のみを透過するか |
| **autoShowWorkspace** | boolean | false | メイン画面表示時にワークスペースを自動表示するか |
| **workspacePositionMode** | WorkspacePositionMode | "displayRight" | ワークスペースウィンドウの表示位置モード |
| **workspaceTargetDisplayIndex** | number | 0 | ターゲットディスプレイ番号（displayLeft/displayRight時に使用、0始まり） |
| **workspacePositionX** | number | 0 | 固定位置のX座標（workspacePositionMode='fixed'時に使用） |
| **workspacePositionY** | number | 0 | 固定位置のY座標（workspacePositionMode='fixed'時に使用） |
| **workspaceVisibleOnAllDesktops** | boolean | true | ワークスペースウィンドウを全仮想デスクトップに表示するか |
| **detachedVisibleOnAllDesktops** | boolean | true | 切り離しウィンドウ（ワークスペースから切り離したグループのウィンドウ）を全仮想デスクトップに表示するか |
| **hideDetachedWithMainWindow** | boolean | true | メインウィンドウの表示/非表示に連動して、固定していない切り離しウィンドウも表示/非表示にするか<br>フォーカスがメイン・ワークスペース・切り離しウィンドウ（とそこから開いた編集・確認ウィンドウ）の中にある間は隠さず、外へ出たときに隠す（管理ウィンドウは外扱い）。判定の詳細は [ウィンドウ制御](../window-control.md#ウィンドウ非表示の判定) |
| **windowSnapEnabled** | boolean | true | ワークスペースウィンドウ・切り離しウィンドウをモニター端に近づけたときに吸着（スナップ）させるか |

#### 3.8.1. WorkspacePositionMode 値

| 値 | 説明 |
| --- | --- |
| **displayLeft** | 指定ディスプレイの左端に配置 |
| **displayRight** | 指定ディスプレイの右端に配置（デフォルト） |
| **fixed** | 固定位置に表示（手動で移動した位置を記憶） |
| **primaryLeft** | @deprecated プライマリディスプレイの左端に配置（後方互換性のため、displayLeftに移行） |
| **primaryRight** | @deprecated プライマリディスプレイの右端に配置（後方互換性のため、displayRightに移行） |

### 3.9. グループ起動設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **parallelGroupLaunch** | boolean | false | グループアイテムを並列起動するか<br>true: 全アイテムを同時起動<br>false: 順次起動（各アイテムの間に100ms待つ） |

### 3.10. 追加ホットキー設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **itemSearchHotkey** | string | "Ctrl+Alt+Space" | ウィンドウ検索の起動ホットキー<br>空の場合は無効<br>例: "Ctrl+Alt+W" |

### 3.11. ブックマーク自動取込設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **bookmarkAutoImport** | BookmarkAutoImportSettings | `{autoRunOnStartup: false, rules: []}` | ブックマーク自動取込の設定<br>`autoRunOnStartup`: 起動時に有効なルール（`enabled: true`）を自動実行するか<br>`rules`: 取込ルール（`BookmarkAutoImportRule[]`）の配列。ルールの項目は `src/common/types/bookmarkAutoImport.ts` を参照 |

### 3.12. 表示設定

| フィールド | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| **showKeyboardHints** | boolean | true | メインウィンドウの下に、気づきにくいキー操作のヒントを表示するか（通常モード・ウィンドウ検索モードの両方） |

---

## 4. 設定の読み書き

### 4.1. 設定の読み込みと更新

メインプロセスの `SettingsService`（[src/main/services/settingsService.ts](../../../src/main/services/settingsService.ts)）が electron-store を包んでいる。読むときは項目 1 つずつ、またはまとめて取得し、書くときは複数の項目をまとめて更新する。レンダラーからは IPC 経由で同じサービスを呼ぶ。

### 4.2. 設定変更の即座反映

設定の変更・リセット・ファイルからの再適用（F5）のたびに、設定が変わったことを知らせるイベント（`IPC_CHANNELS.EVENT_SETTINGS_CHANGED`）を全ウィンドウへ送る。イベントはデータを伴わない通知だけで、受け取った各ウィンドウが設定を取得し直して画面に反映する。

### 4.3. QDL の外での変更の反映

`settings.json` を手で編集する使い方はサポートしない（設定は画面から変える）。それでも QDL の外でファイルが変わった場合、設定値そのものは次の取得時から反映されます（electron-store は取得のたびにファイルを読みます）。ただし OS やウィンドウに作用する設定（ホットキー登録・自動起動・CLI（qdl）の PATH 登録・ワークスペースの不透明度と位置・全デスクトップ表示・スナップ）は `set()` 時にしか適用されないため、**`qdl reload`、メイン画面の F5、または再起動**で適用し直されます（`settings:reapply` IPC → `reapplySettingsFromDisk()`）。

- ホットキーの値が不正、または他のアプリが使用中で登録できない場合は、現在の登録を維持し、トーストで知らせます。`settings.json` の値は書き戻しません（外で書かれた値を勝手に消さないため）
- 環境変数 `HOTKEY` で上書きしている間は `settings.json` のホットキーは使いません
- データファイル（`datafiles/data*.json`）が QDL の外で変わったときについては [データファイル形式 5.3](data-format.md#53-qdl-の外での変更への備え) を参照

---

## 5. 関連ドキュメント

- **[データファイル形式](data-format.md)** - data.json仕様
- **[ワークスペースファイル形式](workspace-format.md)** - workspace.json仕様
- **[ファイル形式一覧](README.md)** - すべてのファイル形式の概要
