# システム概要

QuickDashLauncherのアーキテクチャ概要とデータフローを説明します。

## プロセス構造

| プロセス | 場所 | 役割 |
|---------|------|------|
| **メインプロセス** | `src/main/main.ts` | システム操作、ウィンドウ管理、IPC処理 |
| **レンダラープロセス** | `src/renderer/` | UIのためのReactアプリケーション |
| **プリロードスクリプト** | `src/main/preload.ts` | レンダラーに限定的なAPIを公開するセキュアブリッジ |
| **共通型定義** | `src/common/types/` | プロセス間で共有される型定義（機能別に分割） |

---

## サービスクラス構造

アプリケーションの主要機能は`src/main/services/`のサービスクラスで実装：

| サービス | 役割 | パターン |
|---------|------|---------|
| `SettingsService` | アプリケーション設定の読み書き・管理 | シングルトン |
| `HotkeyService` | 起動ホットキーの登録・変更 | シングルトン |
| `BackupService` | データファイルのスナップショット保存・復元 | シングルトン |
| `AutoLaunchService` | Windows起動時の自動起動設定 | シングルトン |
| `FaviconService` | ファビコン・アイコンの取得・キャッシュ管理 | 通常クラス |
| `SearchHistoryService` | 検索履歴の保存・読み込み | 通常クラス |
| `WorkspaceService` | ワークスペースアイテム・グループの管理 | シングルトン |
| `ClipboardService` | クリップボードの内容のキャプチャ・保存・復元 | シングルトン |
| `BookmarkAutoImportService` | ルールに基づくブックマーク自動インポート | シングルトン |
| `IconService` | アイテムタイプに応じた適切なアイコン取得処理 | 関数群（モジュール） |
| `IconFetchErrorService` | アイコン取得エラーの記録・管理 | シングルトン |
| `NotificationService` | システム通知・トースト通知の表示管理 | 関数群（モジュール） |
| `ToastWindowService` | トースト専用ウィンドウの管理 | 通常クラス |

**設計原則:**
- シングルトンパターン: `getInstance()`で取得
- 関数群モジュール: モジュール内の関数を直接呼び出し
- 単一責任の原則に従う
- 重複したロジックを一箇所に集約（DRY原則）

### ワークスペースサービスの内部構造

`WorkspaceService`は単一責務の原則に従い、以下のマネージャーに分割されています（`src/main/services/workspace/`）:

| クラス | 役割 |
|-------|------|
| `WorkspaceItemManager` | アイテムの追加・削除・更新・並び替え |
| `WorkspaceGroupManager` | グループの作成・更新・削除・並び替え |
| `WorkspaceArchiveManager` | グループのアーカイブ・復元・削除 |
| `WorkspaceService` | 上記マネージャーを統合するファサード |

---

## IPCハンドラー構造

IPCハンドラーは機能ごとに分離（`src/main/ipc/`）:

| ハンドラー | 役割 |
|-----------|------|
| `settingsHandlers.ts` | 設定の取得・更新・ホットキー変更 |
| `configHandlers.ts` | 設定フォルダーへのアクセス・外部URL開く |
| `dataHandlers.ts` | データファイルの読み込み・保存・ブックマーク解析 |
| `itemHandlers.ts` | アイテムの起動・フォルダー表示・グループ実行 |
| `iconHandlers.ts` | ファビコン取得・アイコン抽出・カスタムアイコン管理 |
| `bookmarkHandlers.ts` | ブラウザブックマークのインポート |
| `appImportHandlers.ts` | スタートメニューのアプリスキャン・インポート |
| `bookmarkAutoImportHandlers.ts` | ブックマーク自動取込ルールの管理と実行 |
| `backupHandlers.ts` | スナップショットバックアップの管理・リストア |
| `windowHandlers.ts` | ウィンドウ固定化・編集モード・モーダルモード制御 |
| `historyHandlers.ts` | 検索履歴の読み書き |
| `editHandlers.ts` | アイテム編集（更新・削除・一括更新） |
| `splashHandlers.ts` | スプラッシュウィンドウ制御 |
| `workspaceHandlers.ts` | ワークスペースアイテム・グループの操作 |
| `windowSearchHandlers.ts` | ウィンドウ検索（ウィンドウ一覧取得・アクティブ化） |
| `notificationHandlers.ts` | システム通知・トースト通知の表示 |
| `contextMenuHandlers.ts` | ネイティブコンテキストメニュー（ランチャー、ワークスペース、管理画面） |
| `clipboardHandlers.ts` | クリップボードのキャプチャ・確認・セッション管理 |

詳細は[IPCチャンネル](ipc-channels.md)を参照。

---

## ユーティリティモジュール構造

共通処理は再利用可能なユーティリティモジュールとして実装（`src/main/utils/`）:

