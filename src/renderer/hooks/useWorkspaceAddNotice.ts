/**
 * ワークスペースの中で足したもの（貼り付け・ドロップ）を、ワークスペースの中のトーストで知らせる
 *
 * 足せなかったときの案内（「グループを選んで」など）も中のトーストなので、知らせ方をそろえる。
 * 閉じたグループに入れたときは、入ったものが見えるようにグループを開く
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceGroupView } from '@common/types';

import { useLatestRef } from './useLatestRef';
import { useToast } from './useToast';

/**
 * @param groups 今のワークスペースのグループ
 * @param toggleGroup グループの開閉を切り替える（閉じたグループを開くのに使う）
 * @returns (足せたアイテムの表示名, 入れたグループ, 添える一文) → 知らせる
 */
export function useWorkspaceAddNotice(
  groups: WorkspaceGroupView[],
  toggleGroup: (groupId: string) => void
): (displayNames: string[], groupId?: string, note?: string) => void {
  const { t } = useTranslation();
  const { showSuccess } = useToast();
  const latest = useLatestRef({ groups, toggleGroup, t });

  return useCallback(
    (displayNames: string[], groupId?: string, note?: string) => {
      const { groups, toggleGroup, t } = latest.current;
      if (displayNames.length === 0) return;
      const group = groupId ? groups.find((g) => g.id === groupId) : undefined;
      const what =
        displayNames.length === 1
          ? displayNames[0]
          : t('workspace.addNotice.items', { count: displayNames.length });
      const message = group
        ? t('workspace.addNotice.toGroup', { what, group: group.displayName })
        : t('workspace.addNotice.added', { what });
      showSuccess(note ? `${message}\n${note}` : message);
      if (group?.collapsed) toggleGroup(group.id);
    },
    [latest, showSuccess]
  );
}
