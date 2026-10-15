/**
 * JSON形式データファイルの型定義
 *
 * data.json形式のデータファイル構造を定義
 * CSV形式からの移行後に使用される
 */

import type { WindowConfig, LayoutWindowEntry, SetEntry, SetLaunchMode } from './launcher';
import type { ClipboardFormat } from './clipboard';

// ============================================================
// JSON ファイル全体の型
// ============================================================

/**
 * JSONデータファイルのルート構造
 */
export interface JsonDataFile {
  /** ファイルフォーマットのバージョン（現在は "1.0"） */
  version: string;
  /** アイテムの配列 */
  items: JsonItem[];
}

// ============================================================
// アイテムの Union 型
// ============================================================

/**
 * JSONデータファイル内のアイテム型（Union型）
 */
export type JsonItem =
  JsonLauncherItem | JsonDirItem | JsonWindowItem | JsonClipboardItem | JsonSetItem;

// ============================================================
// 共通フィールド
// ============================================================

/**
 * 全アイテム共通の基底インターフェース
 */
interface JsonItemBase {
  /**
   * 8文字の一意ID（英数字 A-Z a-z 0-9、ランダムに生成）。
   * 手で書くときも新しい値を生成する。既存の id は変えない
   * @pattern ^[A-Za-z0-9]{8}$
   */
  id: string;
  /** 自由記述メモ（オプション） */
  memo?: string;
  /** 更新日時（Unixタイムスタンプ ms、オプション） */
  updatedAt?: number;
}

// ============================================================
// 通常アイテム (type: "item")
// ============================================================

/**
 * 通常のランチャーアイテム
 * ファイル、アプリケーション、URL、フォルダなどを起動するアイテム
 */
export interface JsonLauncherItem extends JsonItemBase {
  /** アイテムタイプ */
  type: 'item';
  /**
   * 表示名
   * @minLength 1
   */
  displayName: string;
  /**
   * ファイルパス、URL、またはコマンド
   * @minLength 1
   */
  path: string;
  /** コマンドライン引数（オプション） */
  args?: string;
  /** カスタムアイコンファイル名（オプション） */
  customIcon?: string;
  /** ウィンドウ制御設定（オプション） */
  windowConfig?: WindowConfig;
  /** 自動取込ルールのID（このフィールドがあるアイテムは自動管理対象） */
  autoImportRuleId?: string;
}

// ============================================================
// フォルダ取込 (type: "dir")
// ============================================================

/**
 * フォルダ取込オプションのデフォルト値
 */
export const DIR_OPTIONS_DEFAULTS = {
  depth: 0,
  types: 'both' as const,
} as const;

/**
 * フォルダ取込オプション（JSON保存用、すべてオプショナル）
 */
export interface JsonDirOptions {
  /**
   * スキャンする深さ（0=サブフォルダなし、デフォルト。-1=無制限）
   * @asType integer
   * @minimum -1
   */
  depth?: number;
  /** 取り込むアイテムの種類 */
  types?: 'file' | 'folder' | 'both';
  /** ファイル名フィルタ（ワイルドカード対応、例: "*.exe"） */
  filter?: string;
  /** 除外フィルタ（ワイルドカード対応、例: "*.tmp"） */
  exclude?: string;
  /** 表示名のプレフィックス */
  prefix?: string;
  /** 表示名のサフィックス */
  suffix?: string;
}

/**
 * フォルダ取込オプション（処理時用、必須フィールドあり）
 */
export interface DirOptionsForProcessing {
  /** スキャンする深さ（-1=無制限、0=サブフォルダなし） */
  depth: number;
  /** 取り込むアイテムの種類 */
  types: 'file' | 'folder' | 'both';
  /** ファイル名フィルタ（オプション） */
  filter?: string;
  /** 除外フィルタ（オプション） */
  exclude?: string;
  /** 表示名のプレフィックス（オプション） */
  prefix?: string;
  /** 表示名のサフィックス（オプション） */
  suffix?: string;
}

/**
 * フォルダ取込アイテム
 * 指定フォルダ内のファイル/フォルダを自動的にスキャンして取り込む
 */
export interface JsonDirItem extends JsonItemBase {
  /** アイテムタイプ */
  type: 'dir';
  /**
   * スキャン対象のフォルダパス
   * @minLength 1
   */
  path: string;
  /** スキャンオプション（オプション） */
  options?: JsonDirOptions;
}

// ============================================================
// グループ (type: "group")
// ============================================================

/**
 * 旧形式のグループ（読み込み時にセットに変換する。JsonItem には含めない）
 * 複数のアイテムを表示名で参照してまとめて起動していた
 */
export interface JsonGroupItem extends JsonItemBase {
  /** アイテムタイプ */
  type: 'group';
  /**
   * グループの表示名
   * @minLength 1
   */
  displayName: string;
  /** グループ内で参照するアイテム名のリスト */
  itemNames: string[];
}

