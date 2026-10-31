import { useCallback, useState } from 'react';
import type { EditingAppItem, RegisterWindowRequest } from '@common/types';

import { logError } from '../utils/debug';

/** 開くときに要求へ載せる内容（種別と今のタブはこのフックが付ける） */
type RegisterWindowContent = Pick<
  RegisterWindowRequest,
  'droppedPaths' | 'editingItem' | 'addExcludeName' | 'initialCategory'
>;

/**
 * アイテムの登録・編集ウィンドウを開くフック（ランチャー用）
 *
 * 以前はランチャーの中に RegisterModal を描き、ウィンドウを 850x1000 に広げていた。
 * 今は要求をメインプロセスに渡して独立した子ウィンドウで開く（ランチャーは動かさない）。
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
    (item: EditingAppItem, options: { addExcludeName?: string } = {}) =>
      open({ droppedPaths: [], editingItem: item, ...options }),
    [open]
  );

  /** 新規登録をフォルダ取込の種別で開く（➕ のメニュー・空のタブから。A3-180） */
  const openFolderImportWindow = useCallback(
    () => open({ droppedPaths: [], editingItem: null, initialCategory: 'dir' }),
    [open]
  );

  /** ドロップされたファイル・URL を初期値にして開く */
  const openWithDroppedPaths = useCallback(
    (paths: string[]) => open({ droppedPaths: paths, editingItem: null }),
    [open]
  );

  return {
    isRegisterWindowOpen,
    openRegisterWindow,
    openEditWindow,
    openFolderImportWindow,
    openWithDroppedPaths,
  };
}
