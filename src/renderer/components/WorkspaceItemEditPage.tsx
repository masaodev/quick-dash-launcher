import React, { useCallback, useEffect, useState } from 'react';
import type { WorkspaceItem, WorkspaceItemUpdate } from '@common/types';

import { logError } from '../utils/debug';

import WorkspaceItemEditModal from './WorkspaceItemEditModal';
import { Button } from './ui';

interface WorkspaceItemEditPageProps {
  itemId: string;
}

/**
 * ワークスペースアイテムの編集ページ（独立した編集ウィンドウの中身）
 *
 * ワークスペースのレンダラーが window.open で開いた子ウィンドウに描画される。
 * 保存は workspace:update-item で行い、変更通知でワークスペース側が読み直すので、
 * ここではウィンドウを閉じるだけでよい。
 */
const WorkspaceItemEditPage: React.FC<WorkspaceItemEditPageProps> = ({ itemId }) => {
  const [item, setItem] = useState<WorkspaceItem | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.title = 'アイテムの編集';
    let cancelled = false;
    (async () => {
      try {
        const items = await window.electronAPI.workspaceAPI.loadItems();
        const found = items.find((i) => i.id === itemId) ?? null;
        if (cancelled) return;
        if (found) {
          setItem(found);
        } else {
          setNotFound(true);
        }
      } catch (error) {
        logError('編集対象のアイテムの読み込みに失敗しました:', error);
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const close = useCallback(() => {
    window.close();
  }, []);

  const save = useCallback(async (id: string, updates: WorkspaceItemUpdate) => {
    const result = await window.electronAPI.workspaceAPI.updateItem(id, updates);
    if (!result.success) {
      throw new Error('ワークスペースアイテムの更新に失敗しました');
    }
  }, []);

  if (notFound) {
    return (
      <div className="workspace-editor-page workspace-editor-missing">
        <p>編集するアイテムが見つかりません（削除された可能性があります）。</p>
        <Button variant="cancel" onClick={close}>
          閉じる
        </Button>
      </div>
    );
  }

  return (
    <WorkspaceItemEditModal
      asPage
      isOpen={item !== null}
      editingItem={item}
      onClose={close}
      onSave={save}
    />
  );
};

export default WorkspaceItemEditPage;
