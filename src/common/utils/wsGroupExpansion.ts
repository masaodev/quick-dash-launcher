/**
 * WSグループ（type: "wsgroup"）の展開と、選べるグループの一覧（メインプロセスと画面で共用）
 */
import type { JsonWsGroupItem } from '../types/json-data';
import type { WsGroupItem } from '../types/launcher';
import type { Workspace, WorkspaceGroup } from '../types/workspace';

/** WSグループで選べるグループ（いちばん上の階層のもの）と、その所属ワークスペース */
export interface WsGroupCandidate {
  group: WorkspaceGroup;
  workspace: Workspace;
}

/**
 * WSグループで選べるグループを、ワークスペースの順 → グループの順に並べて返す
 * サブグループと、ワークスペースが見つからないグループは除く
 */
export function listWsGroupCandidates(
  workspaces: readonly Workspace[],
  groups: readonly WorkspaceGroup[]
): WsGroupCandidate[] {
  const sortedWorkspaces = [...workspaces].sort((a, b) => a.order - b.order);
  return sortedWorkspaces.flatMap((workspace) =>
    groups
      .filter((group) => !group.parentGroupId && group.workspaceId === workspace.id)
      .sort((a, b) => a.order - b.order)
      .map((group) => ({ group, workspace }))
  );
}

/**
 * WSグループの行が指すグループを返す（scope が all ならすべて、selected なら groupIds にあるもの）
 * 並びはワークスペースの順。消えたグループ・サブグループは並べない
 */
export function resolveWsGroupTargets(
  item: Pick<JsonWsGroupItem, 'scope' | 'groupIds'>,
  candidates: readonly WsGroupCandidate[]
): WsGroupCandidate[] {
  if (item.scope === 'all') return [...candidates];
  const ids = new Set(item.groupIds ?? []);
  return candidates.filter((candidate) => ids.has(candidate.group.id));
}

/** selected の groupIds のうち、選べるグループに見つからない id（消えたグループ・サブグループになったもの） */
export function findMissingWsGroupIds(
  item: Pick<JsonWsGroupItem, 'scope' | 'groupIds'>,
  candidates: readonly WsGroupCandidate[]
): string[] {
  if (item.scope === 'all') return [];
  const known = new Set(candidates.map((candidate) => candidate.group.id));
  return (item.groupIds ?? []).filter((id) => !known.has(id));
}

/**
 * WSグループの行を、ランチャーに並べるアイテムに展開する
 */
export function expandWsGroupItem(
  item: JsonWsGroupItem,
  candidates: readonly WsGroupCandidate[],
  sourceFile: string,
  lineNumber: number
): WsGroupItem[] {
  const prefix = item.options?.prefix ?? '';
  const suffix = item.options?.suffix ?? '';
  return resolveWsGroupTargets(item, candidates).map(({ group }) => ({
    type: 'wsgroup',
    displayName: `${prefix}${group.displayName}${suffix}`,
    groupId: group.id,
    color: group.color,
    sourceFile,
    lineNumber,
    expandedFromId: item.id,
  }));
}
