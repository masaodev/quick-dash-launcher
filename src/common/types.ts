/**
 * ランチャーアプリケーションで表示・実行されるアイテムの基本インターフェース
 * ファイル、アプリケーション、URL、フォルダなど様々なタイプのアイテムに対応
 */
export interface LauncherItem {
  /** アイテムの表示名 */
  name: string;
  /** アイテムのパス、URL、またはコマンド */
  path: string;
  /** アイテムのタイプ（URL、ファイル、フォルダ、アプリケーション、カスタムURI） */
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  /** アイテムのアイコン（base64エンコードされたデータURL、オプション） */
  icon?: string;
  /** カスタムアイコンのファイル名（custom-iconsフォルダ内の相対パス、オプション） */
  customIcon?: string;
  /** 実行時のコマンドライン引数（オプション） */
  args?: string;
  /** ショートカットファイル（.lnk）のリンク先のパス（オプション） */
  originalPath?: string;
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用） */
  lineNumber?: number;
  /** フォルダ取込アイテムによって展開されたアイテムかどうか */
  isDirExpanded?: boolean;
  /** フォルダ取込アイテムから展開された場合の元ディレクトリパス */
  expandedFrom?: string;
  /** フォルダ取込アイテムから展開された場合のオプション情報（人間が読める形式） */
  expandedOptions?: string;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
}

/**
 * 複数のアイテムをまとめて一括起動するためのグループアイテム
 * 既存のアイテム名を参照して、順次実行する
 */
export interface GroupItem {
  /** グループの表示名 */
  name: string;
  /** アイテムタイプ（常に'group'） */
  type: 'group';
  /** グループ内で参照するアイテム名のリスト */
  itemNames: string[];
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用） */
  lineNumber?: number;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
}

/**
 * ワークスペースのグループ
 * アイテムを論理的にグループ化して整理する
 */
export interface WorkspaceGroup {
  /** グループの一意識別子（UUID） */
  id: string;
  /** グループ名 */
  name: string;
  /** グループの色（CSS変数名またはカラーコード） */
  color: string;
  /** 並び順（0から開始） */
  order: number;
  /** 折りたたみ状態（true: 折りたたみ） */
  collapsed: boolean;
  /** 作成日時（timestamp） */
  createdAt: number;
}

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
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
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
  /** グループラベル（将来的な拡張用、廃止予定） */
  label?: string;
}

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
  itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'group';
  /** アイテムのアイコン（base64エンコードされたデータURL、オプション） */
  icon?: string;
  /** 実行時のコマンドライン引数（オプション） */
  args?: string;
  /** 実行日時（timestamp） */
  executedAt: number;
}

/**
 * 生データ編集モードで使用される、データファイルの1行を表すインターフェース
 * 編集機能で各行の種別や元のデータファイルを管理するために使用される
 */
export interface RawDataLine {
  /** データファイル内の行番号（1から開始） */
  lineNumber: number;
  /** 行の内容（改行文字は含まない） */
  content: string;
  /** 行の種別（フォルダ取込アイテム、アイテム、コメント、空行） */
  type: 'directive' | 'item' | 'comment' | 'empty';
  /** 元のデータファイル */
  sourceFile: string;
  /** カスタムアイコンのファイル名（custom-iconsフォルダ内の相対パス、オプション） */
  customIcon?: string;
}

/**
 * ブックマークインポート機能で使用される、シンプルなブックマークアイテムのインターフェース
 * HTMLブックマークファイルから抽出されたブックマーク情報を表す
 */
export interface SimpleBookmarkItem {
  /** ブックマークの一意識別子 */
  id: string;
  /** ブックマークの表示名 */
  name: string;
  /** ブックマークのURL */
  url: string;
  /** インポート時の選択状態 */
  checked: boolean;
}

/**
 * ブラウザのプロファイル情報
 * Chrome/Edgeの各プロファイルを表す
 */
