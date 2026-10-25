import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  RegisterItem,
  EditingAppItem,
  EditableJsonItem,
  RegisterWindowRequest,
} from '@common/types';
import { isEditableJsonItem, isEditingLauncherItem } from '@common/types';

import { useToast } from '../hooks/useToast';
import { logError } from '../utils/debug';
import { saveRegisterItems } from '../utils/registerItemSave';

import ConfirmDialog from './ConfirmDialog';
import RegisterModal from './RegisterModal';

interface RegisterWindowPageProps {
  requestId: string;
  request: RegisterWindowRequest;
}

/**
 * アイテムの登録・編集ページ（メイン画面が開く独立した子ウィンドウの中身）
 *
 * 保存はここでデータファイルに書き、メイン画面は data-changed で読み直す。
 * 結果（登録・更新・削除）はメインプロセス経由でメイン画面に知らせ、トーストはメイン画面が出す。
 * このウィンドウは閉じるだけでよい
 *
 * 管理画面の詳細編集（returnToOpener）では保存せず、フォームの内容を開き元へ返して閉じる。
 * 管理画面が未保存の編集状態に反映し、「変更を保存」で確定する。削除も開き元へ返し、
 * 管理画面で未保存の削除にする
 */
const RegisterWindowPage: React.FC<RegisterWindowPageProps> = ({ requestId, request }) => {
  const { t } = useTranslation();
  const { showError } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<EditingAppItem | null>(null);
  // フォルダの中身から開いたアイテムは、消すとフォルダ取込のアイテムごと消えるので削除を出さない
  const canDelete = !(
    request.editingItem &&
    !isEditableJsonItem(request.editingItem) &&
    isEditingLauncherItem(request.editingItem) &&
    request.editingItem.isDirExpanded
  );
  // 編集するアイテムを指すワークスペースの参照の数（帯と削除の確認に出す）
  const editingId = request.editingItem
    ? isEditableJsonItem(request.editingItem)
      ? request.editingItem.item.id
      : request.editingItem.jsonItemId
    : undefined;
  const [linkedCount, setLinkedCount] = useState(0);
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    window.electronAPI.workspaceAPI
      .countRefs([editingId])
      .then((counts) => {
        if (!cancelled) setLinkedCount(counts[editingId] ?? 0);
      })
      .catch((error) => {
        logError('ワークスペースの参照の数を読めませんでした:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [editingId]);
  /** 保存中に閉じる要求が来ても、保存が終わってから閉じるための待ち。false＝保存に失敗した */
  const pendingSave = useRef<Promise<boolean> | null>(null);

  const close = useCallback(() => {
    const pending = pendingSave.current;
    if (pending) {
      void pending.then((saved) => {
        if (saved) {
          window.close();
          return;
        }
        // 保存に失敗したら閉じずに残す（エラーを見せ、入力したままもう一度保存できるように。RM7）。
        // 次の「保存」・キャンセルでは、この失敗を待たない
        if (pendingSave.current === pending) pendingSave.current = null;
      });
    } else {
      window.close();
    }
  }, []);

  const handleRegister = useCallback(
    (items: RegisterItem[]) => {
      if (request.returnToOpener) {
        pendingSave.current = window.electronAPI
          .returnMainChildWindowValue(requestId, { kind: 'register', items })
          .then(
            () => true,
            (error) => {
              // 返せなかったときは、残しても保存し直せないので、今までどおり閉じる
              logError('編集内容を管理画面へ返せませんでした:', error);
              return true;
            }
          );
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
          return true;
        } catch (error) {
          logError('アイテムの保存に失敗しました:', error);
          showError(t('register.saveFailed'));
          return false;
        }
      })();
    },
    [request.editingItem, request.returnToOpener, requestId, showError, t]
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
    if (request.returnToOpener) {
      // 管理画面の詳細編集: 消すのは管理画面（未保存の削除になり、「変更を保存」で確定する）
      setDeleteTarget(null);
      pendingSave.current = window.electronAPI
        .returnMainChildWindowValue(requestId, { kind: 'delete' })
        .then(
          () => true,
          (error) => {
            logError('削除を管理画面へ返せませんでした:', error);
            return true;
          }
        );
      close();
      return;
    }
    try {
      if (!target.jsonItemId) {
        throw new Error(t('register.itemIdNotFound'));
      }
      await window.electronAPI.deleteItemsById([{ id: target.jsonItemId }]);
      window.electronAPI.notifyMainChildWindowResult({ kind: 'register', action: 'deleted' });
      setDeleteTarget(null);
      window.close();
    } catch (error) {
      logError('Failed to delete item:', error);
      showError(t('register.deleteFailed'));
      setDeleteTarget(null);
    }
  }, [close, deleteTarget, request.returnToOpener, requestId, showError, t]);

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
        addExcludeName={request.addExcludeName}
        onDelete={canDelete ? handleDeleteRequest : undefined}
        notice={linkedCount > 0 ? t('workspace.ref.editBanner', { count: linkedCount }) : undefined}
      />
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        message={
          deleteTarget
            ? [
                t('register.deleteConfirm', { name: deleteTarget.displayName }),
                ...(linkedCount > 0
                  ? [t('workspace.ref.deleteWarning', { count: linkedCount })]
                  : []),
              ].join('\n')
            : ''
        }
        danger={true}
      />
    </>
  );
};

export default RegisterWindowPage;
