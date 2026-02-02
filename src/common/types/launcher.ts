import { WindowInfo } from './window';
import type { ClipboardFormat } from './clipboard';

/**
 * ウィンドウ制御の設定情報
 * アイテム起動時のウィンドウ検索・位置・サイズ制御に使用
 *
 * ワイルドカード検索:
 * - タイトルにワイルドカード文字（*または?）が含まれている場合、ワイルドカードマッチングを実行
 *   - `*`: 任意の0文字以上の文字列
 *   - `?`: 任意の1文字
 * - ワイルドカード文字が含まれていない場合、完全一致検索を実行
 * - 大文字小文字は区別しない
 */
export interface WindowConfig {
  /** ウィンドウタイトル（検索用、必須） */
  title: string;
  /** プロセス名で検索（部分一致、省略時は検索なし） */
  processName?: string;
  /** X座標（仮想スクリーン座標系、省略時は位置変更なし） */
  x?: number;
  /** Y座標（仮想スクリーン座標系、省略時は位置変更なし） */
  y?: number;
  /** 幅（省略時はサイズ変更なし） */
  width?: number;
  /** 高さ（省略時はサイズ変更なし） */
  height?: number;
  /** アクティブモニター（マウスカーソルがあるモニター）の中央に移動するかどうか（省略時はfalse） */
  moveToActiveMonitorCenter?: boolean;
  /** 仮想デスクトップ番号（1から開始、省略時は移動なし、Windows 10以降） */
  virtualDesktopNumber?: number;
  /** ウィンドウをアクティブにするかどうか（省略時はtrue） */
  activateWindow?: boolean;
  /** 全仮想デスクトップにピン止めするかどうか（省略時はfalse） */
  pinToAllDesktops?: boolean;
}

/**
 * ランチャーアプリケーションで表示・実行されるアイテムの基本インターフェース
 * ファイル、アプリケーション、URL、フォルダなど様々なタイプのアイテムに対応
 */
export interface LauncherItem {
  /** アイテムの表示名 */
  displayName: string;
  /** アイテムのパス、URL、またはコマンド */
  path: string;
  /** アイテムのタイプ（URL、ファイル、フォルダ、アプリケーション、カスタムURI、クリップボード） */
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'clipboard';
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
  /** データファイル内の行番号（編集機能で使用、非推奨：IDベースアクセスを推奨） */
  lineNumber?: number;
  /** JSONアイテムのID（JSON形式の場合） */
  id?: string;
  /** フォルダ取込アイテムによって展開されたアイテムかどうか */
  isDirExpanded?: boolean;
  /** フォルダ取込アイテムから展開された場合の元ディレクトリパス */
  expandedFrom?: string;
  /** フォルダ取込アイテムから展開された場合のオプション情報（人間が読める形式） */
  expandedOptions?: string;
  /** フォルダ取込アイテムから展開された場合の元のdirディレクティブID */
  expandedFromId?: string;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
  /** ウィンドウ制御設定（ウィンドウ検索・位置・サイズ制御） */
  windowConfig?: WindowConfig;
  /** 自由記述メモ（オプション） */
  memo?: string;
  /** クリップボードデータファイルへの参照（クリップボードアイテムのみ） */
  clipboardDataRef?: string;
  /** クリップボードの保存フォーマット（クリップボードアイテムのみ） */
  clipboardFormats?: ClipboardFormat[];
  /** クリップボードの保存日時（クリップボードアイテムのみ） */
  clipboardSavedAt?: number;
}

/**
 * 複数のアイテムをまとめて一括起動するためのグループアイテム
 * 既存のアイテム名を参照して、順次実行する
 */
export interface GroupItem {
  /** グループの表示名 */
  displayName: string;
  /** アイテムタイプ（常に'group'） */
  type: 'group';
  /** グループ内で参照するアイテム名のリスト */
  itemNames: string[];
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用、非推奨：IDベースアクセスを推奨） */
  lineNumber?: number;
  /** JSONアイテムのID（JSON形式の場合） */
  id?: string;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
  /** 自由記述メモ（オプション） */
  memo?: string;
}

/**
 * ウィンドウ操作アイテム
 * 既存のウィンドウを検索・アクティブ化し、位置・サイズを制御する
 *
 * ワイルドカード検索:
 * - windowTitleにワイルドカード文字（*または?）が含まれている場合、ワイルドカードマッチングを実行
 *   - `*`: 任意の0文字以上の文字列
 *   - `?`: 任意の1文字
 * - ワイルドカード文字が含まれていない場合、完全一致検索を実行
 * - 大文字小文字は区別しない
 */
export interface WindowItem {
  /** アイテムタイプ（常に'window'） */
  type: 'window';
  /** アイテムリストでの表示名 */
  displayName: string;
  /** ウィンドウタイトル（検索用、必須） */
  windowTitle: string;
  /** プロセス名で検索（部分一致、省略時は検索なし） */
  processName?: string;
  /** X座標（仮想スクリーン座標系、省略時は位置変更なし） */
  x?: number;
  /** Y座標（仮想スクリーン座標系、省略時は位置変更なし） */
  y?: number;
  /** 幅（省略時はサイズ変更なし） */
  width?: number;
  /** 高さ（省略時はサイズ変更なし） */
  height?: number;
  /** アクティブモニター（マウスカーソルがあるモニター）の中央に移動するかどうか（省略時はfalse） */
  moveToActiveMonitorCenter?: boolean;
  /** 仮想デスクトップ番号（1から開始、省略時は移動なし、Windows 10以降） */
  virtualDesktopNumber?: number;
  /** ウィンドウをアクティブにするかどうか（省略時はtrue） */
  activateWindow?: boolean;
  /** 全仮想デスクトップにピン止めするかどうか（省略時はfalse） */
  pinToAllDesktops?: boolean;
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用、非推奨：IDベースアクセスを推奨） */
  lineNumber?: number;
  /** JSONアイテムのID（JSON形式の場合） */
  id?: string;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
  /** 自由記述メモ（オプション） */
  memo?: string;
}

/**
 * クリップボードアイテム
 * クリップボードの内容を保存し、後から復元できる
 */
export interface ClipboardItem {
  /** アイテムタイプ（常に'clipboard'） */
  type: 'clipboard';
  /** アイテムリストでの表示名 */
  displayName: string;
  /** クリップボードデータファイルへの参照（clipboard-data/{id}.json） */
  clipboardDataRef: string;
  /** 保存日時（timestamp） */
  savedAt: number;
  /** プレビューテキスト（最初の100文字程度） */
  preview?: string;
  /** 保存されているフォーマット */
  formats: ClipboardFormat[];
  /** カスタムアイコンのファイル名（オプション） */
  customIcon?: string;
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用、非推奨：IDベースアクセスを推奨） */
  lineNumber?: number;
  /** JSONアイテムのID（JSON形式の場合） */
  id?: string;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
  /** 自由記述メモ（オプション） */
  memo?: string;
}

/**
 * アプリケーションで扱うすべてのアイテムの統合型
 * 通常のLauncherItem、GroupItem、WindowItem、ClipboardItem、WindowInfo（ウィンドウ検索結果）を扱える
 */
export type AppItem = LauncherItem | GroupItem | WindowItem | ClipboardItem | WindowInfo;
