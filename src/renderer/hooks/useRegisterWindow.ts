import { useCallback, useState } from 'react';
import type { EditingAppItem, RegisterWindowRequest, WorkspaceItem } from '@common/types';
import { workspaceItemToRegisterItem } from '@common/utils/workspaceConverters';

import { logError } from '../utils/debug';

/** 開くときに要求へ載せる内容（種別と今のタブはこのフックが付ける） */
type RegisterWindowContent = Pick<
  RegisterWindowRequest,
  'droppedPaths' | 'editingItem' | 'prefillItems'
>;

/**
 * アイテムの登録・編集ウィンドウを開くフック（メイン画面用）
 *
 * 以前はメイン画面の中に RegisterModal を描き、ウィンドウを 850x1000 に広げていた。
 * 今は要求をメインプロセスに渡して独立した子ウィンドウで開く（メインウィンドウは動かさない）。
 * 開いている間は isRegisterWindowOpen が true になる（ドロップ受付の抑止に使う）
 */
export function useRegisterWindow(getCurrentTab: () => string | undefined) {
  const [isRegisterWindowOpen, setIsRegisterWindowOpen] = useState(false);

  const open = useCallback(
    async (content: RegisterWindowContent) => {
      setIsRegisterWindowOpen(true);
      try {
        await window.electronAPI.openMainChildWindow({
          kind: 'register',
          ...content,
          currentTab: getCurrentTab(),
        });
      } catch (error) {
        logError('登録ウィンドウを開けませんでした:', error);
      } finally {
        setIsRegisterWindowOpen(false);
      }
    },
    [getCurrentTab]
  );

  /** 新規登録で開く */
  const openRegisterWindow = useCallback(
    () => open({ droppedPaths: [], editingItem: null }),
    [open]
  );

  /** 既存アイテムの編集で開く */
  const openEditWindow = useCallback(
    (item: EditingAppItem) => open({ droppedPaths: [], editingItem: item }),
    [open]
  );

  /** ドロップされたファイル・URL を初期値にして開く */
  const openWithDroppedPaths = useCallback(
    (paths: string[]) => open({ droppedPaths: paths, editingItem: null }),
    [open]
  );

  /** ワークスペースのアイテムを初期値にして開く（メインウィンドウへの登録） */
  const openWithWorkspaceItem = useCallback(
    (item: WorkspaceItem) =>
      open({
        droppedPaths: [],
        editingItem: null,
        prefillItems: [workspaceItemToRegisterItem(item)],
      }),
    [open]
  );

  return {
    isRegisterWindowOpen,
    openRegisterWindow,
    openEditWindow,
    openWithDroppedPaths,
    openWithWorkspaceItem,
  };
}
