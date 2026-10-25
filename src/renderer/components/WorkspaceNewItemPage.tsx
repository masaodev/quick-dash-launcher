/**
 * 画面: ワークスペースにアイテムを追加（ワークスペースのグループの右クリック「新しく入力して追加」）
 * 画面仕様: docs/screens/workspace-window.md#589-グループを右クリックしてアイテムを追加
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceItemUpdate } from '@common/types';

import { logError } from '../utils/debug';
import type { WorkspaceItemCreate } from '../hooks/workspace/useWorkspaceItemEditForm';

import WorkspaceItemEditModal from './WorkspaceItemEditModal';
import WorkspaceDestinationBand, {
  destinationAddedMessage,
  expandDestinationGroup,
  loadWorkspaceDestination,
  type WorkspaceDestination,
} from './WorkspaceDestinationBand';
import { Button } from './ui';

interface WorkspaceNewItemPageProps {
  groupId: string;
}

/**
 * グループに新しいアイテムを入力して追加するページ（独立したウィンドウの中身）
 *
 * 編集ウィンドウと同じフォームを新規の形で描く。追加は workspace:create-item で行い、
 * 変更通知でワークスペース側が読み直すので、追加したら閉じるだけでよい
 */
const WorkspaceNewItemPage: React.FC<WorkspaceNewItemPageProps> = ({ groupId }) => {
  const { t } = useTranslation();
  const [destination, setDestination] = useState<WorkspaceDestination | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.title = t('workspace.edit.newTitle');
    let cancelled = false;
    loadWorkspaceDestination(groupId)
      .then((found) => {
        if (cancelled) return;
        if (found) {
          setDestination(found);
        } else {
          setNotFound(true);
        }
      })
      .catch((error) => {
        logError('追加先のグループの読み込みに失敗しました:', error);
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, t]);

  const close = useCallback(() => {
    window.close();
  }, []);

  // 失敗したときは投げ直し、フォームがエラーのトーストを出して開いたままにする
  const create = useMemo<WorkspaceItemCreate | undefined>(
    () =>
      destination
        ? {
            onAdd: async (body: WorkspaceItemUpdate) => {
              await expandDestinationGroup(destination);
              const created = await window.electronAPI.workspaceAPI.createItem(
                body,
                destination.group?.id,
                destination.workspaceId
              );
              await window.electronAPI.showToastWindow({
                type: 'success',
                itemType: 'workspaceAdd',
                displayName: created.displayName,
                message: destinationAddedMessage(destination),
                ...(created.type === 'item' && { path: created.path }),
              });
            },
          }
        : undefined,
    [destination, t]
  );

  const save = useCallback(async () => {
    // 新規の形では呼ばれない（保存の代わりに create.onAdd を呼ぶ）
  }, []);

  if (notFound) {
    return (
      <div className="workspace-editor-page workspace-editor-missing">
        <p>{t('workspace.picker.groupNotFound')}</p>
        <Button variant="secondary" onClick={close}>
          {t('common.close')}
        </Button>
      </div>
    );
  }

  return (
    <WorkspaceItemEditModal
      asPage
      isOpen={destination !== null}
      editingItem={null}
      onClose={close}
      onSave={save}
      create={create}
      banner={destination && <WorkspaceDestinationBand destination={destination} />}
    />
  );
};

export default WorkspaceNewItemPage;
