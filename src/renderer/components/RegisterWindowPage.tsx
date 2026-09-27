import React, { useCallback, useRef, useState } from 'react';
import type {
  RegisterItem,
  EditingAppItem,
  EditableJsonItem,
  RegisterWindowRequest,
} from '@common/types';

import { useToast } from '../hooks/useToast';
import { logError } from '../utils/debug';
import { saveRegisterItems } from '../utils/registerItemSave';

import ConfirmDialog from './ConfirmDialog';
import RegisterModal from './RegisterModal';

interface RegisterWindowPageProps {
  requestId: string;
  request: RegisterWindowRequest;
}

/** 管理画面から渡された編集対象か（メイン画面からは EditingAppItem） */
function isEditableJsonItem(item: EditingAppItem | EditableJsonItem): item is EditableJsonItem {
  return 'item' in item && 'meta' in item;
}

/**
 * アイテムの登録・編集ページ（メイン画面が開く独立した子ウィンドウの中身）
 *
 * 保存はここでデータファイルに書き、メイン画面は data-changed で読み直す。
 * 結果（登録・更新・削除）はメインプロセス経由でメイン画面に知らせ、トーストはメイン画面が出す。
 * このウィンドウは閉じるだけでよい
 *
 * 管理画面の詳細編集（returnToOpener）では保存せず、フォームの内容を開き元へ返して閉じる。
 * 管理画面が未保存の編集状態に反映し、「変更を保存」で確定する。削除はここでは出さない
 */
const RegisterWindowPage: React.FC<RegisterWindowPageProps> = ({ requestId, request }) => {
  const { showError } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<EditingAppItem | null>(null);
  /** 保存中に閉じる要求が来ても、保存が終わってから閉じるための待ち */
  const pendingSave = useRef<Promise<void> | null>(null);

  const close = useCallback(() => {
    const pending = pendingSave.current;
    if (pending) {
      void pending.finally(() => window.close());
    } else {
      window.close();
    }
  }, []);

  const handleRegister = useCallback(
    (items: RegisterItem[]) => {
      if (request.returnToOpener) {
        pendingSave.current = window.electronAPI
          .returnMainChildWindowValue(requestId, { kind: 'register', items })
          .catch((error) => {
            logError('編集内容を管理画面へ返せませんでした:', error);
          });
        return;
      }
      const editingItem =
        request.editingItem && !isEditableJsonItem(request.editingItem)
          ? request.editingItem
          : null;
      pendingSave.current = (async () => {
        try {
          const action = await saveRegisterItems(items, editingItem);
          window.electronAPI.notifyMainChildWindowResult({ kind: 'register', action });
        } catch (error) {
          logError('アイテムの保存に失敗しました:', error);
          showError('アイテムの保存に失敗しました');
          throw error;
        }
      })();
      // 失敗してもウィンドウは閉じる（エラーはログに残す。close 側の finally で閉じる）
      pendingSave.current.catch(() => {});
    },
    [request.editingItem, request.returnToOpener, requestId, showError]
  );

  const handleDeleteRequest = useCallback((item: EditingAppItem | EditableJsonItem) => {
    if (isEditableJsonItem(item)) {
      const editable = item;
      setDeleteTarget({
        ...editable.item,
        sourceFile: editable.meta.sourceFile,
        jsonItemId: editable.item.id,
      } as EditingAppItem);
    } else {
      setDeleteTarget(item as EditingAppItem);
    }
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    const target = deleteTarget;
    if (!target) return;
    try {
      if (!target.jsonItemId) {
        throw new Error('アイテムIDが見つかりません');
      }
      await window.electronAPI.deleteItemsById([{ id: target.jsonItemId }]);
      window.electronAPI.notifyMainChildWindowResult({ kind: 'register', action: 'deleted' });
      setDeleteTarget(null);
      window.close();
    } catch (error) {
      logError('Failed to delete item:', error);
      showError('アイテムの削除に失敗しました。');
      setDeleteTarget(null);
    }
  }, [deleteTarget, showError]);

  return (
    <>
      <RegisterModal
        asPage
        isOpen
        onClose={close}
        onRegister={handleRegister}
        droppedPaths={request.droppedPaths}
        editingItem={request.editingItem}
        currentTab={request.currentTab}
        initialCategory={request.initialCategory}
        onDelete={request.returnToOpener ? undefined : handleDeleteRequest}
      />
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        message={deleteTarget ? `「${deleteTarget.displayName}」を削除してもよろしいですか？` : ''}
        danger={true}
      />
    </>
  );
};

export default RegisterWindowPage;
