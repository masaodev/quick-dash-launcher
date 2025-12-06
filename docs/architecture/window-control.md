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

### ウィンドウ表示位置制御

ホットキーでウィンドウを表示する際、設定に応じて表示位置を制御します。

#### 表示位置モード

ウィンドウの表示位置は`windowPositionMode`設定によって以下の3つのモードから選択できます：

**1. 画面中央モード (`center`)**
- ウィンドウを常に画面中央に配置します
- デフォルトモードです
- 実装: `mainWindow.center()`を呼び出し

**2. マウスカーソル位置モード (`cursor`)**
- ウィンドウをマウスカーソルの位置が検索入力欄付近に来るように配置します
- カーソル位置がウィンドウの左上から右へ100px、下へ40px付近（検索入力欄の位置）に来るように計算されます
- 画面外にはみ出さないように自動的に位置調整が行われます
- マルチモニター環境では、カーソルがあるモニターの作業領域（タスクバーを除く領域）内に配置されます
- 実装: `screen.getCursorScreenPoint()`でカーソル位置を取得し、オフセット（X: 100px, Y: 40px）を考慮してウィンドウ位置を計算

**3. 固定位置モード (`fixed`)**
- ユーザーが手動で移動した位置を記憶して、次回も同じ位置に表示します
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
7. **終了**: アプリケーションを終了（`app.quit()`）

詳細は [アプリケーション設定](../features/settings.md#システムトレイメニュー) を参照してください。

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

## 関連ドキュメント

- [アーキテクチャ概要](overview.md) - システム全体の構造
- [IPCチャンネル詳細](ipc-channels.md) - ウィンドウ制御関連のIPCチャンネル
- [アプリケーション設定](../features/settings.md) - 設定画面へのアクセス方法