# ウィンドウ制御システム

## ウィンドウピン留めモード機能

### 概要

ウィンドウの表示動作を3段階で制御する機能です。📌ボタンをクリックするたびに、`normal` → `alwaysOnTop` → `stayVisible` → `normal` と循環的に切り替わります。

### ピン留めモードの種類

**通常モード (`normal`)**

- フォーカスが QDL のウィンドウ群（メイン・ワークスペース・切り離しウィンドウ）の外へ出ると自動的に非表示になります（[ウィンドウ非表示の判定](#ウィンドウ非表示の判定)）
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
- **型定義**: `src/common/types/settings.ts`で`WindowPinMode`型を定義
- **制御ロジック**:
  - ピン留めモードに応じてウィンドウのblurイベントで非表示制御
  - アイテム起動時、`normal`モードの場合のみウィンドウを非表示
- **UI制御**: レンダラーで固定ボタン（📌）の状態を管理

### アイテム起動時の動作制御

アイテム起動時のウィンドウ非表示動作は、ピン留めモードによって制御されます：

**実装場所**: `src/main/ipc/itemHandlers.ts`

各実行ハンドラは起動前に `hideMainWindowOnExecute()`（`src/main/windowManager.ts`）を呼びます。`normal` モード（初回起動モード・モーダルモードでない場合）のときだけ、起動先がフォーカスを奪うのを待たずにメインウィンドウを隠します。

- `normal`モード: アイテム起動時、ウィンドウを非表示
- `alwaysOnTop`/`stayVisible`モード: ウィンドウを表示したまま

この動作は以下の操作すべてに適用されます：

- 個別アイテムの起動 (`open-item`)
- 親フォルダを開く (`open-parent-folder`)
- セットの実行 (`execute-set`)
- ウィンドウ検索でのウィンドウの切り替え (`activate-window`)

## ウィンドウ表示制御

- **起動ホットキー**: 設定したホットキー（既定値は空。初回起動画面の初期値が `Alt+Space`）でウィンドウ表示/非表示
  - **非表示制限**: 以下の場合はホットキーでも非表示にできません
    - 初回起動モード
    - モーダルモード
    - ピン留めモードが`alwaysOnTop`または`stayVisible`の場合
  - **別の仮想デスクトップにあるとき**: 表示したまま別の仮想デスクトップへ移った（ピン留め中など）メインウィンドウは、ホットキー（「ウィンドウ検索で起動」のホットキーも）を押すと隠さずに今のデスクトップへ移して前に出す。表示するときも、別のデスクトップにあれば今のデスクトップへ移してから出す（`moveWindowToCurrentDesktop()`）。先に `focus()` すると Windows がメインウィンドウのあるデスクトップへ切り替えてしまうため、移すのが先
  - **実装場所**: `src/main/services/hotkeyService.ts`（ホットキーの登録と押したときの表示・非表示の切り替え。`handleHotkeyPressed()`）、`src/main/windowManager.ts`（`registerGlobalShortcut()` で表示・非表示の処理を渡す。`showMainWindow()`・`hideMainWindow()`）
- **フォーカスアウト**: `normal`モードの場合、フォーカスを失うと自動的に非表示
- **モーダルモード時のフォーカス制御**: メイン画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果）が開いている間はフォーカスアウトでもウィンドウが非表示にならない（下記「メイン画面の子ウィンドウ」）
- **Escapeキー**: 以下の場合を**除き**、Escapeキーで非表示可能
  - 初回起動モード
  - モーダルモード
  - ピン留めモードが`alwaysOnTop`または`stayVisible`の場合
  - ウィンドウ検索で選択中、または閉じる確認の帯を表示中（Esc をページに渡し、選択の解除・確認の取り消しに使う。レンダラーが `window:set-escape-handled-by-page` で知らせる。ページの読み直し（`did-start-loading`）・ページが落ちたとき（`render-process-gone`）は戻す）
  - **実装場所**: `src/main/windowManager.ts`（`createWindow()` 内の `before-input-event`）
- **システムトレイ**: ダブルクリックでウィンドウ表示、右クリックでメニュー表示
- **二重起動**: 同じ userData で動いている本体があるときに 2 つ目を起動すると、2 つ目はすぐに終了し、動いている側がメインウィンドウを表示する（`src/main/main.ts` の `second-instance` から `showMainWindow()`）。2 つ目が CLI（`qdl.exe`）から `--launched-by-cli` 付きで起動されたものなら表示しない。`QUICK_DASH_CONFIG_DIR` を指定した起動（E2E・`npm run dev:test`）は二重起動の防止の対象外

### ウィンドウ非表示時の処理フロー

ウィンドウが非表示になる際、レンダラープロセスに`window-hidden`イベントが送信されます。これにより、ウィンドウ非表示時に必要な前処理（タブのリセット、ウィンドウ検索モードのリセット等）を実行できます。

**処理フロー:**

1. ユーザーがホットキーを押下、またはフォーカスアウト等でウィンドウが非表示になる
2. メインプロセスの`hideMainWindowInternal()`が実行される（ホットキー・フォーカスアウト・Escape・アイテム実行の共通処理）
3. 非表示にする直前に、メインウィンドウのレンダラーへ`window-hidden`を送信
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
- 実装: `mainWindow.center()`を呼び出し

**2. 画面中央（自動切替）モード (`cursorMonitorCenter`)**

- デフォルトモードです
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
- 初回表示時（`windowPositionX=0, windowPositionY=0`の場合）と、保存した位置がどのモニターの作業領域にも入らないとき（モニターを外した後など）は画面中央に配置され、その位置が自動保存されます（`isPositionOnScreen()`、`src/main/utils/screenPosition.ts`）
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
2. **初回表示時・保存位置が画面外のとき**: `windowPositionX=0, windowPositionY=0`の場合、または保存位置がどのモニターの作業領域にも入らない場合、画面中央に配置後に位置を保存

### システムトレイメニュー

システムトレイアイコンを右クリックすると、以下のメニューが表示されます（表示言語を変えると、メニューもその言語で作り直す）：

1. **バージョン情報**: `QuickDashLauncher vX.X.X` - 現在のバージョンを動的に表示（選択不可）
2. **表示**: メインウィンドウを表示（設定されているホットキーも表示）
3. **画面中央に表示**: 設定に関係なく強制的に画面中央に表示
4. **設定...**: 管理ウィンドウの設定タブを開く
5. **設定フォルダを開く**: 設定フォルダをエクスプローラーで開く
6. **ヘルプ**: GitHubリポジトリをブラウザで開く
7. **再起動**: アプリケーションを再起動
   - **開発モード**: 警告ダイアログを表示（自動再起動非対応、手動で`npm run dev`を実行する必要がある）
   - **本番モード**: 通常の再起動を実行
8. **終了**: アプリケーションを終了

トレイアイコンをダブルクリックすると、メインウィンドウを表示する。

## IPC通信フロー

### ピン留めモードの切り替え

1. レンダラーが📌ボタンクリック → `cycle-window-pin-mode`
2. メインプロセスがピンモードを循環的に切り替え → `windowManager.cycleWindowPinMode()`
3. レンダラーが新しいピンモードを取得 → `get-window-pin-mode`
4. UIが新しいモードに応じて更新される

### ウィンドウ非表示の判定

- **blur イベント**: メイン・ワークスペース・切り離しウィンドウを 1 つのまとまり（ウィンドウ群）として扱い、フォーカスがウィンドウ群の外へ出たときだけ隠す（`windowManager.ts` の `app.on('browser-window-blur')`）
  - どのウィンドウの blur でも、50ms 後にフォーカスの移動先を確認する。移動先がメイン・ワークスペース・切り離しウィンドウ、またはそれらの子ウィンドウなら何もしない。管理ウィンドウ（設定画面）はウィンドウ群に含めない
  - 外へ出ていれば、メインウィンドウを隠す（`windowPinMode === 'normal'` で、初回起動モード・モーダルモードでなく、DevTools を開いていない場合のみ）。続けて `hideDetachedWithMainWindow` がオンなら、固定していない切り離しウィンドウも隠す。メインウィンドウが表示中でこれを隠さないモードのときは、切り離しウィンドウも残す（メインが既に隠れているときは、連動設定に従って切り離しウィンドウを隠す）
  - ワークスペースはこの連動では隠さない
  - メインウィンドウの表示から 200ms 以内の blur は、200ms を過ぎてから確認する（表示直後の一時的なフォーカスの揺れで隠れないため）
- **アイテム起動時**: `windowPinMode === 'normal'`の場合のみ非表示
- **モーダルモード時**: `isModalMode`フラグで判定 → 子ウィンドウが開いている間は非表示にしない

## メイン画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果）

メイン画面の「アイテムの登録・編集」（➕「アイテムを追加…」 / 右クリック「編集」/ ドラッグ&ドロップ / ワークスペースのアイテムの「メインウィンドウに登録」）と「アイコン取得結果」（進捗バーの詳細）は、メインウィンドウの中のモーダルではなく、独立した子ウィンドウで開きます（v0.7.38 以降）。

- **実装場所**: `src/main/mainChildWindowManager.ts`（メインプロセス。生成・表示・破棄はワークスペースの編集ウィンドウと共通の `src/main/utils/modalChildWindows.ts`）、`src/renderer/components/MainChildPage.tsx`・`RegisterWindowPage.tsx`（レンダラー）
- IPC `window:open-main-child`（要求 `MainChildWindowRequest`）を受け、メインウィンドウを親にした子ウィンドウを開く。子ウィンドウが閉じるまで解決しない
- 要求（何を表示するか。登録ならドロップしたパス・編集対象・新規登録の初期値にするアイテム（`prefillItems`）・今のタブ）はメインプロセスが requestId で預かり、子ウィンドウは `window.name`（`main-child:<requestId>`）から requestId を取り出して `window:get-main-child-request` で受け取る
- 位置はメインウィンドウと同じディスプレイの作業領域の中央、サイズは登録 850x900・アイコン取得結果 760x700 を作業領域で切り詰める（`utils/mainChildWindowSpec.ts`・`utils/editorWindowBounds.ts`）。**メインウィンドウのサイズ・位置は変えない**
- 親に対してモーダル（`parent` + `modal: true`）。閉じると破棄
- ワークスペースのアイテムをメインウィンドウに登録するときは、メインウィンドウのレンダラーが要求を出す。経路は次の 2 つで、どちらもアイテムを `prefillItems` に変換して `window:open-main-child` を呼ぶ（`src/renderer/hooks/useRegisterWindow.ts`）
  - ドラッグ&ドロップ: ドラッグ元が dataTransfer の型 `workspaceItem`（`WORKSPACE_ITEM_DRAG_TYPE`）に載せたアイテムの JSON を、メインウィンドウがファイル・URL より先に読む
  - 右クリックの「メインウィンドウに登録」: メインプロセスが `showMainWindow()` でメインウィンドウを出してから、`workspace-menu-register-to-main` イベントでアイテムを送る（登録画面はメインウィンドウを親にするため）
- 開いている間はメインウィンドウを**モーダルモード**にする（`windowManager.setModalMode(true)`）: フォーカスアウト・Escape・ホットキー・アイテム実行で隠れず、最前面に固定。閉じたら戻す
- 保存は子ウィンドウが `register-items` / `update-*-by-id` / `delete-items-by-id` で行い、メイン画面は `data-changed` で読み直す。結果（登録・更新・削除）は `window:notify-main-child-result` → `window:main-child-result` でメイン画面に中継され、メイン画面がトーストを出す
- 子ウィンドウはメインのレンダラーから `window.open` で開く（レンダラープロセス共有、[システム概要](overview.md#ウィンドウとレンダラープロセスの対応)）。開き元が使えないときは `index.html?childRequestId=` で直接生成する

以前は `set-modal-mode` でメインウィンドウを 850x1000（アイコン取得結果は 800x700）に広げて中央へ動かし、閉じると元のサイズに戻していた（位置は中央のまま。カーソル位置・固定位置の設定と食い違う）。管理ウィンドウの詳細編集・バックアップ一覧も同じ IPC を送っていたため、管理画面でモーダルを開くだけでメインウィンドウが動いていた。管理ウィンドウの詳細編集は、同じ子ウィンドウの仕組みで管理ウィンドウを親にして開く（下記）。バックアップ一覧などほかのモーダルは今もウィンドウ内に描くが、メインウィンドウには触らない。

### 管理画面の詳細編集

管理画面（アイテム管理）の ✏️ 詳細編集と、種類プルダウンで詳細編集が必要な種別を選んだときも、同じ登録・編集フォームを子ウィンドウで開きます（v0.7.39 以降）。

- 要求元が管理ウィンドウなら、管理ウィンドウを開き元（`window.open` するレンダラー）・親にする。メインウィンドウはモーダルモードにしない
- 要求に `returnToOpener: true` を付け、子ウィンドウは保存しない。「更新」でフォームの内容を `window:return-main-child-value` で預けて閉じ、`window:open-main-child` の戻り値として管理画面に返る。管理画面は未保存の編集状態に反映し、「変更を保存」で確定する
- 削除ボタンは出さない（管理画面の一覧で削除する）

## 管理ウィンドウ制御

### 実装場所

- **メインプロセス**: `src/main/adminWindowManager.ts`
- **レンダラー**: `src/renderer/AdminApp.tsx`

### タブ指定での表示機能

1. **メニューからのタブ指定**
   - 「設定」メニュー → `window.electronAPI.openEditWindowWithTab('settings')`（IPC → メインの `showAdminWindowWithTab()`）
   - 「アイテム管理」メニュー → `window.electronAPI.openEditWindowWithTab('edit')`（同上）

2. **タブ変更の通信フロー**
   - メインプロセスから`set-active-tab`イベントを送信
   - AdminAppがイベントを受信してタブを切り替え

3. **初期タブのリセット**
   - ウィンドウが非表示になるたびに初期タブをリセット
   - 次回開く際は指定されたタブが正しく表示される

### 管理ウィンドウのEscapeキー動作

管理ウィンドウでは、編集作業中の誤操作を防止するため、**Escapeキーでは閉じません**（Escape でウィンドウを隠す処理を持たない）。

Escape はページに届き、セル編集の取り消しや確認ダイアログを閉じるのに使います。切り離しウィンドウも同じです（v0.8.0 より前はメインプロセスで Escape を止めていたため、ページの中でも効かなかった）。

管理ウィンドウを閉じるには、以下の方法を使用します：

- ウィンドウ右上の閉じるボタン（×）をクリック
- メインウィンドウで再度 Ctrl+E を押す（表示/非表示の切り替え。Ctrl+E はメインウィンドウのキー操作なので、管理ウィンドウの中で押しても閉じない）

### 管理ウィンドウのIPC通信

表示・非表示・切り替え・タブを指定した表示と、初期タブの受け渡しを IPC で行う。チャンネルは `src/common/ipcChannels.ts` の `IPC_CHANNELS`（`*_EDIT_WINDOW`・`GET_INITIAL_TAB`・`EVENT_SET_ACTIVE_TAB` など）を参照。

## ワークスペースウィンドウ制御

### 実装場所

- **メインプロセス**: `src/main/workspaceWindowManager.ts`
- **レンダラー**: `src/renderer/WorkspaceApp.tsx`

### 生成と破棄

- アプリ起動時に、メインウィンドウ・トレイと並べて生成する。× で閉じても隠すだけで、破棄するのはアプリ終了時だけ
- よく開くウィンドウなので、開くたびに待たせないよう常駐させている。非表示が続いたら破棄する作り（管理ウィンドウなど）にはしない

### 別の仮想デスクトップにあるときの呼び寄せ

全仮想デスクトップに表示しない設定では、ワークスペースウィンドウが表示したまま別の仮想デスクトップに残ることがある。そのときは隠したり出し直したりせず、今のデスクトップへ移す（呼び寄せ。`moveWindowToCurrentDesktop()`）。

- **表示するとき**（メインウィンドウ表示時の自動表示を含む）: 別のデスクトップにあれば、今のデスクトップへ移してから出す。表示中のまま別のデスクトップにあると `show()` だけでは出てこないため。自動表示はフォーカスを奪わない（`showWorkspaceWindow()`）
- **`Ctrl+W` で切り替えるとき**: 表示したまま別のデスクトップにあれば、隠さずに今のデスクトップへ移して前に出す。隠すと、Windows がフォーカスの移り先のデスクトップへ切り替えてしまうことがあるため（`toggleWorkspaceWindow()`）
- 全仮想デスクトップに表示しているときは移さない（どのデスクトップにも出ているため）。全仮想デスクトップへの表示は、表示するたびに当て直す
- **実装場所**: `src/main/workspaceWindowManager.ts`、`src/main/utils/virtualDesktop/windowOperations.ts`

### アイテム編集ウィンドウ（独立した子ウィンドウ）

ワークスペースアイテムの「編集」は、ワークスペースウィンドウの中のモーダルではなく、独立した子ウィンドウで開きます（v0.7.37 以降）。

**実装場所**: `src/main/workspaceItemEditorWindowManager.ts`（`openWorkspaceItemEditor`）、`src/main/utils/modalChildWindows.ts`（生成・表示・破棄。メイン画面の子ウィンドウと共通）、`src/main/utils/editorWindowBounds.ts`（位置計算）、`src/renderer/components/WorkspaceItemEditPage.tsx`（中身）

- IPC `workspace:open-item-editor`（itemId）を受け、送信元（ワークスペース本体または切り離しウィンドウ）を親にした子ウィンドウを開く
- ワークスペースのレンダラーから `window.open` で開く（`childWindowService`。レンダラープロセス共有）。`window.name` は `workspace-editor:<itemId>` で、フォールバック時は URL クエリ `editItemId`
- 位置は開き元と同じディスプレイの作業領域の中央、サイズは 850x800 を作業領域で切り詰める。**開き元のウィンドウのサイズ・位置は変えない**
- 親に対してモーダル（`parent` + `modal: true`）。同じアイテムの編集が開いていれば前面に出す。閉じると破棄
- 保存は `workspace:update-item` で行い、変更通知でワークスペース側が読み直す。編集ウィンドウは `window.close()` するだけ

以前は `set-workspace-modal-mode` でワークスペースを 850x800 に広げ、x 座標をプライマリの右端に決め打ちしていたため、左端配置・別ディスプレイ・固定位置で位置がずれ、切り離しウィンドウからは本体が動いていた。

### 確認ウィンドウ（グループの削除・アーカイブ）

グループの削除・アーカイブの確認は、ワークスペースウィンドウの中のダイアログではなく、独立した子ウィンドウで行います（v0.7.39 以降）。ワークスペース本体・切り離しウィンドウのどちらから開いても同じです。

**実装場所**: `src/main/workspaceConfirmWindowManager.ts`（`openWorkspaceConfirm`）、`src/renderer/components/WorkspaceConfirmPage.tsx`（中身。`ConfirmDialog` をページとして描く）

- IPC `workspace:open-confirm`（要求 `ConfirmWindowRequest`: タイトル・文面・ボタン名・`danger`・チェックボックス）を受け、送信元を親にしたモーダルな子ウィンドウを同じディスプレイの中央に開く（520x320 を作業領域で切り詰める）。**開き元のウィンドウのサイズ・位置は変えない**
- ワークスペースのレンダラーから `window.open` で開く。`window.name` は `workspace-confirm:<requestId>` で、要求は `workspace:get-confirm-request` で受け取る（フォールバック時は URL クエリ `confirmRequestId`）
- 確定したら `workspace:return-confirm-result` で結果（チェックボックスの状態）を預けて閉じる。`workspace:open-confirm` は閉じたときに結果を返す。キャンセル・Escape・閉じたときは `null`
- 切り離しウィンドウから開いたとき、フォーカスが子ウィンドウへ移っても「メインと連動して隠す」で切り離しウィンドウが隠れないようにしている（アイテムの編集ウィンドウも同じ）

以前はワークスペースの中に `ConfirmDialog` を描き、収まらないときは `workspace:set-modal-mode` でウィンドウを 600x400 まで広げていた（閉じると戻す）。切り離しウィンドウでは確認ダイアログが描かれず、削除・アーカイブを選んでも何も起きなかった。

## ウィンドウ位置・サイズ制御

### 概要

アイテムにウィンドウ設定を追加することで、既存ウィンドウのアクティブ化と同時に位置・サイズの制御ができます。

### 機能概要

**基本動作（単一アイテム）:**

単一アイテムのウィンドウ切り替えは、アイテムを「セットの 1 行」として、セットと同じ処理（`executeLauncherItem`、`src/main/services/launch/setExecutor.ts`）で実行します。

1. アイテム起動前に、指定されたウィンドウ（タイトル・プロセス名）を検索
2. ウィンドウが見つかった場合: 位置の指定があれば移動・リサイズし、前面に出す（既定）。通常起動は実行しない
3. ウィンドウが見つからない場合: アイテムを起動する。位置の指定があれば、ウィンドウが出るのを待って（既定 30 秒）位置を合わせる。無ければ起動するだけ

パスの無い単一アイテム（`path` が空で `window` だけを持つ）は開くものが無いので、見つかったウィンドウに切り替えるだけで、見つからなければ何も起動しません。廃止した種別「ウィンドウ操作」（`type: "window"`）は、読み込み時にこの形へ変換します（[データファイル形式 3.4](file-formats/data-format.md#34-ウィンドウ操作廃止読み込み時に変換)）。

### データ形式

単一アイテムでは data.json のアイテムに、セットの行と同じキー（`window`・`placement`・`ifOpen`・`activateWindow`・`waitSeconds`）と `pinToAllDesktops` を書きます。

```json
{
  "id": "u1V2w3X4",
  "type": "item",
  "displayName": "VSCode",
  "path": "code.exe",
  "window": { "title": "Visual Studio Code" },
  "placement": { "x": 100, "y": 200, "width": 800, "height": 600 },
  "activateWindow": true
}
```

フィールド・既定値・例の正本は **[データファイル形式 - ウィンドウ切り替え](file-formats/data-format.md#315-ウィンドウ切り替えitemwindowswitch)** です。

### アクティブモニター中央への移動

`windowActivator.ts` は、内部のウィンドウ設定（`WindowConfig`）の `moveToActiveMonitorCenter` が true なら、マウスカーソルのあるモニターの作業領域の中央へウィンドウを動かす処理（x・y を中央の座標で置き換える）を今も持っています。ただし、これを書けるアイテムはありません。単一アイテムでは廃止し、旧形式の `windowConfig` とウィンドウ操作アイテムを変換するときに捨てます。

### マルチモニタ対応（固定座標指定）

座標系は仮想スクリーン座標（Virtual Screen Coordinates）を使用します。

**座標系の仕様:**

- プライマリモニターの左上が原点 (0, 0)
- セカンダリモニターは相対位置に配置
  - 例: プライマリが1920x1080、セカンダリが右側なら X=1920 から開始
- 負の座標も使用可能（プライマリの左側・上側にモニターがある場合）

**使用例（デュアルモニタ、固定座標）:**

- Chrome（セカンダリ全体）: `"window": { "title": "*Google Chrome" }, "placement": { "x": 1920, "y": 0, "width": 1920, "height": 1080 }`
- VSCode（プライマリの左半分）: `"window": { "title": "*Visual Studio Code" }, "placement": { "x": 0, "y": 0, "width": 960, "height": 1080 }`
- Slack（プライマリの右半分）: `"window": { "title": "*Slack" }, "placement": { "x": 960, "y": 0, "width": 960, "height": 1080 }`

### 実装詳細

**アーキテクチャ:**

アイテム起動時のウィンドウアクティブ化は、以下のモジュール構成で実装されています：

| モジュール | 役割 |
| --- | --- |
| `src/main/ipc/itemHandlers.ts` | アイテム起動のエントリーポイント |
| `src/main/ipc/workspaceHandlers.ts` | ワークスペースアイテム起動のエントリーポイント |
| `src/main/utils/windowActivator.ts` | ウィンドウ検索・アクティブ化・位置サイズ設定の一元管理 |
| `src/main/utils/itemLauncher.ts` | URL/ファイル/アプリ/カスタムURIの起動処理を統一 |
| `src/main/utils/windowMatcher.ts` | ウィンドウタイトルによるウィンドウ検索 |
| `src/main/utils/nativeWindowControl.ts` | ネイティブWindows API経由のウィンドウ制御 |

**処理フロー:**

1. **itemHandlers.ts / workspaceHandlers.ts**
   - アイテム起動リクエストを受信
   - 単一アイテムでウィンドウ切り替え（`window`）があれば、`executeLauncherItem()`（`setExecutor.ts`）でセットの 1 行として実行する。見つかれば `tryActivateWindow()`／`applyWindowConfig()` に `followDesktop` を付けて渡し、見つからなければ `launchItem()` で開く（位置があれば出てくるのを待って `applyWindowConfig()` を当てる）。うまくいかなかったときだけトーストで知らせる
   - ウィンドウ切り替えの無い単一アイテムは `launchItem()` で開くだけ
   - パスの無い単一アイテムも `executeLauncherItem()` で実行する（開くものの無い行として、見つかれば切り替え、無ければ何も開かない）

2. **windowActivator.ts**
   - ウィンドウ設定（WindowConfig）を受け取る
   - `findWindowByTitle()` でウィンドウを検索
   - ウィンドウが見つかった場合:
     - `restoreWindow()` で最小化を解除（最大化中は、位置・サイズを当てるときだけ戻す）
     - `setWindowBounds()` で位置・サイズを設定
     - 移す先のデスクトップ番号の指定が無く、呼び出し元が `followDesktop` を指定していれば（単一アイテムの実行。セットの実行は指定しない）、ウィンドウが別の仮想デスクトップにあるときそのデスクトップへ切り替える（`switchToWindowDesktop()`）
     - `activateWindow()` でウィンドウをアクティブ化
   - ウィンドウが見つからない場合は見つからなかったことを返す（開くかどうかは呼び出し元が決める）

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

### 仮想デスクトップ移動機能

**概要:**
仮想デスクトップ機能を使用して、ウィンドウを指定されたデスクトップに移動できます。

**動作仕様:**

1. `virtualDesktopNumber`フィールドに移動先のデスクトップ番号を指定（1から開始）
2. ウィンドウが見つかった場合、位置・サイズを当て、指定のデスクトップへ移し、移ったのを待ってから位置・サイズをもう一度当てる（移すと位置がずれることがあるため。位置・サイズの指定が無ければ移すだけ）
3. **現在のデスクトップは変更されません**（移動前のデスクトップに自動的に戻ります）
4. デスクトップ番号が範囲外の場合、エラーログを出力して移動をスキップ
5. 番号の指定が無いときは移さない。単一アイテムでウィンドウを前に出すとき、ウィンドウが別のデスクトップにあれば、そのデスクトップへ切り替える（全デスクトップに表示する指定のとき・セットの実行中は切り替えない）

**使用例:**

- デスクトップ2にウィンドウを移動: `{ "title": "Visual Studio Code", "virtualDesktopNumber": 2 }`
- デスクトップ3に移動し、位置・サイズも調整: `{ "title": "Google Chrome", "virtualDesktopNumber": 3, "x": 100, "y": 100, "width": 1600, "height": 900 }`

**技術実装:**

- VirtualDesktopAccessor.dll（Rust 版、Ciantic 版。`resources/native/`）を使用。デスクトップの作成・削除・名前の変更（`CreateDesktop`・`RemoveDesktop`・`SetDesktopName`）も公開しているが、今は使っていない
- koffiライブラリでネイティブDLL呼び出し
- デスクトップ番号（1 から）は DLL の 0 始まりの番号に直して渡す。レジストリは、仮想デスクトップが使えるかの判定と、DLL がデスクトップの数を返せないときの数の取得（GUID の数）にだけ使う
- DLL が読めない環境は、仮想デスクトップ非対応として扱う（ウィンドウ検索のデスクトップのタブ・移動のメニューを出さない）。DLL の関数が失敗（-1）を返したときは失敗として扱う

詳細は **[src/main/utils/virtualDesktop/](../../src/main/utils/virtualDesktop/)** を参照してください。

**別のデスクトップにあるウィンドウの扱い:**

- 単一アイテム・セットの実行で探すウィンドウは、すべての仮想デスクトップから探す（別のデスクトップにあって描画されていない（cloaked）ウィンドウも含む。`findWindowHwndByTitle()`、`src/main/utils/nativeWindowControl.ts`）。ウィンドウ検索の一覧は、呼び出し元が `includeAllVirtualDesktops` を指定したときだけ全デスクトップを含める
- 位置・サイズは、デスクトップを切り替えずに `SetWindowPos()` で直接当てる。当てたあと読み直して 5px 以内に収まっているかを確かめ、ずれていれば 50ms おきに最大 3 回やり直す（`setBoundsWithRetry()`）
- 移す先の番号の指定が無いままウィンドウを前に出すとき（単一アイテム）は、そのままでは見えないので、ウィンドウのあるデスクトップへ切り替える（上の「動作仕様」の 5）

**ウィンドウ設定を当てる処理（`applyWindowConfig()`）:**

- 見つけたウィンドウにウィンドウ設定を当てる本体。全デスクトップに表示、最小化（位置・サイズを当てるときは最大化も）の解除、位置・サイズ、仮想デスクトップへの移動、前面化の順に行う
- `tryActivateWindow()` はタイトル・プロセス名でウィンドウを探し、見つかればこれを呼ぶ（`src/main/services/launch/setExecutor.ts` が、位置の無い行で開いているウィンドウを前に出すときに使う）。位置のある行は、開くのを待つなどして自分で見つけたウィンドウを直接これに渡す
- 位置（x・y）を当てようとして最後まで当たらなかったとき（管理者権限で動くウィンドウなど）は、結果に `positionNotApplied` を付ける。位置を当てなかったとき・当たったときは付けない。大きさは見ない（大きさが固定のウィンドウを誤って失敗にしないため）。セットの実行はこれを見て、その行の結果を「ウィンドウを動かせませんでした（管理者権限で動くウィンドウなど）」にする
- **実装場所**: `src/main/utils/windowActivator.ts`

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

- 位置・サイズ調整のみ実行（アクティブ化しない）: `{ "title": "Slack", "x": 960, "y": 0, "width": 960, "height": 1080, "activateWindow": false }`
- 仮想デスクトップ移動のみ実行（アクティブ化しない）: `{ "title": "Teams", "virtualDesktopNumber": 2, "activateWindow": false }`

### システムウィンドウの除外

ウィンドウ検索・ウィンドウ選択の一覧と、単一アイテム・セットの実行で探すウィンドウから、次のシステムウィンドウを外す（`src/main/utils/nativeWindowControl.ts` の `EXCLUDED_WINDOWS`）。

| ウィンドウ | プロセス名 | クラス名 | 説明 |
| --- | --- | --- | --- |
| Windows入力エクスペリエンス | TextInputHost.exe | Windows.UI.Core.CoreWindow | IME・タッチキーボード等 |
| Windowsシェルエクスペリエンス | ShellExperienceHost.exe | Windows.UI.Core.CoreWindow | スタートメニュー・通知センター等 |
| デスクトップ壁紙 | explorer.exe | Progman | Program Manager（デスクトップ背景） |
| Windowsロック画面 | LockApp.exe | Windows.UI.Core.CoreWindow | ロック画面 |
| Windowsスタートメニュー | StartMenuExperienceHost.exe | Windows.UI.Core.CoreWindow | スタートメニュー |
| Windows検索 | SearchHost.exe | Windows.UI.Core.CoreWindow | 検索ウィンドウ |

- プロセス名とクラス名の**両方**が一致し、かつウィンドウがクロークされている（画面に描画されていない）ときだけ外す。描画されている間は一覧に出る（誤検知を防ぐため）
- これとは別に、QuickDashLauncher 自身のメインウィンドウとトースト（オーバーレイ）、タイトルのないウィンドウ、非表示のウィンドウ、Alt+Tab に出ないツールウィンドウも一覧に出ない

### データ形式の変更履歴

**単一アイテムのウィンドウ設定:**

CSV 形式（`data*.txt`）では 5 番目の列にウィンドウタイトルの文字列か JSON を書いていた。v0.6.1 で CSV を廃止し、`windowConfig` オブジェクトだけを読むようにした（文字列は受け付けない）。v0.8.0-beta.11 の後、セットの行と同じキー（`window`・`placement` など）に変え、`windowConfig` は読み込み時に 1 回だけ変換する（[データファイル形式 3.1.5.6](file-formats/data-format.md#3156-旧形式windowconfigからの変換)。検証は `validateJsonLauncherItem`、`src/common/utils/jsonParser.ts`）。

**ウィンドウ操作アイテム:**

v0.5.10以降、ウィンドウ操作アイテムはJSON形式専用となりました（CSV の列に JSON を書く形）。v0.6.1 からは data.json の `type: "window"` のアイテムでした。v0.8.0-beta.12 の後に種別を廃止し、読み込み時に 1 回だけパスの無い単一アイテムへ変換します（[データファイル形式 3.4](file-formats/data-format.md#34-ウィンドウ操作廃止読み込み時に変換)）。実行用の IPC（`execute-window-operation`・`update-window-item-by-id`）と編集部品 `WindowConfigEditor` も削除しました。

## 関連ドキュメント

- [アーキテクチャ概要](overview.md) - システム全体の構造
- [IPCチャンネル詳細](ipc-channels.md) - ウィンドウ制御関連のIPCチャンネル
- [データファイル形式](file-formats/data-format.md) - ウィンドウ設定フィールドの仕様