| モジュール | 役割 | 使用箇所 |
|-----------|------|----------|
| `windowActivator.ts` | ウィンドウ検索・アクティブ化・位置サイズ設定の一元管理 | `itemHandlers.ts`, `workspaceHandlers.ts` |
| `itemLauncher.ts` | URL/ファイル/アプリ/カスタムURIの起動処理を統一 | `itemHandlers.ts`, `workspaceHandlers.ts` |
| `windowMatcher.ts` | ウィンドウタイトルによるウィンドウ検索 | `windowActivator.ts` |
| `nativeWindowControl.ts` | ネイティブWindows API経由のウィンドウ制御 | `windowActivator.ts` |
| `virtualDesktop/` | 仮想デスクトップ制御の機能別モジュール群 | `windowActivator.ts`, `windowSearchHandlers.ts` |

### virtualDesktopモジュールの内部構造

仮想デスクトップ制御は単一責務の原則に従い分割されています（`src/main/utils/virtualDesktop/`）:

| モジュール | 役割 |
|-----------|------|
| `dllLoader.ts` | Windows DLLの動的ロード（koffi経由） |
| `guidUtils.ts` | GUID文字列とバイナリの相互変換 |
| `registryAccess.ts` | レジストリからの仮想デスクトップ情報取得 |
| `windowOperations.ts` | ウィンドウの仮想デスクトップ所属判定 |
| `types.ts` | 型定義とデバッグログ |
| `index.ts` | 公開API（統合エントリーポイント） |

**設計原則:**
- **DRY（Don't Repeat Yourself）**: 重複コードを共通関数に集約
- **単一責任の原則**: 各モジュールは明確に定義された単一の責任を持つ
- **型安全性**: TypeScriptの型システムを活用した安全な実装
- **テスタビリティ**: 独立したモジュールとして単体テストが容易

---

## 共通ユーティリティ構造

プロセス間で共有されるユーティリティ（`src/common/utils/`）:

| モジュール | 役割 |
|-----------|------|
| `directiveUtils.ts` | ディレクティブ（group, dir, window）の判定と解析 |
| `dataConverters.ts` | データ形式変換（dirオプション解析等、v0.5.20で型定義を`types/register.ts`に移動） |
| `windowConfigUtils.ts` | ウィンドウ設定のJSON⇔文字列変換 |
| `itemTypeDetector.ts` | パスからアイテムタイプを自動検出 |
| `pathUtils.ts` | パス操作の共通処理 |
| `historyConverters.ts` | 履歴データの形式変換処理 |

## 共通型定義の構造

型定義は機能別に分割され、`src/common/types/`に配置されています（v0.5.20で再編成）:

| モジュール | 役割 |
|-----------|------|
| `index.ts` | すべての型をエクスポートする統合ポイント |
| `launcher.ts` | ランチャーアイテム関連（`LauncherItem`, `AppItem`, `ClipboardItem`等） |
| `json-data.ts` | JSONデータファイル関連（`JsonDataFile`, `JsonLauncherItem`等） |
| `data.ts` | データファイルタブ関連（`DataFileTab`, `DEFAULT_DATA_FILE`） |
| `register.ts` | 登録アイテム関連（`RegisterItem`, `WindowOperationConfig`） |
| `guards.ts` | 型ガード関数（`isWindowInfo`, `isLauncherItem`, `isGroupItem`等） |
| `workspace.ts` | ワークスペース関連（`WorkspaceItem`, `WorkspaceGroup`, `DragItemData`等） |
| `window.ts` | ウィンドウ関連（`WindowInfo`, `VirtualDesktopInfo`, `WindowState`） |
| `settings.ts` | 設定関連（`AppSettings`, `WindowPinMode`, `WindowPositionMode`等） |
| `search.ts` | 検索関連（`SearchHistoryEntry`, `SearchHistoryState`, `SearchMode`） |
| `clipboard.ts` | クリップボード関連（`SerializableClipboard`, `ClipboardFormat`等） |
| `icon.ts` | アイコン関連（`IconProgressResult`, `IconFetchErrorRecord`等） |
| `bookmark.ts` | ブックマーク関連（`SimpleBookmarkItem`, `BrowserProfile`等） |
| `bookmarkAutoImport.ts` | ブックマーク自動取込関連（`BookmarkAutoImportRule`, `BookmarkAutoImportSettings`等） |
| `backup.ts` | バックアップ関連（`SnapshotInfo`, `BackupStatus`） |
| `appImport.ts` | アプリインポート関連（`ScannedAppItem`, `AppScanResult`） |
| `toast.ts` | トースト通知関連（`ToastItemType`） |
| `app.ts` | アプリケーション情報関連（`AppInfo`） |
| `editingItem.ts` | 編集中アイテム関連（`EditingLauncherItem`, `EditingGroupItem`等） |
| `editableItem.ts` | 編集可能JSONアイテム関連（`EditableJsonItem`, `ValidationResult`等） |

