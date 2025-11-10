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
  /** ショートカットファイル（.lnk）の元のパス（オプション） */
  originalPath?: string;
  /** アイテムの元データファイル */
  sourceFile?: 'data.txt' | 'data2.txt';
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
  /** アイテムの元データファイル */
  sourceFile?: 'data.txt' | 'data2.txt';
  /** データファイル内の行番号（編集機能で使用） */
  lineNumber?: number;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
}

/**
 * データファイル（data.txt、data2.txt）の内容を表すインターフェース
 * フォルダ取込アイテムの展開処理などで使用される
 */
export interface DataFile {
  /** ファイル名（data.txt、data2.txtのいずれか） */
  name: string;
  /** ファイルの内容（フォルダ取込アイテム展開後） */
  content: string;
}

/**
 * 生データ編集モードで使用される、データファイルの1行を表すインターフェース
 * 編集機能で各行の種別や元ファイルを管理するために使用される
 */
export interface RawDataLine {
  /** データファイル内の行番号（1から開始） */
  lineNumber: number;
  /** 行の内容（改行文字は含まない） */
  content: string;
  /** 行の種別（フォルダ取込アイテム、アイテム、コメント、空行） */
  type: 'directive' | 'item' | 'comment' | 'empty';
  /** この行が含まれる元のデータファイル */
  sourceFile: 'data.txt' | 'data2.txt';
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
 * アプリケーションの設定を管理するインターフェース
 * electron-storeを使用して永続化される
 */
export interface AppSettings {
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
}

/**
 * アイコン取得処理の進捗状況を表すインターフェース
 * リアルタイムでの進捗表示と処理状況の追跡に使用される
 */
export interface IconProgress {
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
