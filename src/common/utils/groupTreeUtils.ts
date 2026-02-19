/**
 * ワークスペースグループのツリー構造を扱うユーティリティ
 * フラット配列 ↔ ツリー構造の変換、深さ計算、バリデーション等
 */
import type { WorkspaceGroup } from '../types/workspace';

/** サブグループの最大階層深さ（0: トップレベル, 1: サブグループ, 2: サブサブグループ） */
export const MAX_GROUP_DEPTH = 2;

/**
 * ツリー構造のノード型
 * WorkspaceGroupにchildren情報を付加したもの
 */
export interface GroupTreeNode {
  group: WorkspaceGroup;
  children: GroupTreeNode[];
  depth: number;
}

/**
 * グループの階層深さを計算する
 * @param groupId 対象グループのID
 * @param groups 全グループ配列
 * @returns 深さ（0: トップレベル, 1: サブグループ, 2: サブサブグループ）
 */
export function getGroupDepth(groupId: string, groups: WorkspaceGroup[]): number {
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  let depth = 0;
  let currentId: string | undefined = groupId;

  while (currentId) {
    const group = groupMap.get(currentId);
    if (!group || !group.parentGroupId) break;
    depth++;
    currentId = group.parentGroupId;
    // 循環参照防止
    if (depth > MAX_GROUP_DEPTH + 1) break;
  }

  return depth;
}

/**
 * サブグループを作成可能かバリデーションする
 * @param parentGroupId 親になるグループのID
 * @param groups 全グループ配列
 * @returns 作成可能ならtrue
 */
export function canCreateSubgroup(parentGroupId: string, groups: WorkspaceGroup[]): boolean {
  const parentDepth = getGroupDepth(parentGroupId, groups);
  return parentDepth < MAX_GROUP_DEPTH;
}

/**
 * 指定グループの直接の子グループを取得する
 * @param parentGroupId 親グループのID
 * @param groups 全グループ配列
 * @returns 子グループの配列（order順にソート済み）
 */
export function getChildGroups(
  parentGroupId: string | undefined,
  groups: WorkspaceGroup[]
): WorkspaceGroup[] {
  return groups.filter((g) => g.parentGroupId === parentGroupId).sort((a, b) => a.order - b.order);
}

/**
 * 指定グループの全子孫グループIDを取得する（再帰）
 * @param groupId 対象グループのID
 * @param groups 全グループ配列
 * @returns 子孫グループIDの配列（自身は含まない）
 */
export function getDescendantGroupIds(groupId: string, groups: WorkspaceGroup[]): string[] {
  const children = groups.filter((g) => g.parentGroupId === groupId);
  return children.flatMap((child) => [child.id, ...getDescendantGroupIds(child.id, groups)]);
}

/**
 * 指定グループの全祖先グループIDを取得する
 * @param groupId 対象グループのID
 * @param groups 全グループ配列
 * @returns 祖先グループIDの配列（自身は含まない、直近の親から順）
 */
export function getAncestorGroupIds(groupId: string, groups: WorkspaceGroup[]): string[] {
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const result: string[] = [];
  let currentId: string | undefined = groupId;

  while (currentId) {
    const group = groupMap.get(currentId);
    if (!group?.parentGroupId) break;
    result.push(group.parentGroupId);
    currentId = group.parentGroupId;
  }

  return result;
}

/**
 * フラットなグループ配列からツリー構造を構築する
 * @param groups 全グループ配列
 * @returns トップレベルのGroupTreeNode配列
 */
export function buildGroupTree(groups: WorkspaceGroup[]): GroupTreeNode[] {
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  function buildChildren(parentId: string | undefined, depth: number): GroupTreeNode[] {
    return sortedGroups
      .filter((g) => g.parentGroupId === parentId)
      .map((g) => ({
        group: g,
        depth,
        children: buildChildren(g.id, depth + 1),
      }));
  }

  return buildChildren(undefined, 0);
}

/**
 * ツリーを平坦化して全ノードの配列にする（深さ優先）
 * @param nodes ツリーノード配列
 * @returns 平坦化されたノード配列
 */
export function flattenGroupTree(nodes: GroupTreeNode[]): GroupTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenGroupTree(node.children)]);
}
