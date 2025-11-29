# データフロー

QuickDashLauncherのデータ処理フローを説明します。

## 初回起動フロー

1. アプリケーション起動時（`main.ts`）でホットキー設定の有無をチェック
   - `hotkey`が空の場合: 初回起動と判定し、`isFirstLaunch = true`を設定
   - `hotkey`に値がある場合: 通常起動
2. レンダラープロセスで`settings:is-first-launch` IPCを呼び出して初回起動かチェック
   - 初回起動の場合: 初回設定画面（`FirstLaunchSetup`）を表示
   - 通常起動の場合: メインウィンドウを表示
3. 初回設定画面でユーザーがホットキーを設定
4. 設定完了時:
   - `settings:set-multiple` IPCでホットキーを含む設定を保存
   - ホットキーが設定されると自動的に初回起動モードが解除される
   - `settings:change-hotkey` IPCでホットキーをグローバル登録
5. 初回設定画面を非表示、メインウィンドウに遷移

## 通常モード（表示・起動）

1. メインプロセスが`%APPDATA%/quickdashlauncher/config/`からデータファイルを読み込む
2. データファイル処理時に特殊な形式を自動変換
   - `dir,`フォルダ取込アイテム: 指定ディレクトリをスキャンしてファイル・フォルダを展開
     - デフォルト動作: 全てのファイルとフォルダをインポート（深さ0）
     - オプション指定可能: `depth`, `types`, `filter`, `exclude`, `prefix`
     - プレフィックス指定時は展開されるアイテム名に自動付与
   - 特定拡張子ファイル: .lnkファイルなどは自動的にターゲット情報を解析
3. パーサーが複数のデータファイルをマージし、重複を削除し、名前順でソート
4. レンダラーがリアルタイムフィルタリングでアイテムを表示
5. 検索クエリは履歴として`%APPDATA%/quickdashlauncher/config/history.csv`に保存（最大100件、重複は最新時刻で更新）
6. ユーザーアクションがシステム操作のためのIPCコールをメインプロセスにトリガー

## 編集モード（生データ編集）

1. 編集モード開始時にウィンドウサイズを自動拡大（1000x700px）
2. 編集モード中はフォーカスアウトでもウィンドウが非表示にならない
3. `load-raw-data-files`でデータファイルを展開せずに読み込み
4. `RawDataLine`型として行ごとにパース（種類：directive, item, comment, empty）
5. `EditableRawItemList`コンポーネントでテーブル形式表示
   - テーブル構成：`☑️ | # | 種類 | 名前 | パスと引数 | 操作`
   - 単一アイテム：名前列で表示名を個別編集可能、パスと引数列でパス＋引数を編集可能
   - フォルダ取込アイテム：名前列は編集不可（ハイフン表示）、パスと引数列でフォルダパス＋オプションを編集可能
6. ヘッダーに編集中のファイル名を表示
7. ユーザーが行の追加・削除・編集を実行
8. `save-raw-data-files`で変更内容をファイルに直接書き込み
9. 行番号の再採番とファイルバックアップを自動実行
10. **メイン画面への自動反映**: 以下の編集操作は即座にメインウィンドウに通知される
   - `update-item`: アイテム更新時に`notifyDataChanged()`を呼び出し
   - `update-raw-line`: 生データ行更新時に`notifyDataChanged()`を呼び出し
   - `delete-items`: アイテム削除時に`notifyDataChanged()`を呼び出し
   - `batch-update-items`: 一括更新時に`notifyDataChanged()`を呼び出し
   - メインウィンドウは`data-changed`イベントを受信してデータを再読み込み
11. 編集モード終了時にウィンドウサイズを元のサイズ（479x506px）に復元

## アイコン取得と進捗表示フロー

### 統合アイコン取得フロー
1. ユーザーがメインウィンドウの🔄ドロップダウンメニューから「🎨 アイコン取得」を選択
2. `App.tsx`の`handleFetchMissingIcons`が実行される
3. **アイテムのフィルタリング:**
   - URL型アイテム: `item.type === 'url' && !item.icon`
   - 非URL型アイテム: `!item.icon && item.type !== 'url' && item.type !== 'folder' && item.type !== 'group'`