// ============================================================
// ウィンドウ操作 (type: "window")
// ============================================================

/**
 * ウィンドウ操作アイテム
 * 既存のウィンドウを検索・アクティブ化し、位置・サイズを制御する
 */
export interface JsonWindowItem extends JsonItemBase {
  /** アイテムタイプ */
  type: 'window';
  /**
   * アイテムリストでの表示名
   * @minLength 1
   */
  displayName: string;
  /**
   * ウィンドウタイトル（検索用、ワイルドカード対応）
   * @minLength 1
   */
  windowTitle: string;
  /** プロセス名で検索（部分一致、オプション） */
  processName?: string;
  /** X座標（仮想スクリーン座標系、オプション） */
  x?: number;
  /** Y座標（仮想スクリーン座標系、オプション） */
  y?: number;
  /** 幅（オプション） */
  width?: number;
  /** 高さ（オプション） */
  height?: number;
  /** アクティブモニターの中央に移動するか（オプション） */
  moveToActiveMonitorCenter?: boolean;
  /** 仮想デスクトップ番号（1から開始、オプション） */
  virtualDesktopNumber?: number;
  /** ウィンドウをアクティブにするか（デフォルト: true、オプション） */
  activateWindow?: boolean;
  /** 全仮想デスクトップにピン止めするか（オプション） */
  pinToAllDesktops?: boolean;
}

// ============================================================
// クリップボードアイテム (type: "clipboard")
// ============================================================

/**
 * クリップボードアイテム
 * クリップボードの内容を保存し、後から復元できる
 */
export interface JsonClipboardItem extends JsonItemBase {
  /** アイテムタイプ */
  type: 'clipboard';
  /**
   * アイテムの表示名
   * @minLength 1
   */
  displayName: string;
  /** クリップボードデータファイルへの参照（clipboard-data/{id}.json） */
  dataFileRef: string;
  /** 保存日時（timestamp） */
  savedAt: number;
  /** プレビューテキスト（最初の100文字程度） */
  preview?: string;
  /** 保存されているフォーマット */
  formats: ClipboardFormat[];
  /** カスタムアイコンファイル名（オプション） */
  customIcon?: string;
}

// ============================================================
// レイアウトアイテム (type: "layout")
// ============================================================

/**
 * 旧形式のウィンドウ配置（レイアウト）（読み込み時にセットに変換する。JsonItem には含めない）
 * 複数ウィンドウの位置・サイズを一括でキャプチャ・復元していた
 */
export interface JsonLayoutItem extends JsonItemBase {
  /** アイテムタイプ */
  type: 'layout';
  /**
   * レイアウトの表示名
   * @minLength 1
   */
  displayName: string;
  /** レイアウト内のウィンドウエントリ一覧 */
  entries: LayoutWindowEntry[];
  /** カスタムアイコンファイル名（オプション） */
  customIcon?: string;
}

// ============================================================
// セット (type: "set")
// ============================================================

/**
 * セットアイテム
 * 複数のアイテムをまとめて開き、必要なら決まった位置に並べる（グループとウィンドウ配置を統合した種別）
 */
export interface JsonSetItem extends JsonItemBase {
  /** アイテムタイプ */
  type: 'set';
  /**
   * セットの表示名
   * @minLength 1
   */
  displayName: string;
  /** 行の一覧（上から順に開く） */
  entries: SetEntry[];
  /** 開き方（省略時は順番に） */
  launchMode?: SetLaunchMode;
  /** カスタムアイコンファイル名（オプション） */
  customIcon?: string;
}

// ============================================================
// 型ガード関数
// ============================================================

/**
 * JsonLauncherItemかどうかを判定
 */
export function isJsonLauncherItem(item: JsonItem): item is JsonLauncherItem {
  return item.type === 'item';
}

/**
 * JsonDirItemかどうかを判定
 */
export function isJsonDirItem(item: JsonItem): item is JsonDirItem {
  return item.type === 'dir';
}

/**
 * JsonWindowItemかどうかを判定
 */
export function isJsonWindowItem(item: JsonItem): item is JsonWindowItem {
  return item.type === 'window';
}

/**
 * JsonClipboardItemかどうかを判定
 */
export function isJsonClipboardItem(item: JsonItem): item is JsonClipboardItem {
  return item.type === 'clipboard';
}

/**
 * JsonSetItemかどうかを判定
 */
export function isJsonSetItem(item: JsonItem): item is JsonSetItem {
  return item.type === 'set';
}

// ============================================================
// 定数
// ============================================================

/** 現在のJSONファイルフォーマットバージョン */
export const JSON_DATA_VERSION = '1.0';

/** ID文字列の長さ */
export const JSON_ID_LENGTH = 8;
