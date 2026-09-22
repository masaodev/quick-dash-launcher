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
  JsonWorkspaceGroup,
  JsonWorkspaceGroupItem,
  JsonWorkspaceItem,
  JsonWorkspaceLauncherItem,
  JsonWorkspaceLayoutItem,
  JsonWorkspaceWindowItem,
} from './json-workspace';

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
export type LauncherItemType = 'url' | 'file' | 'folder' | 'app' | 'customUri';

/** 実行時にだけ持つアイコン（icon-cache から解決。ファイルには保存しない） */
interface RuntimeIcon {
  icon?: string;
}

export type WorkspaceLauncherItem = JsonWorkspaceLauncherItem &
  RuntimeIcon & {
    /** path（ショートカットならリンク先）から判定した起動種別 */
    launcherType: LauncherItemType;
  };
export type WorkspaceWindowItem = JsonWorkspaceWindowItem & RuntimeIcon;
export type WorkspaceGroupItem = JsonWorkspaceGroupItem & RuntimeIcon;
export type WorkspaceClipboardItem = JsonWorkspaceClipboardItem & RuntimeIcon;
export type WorkspaceLayoutItem = JsonWorkspaceLayoutItem & RuntimeIcon;

/**
 * ワークスペースに追加されたアイテム（実行時）
 * メイン画面のアイテムをコピーし、独立して管理される。type で判別できる union
 */
export type WorkspaceItem =
  | WorkspaceLauncherItem
  | WorkspaceWindowItem
  | WorkspaceGroupItem
  | WorkspaceClipboardItem
  | WorkspaceLayoutItem;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * アイテム編集の入力。その type が持つ編集可能フィールドを全部渡す「置き換え」で、
 * id・並び順・所属（groupId / workspaceId）は変えられない
 */
export type WorkspaceItemUpdate = DistributiveOmit<
  JsonWorkspaceItem,
  'id' | 'order' | 'addedAt' | 'groupId' | 'workspaceId'
>;

/** グループ編集の入力 */
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
