/**
 * ワークスペース設定ファイルの型定義（ファイル形式 version 2.0）
 *
 * - config/workspace.json: ワークスペース（タブ）・グループ・アイテム
 * - config/workspace-archive.json: アーカイブしたグループとアイテム
 * - config/workspace-ui-state.json: 折りたたみ・切り離しウィンドウの位置など UI 状態（AI 編集対象外）
 *
 * アイテムはデータファイル（json-data.ts の JsonItem）と**同じ語彙・同じフィールド名**を使う。
 * 末尾のコンパイル時アサーションで語彙のずれを検出する。
 */

import type { ItemWindowSwitch, SetEntry, SetLaunchMode } from './launcher';
import type { ClipboardFormat } from './clipboard';
import type { JsonClipboardItem, JsonLauncherItem, JsonSetItem, JsonWindowItem } from './json-data';

// ============================================================
// workspace.json
// ============================================================

/**
 * ワークスペース設定ファイル（workspace.json）のルート構造
 */
export interface JsonWorkspaceFile {
  /** ファイルフォーマットのバージョン（現在は "2.0"） */
  version: string;
  /** ワークスペース（タブ）の一覧。1 件以上必要 */
  workspaces: JsonWorkspace[];
  /** グループの一覧 */
  groups: JsonWorkspaceGroup[];
  /** アイテムの一覧 */
  items: JsonWorkspaceItem[];
}

/**
 * ワークスペース（タブ）
 */
export interface JsonWorkspace {
  /**
   * 8文字の一意ID（英数字 A-Z a-z 0-9）。workspace.json と workspace-archive.json で共通の名前空間
   * @pattern ^[A-Za-z0-9]{8}$
   */
  id: string;
  /**
   * タブに表示する名前
   * @minLength 1
   */
  displayName: string;
  /** タブの並び順（0 から。省略時は QDL が補う） */
  order: number;
  /** 作成日時（Unixタイムスタンプ ms。省略時は QDL が補う） */
  createdAt: number;
}

/**
 * グループ（ワークスペース内でアイテムをまとめる箱。2 段までネストできる）
 */
export interface JsonWorkspaceGroup {
  /**
   * 8文字の一意ID（英数字 A-Z a-z 0-9）
   * @pattern ^[A-Za-z0-9]{8}$
   */
  id: string;
  /**
   * グループ名
   * @minLength 1
   */
  displayName: string;
  /**
   * グループの色。色トークン（primary / success / danger / warning / info / secondary /
   * purple / teal / pink / indigo / orange / cyan）または 6 桁の hex（例: "#00897b"）。トークン推奨
   * @pattern ^(primary|success|danger|warning|info|secondary|purple|teal|pink|indigo|orange|cyan|#[0-9A-Fa-f]{6})$
   */
  color: string;
  /** 同じ親の中での並び順（0 から。省略時は QDL が補う） */
  order: number;
  /** 作成日時（Unixタイムスタンプ ms。省略時は QDL が補う） */
  createdAt: number;
  /** 所属するワークスペースの id */
  workspaceId: string;
  /** 親グループの id（トップレベルなら省略） */
  parentGroupId?: string;
}

// ============================================================
// アイテム（type で判別する union）
// ============================================================

/**
 * 全ワークスペースアイテム共通のフィールド
 */
interface JsonWorkspaceItemBase {
  /**
   * 8文字の一意ID（英数字 A-Z a-z 0-9）。省略すると QDL が採番する
   * @pattern ^[A-Za-z0-9]{8}$
   */
  id: string;
  /**
   * 表示名
   * @minLength 1
   */
  displayName: string;
  /** 自由記述メモ（オプション） */
  memo?: string;
  /** 所属するワークスペースの id */
  workspaceId: string;
  /** 所属するグループの id（未分類なら省略） */
  groupId?: string;
  /** 同じグループ内での並び順（0 から。省略時は QDL が補う） */
  order: number;
  /** ワークスペースに追加した日時（Unixタイムスタンプ ms。省略時は QDL が補う） */
  addedAt: number;
}

/**
 * 通常のアイテム（type: "item"）
 * ファイル・アプリ・URL・フォルダなどを起動する。URL/ファイル/アプリの区別は path から QDL が判定する
 */
export interface JsonWorkspaceLauncherItem extends JsonWorkspaceItemBase, ItemWindowSwitch {
  /** アイテムタイプ */
  type: 'item';
  /**
   * ファイルパス、URL、またはコマンド
   * @minLength 1
   */
  path: string;
  /** コマンドライン引数（オプション） */
  args?: string;
  /** ショートカット（.lnk）のリンク先パス（QDL が解決して書く。手で書かなくてよい） */
  originalPath?: string;
  /** カスタムアイコンファイル名（オプション） */
  customIcon?: string;
}

/**
 * ウィンドウ操作アイテム（type: "window"）
 * 既存のウィンドウを検索・アクティブ化し、位置・サイズを制御する
 */
export interface JsonWorkspaceWindowItem extends JsonWorkspaceItemBase {
  /** アイテムタイプ */
  type: 'window';
  /**
   * ウィンドウタイトル（検索用、ワイルドカード * ? 対応）
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
  /** 全デスクトップに表示するか（オプション） */
  pinToAllDesktops?: boolean;
}

/**
 * クリップボードアイテム（type: "clipboard"）
 * QDL が画面操作で生成する。手で書かない
 */
