# ウィンドウ制御システム

## ウィンドウピン留めモード機能

### 概要

ウィンドウの表示動作を3段階で制御する機能です。📌ボタンをクリックするたびに、`normal` → `alwaysOnTop` → `stayVisible` → `normal` と循環的に切り替わります。

### ピン留めモードの種類

**通常モード (`normal`)**
- フォーカスが外れると自動的に非表示になります
- アイテム起動後も自動的に非表示になります
- 最上面には表示されません（`alwaysOnTop: false`）
- デフォルトモードです

**常に最上面モード (`alwaysOnTop`)**
- 常に最上面に表示されます（`alwaysOnTop: true`）
- フォーカスが外れても非表示になりません
- アイテム起動後も表示されたままです

**表示固定モード (`stayVisible`)**
- 最上面には表示されません（`alwaysOnTop: false`）
- フォーカスが外れても非表示になりません
- アイテム起動後も表示されたままです

### 実装詳細

- **実装場所**: `src/main/windowManager.ts`, `src/main/ipc/itemHandlers.ts`
- **状態管理**: メインプロセスで`windowPinMode: WindowPinMode`を管理
- **型定義**: `src/common/types.ts`で`WindowPinMode`型を定義
- **制御ロジック**:
  - ピン留めモードに応じてウィンドウのblurイベントで非表示制御
  - アイテム起動時、`normal`モードの場合のみウィンドウを非表示
- **UI制御**: レンダラーで固定ボタン（📌）の状態を管理

### アイテム起動時の動作制御

アイテム起動時のウィンドウ非表示動作は、ピン留めモードによって制御されます：

**実装場所**: `src/main/ipc/itemHandlers.ts`

```typescript
// setupItemHandlers内で、ピンモードに応じて非表示を制御
ipcMain.handle('open-item', async (_event, item: LauncherItem) => {
  const shouldHide = getWindowPinMode() === 'normal';
  await openItem(item, getMainWindow(), shouldHide);
});
```

- `normal`モード: `shouldHide = true` → ウィンドウを非表示
- `alwaysOnTop`/`stayVisible`モード: `shouldHide = false` → ウィンドウを表示したまま

この動作は以下の操作すべてに適用されます：
- 個別アイテムの起動 (`open-item`)
- 親フォルダを開く (`open-parent-folder`)
- グループアイテムの実行 (`execute-group`)

## ウィンドウ表示制御

- **グローバルホットキー**: 設定したホットキー（デフォルト: `Alt+Space`）でウィンドウ表示/非表示
  - **非表示制限**: 以下の場合はホットキーでも非表示にできません
    - 初回起動モード
    - 編集モード
    - モーダルモード
    - ピン留めモードが`alwaysOnTop`または`stayVisible`の場合
  - **実装場所**: `src/main/windowManager.ts:487-509`（`hideMainWindow`関数）
- **フォーカスアウト**: `normal`モードの場合、フォーカスを失うと自動的に非表示
- **編集モード時のフォーカス制御**: 編集モード中はフォーカスアウトでもウィンドウが非表示にならない
- **Escapeキー**: 以下の場合を**除き**、Escapeキーで非表示可能
  - 初回起動モード
  - 編集モード
  - モーダルモード
  - ピン留めモードが`alwaysOnTop`または`stayVisible`の場合
  - **実装場所**: `src/main/windowManager.ts:85-104`
- **システムトレイ**: ダブルクリックでウィンドウ表示、右クリックでメニュー表示

### ウィンドウ非表示時の処理フロー

ウィンドウが非表示になる際、レンダラープロセスに`window-hidden`イベントが送信されます。これにより、ウィンドウ非表示時に必要な前処理（タブのリセット、ウィンドウ検索モードのリセット等）を実行できます。

**処理フロー:**
1. ユーザーがホットキーを押下、またはフォーカスアウト等でウィンドウが非表示になる
2. メインプロセスの`hideMainWindow`関数が実行される
3. ウィンドウを非表示にする直前に、`window-hidden`イベントを全レンダラープロセスに送信
4. レンダラープロセスが`onWindowHidden`イベントハンドラーで前処理を実行
   - 例1: タブをデフォルト位置にリセット
   - 例2: ウィンドウ検索モードを通常モードにリセット（次回表示時のラグ防止）
