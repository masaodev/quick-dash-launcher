/**
 * JSON形式データファイルの型定義
 *
 * data.json形式のデータファイル構造を定義
 * CSV形式からの移行後に使用される
 */

import type { WindowConfig } from './launcher';

// ============================================================
// JSON ファイル全体の型
// ============================================================

/**
 * JSONデータファイルのルート構造
 */
export interface JsonDataFile {
  /** ファイルフォーマットのバージョン */
  version: string; // "1.0"
  /** アイテムの配列 */
  items: JsonItem[];
}

// ============================================================
// アイテムの Union 型
// ============================================================

/**
 * JSONデータファイル内のアイテム型（Union型）
 */
export type JsonItem = JsonLauncherItem | JsonDirItem | JsonGroupItem | JsonWindowItem;

// ============================================================
// 共通フィールド
// ============================================================

/**
 * 全アイテム共通の基底インターフェース
 */
interface JsonItemBase {
  /** 8文字の一意ID（英数字、ランダムに生成） */
  id: string;
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
  /** 表示名 */
  displayName: string;
  /** ファイルパス、URL、またはコマンド */
  path: string;
  /** コマンドライン引数（オプション） */
  args?: string;
  /** カスタムアイコンファイル名（オプション） */
  customIcon?: string;
  /** ウィンドウ制御設定（オプション） */
  windowConfig?: WindowConfig;
}

// ============================================================
// フォルダ取込 (type: "dir")
// ============================================================

/**
 * フォルダ取込オプション
 */
export interface JsonDirOptions {
  /** スキャンする深さ（0=サブフォルダなし、デフォルト） */
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
 * フォルダ取込アイテム
 * 指定フォルダ内のファイル/フォルダを自動的にスキャンして取り込む
 */
export interface JsonDirItem extends JsonItemBase {
  /** アイテムタイプ */
  type: 'dir';
  /** スキャン対象のフォルダパス */
  path: string;
  /** スキャンオプション（オプション） */
  options?: JsonDirOptions;
}

// ============================================================
// グループ (type: "group")
// ============================================================

/**
 * グループアイテム
 * 複数のアイテムをまとめて一括起動する
 */
export interface JsonGroupItem extends JsonItemBase {
  /** アイテムタイプ */
  type: 'group';
  /** グループの表示名 */
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
  /** アイテムリストでの表示名 */
  displayName: string;
  /** ウィンドウタイトル（検索用、ワイルドカード対応） */
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
 * JsonGroupItemかどうかを判定
 */
export function isJsonGroupItem(item: JsonItem): item is JsonGroupItem {
  return item.type === 'group';
}

/**
 * JsonWindowItemかどうかを判定
 */
export function isJsonWindowItem(item: JsonItem): item is JsonWindowItem {
  return item.type === 'window';
}

// ============================================================
// 定数
// ============================================================

/** 現在のJSONファイルフォーマットバージョン */
export const JSON_DATA_VERSION = '1.0';

/** ID文字列の長さ */
export const JSON_ID_LENGTH = 8;
