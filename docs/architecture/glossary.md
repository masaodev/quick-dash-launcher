# ドメイン用語集

QuickDashLauncherで使用されるドメイン用語の定義です。開発時の用語の揺れを防ぐために参照してください。

## 凡例

| 列名 | 説明 |
|------|------|
| 分類 | 用語のカテゴリ |
| 物理名 | コード上の型名・変数名・ファイル名 |
| 和名 | 日本語での正式名称 |
| UI表記 | アプリケーション画面上での表示 |
| 説明 | 用語の定義・役割・使用場所 |

---

## 用語一覧

| 分類 | 物理名 | 和名 | UI表記 | 説明 |
|------|--------|------|--------|------|
| アイテム | - | アイテム | アイテム | ランチャーで起動・操作できる対象の総称。ランチャーアイテム（単一起動）、グループアイテム（一括起動）、ウィンドウ操作アイテム（既存ウィンドウ制御）の3種類がある。メインウィンドウのアイテムリストに表示され、クリックまたはEnterキーで実行する。 |
| アイテム | `LauncherItem` | ランチャーアイテム | アイテム | 起動対象（URL/ファイル/フォルダ/アプリ/カスタムURI）を表す基本型。メインウィンドウのアイテムリストに表示される。`src/common/types/launcher.ts`で定義。 |
| アイテム | `GroupItem` | グループアイテム | グループ | 複数アイテムをまとめて一括起動するアイテム。GroupDirectiveで定義。実行すると参照アイテムを500ms間隔で順次起動。 |
| アイテム | `WindowOperationItem` | ウィンドウ操作アイテム | ウィンドウ操作 | 既存ウィンドウを検索・制御するアイテム。WindowDirectiveで定義。アプリを起動せずウィンドウのみ操作。 |
| アイテム | `AppItem` | アプリアイテム | - | `LauncherItem \| GroupItem \| WindowOperationItem \| WindowInfo`の統合型。アイテムリスト表示時に使用。 |
| アイテム | `WorkspaceItem` | ワークスペースアイテム | - | ワークスペースに追加されたアイテムの独立コピー。元アイテムが削除されても影響を受けない。WorkspaceFileに保存。 |
| アイテム | `RegisterItem` | 登録アイテム | - | アイテム登録・編集時に使用される型。`RegisterModal`や`useRegisterForm`で使用。`src/common/types/register.ts`で定義（v0.5.20で型定義を再配置）。 |
| 登録項目 | `displayName` | アイテム名 | アイテム表示名 | メインウィンドウのアイテムリストに表示される名前。`RegisterItem.displayName`および`LauncherItem.displayName`で使用。ユーザーが自由に設定可能。 |
| 登録項目 | `path` | 起動パス | パス/URL | 起動対象を指定するパスまたはURL。ファイルパス、フォルダパス、HTTPS URL、カスタムURIなど。`RegisterItem.path`および`LauncherItem.path`で使用。この値から自動的にItemTypeが検出される。 |
| 登録種別 | `ItemCategory` | アイテム登録種別 | 登録種別 | アイテム登録画面での「種別」選択。`RegisterItem.itemCategory`で使用。ユーザーが登録方法を選択する。<br>値:<br>• `item` - 単一アイテム（1つのアイテムを個別に登録）<br>• `dir` - フォルダ取込（フォルダ内のファイルを一括登録）<br>• `group` - グループ（複数アイテムをまとめて一括起動）<br>• `window` - ウィンドウ操作（既存ウィンドウを検索・制御）<br><br>**ItemTypeとの違い**: ItemCategoryは「登録方法」、ItemTypeは「実行方法」を表す。例: itemCategory='item'かつtype='url'は「単一アイテムとしてURLを登録」を意味する。 |
| アイテムタイプ | `ItemType` | アイテム実行タイプ | - | アイテムの実行方法を表す列挙型。`LauncherItem.type`で使用。パスから自動検出され、起動時の動作を決定する。<br>値:<br>• `url` - URL（HTTPまたはHTTPS URL、デフォルトブラウザで開く）<br>• `file` - ファイル（実行ファイル・ドキュメント等、関連付けされたアプリで開く）<br>• `folder` - フォルダ（ディレクトリ、エクスプローラーで開く）<br>• `app` - アプリケーション（実行可能ファイル、直接実行）<br>• `customUri` - カスタムURI（`obsidian://`、`vscode://`等の独自スキーマ）<br><br>**注**: GroupItemやWindowOperationItemは独自のtype値を持つため、ItemTypeには含まれない。 |
| データファイル | `DataFile` | データファイル | - | アイテム定義を保存するファイル（data.json, data2.json, data3.json等）。JSON形式で記述し、items配列にアイテムを定義する。`%APPDATA%/quick-dash-launcher/config/`に配置。data.jsonは必須で削除不可。`PathManager.getDataFilePath()`でdata.jsonのパス取得。タブ表示で切り替え可能。 |
| データファイル | `RawDataLine` | 生データ行 | - | データファイルの1行を表す内部型。管理画面のアイテム編集で使用。`src/common/types/data.ts`で定義。 |
| データファイル | `DataFileTab` | データファイルタブ | タブ | 複数データファイルをグループ化したタブ設定。設定画面で編集可能。 |
| ディレクティブ | - | ディレクティブ | - | データファイル内で特殊な処理を指示するアイテムの総称。各アイテムの`type`フィールドで識別される。フォルダ取込（`type: "dir"`）、グループ（`type: "group"`）、ウィンドウ操作（`type: "window"`）の3種類がある。 |
| ディレクティブ | `DirDirective` | フォルダ取込ディレクティブ | フォルダ取込 | 指定フォルダ内のアイテムを自動取込するディレクティブ。`JsonDirItem`（`type: "dir"`）として定義。内部処理で`isDirDirective()`、`parseDirDirective()`を使用。 |
| ディレクティブ | `GroupDirective` | グループディレクティブ | グループ | 複数アイテムをグループ化するディレクティブ。`JsonGroupItem`（`type: "group"`）として定義。内部処理で`isGroupDirective()`、`parseGroupDirective()`を使用。 |
| ディレクティブ | `WindowDirective` | ウィンドウ操作ディレクティブ | ウィンドウ操作 | ウィンドウ検索・制御を定義するディレクティブ。`JsonWindowItem`（`type: "window"`）として定義。内部処理で`isWindowOperationDirective()`を使用。 |
| 行タイプ | `LineType` | 行タイプ | - | データファイルの行の種別を表す列挙型。`RawDataLine.type`で使用。内部処理で維持。<br>値:<br>• `directive` - ディレクティブ行（`type: "dir"/"group"/"window"`に対応）<br>• `item` - アイテム行（`type: "item"`に対応）<br>• `comment` - コメント行（内部互換性のみ）<br>• `empty` - 空行（内部互換性のみ） |
| ワークスペース | - | ワークスペース機能 | ワークスペース | よく使うアイテムを整理・保存する機能の総称。メインウィンドウとは独立したウィンドウで表示される。アイテムをグループ分けして管理でき、ドラッグ&ドロップで整理できる。データファイルのアイテムとは独立したコピーとして保存される。 |
| ワークスペース | `Workspace` | ワークスペース | ワークスペース | ワークスペース機能の作業領域。ワークスペースウィンドウに表示される。 |
| ワークスペース | `WorkspaceGroup` | ワークスペースグループ | グループ | ワークスペース内のアイテムをグループ化。色分け・折りたたみ可能。 |
| ワークスペース | `ExecutionHistoryItem` | 実行履歴アイテム | 履歴 | メインウィンドウでの実行履歴。最大10件保持。ワークスペースウィンドウの履歴セクションに表示。 |
| ワークスペース | `ArchivedWorkspaceGroup` | アーカイブグループ | - | アーカイブされたグループ。WorkspaceArchiveFileに保存。復元可能。 |
| ワークスペース | `ArchivedWorkspaceItem` | アーカイブアイテム | - | アーカイブされたアイテム。グループと一緒にアーカイブ・復元される。 |
| ワークスペース | `WorkspaceFile` | ワークスペースファイル | - | ワークスペースのアイテム・グループを保存するファイル（workspace.json）。items配列とgroups配列を持つ。`%APPDATA%/quick-dash-launcher/config/`に配置。`PathManager.getWorkspaceFilePath()`でパス取得。 |
| ワークスペース | `ExecutionHistoryFile` | 実行履歴ファイル | - | 実行履歴を保存するファイル（execution-history.json）。最大10件、古いものから自動削除。`ExecutionHistoryService`で管理。 |
| ワークスペース | `WorkspaceArchiveFile` | アーカイブファイル | - | アーカイブされたグループ・アイテムを保存するファイル（workspace-archive.json）。復元時に参照。`WorkspaceService`で管理。 |
| ウィンドウ | `WindowInfo` | ウィンドウ情報 | - | ウィンドウ検索機能で取得されるウィンドウの情報。hwnd、タイトル、位置、サイズ等を含む。`src/common/types/window.ts`で定義。 |
| ウィンドウ | `WindowConfig` | ウィンドウ設定 | - | アイテム起動時のウィンドウ制御設定。`LauncherItem.windowConfig`で使用。タイトル検索と位置・サイズ制御を定義。 |
| ウィンドウ | `WindowState` | ウィンドウ状態 | - | ウィンドウの表示状態を表す列挙型。`WindowInfo.windowState`で使用。<br>値:<br>• `normal` - 通常<br>• `minimized` - 最小化<br>• `maximized` - 最大化 |
| ウィンドウ | `WindowPinMode` | ウィンドウ固定モード | 固定モード | メインウィンドウの固定状態。タイトルバーのピンアイコンで切り替え。設定に保存されない（セッション中のみ）。<br>値:<br>• `normal` - 通常モード（フォーカスが外れたら非表示）<br>• `alwaysOnTop` - 常に最上面モード（常に最上面に表示、他ウィンドウより前面）<br>• `stayVisible` - 表示固定モード（フォーカスが外れても表示継続、他ウィンドウの背面に隠れる可能性あり） |
| ウィンドウ | `WindowPositionMode` | ウィンドウ表示位置モード | 表示位置 | メインウィンドウの表示位置設定。設定画面の「表示位置」で変更。<br>値:<br>• `center` - 画面中央（プライマリモニターの中央、デフォルト）<br>• `cursor` - カーソル位置（マウスカーソル中心）<br>• `cursorMonitorCenter` - カーソルモニター中央（カーソルがあるモニターの中央）<br>• `fixed` - 固定位置（手動で移動した位置を記憶、`windowPositionX/Y`に座標保存） |
| ウィンドウ | `WorkspacePositionMode` | ワークスペース表示位置モード | 表示位置 | ワークスペースウィンドウの表示位置設定。設定画面で変更。<br>値:<br>• `primaryLeft` - プライマリディスプレイの左端<br>• `primaryRight` - プライマリディスプレイの右端（デフォルト）<br>• `fixed` - 固定位置（手動で移動した位置を記憶、`workspacePositionX/Y`に座標保存） |
| 検索 | - | アイテム検索機能 | - | メインウィンドウの検索ボックスで行う絞り込み機能の総称。通常検索（アイテム）、ウィンドウ検索（実行中ウィンドウ）、履歴検索（実行履歴）の3モードがある。検索ボックス左のアイコンまたはショートカットキーでモードを切り替える。 |
| 検索 | `SearchMode` | 検索モード | - | 検索ボックスの動作モード。`src/common/types/search.ts`で定義。検索ボックス左のアイコンで切り替え。<br>値:<br>• `normal` - 通常検索（データファイルのアイテムを検索、デフォルト）<br>• `window` - ウィンドウ検索（実行中ウィンドウを検索、`Ctrl+W`で切り替え）<br>• `history` - 履歴検索（実行履歴から検索、`Ctrl+H`で切り替え） |
| 検索 | `SearchHistoryEntry` | 検索履歴エントリ | - | 検索クエリと実行日時のペア。上下キーで履歴を遡れる。 |
| 検索 | `SearchHistoryState` | 検索履歴状態 | - | 検索履歴のリストと現在のインデックス。キーボードナビゲーション用。 |
| 設定 | `AppSettings` | アプリケーション設定 | 設定 | 全設定項目を管理するインターフェース。`electron-store`で永続化。`src/common/types/settings.ts`で定義。 |
| 設定 | `hotkey` | ホットキー | ホットキー | グローバルホットキー。デフォルト`Alt+Space`。設定画面で変更可能。 |
| 設定 | `autoLaunch` | 自動起動 | 自動起動 | Windows起動時に自動起動するか。設定画面のチェックボックスで切り替え。 |
| 設定 | `backupEnabled` | バックアップ有効 | バックアップ | バックアップ機能の有効/無効。設定画面で変更。 |
| D&D | `DragItemData` | ドラッグアイテムデータ | - | ドラッグ中のアイテム情報。`workspace-item`/`history-item`/`group`の3種類。`src/common/types/workspace.ts`で定義。 |
| D&D | `DropTargetData` | ドロップターゲットデータ | - | ドロップ先の種別と識別子。`group`/`item`/`uncategorized`の3種類。 |
| 画面 | - | 画面 | - | アプリケーションのウィンドウの総称。メインウィンドウ（ホットキーで表示）、ワークスペースウィンドウ（アイテム整理）、管理ウィンドウ（設定・アイテム管理）の3種類がある。 |
| 画面 | `MainWindow` | メインウィンドウ | - | ホットキーで表示されるメイン画面。検索ボックスとアイテムリストを持つ。`src/renderer/App.tsx`で実装。 |
| 画面 | `WorkspaceWindow` | ワークスペースウィンドウ | ワークスペース | ワークスペース専用ウィンドウ。メインウィンドウとは独立。`src/renderer/Workspace.tsx`で実装。 |
| 画面 | `AdminWindow` | 管理ウィンドウ | 管理 | 設定・アイテム管理画面。メインウィンドウの歯車アイコンから開く。`src/renderer/Admin.tsx`で実装。 |
| 画面 | `RegisterModal` | 登録モーダル | - | アイテム登録・編集ダイアログ。メインウィンドウ・管理画面から開く。新規登録と編集の両方に対応。 |
| 画面 | `DirOptionsEditor` | フォルダ取込オプションエディタ | フォルダ取込オプション | フォルダ取込の詳細設定コンポーネント。RegisterModal内で使用。depth、types、filter等を設定。 |

---

## 用語使用ガイドライン

### コード内での使用

- **型名・インターフェース名**: 英語の物理名をそのまま使用（例: `LauncherItem`）
- **変数名**: キャメルケースで物理名を使用（例: `launcherItem`, `groupItems`）
- **コメント**: 和名を使用（例: `// ランチャーアイテムを取得`）

### ドキュメント内での使用

- **技術ドキュメント**: 和名を基本とし、初出時に物理名を併記（例: ランチャーアイテム（`LauncherItem`））
- **ユーザー向けドキュメント**: UI表記または和名を使用

### UI上での使用

- **ボタン・ラベル**: UI表記を使用（簡潔な表現を優先）
- **ツールチップ・ヘルプ**: 和名または詳細な説明を使用

---

## 関連ドキュメント

- **[データ形式仕様](data-format.md)** - データファイルの詳細仕様
- **[システム概要](overview.md)** - アーキテクチャの全体像
- **[コンポーネント命名規則](component-naming.md)** - コンポーネントの命名規則
