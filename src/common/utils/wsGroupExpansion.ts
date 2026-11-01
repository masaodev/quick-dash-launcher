/**
 * WSグループ（type: "wsgroup"）の展開と、選べるグループの一覧（メインプロセスと画面で共用）
 */
import type { JsonWsGroupItem } from '../types/json-data';
import type { WsGroupItem } from '../types/launcher';
import type { ArchivedWorkspaceGroup, Workspace, WorkspaceGroup } from '../types/workspace';

/**
 * WSグループで選べるグループ（いちばん上の階層のもの）と、その所属ワークスペース。
 * アーカイブしたグループは archivedAt を持つ。元のワークスペースが無くなっていれば workspace は undefined
 */
export interface WsGroupCandidate {
  group: WorkspaceGroup;
  workspace?: Workspace;
  /** アーカイブした日時（アーカイブしたグループだけ） */
  archivedAt?: number;
}

/**
 * WSグループで選べるグループを返す。今あるグループをワークスペースの順 → グループの順に並べ、
 * その後ろにアーカイブしたグループ（しまった単位の最上位だけ）をアーカイブの並びで足す。
 * サブグループと、ワークスペースが見つからない今あるグループは除く
 */
export function listWsGroupCandidates(
  workspaces: readonly Workspace[],
  groups: readonly WorkspaceGroup[],
  archivedGroups: readonly ArchivedWorkspaceGroup[] = []
): WsGroupCandidate[] {
  const sortedWorkspaces = [...workspaces].sort((a, b) => a.order - b.order);
  const active = sortedWorkspaces.flatMap((workspace) =>
    groups
      .filter((group) => !group.parentGroupId && group.workspaceId === workspace.id)
      .sort((a, b) => a.order - b.order)
      .map((group) => ({ group, workspace }))
  );
  const archived = archivedGroups
    .filter((group) => !group.parentGroupId)
    .map((group) => ({
      group,
      workspace: workspaces.find((w) => w.id === group.workspaceId),
      archivedAt: group.archivedAt,
    }));
  return [...active, ...archived];
}

/** アーカイブしたグループか */
export function isArchivedCandidate(candidate: WsGroupCandidate): boolean {
  return candidate.archivedAt !== undefined;
}

/**
 * WSグループの行が指すグループを返す。
 * scope が all なら archived の指定（省略時は exclude）で、今あるグループ・アーカイブしたグループを選ぶ。
 * selected なら groupIds にあるもの（アーカイブしたグループも含む）。消えたグループ・サブグループは並べない
 */
export function resolveWsGroupTargets(
  item: Pick<JsonWsGroupItem, 'scope' | 'groupIds' | 'archived'>,
  candidates: readonly WsGroupCandidate[]
): WsGroupCandidate[] {
  if (item.scope === 'all') {
    const filter = item.archived ?? 'exclude';
    if (filter === 'include') return [...candidates];
    const wantArchived = filter === 'only';
    return candidates.filter((candidate) => isArchivedCandidate(candidate) === wantArchived);
  }
  const ids = new Set(item.groupIds ?? []);
  return candidates.filter((candidate) => ids.has(candidate.group.id));
}

/**
 * selected の groupIds のうち、選べるグループに見つからない id（消えたグループ・サブグループになったもの）。
 * アーカイブしたグループは見つかったものとして数える
 */
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
  return resolveWsGroupTargets(item, candidates).map((candidate) => ({
    type: 'wsgroup',
    displayName: `${prefix}${candidate.group.displayName}${suffix}`,
    groupId: candidate.group.id,
    color: candidate.group.color,
    ...(isArchivedCandidate(candidate) ? { archived: true } : {}),
    sourceFile,
    lineNumber,
    expandedFromId: item.id,
  }));
}