export interface BrowserProfile {
  /** プロファイルID（フォルダ名: 'Default', 'Profile 1' 等） */
  id: string;
  /** プロファイルの表示名（Preferencesから取得） */
  name: string;
  /** ブックマークファイルの絶対パス */
  bookmarkPath: string;
}

/**
 * インストール済みブラウザの情報
 * ブラウザの検出結果とプロファイル一覧を保持
 */
export interface BrowserInfo {
  /** ブラウザの識別子 */
  id: 'chrome' | 'edge';
  /** ブラウザの表示名 */
  name: string;
  /** インストールされているかどうか */
  installed: boolean;
  /** 検出されたプロファイルのリスト */
  profiles: BrowserProfile[];
}

/**
 * アプリケーションの設定を管理するインターフェース
 * electron-storeを使用して永続化される
 */
export interface AppSettings {
  /** この設定ファイルを作成したアプリバージョン（初回作成時のみ記録） */
  createdWithVersion?: string;
  /** この設定ファイルを最後に更新したアプリバージョン */
  updatedWithVersion?: string;
  /** グローバルホットキー（デフォルト: 'Alt+Space'） */
  hotkey: string;
  /** ウィンドウの初期幅（デフォルト: 600） */
  windowWidth: number;
  /** ウィンドウの初期高さ（デフォルト: 400） */
  windowHeight: number;
  /** 編集モード時のウィンドウ幅（デフォルト: 1000） */
  editModeWidth: number;
  /** 編集モード時のウィンドウ高さ（デフォルト: 700） */
  editModeHeight: number;
  /** アプリの自動起動設定 */
  autoLaunch: boolean;
  /** バックアップ機能の有効/無効（デフォルト: false） */
  backupEnabled: boolean;
  /** アプリ起動時のバックアップ（デフォルト: false） */
  backupOnStart: boolean;
  /** データ編集時のバックアップ（デフォルト: false） */
  backupOnEdit: boolean;
  /** 最小バックアップ間隔（分）（デフォルト: 5） */
  backupInterval: number;
  /** バックアップファイルの保存件数上限（デフォルト: 20） */
  backupRetention: number;
  /** タブ表示の有効/無効（デフォルト: false） */
  showDataFileTabs: boolean;
  /** デフォルトで表示するタブ（タブ表示ON時のみ有効、デフォルト: 'data.txt'） */
  defaultFileTab: string;
  /** データファイルタブの設定（ファイル名リスト、タブ名、表示順序） */
  dataFileTabs: DataFileTab[];
  /** データファイルの名前定義（物理ファイル名 → データファイル名） */
  dataFileLabels: Record<string, string>;
  /** ウィンドウ表示位置モード（デフォルト: 'center'） */
  windowPositionMode: WindowPositionMode;
  /** 固定位置のX座標（windowPositionMode='fixed'時に使用、デフォルト: 0） */
  windowPositionX: number;
  /** 固定位置のY座標（windowPositionMode='fixed'時に使用、デフォルト: 0） */
  windowPositionY: number;
}

/**
 * データファイルタブの設定項目
 */
export interface DataFileTab {
  /** データファイル名のリスト（例: ['data.txt'], ['data2.txt', 'data3.txt']） */
  files: string[];
  /** タブに表示する名前（例: 'メイン', 'サブ1'） */
  name: string;
}

/**
 * アイコン処理結果の詳細情報
 */
export interface IconProgressResult {
  /** アイテム名またはURL */
  itemName: string;
  /** 成功したかどうか */
  success: boolean;
  /** エラーメッセージ（失敗時のみ） */
  errorMessage?: string;
  /** 処理の種別（ファビコン取得またはアイコン抽出） */
  type: 'favicon' | 'icon';
}

/**
 * 単一フェーズの進捗情報
 */
