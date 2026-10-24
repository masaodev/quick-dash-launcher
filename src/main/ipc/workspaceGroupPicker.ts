/**
 * ワークスペースへ足す・移す先のグループを、右クリックのその場で選ぶサブメニュー（A3-157）
 *
 * 未分類は無いので、グループのあるワークスペースへはグループを選んで入れる。
 * ワークスペースが 1 つならワークスペースの段は省き、グループを直接並べる。
 * グループが 1 つも無いワークスペースは「「未分類」グループを作って入れる」だけを出す（入れるときに作られる）
 */
import { Menu, MenuItem } from 'electron';
import type { Workspace, WorkspaceGroup } from '@common/types';

import { WorkspaceService } from '../services/workspace/index.js';

import { t } from './contextMenuShared.js';

/** 選ばれた置き場（groupId が無いのは、グループの無いワークスペースのとき） */
export interface WorkspaceTargetPick {
  workspaceId: string;
  groupId?: string;
}

const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

/** 1 つのワークスペースのグループを、サブグループを字下げして並べる */
function buildWorkspaceEntries(
  workspace: Workspace,
  groups: WorkspaceGroup[],
  onPick: (pick: WorkspaceTargetPick) => void,
  isCurrent: (groupId: string) => boolean
): MenuItem[] {
  const inWorkspace = groups.filter((g) => g.workspaceId === workspace.id);
  if (inWorkspace.length === 0) {
    return [
      new MenuItem({
        label: t('menu.groupPicker.createUncategorized'),
        click: () => onPick({ workspaceId: workspace.id }),
      }),
    ];
  }
  const entries: MenuItem[] = [];
  const appendTree = (parentId: string | undefined, depth: number) => {
    for (const group of inWorkspace.filter((g) => g.parentGroupId === parentId).sort(byOrder)) {
      entries.push(
        new MenuItem({
          label: `${'　'.repeat(depth)}${group.displayName}`,
          enabled: !isCurrent(group.id),
          click: () => onPick({ workspaceId: workspace.id, groupId: group.id }),
        })
      );
      appendTree(group.id, depth + 1);
    }
  };
  appendTree(undefined, 0);
  entries.push(new MenuItem({ type: 'separator' }));
  entries.push(
    new MenuItem({
      label: t('menu.groupPicker.createGroup'),
      click: () => void pickNewGroup(workspace.id, inWorkspace.length, onPick),
    })
  );
  return entries;
}

/** 「新しいグループを作って入れる」: 「グループ {N}」をワークスペースの最後に作り、そこへ入れる */
async function pickNewGroup(
  workspaceId: string,
  groupCount: number,
  onPick: (pick: WorkspaceTargetPick) => void
): Promise<void> {
  const service = await WorkspaceService.getInstance();
  const created = await service.createGroup(
    t('workspace.groups.defaultName', { number: groupCount + 1 }),
    undefined,
    undefined,
    workspaceId
  );
  onPick({ workspaceId, groupId: created.id });
}

/**
 * 置き場を選ぶサブメニューを作る（選ぶものが無ければ null）
 *
 * @param options.excludeWorkspaceId このワークスペースは並べない（別のワークスペースへ移すとき）
 * @param options.currentGroupId 今入っているグループ（選べなくする）
 */
export function buildWorkspaceTargetSubmenu(
  label: string,
  workspaces: Workspace[],
  groups: WorkspaceGroup[],
  onPick: (pick: WorkspaceTargetPick) => void,
  options: { excludeWorkspaceId?: string; currentGroupId?: string } = {}
): MenuItem | null {
  const targets = workspaces.filter((ws) => ws.id !== options.excludeWorkspaceId).sort(byOrder);
  if (targets.length === 0) return null;
  const isCurrent = (groupId: string) => groupId === options.currentGroupId;
  const submenu = new Menu();
  if (targets.length === 1 && options.excludeWorkspaceId === undefined) {
    for (const entry of buildWorkspaceEntries(targets[0], groups, onPick, isCurrent)) {
      submenu.append(entry);
    }
  } else {
    for (const ws of targets) {
      const wsMenu = new Menu();
      for (const entry of buildWorkspaceEntries(ws, groups, onPick, isCurrent))
        wsMenu.append(entry);
      submenu.append(new MenuItem({ label: ws.displayName, submenu: wsMenu }));
    }
  }
  return new MenuItem({ label, submenu });
}

/** 今のワークスペースとグループを読む（右クリックのメニューを作るとき用） */
export async function loadWorkspaceTargets(): Promise<{
  workspaces: Workspace[];
  groups: WorkspaceGroup[];
}> {
  const service = await WorkspaceService.getInstance();
  const [workspaces, groups] = await Promise.all([service.loadWorkspaces(), service.loadGroups()]);
  return { workspaces, groups };
}
