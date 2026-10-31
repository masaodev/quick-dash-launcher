/**
 * ワークスペースの実行時の型
 *
 * ファイル形式（json-workspace.ts）のエンティティに、実行時にだけ持つ情報を足したもの:
 * - アイテム: `launcherType`（type: "item" の path から判定した url/file/app/…）と `icon`
 * - グループ: `collapsed`（workspace-ui-state.json から合成。WorkspaceGroupView）
 *
 * ファイルに書くときは実行時情報を落として JsonWorkspace* に戻す（WorkspaceFileStore）。
 */

import type {
  JsonArchivedItemMeta,
  JsonArchivedWorkspaceGroup,
  JsonWorkspace,
  JsonWorkspaceClipboardItem,
  JsonWorkspaceContentItem,
  JsonWorkspaceGroup,
  JsonWorkspaceLauncherItem,
  JsonWorkspaceRefItem,
  JsonWorkspaceSetItem,
} from './json-workspace';
import type { LauncherItem } from './launcher';

/** ワークスペース（タブ）。ファイル形式と同じ */
export type Workspace = JsonWorkspace;

/** グループ。ファイル形式と同じ（折りたたみ状態は持たない） */
export type WorkspaceGroup = JsonWorkspaceGroup;

/** レンダラー表示用のグループ（UI 状態ファイルの折りたたみを合成したもの） */
export interface WorkspaceGroupView extends WorkspaceGroup {
  /** 折りたたみ状態（true: 折りたたみ） */
  collapsed: boolean;
}

/** type: "item" の path から判定した起動種別 */
export type LauncherItemType = 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'windowSwitch';

/** 実行時にだけ持つアイコン（icon-cache から解決。ファイルには保存しない） */
interface RuntimeIcon {
  icon?: string;
}

/**
 * 参照の解決の結果
 * - ok: ランチャーのアイテムが見つかった（中身はそのアイテムのもの）
 * - missing: 見つからない（消された・id が変わった）
 * - unsupported: 見つかったが参照できない種別（フォルダ取込）
 */
export type WorkspaceRefStatus = 'ok' | 'missing' | 'unsupported';

/**
 * 参照アイテムの情報（実行時）
 *
 * ファイルの参照アイテム（type: "ref"）を読んだときに付く。解決できたアイテムは、指す先の種別
 * （item / clipboard / set）の形で中身を持ち、この情報で参照だと分かる
 */
export interface WorkspaceRefInfo {
  /** 指すランチャーのアイテムの id */
  itemId: string;
  /** ワークスペースでの表示名（無ければランチャーの表示名を使う） */
  alias?: string;
  /** 最後に見たランチャーの表示名 */
  lastKnownName?: string;
  /** 解決の結果 */
  status: WorkspaceRefStatus;
  /** ランチャーのアイテムの表示名（解決できたときだけ） */
  mainDisplayName?: string;
  /** ランチャーのアイテムのデータファイル（解決できたときだけ） */
  sourceFile?: string;
  /** ランチャーのアイテムのタブの名前（解決できたときだけ） */
  tabName?: string;
}

/** 参照から解決したときだけ付く情報 */
interface RuntimeRef {
  ref?: WorkspaceRefInfo;
}

export type WorkspaceLauncherItem = JsonWorkspaceLauncherItem &
  RuntimeIcon &
  RuntimeRef & {
    /** path（ショートカットならリンク先）から判定した起動種別 */
    launcherType: LauncherItemType;
  };
export type WorkspaceClipboardItem = JsonWorkspaceClipboardItem & RuntimeIcon & RuntimeRef;
export type WorkspaceSetItem = JsonWorkspaceSetItem & RuntimeIcon & RuntimeRef;

/**
 * 解決していない（または解決できなかった）参照アイテム（実行時）
 *
 * displayName は表示に使う名前（ワークスペースでの表示名 → 最後に見た表示名の順）。ファイルに書くときは
 * ref.alias・ref.lastKnownName から書き戻す
 */
export type WorkspaceRefItem = Omit<JsonWorkspaceRefItem, 'displayName' | 'lastKnownName'> &
  RuntimeIcon & {
    displayName: string;
    ref: WorkspaceRefInfo;
    /** 型をそろえるため（参照アイテムはメモを持たない） */
    memo?: undefined;
  };

/**
 * ワークスペースに追加されたアイテム（実行時）。type で判別できる union
 *
 * ランチャーのアイテムのコピー（item / clipboard / set）か、参照（ref。解決できたら指す先の種別の形になり
 * ref を持つ）
 */
