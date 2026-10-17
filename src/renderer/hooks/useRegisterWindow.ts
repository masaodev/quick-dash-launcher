import { useCallback, useState } from 'react';
import type {
  EditingAppItem,
  RegisterItem,
  RegisterWindowRequest,
  WorkspaceItem,
} from '@common/types';
import {
  expandWorkspaceSetEntries,
  workspaceItemToRegisterItem,
} from '@common/utils/workspaceConverters';

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

  /**
   * ワークスペースのアイテムを初期値にして開く（メインウィンドウへの登録）
   *
   * セットは、ワークスペースのアイテムを指す行をパスを書いた行に置き換えてから開く
   * （メインウィンドウのセットはワークスペースのアイテムを探さないため）
   */
  const openWithWorkspaceItem = useCallback(
    async (item: WorkspaceItem) => {
      const prefill: RegisterItem = workspaceItemToRegisterItem(item);
      if (item.type === 'set') {
        try {
          const workspaceItems = await window.electronAPI.workspaceAPI.loadItems();
          prefill.setEntries = expandWorkspaceSetEntries(item.entries, workspaceItems);
        } catch (error) {
          // 読めなければ置き換えずに開く（指す先の無い行は登録画面に「アイテムが見つかりません」と出る）
          logError('ワークスペースのアイテムを読めませんでした:', error);
        }
      }
      await open({ droppedPaths: [], editingItem: null, prefillItems: [prefill] });
    },
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
