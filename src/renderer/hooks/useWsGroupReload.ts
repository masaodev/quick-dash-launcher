import { useEffect } from 'react';
import type { AppItem } from '@common/types';
import { isWsGroupItem } from '@common/types/guards';

import { useLatestRef } from './useLatestRef';

/** ワークスペースの変更がまとめて届くことがあるので、少し待ってから 1 回だけ読み直す */
const RELOAD_DELAY_MS = 300;

/**
 * WSグループのアイテムを並べているときだけ、ワークスペースの変更（グループの追加・改名・削除）で一覧を読み直す
 * （WSグループはワークスペースのグループから作るので、データファイルが変わらなくても中身が変わる）
 */
export function useWsGroupReload(items: AppItem[], reload: () => Promise<unknown>): void {
  const itemsRef = useLatestRef(items);
  const reloadRef = useLatestRef(reload);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = window.electronAPI.onWorkspaceChanged(() => {
      if (!itemsRef.current.some(isWsGroupItem)) return;
      clearTimeout(timer);
      timer = setTimeout(() => void reloadRef.current(), RELOAD_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
