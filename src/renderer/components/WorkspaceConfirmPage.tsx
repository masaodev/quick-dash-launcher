import React, { useCallback, useEffect, useState } from 'react';
import type { ConfirmWindowRequest } from '@common/types';

import { logError } from '../utils/debug';

import ConfirmDialog from './ConfirmDialog';
import { Button } from './ui';

interface WorkspaceConfirmPageProps {
  requestId: string;
}

/**
 * 確認ウィンドウの中身（ワークスペースのグループの削除・アーカイブ）
 *
 * ワークスペースのレンダラーが window.open で開いた子ウィンドウに描画される。
 * 要求（タイトル・文面・チェックボックス）を requestId でメインプロセスから受け取り、
 * 確認されたら結果を預けて閉じる。キャンセル・Escape は閉じるだけ（開き元には null が返る）
 */
const WorkspaceConfirmPage: React.FC<WorkspaceConfirmPageProps> = ({ requestId }) => {
  const [request, setRequest] = useState<ConfirmWindowRequest | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await window.electronAPI.workspaceAPI.getConfirmRequest(requestId);
        if (cancelled) return;
        if (found) {
          document.title = found.title;
          setChecked(found.checkbox?.checked ?? false);
          setRequest(found);
        } else {
          setNotFound(true);
        }
      } catch (error) {
        logError('確認ウィンドウの要求の取得に失敗しました:', error);
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const close = useCallback(() => {
    window.close();
  }, []);

  const confirm = useCallback(async () => {
    try {
      await window.electronAPI.workspaceAPI.returnConfirmResult(requestId, {
        confirmed: true,
        checkboxChecked: checked,
      });
    } catch (error) {
      logError('確認結果を返せませんでした:', error);
    }
    window.close();
  }, [requestId, checked]);

  if (notFound) {
    return (
      <div className="confirm-window-page confirm-window-missing">
        <p>確認する内容が見つかりません。</p>
        <Button variant="cancel" onClick={close}>
          閉じる
        </Button>
      </div>
    );
  }

  if (!request) {
    return <div className="confirm-window-page" />;
  }

  return (
    <ConfirmDialog
      asPage
      isOpen
      onClose={close}
      onConfirm={() => void confirm()}
      title={request.title}
      message={request.message}
      confirmText={request.confirmText}
      cancelText={request.cancelText}
      danger={request.danger}
      showCheckbox={request.checkbox !== undefined}
      checkboxLabel={request.checkbox?.label}
      checkboxChecked={checked}
      onCheckboxChange={setChecked}
    />
  );
};

export default WorkspaceConfirmPage;