5. ウィンドウが非表示になる

**メリット:**
- 次回ウィンドウを表示する際、既に前処理が完了しているため、表示遅延が発生しない
- 例1: タブをデフォルト位置にリセットする処理をウィンドウ非表示時に実行することで、次回表示時は既にリセット済み
- 例2: ウィンドウ検索モード（`searchMode='window'`）を通常モードにリセットすることで、次回表示時にモード切り替えのラグが発生しない

**実装場所:**
- メインプロセス: `src/main/windowManager.ts` - `hideMainWindowInternal()`関数
- プリロードAPI: `src/main/preload.ts` - `onWindowHidden`イベントハンドラー
- レンダラー:
  - `src/renderer/hooks/useDataFileTabs.ts` - タブリセット処理
  - `src/renderer/App.tsx` - ウィンドウ検索モードリセット処理

### ウィンドウ表示位置制御

ホットキーでウィンドウを表示する際、設定に応じて表示位置を制御します。

#### 表示位置モード

ウィンドウの表示位置は`windowPositionMode`設定によって以下の4つのモードから選択できます：

**1. 画面中央（固定）モード (`center`)**
- 常にプライマリモニターの中央にウィンドウを表示します
- デフォルトモードです
- 実装: `mainWindow.center()`を呼び出し

**2. 画面中央（自動切替）モード (`cursorMonitorCenter`)**
- マウスカーソルがあるモニターの中央にウィンドウを表示します（マルチモニター推奨）
- マルチモニター環境で、作業中のモニターにウィンドウを表示したい場合に便利です
- シングルモニター環境では「画面中央（固定）」モードと同じ動作になります
- タスクバーを除く作業領域（`workArea`）の中央に配置されます
- 実装: `screen.getCursorScreenPoint()`でカーソル位置を取得し、`screen.getDisplayNearestPoint()`で対象モニターを特定、その中央座標を計算してウィンドウを配置

**3. カーソル付近モード (`cursor`)**
- マウスカーソルの近くにウィンドウを表示します（検索入力がしやすい位置）
- カーソル位置がウィンドウの左上から右へ100px、下へ40px付近（検索入力欄の位置）に来るように計算されます
- 画面外にはみ出さないように自動的に位置調整が行われます
- マルチモニター環境では、カーソルがあるモニターの作業領域（タスクバーを除く領域）内に配置されます
- 実装: `screen.getCursorScreenPoint()`でカーソル位置を取得し、オフセット（X: 100px, Y: 40px）を考慮してウィンドウ位置を計算

**4. 固定位置（手動設定）モード (`fixed`)**
- ウィンドウを移動した位置を記憶して、次回も同じ位置に表示します
- 初回表示時（`windowPositionX=0, windowPositionY=0`の場合）は画面中央に配置され、その位置が自動保存されます
- ウィンドウの`moved`イベントを監視し、ユーザーがウィンドウを移動すると自動的に位置を保存します
- 保存された座標（`windowPositionX`, `windowPositionY`）は`settings.json`に永続化されます

#### 実装詳細

**関数: `setWindowPosition(mode?: WindowPositionMode)`**
- 指定されたモードに応じてウィンドウを適切な位置に配置します
- `mode`が省略された場合は、設定ファイルから`windowPositionMode`を読み込みます
- 実装場所: `src/main/windowManager.ts`

**関数: `saveWindowPosition()`**
- `fixed`モードの場合のみ、現在のウィンドウ位置を設定ファイルに保存します
- ウィンドウの`moved`イベントハンドラーから自動的に呼び出されます
- 実装場所: `src/main/windowManager.ts`

**関数: `showMainWindow()`**
- ホットキー押下時にウィンドウを表示する際に使用されます
- 内部で`setWindowPosition()`を呼び出して位置を設定してから表示します
- 実装場所: `src/main/windowManager.ts`

**関数: `showWindowAtCenter()`**
- タスクトレイメニューの「画面中央に表示」から呼び出されます
- 設定に関係なく、強制的に画面中央に表示します
- 実装場所: `src/main/windowManager.ts`

