import { WindowInfo } from './window';

/**
 * ウィンドウ制御の設定情報
 * アイテム起動時のウィンドウ検索・位置・サイズ制御に使用
 */
export interface WindowConfig {
  /** ウィンドウタイトル（検索用、必須） */
  title: string;
  /** X座標（仮想スクリーン座標系、省略時は位置変更なし） */
  x?: number;
  /** Y座標（仮想スクリーン座標系、省略時は位置変更なし） */
  y?: number;
  /** 幅（省略時はサイズ変更なし） */
  width?: number;
  /** 高さ（省略時はサイズ変更なし） */
  height?: number;
  /** 仮想デスクトップ番号（1から開始、省略時は移動なし、Windows 10以降） */
  virtualDesktopNumber?: number;
  /** ウィンドウをアクティブにするかどうか（省略時はtrue） */
  activateWindow?: boolean;
}

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
  /** ウィンドウタイトル検索用の文字列（設定時、起動前にウィンドウ検索を実行）
   * @deprecated windowConfigを使用してください。後方互換性のため残されています
   */
  windowTitle?: string;
  /** ウィンドウ制御設定（ウィンドウ検索・位置・サイズ制御） */
  windowConfig?: WindowConfig;
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
 * ウィンドウ操作アイテム
 * 既存のウィンドウを検索・アクティブ化し、位置・サイズを制御する
 */
export interface WindowOperationItem {
  /** アイテムタイプ（常に'windowOperation'） */
  type: 'windowOperation';
  /** アイテムリストでの表示名 */
  name: string;
  /** ウィンドウタイトル（検索用、必須） */
  windowTitle: string;
  /** X座標（仮想スクリーン座標系、省略時は位置変更なし） */
  x?: number;
  /** Y座標（仮想スクリーン座標系、省略時は位置変更なし） */
  y?: number;
  /** 幅（省略時はサイズ変更なし） */
  width?: number;
  /** 高さ（省略時はサイズ変更なし） */
  height?: number;
  /** 仮想デスクトップ番号（1から開始、省略時は移動なし、Windows 10以降） */
  virtualDesktopNumber?: number;
  /** ウィンドウをアクティブにするかどうか（省略時はtrue） */
  activateWindow?: boolean;
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用） */
  lineNumber?: number;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
}

/**
 * アプリケーションで扱うすべてのアイテムの統合型
 * 通常のLauncherItem、GroupItem、WindowOperationItem、WindowInfo（ウィンドウ検索結果）を扱える
 */
export type AppItem = LauncherItem | GroupItem | WindowOperationItem | WindowInfo;