4. **統合API呼び出し:**
   - `fetchIconsCombined`IPCに両方のリストを送信
   - メインプロセスで`CombinedProgressManager`を使用して複数フェーズを管理
5. **フェーズ1: ファビコン取得**
   - URL型アイテムを逐次処理
   - 各アイテム処理後に進捗イベント送信
   - タイムアウト設定: HTMLダウンロード10秒、ファビコンダウンロード5秒
6. **フェーズ2: アイコン抽出**
   - 非URL型アイテムを逐次処理
   - 各アイテム処理後に進捗イベント送信
     - app型: ショートカット（.lnk）または実行ファイル（.exe）からアイコン抽出
     - customUri型: レジストリからスキーマハンドラーアプリを特定しアイコン抽出
     - file型: 拡張子ベースでシステム関連付けアイコンを抽出
7. **進捗表示:**
   - `icon-progress-start`: 処理開始通知（統合進捗情報）
   - `icon-progress-update`: 各アイテム処理後の進捗更新通知（フェーズ別、アイテム名とパス/URLを含む）
   - `icon-progress-complete`: 処理完了通知（全フェーズの最終結果とエラー詳細）
8. レンダラープロセスで`useIconProgress`フックが進捗イベントを受信
9. `IconProgressBar`コンポーネントが統合進捗を表示
   - 基本表示: 全体進捗とフェーズ情報
   - 処理中アイテム表示: アイテム名とパス/URLを両方表示（改行区切り）
   - 詳細モーダル: クリックでフェーズ別詳細とエラー一覧を表示
10. 取得結果をレンダラーに返却、`mainItems`と`tempItems`を更新
11. 完了後3秒で進捗バーが自動非表示

**注:** フォルダとグループアイテムは処理対象から除外されます。

### 進捗データ構造
```typescript
IconProgress {
  currentPhase: number,            // 現在のフェーズ番号（1から開始）
  totalPhases: number,             // 総フェーズ数
  phases: IconPhaseProgress[],     // 各フェーズの進捗情報
  isComplete: boolean,             // 全体の処理が完了したかどうか
  startTime: number,               // 全体の処理開始時刻
  completedTime?: number           // 全体の処理完了時刻（完了後のみ設定）
}

IconPhaseProgress {
  type: 'favicon' | 'icon',        // 処理種別
  current: number,                 // 現在完了数
  total: number,                   // 総数
  currentItem: string,             // 処理中アイテム（アイテム名\nパス/URL形式）
  errors: number,                  // エラー数
  startTime: number,               // フェーズ開始時刻
  isComplete: boolean,             // フェーズ完了フラグ
  results?: IconProgressResult[]   // 処理結果の詳細リスト
}

IconProgressResult {
  itemName: string,                // アイテム識別情報（アイテム名\nパス/URL形式）
  success: boolean,                // 成功したかどうか
  errorMessage?: string,           // エラーメッセージ（失敗時のみ）
  type: 'favicon' | 'icon'         // 処理の種別
}
```

### 進捗表示UI仕様
- **表示位置**: メインウィンドウ下部（ItemListの下）
- **基本表示**: 統合進捗バー（全体進捗、現在フェーズ、プログレスバー）
  - 処理中アイテム表示: アイテム名とパス/URLを両方表示（改行区切り、80文字超で省略）
- **詳細モーダル**: クリックでフェーズ別の詳細情報とエラー一覧を表示
  - フェーズごとの進捗（処理済み数、成功・失敗件数）
  - エラー一覧（アイテム識別情報とエラーメッセージ、改行区切り）
  - テキスト選択可能（エラー情報のコピー）
- **非表示条件**: 処理完了後3秒で自動非表示
- **操作性**: 非モーダル設計により、進捗表示中も他の操作が継続可能

## コマンドヒストリー機能