#### ウィンドウ位置の自動保存

`fixed`モード時のみ、以下のタイミングでウィンドウ位置が自動保存されます：

1. **ウィンドウ移動時**: ユーザーがウィンドウをドラッグして移動したとき（`moved`イベント）
2. **初回表示時**: `windowPositionX=0, windowPositionY=0`の場合、画面中央に配置後に位置を保存

### システムトレイメニュー

システムトレイアイコンを右クリックすると、以下のメニューが表示されます：

1. **バージョン情報**: `QuickDashLauncher vX.X.X` - 現在のバージョンを動的に表示（選択不可）
2. **表示**: メインウィンドウを表示（設定されているホットキーも表示）
3. **画面中央に表示**: 設定に関係なく強制的に画面中央に表示（`showWindowAtCenter()`を呼び出し）
4. **設定...**: 管理ウィンドウの設定タブを開く（`showAdminWindowWithTab('settings')`を呼び出し）
5. **データフォルダを開く**: 設定・データフォルダをエクスプローラーで開く（`shell.openPath`使用）
6. **ヘルプ**: GitHubリポジトリをブラウザで開く（`shell.openExternal`使用）
7. **再起動**: アプリケーションを再起動（`app.relaunch()` + `app.quit()`）
   - **開発モード**: 警告ダイアログを表示（自動再起動非対応、手動で`npm run dev`を実行する必要がある）
   - **本番モード**: 通常の再起動を実行
8. **終了**: アプリケーションを終了（`app.quit()`）

