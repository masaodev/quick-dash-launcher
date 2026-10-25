import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppItem } from '@common/types';
import { isWindowInfo } from '@common/types/guards';
import { getDeletableItemId } from '@common/utils/launcherItemDelete';

import { logError } from '../utils/debug';
import { setUsageWarning } from '../utils/setUsageWarning';

interface DeleteTarget {
  id: string;
  name: string;
  /** このアイテムを参照しているワークスペースのアイテムの数 */
  linkedCount: number;
  /** このアイテムを行で指しているセットの名前（A3-79 #6） */
  setNames: string[];
}

/**
 * メインウィンドウの右クリック「削除…」
 *
 * 確認はメインウィンドウの中に出す（登録・編集画面の削除と同じ文面。参照しているワークスペースの
 * アイテムがあれば、その数も添える）。確認を出している間は Esc でウィンドウを隠さない。
 *
 * @returns dialog: 確認ダイアログに渡す中身（出していないときは null）
 */
export function useLauncherItemDelete(onError: (message: string) => void) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    return window.electronAPI.onLauncherMenuDeleteItem((item: AppItem) => {
      const id = getDeletableItemId(item);
      if (!id || isWindowInfo(item)) return;
      const name = item.displayName;
      const linkedCount = window.electronAPI.workspaceAPI
        .countRefs([id])
        .then((counts) => counts[id] ?? 0)
        .catch((error) => {
          logError('ワークスペースの参照の数を読めませんでした:', error);
          return 0;
        });
      const setNames = window.electronAPI.findSetsUsingItems([id]).catch((error) => {
        logError('アイテムを使っているセットを読めませんでした:', error);
        return [] as string[];
      });
      void Promise.all([linkedCount, setNames]).then(([count, names]) =>
        setTarget({ id, name, linkedCount: count, setNames: names })
      );
    });
  }, []);

  // 確認を出している間は、Esc をページ（確認ダイアログ）が受ける
  const isOpen = target !== null;
  useEffect(() => {
    window.electronAPI.setEscapeHandledByPage?.(isOpen);
  }, [isOpen]);

  const cancel = useCallback(() => setTarget(null), []);

  const confirm = useCallback(async () => {
    if (!target) return;
    setTarget(null);
    try {
      // 消したら本体がデータの変更を知らせ、一覧は読み直される
      await window.electronAPI.deleteItemsById([{ id: target.id }]);
    } catch (error) {
      logError('アイテムの削除に失敗しました:', error);
      onError(t('register.deleteFailed'));
    }
  }, [onError, t, target]);

  const dialog = target
    ? {
        message: [
          t('register.deleteConfirm', { name: target.name }),
          ...(target.linkedCount > 0
            ? [t('workspace.ref.deleteWarning', { count: target.linkedCount })]
            : []),
          ...(setUsageWarning(target.setNames, t) ?? []),
        ].join('\n'),
        onConfirm: () => void confirm(),
        onClose: cancel,
      }
    : null;

  return { dialog, isOpen };
}