### 履歴管理フロー
1. ユーザーが検索ボックスに入力して実行（Enter等）
2. 検索クエリを`%APPDATA%/quickdashlauncher/config/history.csv`に保存
   - CSV形式: `検索クエリ,実行時刻（ISO8601形式）`
   - 重複クエリは削除され、最新の実行時刻で更新
   - 最大100件を保持（古いものから自動削除）
3. Ctrl+↑/↓キーで履歴ナビゲート
   - 現在の検索ボックス内容を一時保存
   - 履歴を時系列順（新しいものから古いもの）で表示
   - Escapeキーまたは新規入力で履歴ナビゲートを終了

### データ構造
```typescript
HistoryEntry {
  query: string,      // 検索クエリ
  timestamp: string   // 実行時刻（ISO8601形式）
}
```

## 設定の即座反映フロー

**v1.0.0以降**: すべての設定変更が「保存」ボタンなしで即座に反映されます。

### 設定変更の処理フロー
1. ユーザーが管理ウィンドウの基本設定タブで設定を変更（例: タブ名、ホットキー、ウィンドウサイズ）
2. `handleSettingChange`関数が実行される
3. 新しい設定値で`settings:set-multiple` IPCを呼び出し
4. メインプロセスの`settingsHandlers.ts`で設定をJSON保存
5. **設定変更通知**: `notifySettingsChanged()`が実行され、`settings-changed`イベントを全ウィンドウに送信
6. メインウィンドウの`onSettingsChanged`リスナーが設定変更を検知
7. 設定を再読み込みして画面に反映（タブ名更新など）

### 対象設定項目
- グローバルホットキー
- ウィンドウサイズ（通常時・編集時）
- 自動起動設定
- バックアップ設定（有効/無効、タイミング、間隔、保存件数）
- タブ表示設定（表示/非表示、タブ名、デフォルトタブ、タブ順序）

### 即座反映の技術詳細
- **IPCイベント**: `settings-changed` - メインプロセスから全レンダラープロセスへブロードキャスト
- **プリロードAPI**: `onSettingsChanged(callback)` - レンダラーでのイベント購読
- **使用例**:
  ```typescript
  window.electronAPI.onSettingsChanged(async () => {
    const settings = await window.electronAPI.getSettings();
    setDataFileTabs(settings.dataFileTabs || [{ file: 'data.txt', name: 'メイン' }]);
    // その他の設定を反映
  });
  ```

### タブ名と順序の即座更新
1. 管理ウィンドウでタブ名入力欄にテキストを入力、または▲▼ボタンで順序を変更
2. `handleTabNameChange`または`handleTabOrderChange`が実行され、`dataFileTabs`配列を更新
3. `settings:set-multiple` IPCで設定保存
4. `settings-changed`イベントがメインウィンドウに送信
5. メインウィンドウのタブ名と順序がリアルタイムに更新される

### データ構造
```typescript
interface DataFileTab {
  file: string;  // データファイル名（例: 'data.txt', 'data2.txt'）
  name: string;  // タブに表示する名前（例: 'メイン', 'サブ1'）
}
```
配列の順序がそのままタブ表示順序になります。

### デフォルトタブ名
タブ名（`name`フィールド）が空文字列の場合、わかりやすいデフォルト名が表示されます：
- `data.txt` → 「メイン」
- `data2.txt` → 「サブ1」
- `data3.txt` → 「サブ2」
- `data4.txt` → 「サブ3」（以降同様）

## 関連ドキュメント

- [アーキテクチャ概要](overview.md) - システム全体の構造
- [IPCチャンネル詳細](ipc-channels.md) - 各IPCチャンネルの仕様
- [アイテム管理](../../manual/item-management.md) - 編集モードの詳細仕様
- [アイコンシステム](../../manual/icon-system.md) - アイコン取得・管理システム
- [アプリケーション設定](../../manual/app-settings.md) - 設定方法とトラブルシューティング
- [アプリケーション設定仕様](../settings-specification.md) - 設定項目の完全仕様