詳細は [アプリケーション設定](../screens/admin-window.md#713-システムトレイメニュー) を参照してください。

## IPC通信フロー

### ピン留めモードの切り替え

1. レンダラーが📌ボタンクリック → `cycle-window-pin-mode`
2. メインプロセスがピンモードを循環的に切り替え → `windowManager.cycleWindowPinMode()`
3. レンダラーが新しいピンモードを取得 → `get-window-pin-mode`
4. UIが新しいモードに応じて更新される

### ウィンドウ非表示の判定

- **blur イベント**: `shouldHideOnBlur()`で判定 → `normal`モード時のみ非表示
- **アイテム起動時**: `getWindowPinMode() === 'normal'`で判定 → `normal`モード時のみ非表示
- **編集モード時**: `isEditMode`フラグで判定 → 編集モード中は非表示にしない

## 編集モードのウィンドウ制御

- **ウィンドウサイズ管理**: 通常モードのサイズを保存し、編集モード時に拡大
- **フォーカス制御**: 編集モード中は`isEditMode`フラグでフォーカスアウトを無効化
- **サイズ復元**: 編集モード終了時に保存した元のサイズに自動復元

### 編集モードのIPC通信フロー

1. レンダラーが編集モード切り替え → `set-edit-mode`
2. メインプロセスが編集モード状態を更新 → `windowManager.setEditMode()`
3. ウィンドウサイズとフォーカス制御を自動調整
4. レンダラーが編集モード状態を取得 → `get-edit-mode`

## 管理ウィンドウ制御

### 実装場所
- **メインプロセス**: `src/main/adminWindowManager.ts`
- **レンダラー**: `src/renderer/AdminApp.tsx`

### タブ指定での表示機能

1. **メニューからのタブ指定**
   - 「基本設定」メニュー → `openEditWindowWithTab('settings')`
   - 「アイテム管理」メニュー → `openEditWindowWithTab('edit')`

2. **タブ変更の通信フロー**
   - メインプロセスから`set-active-tab`イベントを送信
   - AdminAppがイベントを受信してタブを切り替え

3. **初期タブのリセット**
   - ウィンドウが非表示になるたびに初期タブをリセット
   - 次回開く際は指定されたタブが正しく表示される

### 管理ウィンドウのEscapeキー動作

**実装場所**: `src/main/adminWindowManager.ts:90-96`

管理ウィンドウでは、編集作業中の誤操作を防止するため、**Escapeキーで閉じる機能を無効化**しています。

```typescript
adminWindow.webContents.on('before-input-event', (event, input) => {
  if (input.key === 'Escape' && input.type === 'keyDown') {
    event.preventDefault();
    // Escapeキーでは閉じない（編集作業中の誤操作を防止）
  }
});
```

管理ウィンドウを閉じるには、以下の方法を使用します：
- ウィンドウ右上の閉じるボタン（×）をクリック
- 再度Ctrl+Eを押してトグル
- 設定メニューから「閉じる」を選択

### 管理ウィンドウのIPC通信

- `show-edit-window`: 管理ウィンドウを表示
- `hide-edit-window`: 管理ウィンドウを非表示
- `toggle-edit-window`: 表示/非表示を切り替え
- `open-edit-window-with-tab`: 指定タブで開く
- `get-initial-tab`: 初期タブを取得
- `set-active-tab`: アクティブタブを変更（イベント）

## ワークスペースウィンドウ制御

### 実装場所
- **メインプロセス**: `src/main/workspaceWindowManager.ts`
- **レンダラー**: `src/renderer/WorkspaceApp.tsx`

### モーダルモードのウィンドウサイズ制御

ワークスペースウィンドウで各種ダイアログ（グループアイテムセレクター、アーカイブ選択など）が表示される際、必要に応じてウィンドウサイズを自動的に拡大・復元します。

**実装場所**: `src/main/workspaceWindowManager.ts:228-284`（`setWorkspaceModalMode`関数）

**動作フロー:**
1. **モーダル表示時**: 現在のウィンドウサイズを保存し、必要な場合のみ拡大
   - モーダルの要求サイズ（`requiredSize`）と現在のサイズを比較
   - 現在のサイズが小さい場合のみ拡大（不要な場合は変更しない）
   - ウィンドウの位置を右端に維持（X座標を調整）

2. **モーダルを閉じる時**: 保存した元のサイズに自動復元
   - `normalWorkspaceWindowBounds`から元のサイズを復元
   - ウィンドウの位置を右端に維持（X座標を調整）
   - 元のサイズ情報をクリア（`normalWorkspaceWindowBounds = null`）

**IPC通信:**
- レンダラーから`set-workspace-modal-mode`イベントで制御
- パラメータ: `{ isModal: boolean, requiredSize?: { width: number, height: number } }`

**使用例:**
```typescript
// モーダル表示時
window.electron.setWorkspaceModalMode(true, { width: 600, height: 500 });

// モーダルを閉じる時
window.electron.setWorkspaceModalMode(false);
```

## ウィンドウ位置・サイズ制御

### 概要

アイテムにウィンドウ設定を追加することで、既存ウィンドウのアクティブ化と同時に位置・サイズの制御ができます。

### 機能概要

**基本動作:**
1. アイテム起動前に、指定されたウィンドウタイトルでウィンドウを検索
2. ウィンドウが見つかった場合:
   - ウィンドウをアクティブ化（前面に表示）
   - 位置・サイズが設定されている場合は、ウィンドウを移動・リサイズ
   - 通常起動は実行しない
3. ウィンドウが見つからない場合: 通常通りアイテムを起動

### データ形式

ウィンドウ設定はdata.jsonの5番目のフィールドに記述します。

#### 文字列形式（タイトルのみ）

```
名前,パス,引数,カスタムアイコン,ウィンドウタイトル
```

**例:**
```
VSCode,code.exe,,,Visual Studio Code
Chrome,chrome.exe,,,Google Chrome
```

#### JSON形式（位置・サイズ指定）

```
名前,パス,引数,カスタムアイコン,"{""title"":""ウィンドウタイトル"",""x"":100,""y"":200,""width"":800,""height"":600}"
```

**JSON構造:**
```json
{
  "title": "ウィンドウタイトル（必須）",
  "x": 100,      // X座標（省略可能）
  "y": 200,      // Y座標（省略可能）
  "width": 800,  // 幅（省略可能）
  "height": 600, // 高さ（省略可能）
  "moveToActiveMonitorCenter": true  // アクティブモニター中央に移動（省略可能、デフォルト: false）
}
```

詳細は **[データファイル形式 - ウィンドウ設定](data-format.md#ウィンドウ設定フィールドの記述方法)** を参照してください。

### アクティブモニター中央への移動

`moveToActiveMonitorCenter`フィールドを使用することで、マウスカーソルがあるモニター（アクティブモニター）の中央にウィンドウを自動的に移動できます。

**動作仕様:**
- `moveToActiveMonitorCenter: true` の場合、マウスカーソルがあるモニターの中央にウィンドウを移動
- X座標とY座標の指定は無視されます（優先順位: `moveToActiveMonitorCenter` > `x/y座標`）
- 幅と高さの指定は引き続き有効です
- タスクバーを除く作業領域（workArea）の中央に配置されます
- 画面外に出ないように自動調整されます

**使用例:**
```
// アクティブモニターの中央に移動（サイズ指定あり）
VSCode,code.exe,,,"{""title"":""Visual Studio Code"",""moveToActiveMonitorCenter"":true,""width"":1600,""height"":900}"

// アクティブモニターの中央に移動（サイズ指定なし、現在のサイズを維持）
Chrome,chrome.exe,,,"{""title"":""Google Chrome"",""moveToActiveMonitorCenter"":true}"
```

### マルチモニタ対応（固定座標指定）

座標系は仮想スクリーン座標（Virtual Screen Coordinates）を使用します。

**座標系の仕様:**
- プライマリモニターの左上が原点 (0, 0)
- セカンダリモニターは相対位置に配置
  - 例: プライマリが1920x1080、セカンダリが右側なら X=1920 から開始
- 負の座標も使用可能（プライマリの左側・上側にモニターがある場合）

**使用例（デュアルモニタ、固定座標）:**
```
Chrome (セカンダリ),chrome.exe,,,"{""title"":""Google Chrome"",""x"":1920,""y"":0,""width"":1920,""height"":1080}"
VSCode (左半分),code.exe,,,"{""title"":""Visual Studio Code"",""x"":0,""y"":0,""width"":960,""height"":1080}"
Slack (右半分),slack://,,,"{""title"":""Slack"",""x"":960,""y"":0,""width"":960,""height"":1080}"
```

### 実装詳細

**アーキテクチャ:**

アイテム起動時のウィンドウアクティブ化は、以下のモジュール構成で実装されています：

| モジュール | 役割 |
|-----------|------|
| `src/main/ipc/itemHandlers.ts` | アイテム起動のエントリーポイント |
| `src/main/ipc/workspaceHandlers.ts` | ワークスペースアイテム起動のエントリーポイント |
| `src/main/utils/windowActivator.ts` | ウィンドウ検索・アクティブ化・位置サイズ設定の一元管理 |
| `src/main/utils/itemLauncher.ts` | URL/ファイル/アプリ/カスタムURIの起動処理を統一 |
| `src/main/utils/windowMatcher.ts` | ウィンドウタイトルによるウィンドウ検索 |
| `src/main/utils/nativeWindowControl.ts` | ネイティブWindows API経由のウィンドウ制御 |
| `src/common/utils/windowConfigUtils.ts` | JSON⇔文字列変換、ウィンドウ設定の処理 |

**処理フロー:**

1. **itemHandlers.ts / workspaceHandlers.ts**
   - アイテム起動リクエストを受信
   - `tryActivateWindow()` を呼び出してウィンドウアクティブ化を試行
   - アクティブ化失敗時は `launchItem()` で通常起動

2. **windowActivator.ts**
   - ウィンドウ設定（WindowConfig）を受け取る
   - `findWindowByTitle()` でウィンドウを検索
   - ウィンドウが見つかった場合:
     - `restoreWindow()` で最小化を解除
     - `setWindowBounds()` で位置・サイズを設定
     - `activateWindow()` でウィンドウをアクティブ化
   - ウィンドウが見つからない場合は通常起動へフォールバック

3. **itemLauncher.ts**
   - アイテムタイプに応じた起動処理を統一
   - URL、ファイル、アプリ、カスタムURIをサポート
   - コマンドインジェクション対策を実装

4. **windowMatcher.ts**
   - ウィンドウタイトルによる検索
   - ワイルドカード検索: `*`（任意の文字列）、`?`（任意の1文字）
   - ワイルドカードなし → 完全一致、ワイルドカードあり → パターンマッチ
   - 大文字小文字を区別しない

5. **nativeWindowControl.ts**
   - Windows API（`SetWindowPos`, `ShowWindow`）を使用
   - 仮想スクリーン座標系でマルチモニタ対応

**リファクタリング成果（v0.5.4）:**
- 重複していたウィンドウ制御処理を `windowActivator.ts` に集約
- 重複していたアイテム起動処理を `itemLauncher.ts` に集約
- `itemHandlers.ts` と `workspaceHandlers.ts` で共通関数を使用
- コードの一貫性・保守性・テスタビリティが向上

### UI機能

**アイテム登録・編集画面（RegisterModal）:**

ウィンドウ設定は、アイテムの種別に応じて異なる形式で表示されます：

1. **単一アイテムのウィンドウ設定（オプション）:**
   - 折りたたみ表示（「オプション設定（ウィンドウ切り替え）」）
   - デフォルトで非表示、必要に応じて展開
   - ウィンドウが見つからない場合は通常起動を実行

2. **ウィンドウ操作アイテム（専用種別）:**
   - **常に展開表示**（折りたたみなし）
   - すべての設定項目が最初から表示される
   - ウィンドウが見つからない場合は何も実行しない（警告ログのみ）

**共通の設定項目:**
- ウィンドウタイトル入力欄（検索用、部分一致）
- 位置・サイズ調整（X座標、Y座標、幅、高さ）
- 仮想デスクトップ移動（デスクトップ番号）
- アクティブ化制御（チェックボックス）
- 「ウィンドウから取得」ボタン（実行中ウィンドウから情報取得）

**ウィンドウ選択ダイアログ（WindowSelectorModal）:**
- 実行中のウィンドウ一覧を表示
- ウィンドウを選択すると、タイトル・位置・サイズが自動入力される

詳細は **[アイテム登録・編集モーダル - ウィンドウ設定](../screens/register-modal.md#45-ウィンドウ設定を入力)** および **[ウィンドウ操作設定](../screens/register-modal.md#47-ウィンドウ操作設定を入力)** を参照してください。

### 仮想デスクトップ移動機能

**概要:**
仮想デスクトップ機能を使用して、ウィンドウを指定されたデスクトップに移動できます。

**動作仕様:**
1. `virtualDesktopNumber`フィールドに移動先のデスクトップ番号を指定（1から開始）
2. ウィンドウが見つかった場合、位置・サイズ調整の前に仮想デスクトップに移動
3. **現在のデスクトップは変更されません**（移動前のデスクトップに自動的に戻ります）
4. デスクトップ番号が範囲外の場合、警告ログを出力して移動をスキップ

**使用例:**
```
// デスクトップ2にウィンドウを移動
VSCode,code.exe,,,"{""title"":""Visual Studio Code"",""virtualDesktopNumber"":2}"

// デスクトップ3に移動し、位置・サイズも調整
Chrome,chrome.exe,,,"{""title"":""Google Chrome"",""virtualDesktopNumber"":3,""x"":100,""y"":100,""width"":1600,""height"":900}"

// デスクトップ1（左半分）+ デスクトップ2（右半分）で画面分割
VSCode (Desktop1),code.exe,,,"{""title"":""Visual Studio Code"",""virtualDesktopNumber"":1,""x"":0,""y"":0,""width"":960,""height"":1080}"
Chrome (Desktop2),chrome.exe,,,"{""title"":""Google Chrome"",""virtualDesktopNumber"":2,""x"":0,""y"":0,""width"":960,""height"":1080}"
```

**技術実装:**
- VirtualDesktopAccessor.dll（C++版、skottmckayフォーク）を使用
- koffiライブラリでネイティブDLL呼び出し
- レジストリから仮想デスクトップGUID一覧を取得し、番号からGUIDに変換

詳細は **[src/main/utils/virtualDesktopControl.ts](../../src/main/utils/virtualDesktopControl.ts)** を参照してください。

**v0.5.12以降の拡張機能:**

v0.5.12以降、仮想デスクトップ機能が大幅に強化され、以下の新機能が追加されました：

1. **全仮想デスクトップからウィンドウ検索**
   - `includeAllVirtualDesktops: true`パラメータで、すべての仮想デスクトップからウィンドウを検索可能
   - cloaked window（別デスクトップの非表示ウィンドウ）も検索対象に含む

2. **デスクトップ切り替えなしで位置・サイズ設定**
   - 別の仮想デスクトップにあるウィンドウに対して、デスクトップを切り替えずに位置・サイズを直接設定
   - ユーザーの現在の作業を中断しない
   - `SetWindowPos()` Win32 APIを使用して直接設定

3. **確実な設定反映**
   - リトライロジック（最大3回、100ms間隔）で確実に設定を反映
   - 設定失敗時は自動的に再試行

**処理フロー（v0.5.12以降）:**
```
1. includeAllVirtualDesktops: true で全仮想デスクトップからウィンドウを検索
2. ウィンドウが見つかったら、SetWindowPos()で位置・サイズを直接設定
   - 位置設定（x, y）
   - サイズ設定（width, height）
   - リトライ処理（最大3回、100ms間隔）
3. 現在のデスクトップは変更されない（ユーザーの作業を中断しない）
```

**実装場所:**
- `src/main/utils/virtualDesktopControl.ts`: `includeAllVirtualDesktops`パラメータの処理
- `src/main/utils/windowActivator.ts`: リトライロジックと位置・サイズ設定

**従来の動作との違い:**

| 項目 | v0.5.11以前 | v0.5.12以降 |
|-----|-----------|-----------|
| **検索範囲** | 現在のデスクトップのみ | すべての仮想デスクトップ |
| **デスクトップ切り替え** | ウィンドウのデスクトップに切り替え | 切り替えなし（現在のデスクトップを維持） |
| **位置・サイズ設定** | デスクトップ移動後に設定 | 直接設定（移動不要） |
| **ユーザー体験** | 画面が一瞬切り替わる | 作業を中断しない |
| **設定確実性** | 1回のみ試行 | 最大3回リトライ |

### ウィンドウアクティブ化制御

**概要:**
ウィンドウをアクティブ化（前面に表示）するかどうかを制御できます。

**動作仕様:**
- `activateWindow`フィールドで制御（省略時は`true`）
- `true`: ウィンドウをアクティブ化（前面に表示）【デフォルト】
- `false`: 位置・サイズ調整や仮想デスクトップ移動のみ実行、アクティブ化しない

**ユースケース:**
- バックグラウンドでウィンドウを準備したい場合
- 位置調整のみ行い、現在の作業を中断したくない場合
- 複数ウィンドウを順次配置する際、最後のウィンドウのみアクティブ化したい場合

**使用例:**
```
// 位置・サイズ調整のみ実行（アクティブ化しない）
Slack (Background),slack://,,,"{""title"":""Slack"",""x"":960,""y"":0,""width"":960,""height"":1080,""activateWindow"":false}"

// 仮想デスクトップ移動のみ実行（アクティブ化しない）
Teams,teams://,,,"{""title"":""Teams"",""virtualDesktopNumber"":2,""activateWindow"":false}"

// 明示的にアクティブ化を指定（デフォルトと同じ）
Chrome,chrome.exe,,,"{""title"":""Google Chrome"",""activateWindow"":true}"
```

### データ形式の変更履歴

**単一アイテムのウィンドウ設定:**

既存の`windowTitle`文字列形式は引き続きサポートされます。アプリケーション内部では自動的に`WindowConfig`形式に変換されます。

**ウィンドウ操作アイテム:**

v0.5.10以降、ウィンドウ操作アイテムはJSON形式専用となりました。

**JSON形式の利点:**
- フィールド順序エラー（設定値のズレ）を完全に解消
- 管理画面でのインライン編集を禁止し、データ破損を防止
- 詳細編集モーダル（RegisterModal）からの編集で、正しいJSON形式を保証

## 関連ドキュメント

- [アーキテクチャ概要](overview.md) - システム全体の構造
- [IPCチャンネル詳細](ipc-channels.md) - ウィンドウ制御関連のIPCチャンネル
- [データファイル形式](data-format.md) - ウィンドウ設定フィールドの仕様
- [アイテム登録・編集モーダル](../screens/register-modal.md) - ウィンドウ設定のUI
- [アプリケーション設定](../screens/admin-window.md#7-設定機能の詳細) - 設定画面へのアクセス方法