export interface IconPhaseProgress {
  /** 処理の種別（ファビコン取得またはアイコン抽出） */
  type: 'favicon' | 'icon';
  /** 現在処理完了したアイテム数 */
  current: number;
  /** 処理対象の総アイテム数 */
  total: number;
  /** 現在処理中のアイテム名またはURL */
  currentItem: string;
  /** エラーが発生したアイテム数 */
  errors: number;
  /** 処理開始時刻（ミリ秒） */
  startTime: number;
  /** 処理が完了したかどうか */
  isComplete: boolean;
  /** 処理結果の詳細リスト */
  results?: IconProgressResult[];
}

/**
 * アイコン取得処理の統合進捗状況を表すインターフェース
 * 複数フェーズ（ファビコン取得 + アイコン抽出）の進捗を一括管理する
 */
export interface IconProgress {
  /** 現在のフェーズ番号（1から開始） */
  currentPhase: number;
  /** 総フェーズ数 */
  totalPhases: number;
  /** 各フェーズの進捗情報 */
  phases: IconPhaseProgress[];
  /** 全体の処理が完了したかどうか */
  isComplete: boolean;
  /** 全体の処理開始時刻（ミリ秒） */
  startTime: number;
  /** 全体の処理完了時刻（ミリ秒、完了時のみ設定） */
  completedTime?: number;
}

/**
 * アイコン取得進捗状態の管理用インターフェース
 * React コンポーネント内での状態管理に使用される
 */
export interface IconProgressState {
  /** 進捗処理がアクティブかどうか */
  isActive: boolean;
  /** 現在の進捗情報 */
  progress: IconProgress | null;
}

/**
 * ウィンドウの固定モードを表す列挙型
 * 3段階のモードを循環的に切り替え可能
 */
export type WindowPinMode =
  | 'normal' // 通常モード: フォーカスが外れたら非表示、最上面ではない
  | 'alwaysOnTop' // 常に最上面モード: 常に最上面に表示、フォーカスが外れても非表示にならない
  | 'stayVisible'; // 表示固定モード: 最上面ではないが、フォーカスが外れても非表示にならない

/**
 * ウィンドウの表示位置モードを表す列挙型
 */
export type WindowPositionMode =
  | 'center' // 画面中央に表示
  | 'cursor' // マウスカーソルの位置に表示
  | 'cursorMonitorCenter' // カーソルのモニター中央に表示
  | 'fixed'; // 固定位置に表示（手動で移動した位置を記憶）

/**
 * 検索履歴のエントリーを表すインターフェース
 * ユーザーが実行時に入力した検索クエリと実行日時を保持する
 */
export interface SearchHistoryEntry {
  /** 検索クエリ文字列 */
  query: string;
  /** 実行日時（ISO文字列形式） */
  timestamp: string;
}

/**
 * 検索履歴の状態管理用インターフェース
 * キーボードナビゲーションでの履歴巡回に使用される
 */
export interface SearchHistoryState {
  /** 履歴エントリーのリスト（最新が先頭） */
  entries: SearchHistoryEntry[];
  /** 現在選択中の履歴インデックス（-1は履歴を使用していない状態） */
  currentIndex: number;
}

/**
 * アプリケーションで扱うすべてのアイテムの統合型
 * 通常のLauncherItemとGroupItemの両方を扱える
 */
export type AppItem = LauncherItem | GroupItem;

/**
 * アプリケーション情報を表すインターフェース
 * package.jsonから取得される基本情報
 */
export interface AppInfo {
  /** アプリケーションのバージョン番号 */
  version: string;
  /** アプリケーション名 */
  name: string;
  /** アプリケーションの説明 */
  description: string;
  /** 作者名 */
  author: string;
  /** ライセンス種別 */
  license: string;
  /** GitHubリポジトリURL */
  repository: string;
}

/**
 * ドラッグ&ドロップで転送されるデータの型
 * ワークスペース内のアイテム、実行履歴、グループのドラッグを型安全に扱う
 */
export type DragItemData =
  | { type: 'workspace-item'; itemId: string; currentGroupId?: string }
  | { type: 'history-item'; historyItem: LauncherItem }
  | { type: 'group'; groupId: string };

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