export type WorkspaceItem =
  WorkspaceLauncherItem | WorkspaceClipboardItem | WorkspaceSetItem | WorkspaceRefItem;

/** 中身を持つワークスペースアイテム（解決できた参照を含む） */
export type WorkspaceContentItem = Exclude<WorkspaceItem, WorkspaceRefItem>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * アイテム編集の入力。その type が持つ編集可能フィールドを全部渡す「置き換え」で、
 * id・並び順・所属（groupId / workspaceId）は変えられない
 */
export type WorkspaceItemUpdate = DistributiveOmit<
  JsonWorkspaceContentItem,
  'id' | 'order' | 'addedAt' | 'groupId' | 'workspaceId'
>;

/**
 * グループ編集の入力
 *
 * parentGroupId を含めると moveGroupToParent と同じ扱い（循環・深さの検証、新しい親の末尾 order）
 */
export type WorkspaceGroupUpdate = Partial<
  Pick<WorkspaceGroup, 'displayName' | 'color' | 'parentGroupId'>
>;

/** グループヘッダーのドロップゾーン（Y位置に応じた操作区別） */
export type GroupDropZone = 'before' | 'nest' | 'after';

/** 親グループ内の混在要素（サブグループまたはアイテム） */
export type MixedChild<G extends WorkspaceGroup = WorkspaceGroup> =
  { kind: 'group'; group: G } | { kind: 'item'; item: WorkspaceItem };

/** 混在並べ替えのエントリ（APIに渡す軽量版） */
export interface MixedOrderEntry {
  id: string;
  kind: 'item' | 'group';
}

/** アーカイブされたグループ。ファイル形式と同じ */
export type ArchivedWorkspaceGroup = JsonArchivedWorkspaceGroup;

/** アーカイブされたアイテム（実行時） */
export type ArchivedWorkspaceItem = WorkspaceItem & JsonArchivedItemMeta;

/** コピーを参照に変えるときの、指す先の候補（ランチャーのアイテム） */
export interface WorkspaceLinkCandidate {
  /** ランチャーのアイテムの id */
  itemId: string;
  /** 表示名 */
  displayName: string;
  /** タブの名前 */
  tabName?: string;
}

/**
 * 「ランチャーのアイテムとつなぐ」の 1 行（パスと引数が同じランチャーのアイテムがあるコピー）
 *
 * memo: none＝どちらにも無いか同じ／move＝コピーにだけあり、ランチャーへ移す／conflict＝両方にあって違う
 */
export interface WorkspaceLinkCopyEntry {
  /** ワークスペースのアイテムの id */
  id: string;
  /** ワークスペースの表示名 */
  displayName: string;
  /** 候補（2 件以上なら選べないので、右クリックから 1 件ずつ選ぶ） */
  candidates: WorkspaceLinkCandidate[];
  /** 参照にしたあとのワークスペースでの表示名（ランチャーの表示名と違うときだけ） */
  alias?: string;
  /** メモの扱い */
  memo: 'none' | 'move' | 'conflict';
  /** ウィンドウ切り替え・カスタムアイコンがランチャーのアイテムと違う（参照にするとメインのものになる） */
  settingsDiffer: boolean;
  /** 行に出すアイコンを、アイコンのキャッシュから読むための情報（先頭の候補のもの） */
  iconItem?: Pick<LauncherItem, 'displayName' | 'path' | 'type' | 'customIcon' | 'originalPath'>;
}

/** 「ランチャーのアイテムとつなぐ」の一覧 */
export interface WorkspaceLinkCopiesPreview {
  /** 対象のワークスペースの表示名 */
  workspaceName: string;
  /** 候補のあるコピー */
  entries: WorkspaceLinkCopyEntry[];
  /** パスで比べられないコピー（クリップボード・セット・パスの無い単一アイテム）の数 */
  notMatchable: number;
}

/**
 * ワークスペースの余白・見出し・＋ のメニューの種類
 * - blank: 余白の右クリック
 * - add: ヘッダーの ＋
 * - tabBar: タブの並びの空いた所の右クリック
 */
/** ワークスペースへ足す先（右クリックでその場で選んだもの。groupId が無いのはグループの無いワークスペース） */
export interface WorkspaceTarget {
  workspaceId?: string;
  groupId?: string;
}

export type WorkspaceBlankMenuKind = 'blank' | 'add' | 'tabBar';
