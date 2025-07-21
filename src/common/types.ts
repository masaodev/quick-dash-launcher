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
  /** 実行時のコマンドライン引数（オプション） */
  args?: string;
  /** ショートカットファイル（.lnk）の元のパス（オプション） */
  originalPath?: string;
  /** アイテムの元データファイル */
  sourceFile?: 'data.txt' | 'data2.txt' | 'tempdata.txt';
  /** データファイル内の行番号（編集機能で使用） */
  lineNumber?: number;
  /** フォルダ取込ディレクティブによって展開されたアイテムかどうか */
  isDirExpanded?: boolean;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
}

/**
 * データファイル（data.txt、data2.txt、tempdata.txt）の内容を表すインターフェース
 * フォルダ取込ディレクティブの展開処理などで使用される
 */
export interface DataFile {
  /** ファイル名（data.txt、data2.txt、tempdata.txtのいずれか） */
  name: string;
  /** ファイルの内容（フォルダ取込ディレクティブ展開後） */
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
  /** 行の種別（フォルダ取込ディレクティブ、アイテム、コメント、空行） */
  type: 'directive' | 'item' | 'comment' | 'empty';
  /** この行が含まれる元のデータファイル */
  sourceFile: 'data.txt' | 'data2.txt' | 'tempdata.txt';
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
  /** グローバルホットキー（デフォルト: 'Ctrl+Alt+W'） */
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
  /** アイコンの表示サイズ（デフォルト: 24） */
  iconSize: number;
  /** ウィンドウの最大表示アイテム数（デフォルト: 10） */
  maxVisibleItems: number;
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
