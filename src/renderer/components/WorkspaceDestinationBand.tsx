import React from 'react';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import type { WorkspaceGroupView } from '@common/types';
import { parseWorkspaceAddTarget } from '@common/utils/workspaceAddTarget';

/** 追加するときの追加先（ワークスペース名 › 親グループ › グループ。未分類に足すときはグループの代わりに「未分類」） */
export interface WorkspaceDestination {
  /** 追加先のグループ（未分類に足すときは無い） */
  group?: WorkspaceGroupView;
  workspaceId: string;
  workspaceName?: string;
  /** 帯に並べるグループの名前（サブグループなら親グループ、グループの順。未分類なら「未分類」だけ） */
  groupPath: string[];
  /** タイトル・トーストに出す追加先の名前（グループ名か「未分類」） */
  label: string;
}

/**
 * 追加先を読む。見つからない（開くまでに削除されたなど）ときは null
 *
 * @param target グループの id か、未分類なら `ws:<ワークスペースの id>`（workspaceAddTarget）
 */
export async function loadWorkspaceDestination(
  target: string
): Promise<WorkspaceDestination | null> {
  const api = window.electronAPI.workspaceAPI;
  const [groups, workspaces] = await Promise.all([api.loadGroups(), api.loadWorkspaces()]);
  const parsed = parseWorkspaceAddTarget(target);
  if (parsed.kind === 'uncategorized') {
    const workspace = workspaces.find((ws) => ws.id === parsed.workspaceId);
    if (!workspace) return null;
    const label = i18next.t('workspace.groups.uncategorized');
    return {
      workspaceId: workspace.id,
      workspaceName: workspace.displayName,
      groupPath: [label],
      label,
    };
  }
  const group = groups.find((g) => g.id === parsed.groupId);
  if (!group) return null;
  const parent = group.parentGroupId ? groups.find((g) => g.id === group.parentGroupId) : undefined;
  return {
    group,
    workspaceId: group.workspaceId,
    workspaceName: workspaces.find((ws) => ws.id === group.workspaceId)?.displayName,
    groupPath: [...(parent ? [parent.displayName] : []), group.displayName],
    label: group.displayName,
  };
}

/** 追加先のグループを折りたたんでいたら開く（入ったアイテムが見えるように） */
export async function expandDestinationGroup(destination: WorkspaceDestination): Promise<void> {
  if (destination.group?.collapsed) {
    await window.electronAPI.workspaceAPI.setGroupsCollapsed([destination.group.id], false);
  }
}

/** 選ぶウィンドウのタイトル（「グループ「〇〇」に追加するアイテム」／「「未分類」に追加するアイテム」） */
export function destinationPickerTitle(destination: WorkspaceDestination): string {
  return destination.group
    ? i18next.t('workspace.picker.title', { group: destination.label })
    : i18next.t('workspace.picker.titleUncategorized');
}

/** 追加したときのトーストの文 */
export function destinationAddedMessage(destination: WorkspaceDestination): string {
  return destination.group
    ? i18next.t('workspace.picker.addedToGroup', { group: destination.label })
    : i18next.t('workspace.picker.addedToUncategorized');
}

/** 追加先に今あるアイテムか（「追加済み」の判定に使う） */
export function isInDestination(
  item: { groupId?: string; workspaceId: string },
  destination: WorkspaceDestination
): boolean {
  return destination.group
    ? item.groupId === destination.group.id
    : !item.groupId && item.workspaceId === destination.workspaceId;
}

/**
 * 追加先の帯（グループの右クリックから開く「グループに追加するアイテム」「ワークスペースにアイテムを追加」の上）
 *
 * 見た目は登録画面の保存先の帯と同じ。選ぶものは無く、名前を並べるだけ
 */
const WorkspaceDestinationBand: React.FC<{ destination: WorkspaceDestination }> = ({
  destination,
}) => {
  const { t } = useTranslation();
  const names = [
    ...(destination.workspaceName ? [destination.workspaceName] : []),
    ...destination.groupPath,
  ];
  return (
    <div className="register-dest workspace-dest">
      <span className="register-dest-label">{t('workspace.picker.destination')}</span>
      {names.map((name, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="register-dest-sep" aria-hidden>
              ›
            </span>
          )}
          <span className="workspace-dest-name">{name}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

export default WorkspaceDestinationBand;
