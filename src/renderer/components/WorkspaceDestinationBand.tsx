import React from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceGroupView } from '@common/types';

/** グループに追加するときの追加先（ワークスペース名 › 親グループ › グループ） */
export interface WorkspaceDestination {
  group: WorkspaceGroupView;
  workspaceName?: string;
  /** 帯に並べるグループの名前（サブグループなら親グループ、グループの順） */
  groupPath: string[];
}

/** 追加先のグループを読む。見つからない（開くまでに削除されたなど）ときは null */
export async function loadWorkspaceDestination(
  groupId: string
): Promise<WorkspaceDestination | null> {
  const api = window.electronAPI.workspaceAPI;
  const [groups, workspaces] = await Promise.all([api.loadGroups(), api.loadWorkspaces()]);
  const group = groups.find((g) => g.id === groupId);
  if (!group) return null;
  const parent = group.parentGroupId ? groups.find((g) => g.id === group.parentGroupId) : undefined;
  return {
    group,
    workspaceName: workspaces.find((ws) => ws.id === group.workspaceId)?.displayName,
    groupPath: [...(parent ? [parent.displayName] : []), group.displayName],
  };
}

/** 追加先のグループを折りたたんでいたら開く（入ったアイテムが見えるように） */
export async function expandDestinationGroup(destination: WorkspaceDestination): Promise<void> {
  if (destination.group.collapsed) {
    await window.electronAPI.workspaceAPI.setGroupsCollapsed([destination.group.id], false);
  }
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