各ファイルは対応するドメインの型のみを定義し、`index.ts`が統合エクスポートポイントとして全型を再エクスポートします。

---

## 設定・パス管理

環境変数とファイルパスは専用モジュールで一元管理（`src/main/config/`）:

| モジュール | 役割 |
|-----------|------|
| `pathManager.ts` | ファイルパス管理（設定フォルダ、データファイル、キャッシュ等） |
| `envConfig.ts` | 環境変数の一元管理（`QUICK_DASH_*`） |

**PathManager**はシングルトンパターンで、アプリケーション全体で一貫したパスを提供します。

---

## データ処理システム

### 設計原則

- **一元化された処理**: 同種のデータは共通の処理関数で統一的に処理
- **拡張可能性**: 新しいファイル形式やデータソースを容易に追加可能
- **エラー処理**: 単一アイテム処理エラーがシステム全体に影響しない設計

### 処理パターン

| パターン | 説明 |
|---------|------|
| ディレクトリベース | `dir,パス`形式でディレクトリ内容を動的に取得 |
| ファイル変換 | 特定の拡張子ファイルを実行可能な形式に自動変換 |
| 直接指定 | 明示的に指定されたパスをそのまま使用 |

### データ変換の仕組み

- **入力**: 多様な形式（ディレクトリパス、ショートカットファイル、実行ファイル等）
- **処理**: ファイル種別に応じた適切な解析・変換処理
- **出力**: 統一されたJSON形式（LauncherItem構造）

---

## データフロー

### 初回起動フロー

1. アプリケーション起動時に`hotkey`設定の有無をチェック
2. `hotkey`が空 → 初回設定画面を表示
3. ユーザーがホットキーを設定 → 設定保存 → メインウィンドウに遷移

### 通常モード（表示・起動）

1. メインプロセスが`%APPDATA%/quick-dash-launcher/config/`からデータファイルを読み込む
2. 特殊形式を自動変換（`dir,`フォルダ取込、`.lnk`ショートカット等）
3. パーサーがマージ・重複削除・ソート
4. レンダラーがリアルタイムフィルタリングで表示
5. ユーザーアクションがIPCコールをトリガー

### 編集モード（生データ編集）

1. 編集モード開始時にウィンドウサイズを自動拡大
2. `load-editable-items`でデータファイルをJSON形式で読み込み
3. テーブル形式コンポーネントで編集可能に表示
4. ユーザーが行の追加・削除・編集を実行
5. `save-editable-items`で変更内容をファイルに書き込み
6. `data-changed`イベントでメインウィンドウに自動反映

### 設定の即座反映フロー（v1.0.0以降）

1. ユーザーが設定を変更
2. `settings:set-multiple` IPCで設定保存
3. `settings-changed`イベントを全ウィンドウに送信
4. 各ウィンドウが設定を再読み込みして画面に反映

### アイコン取得フロー

1. 🔄メニューから「🎨 アイコン取得」を選択
2. `fetchIconsCombined` IPCで統合API呼び出し
3. **フェーズ1**: ファビコン取得（URL型アイテム）
4. **フェーズ2**: アイコン抽出（EXE、カスタムURI等）
5. 進捗イベントでリアルタイム表示
6. 完了後3秒で進捗バー自動非表示

### コマンドヒストリー機能

1. 検索実行時にクエリを`search-history.json`に保存（最大100件）
2. Ctrl+↑/↓キーで履歴ナビゲート
3. 重複クエリは最新時刻で更新

### ワークスペースフロー

1. ランチャーウィンドウ内で`Ctrl+W`でワークスペースウィンドウを表示
2. アイテム追加方法:
   - メイン画面のアイテムを右クリック → 「ワークスペースに追加」
   - ファイル・フォルダをドラッグ&ドロップ
   - クリップボードからペースト（`Ctrl+V`）- v0.5.1以降
3. `WorkspaceService`がアイテムをworkspace.jsonに保存
4. ワークスペースウィンドウでグループ管理・名前変更・並び替え
5. アイテム起動時に実行履歴（`ExecutionHistoryItem`）がワークスペースデータに記録（最大10件）
6. 実行履歴からワークスペースへドラッグ&ドロップでコピー可能

---

## 関連ドキュメント

- [IPCチャンネル](ipc-channels.md) - 各IPCチャンネルの仕様
- [ウィンドウ制御](window-control.md) - ウィンドウ管理システム
- [ファイル形式一覧](file-formats/README.md) - すべてのファイル形式の概要
- [データファイル形式](file-formats/data-format.md) - data.json仕様
- [ワークスペースファイル形式](file-formats/workspace-format.md) - workspace.json仕様
- [設定ファイル形式](file-formats/settings-format.md) - config.json仕様
- [CSSデザインシステム](css-design.md) - スタイル管理