export interface JsonWorkspaceClipboardItem extends JsonWorkspaceItemBase {
  /** アイテムタイプ */
  type: 'clipboard';
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

/**
 * セットアイテム（type: "set"）
 * 複数のアイテムをまとめて開き、必要なら決まった位置に並べる。行の itemId はワークスペースのアイテムかデータファイルのアイテムを指す
 */
export interface JsonWorkspaceSetItem extends JsonWorkspaceItemBase {
  /** アイテムタイプ */
  type: 'set';
  /** 行の一覧（上から順に開く） */
  entries: SetEntry[];
  /** 開き方（省略時は順番に） */
  launchMode?: SetLaunchMode;
  /** カスタムアイコンファイル名（オプション） */
  customIcon?: string;
}

/**
 * ワークスペースアイテム（Union型）
 */
export type JsonWorkspaceItem =
  | JsonWorkspaceLauncherItem
  | JsonWorkspaceWindowItem
  | JsonWorkspaceClipboardItem
  | JsonWorkspaceSetItem;

/** ワークスペースアイテムの type の一覧 */
export const JSON_WORKSPACE_ITEM_TYPES = ['item', 'window', 'clipboard', 'set'] as const;

// ============================================================
// workspace-archive.json
// ============================================================

/**
 * アーカイブファイル（workspace-archive.json）のルート構造
 */
export interface JsonWorkspaceArchiveFile {
  /** ファイルフォーマットのバージョン（現在は "2.0"） */
  version: string;
  /** アーカイブしたグループ */
  groups: JsonArchivedWorkspaceGroup[];
  /** アーカイブしたアイテム */
  items: JsonArchivedWorkspaceItem[];
}

/**
 * アーカイブ時に付く情報（グループ）
 */
export interface JsonArchivedWorkspaceGroup extends JsonWorkspaceGroup {
  /** アーカイブ日時（Unixタイムスタンプ ms） */
  archivedAt: number;
  /** アーカイブ前の order（復元時の参考） */
  originalOrder: number;
  /** アーカイブ時のアイテム数（表示用） */
  itemCount: number;
}

/**
 * アーカイブ時に付く情報（アイテム）
 */
export interface JsonArchivedItemMeta {
  /** アーカイブ日時（Unixタイムスタンプ ms） */
  archivedAt: number;
  /** どのアーカイブグループと一緒にアーカイブされたか */
  archivedGroupId: string;
}

/**
 * アーカイブされたアイテム
 */
export type JsonArchivedWorkspaceItem = JsonWorkspaceItem & JsonArchivedItemMeta;

// ============================================================
// workspace-ui-state.json（UI 状態。AI 編集対象外・スキーマなし）
// ============================================================

/**
 * 切り離しウィンドウの永続化状態
 */
export interface DetachedWindowState {
  /** ウィンドウ内のグループの折りたたみ状態（groupId → collapsed） */
  collapsedStates: Record<string, boolean>;
  /** ウィンドウ位置・サイズ */
  bounds: { x: number; y: number; width: number; height: number };
  /** ピン留めモード */
  pinMode?: 0 | 1 | 2;
}

/**
 * UI 状態ファイルのルート構造
 */
export interface WorkspaceUiStateFile {
  /** ファイルフォーマットのバージョン */
  version: 1;
  /** メインのワークスペースウィンドウでのグループ折りたたみ状態（true のものだけ持つ） */
  collapsedGroups: Record<string, boolean>;
  /** 切り離しウィンドウの状態（ルートグループ id → 状態） */
  detachedWindows: Record<string, DetachedWindowState>;
}

// ============================================================
// 定数
// ============================================================

/** 現在のワークスペースファイルフォーマットバージョン */
export const JSON_WORKSPACE_VERSION = '2.0';

/** UI 状態ファイルのバージョン */
export const WORKSPACE_UI_STATE_VERSION = 1;

/** 既定ワークスペースの表示名（ファイルに 1 件も無いときに作る） */
export const DEFAULT_WORKSPACE_DISPLAY_NAME = 'デフォルト';

// ============================================================
// コンパイル時アサーション: データファイルと語彙が一致していること
// ============================================================

/** ワークスペースだけが持つメタ情報のキー */
type WorkspaceMetaKey = 'workspaceId' | 'groupId' | 'order' | 'addedAt';

type Expect<T extends true> = T;
type SameKeys<A, B> = [keyof A] extends [keyof B]
  ? [keyof B] extends [keyof A]
    ? true
    : false
  : false;

// データファイル側で updatedAt / autoImportRuleId を除いたもの = ワークスペース側でメタを除いたもの

type _AssertLauncherParity = Expect<
  SameKeys<
    Omit<JsonWorkspaceLauncherItem, WorkspaceMetaKey | 'originalPath'>,
    Omit<JsonLauncherItem, 'updatedAt' | 'autoImportRuleId'>
  >
>;

type _AssertWindowParity = Expect<
  SameKeys<Omit<JsonWorkspaceWindowItem, WorkspaceMetaKey>, Omit<JsonWindowItem, 'updatedAt'>>
>;

type _AssertClipboardParity = Expect<
  SameKeys<Omit<JsonWorkspaceClipboardItem, WorkspaceMetaKey>, Omit<JsonClipboardItem, 'updatedAt'>>
>;

type _AssertSetParity = Expect<
  SameKeys<Omit<JsonWorkspaceSetItem, WorkspaceMetaKey>, Omit<JsonSetItem, 'updatedAt'>>
>;
