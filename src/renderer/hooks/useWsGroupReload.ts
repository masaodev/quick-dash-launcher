import { useEffect } from 'react';
import type { AppItem } from '@common/types';
import { isWsGroupItem } from '@common/types/guards';

import { useLatestRef } from './useLatestRef';

/** ワークスペースの変更がまとめて届くことがあるので、少し待ってから 1 回だけ読み直す */
const RELOAD_DELAY_MS = 300;

/**
 * WSグループの行があるときだけ、ワークスペースの変更（グループの追加・改名・削除）で一覧を読み直す
 * （WSグループはワークスペースのグループから作るので、データファイルが変わらなくても中身が変わる）。
 * 展開が 0 件の行（グループがまだ無い・選んだグループを全部アーカイブした）は一覧に何も残らないので、
 * 一覧に無ければ main に行があるかを聞く
 */
export function useWsGroupReload(items: AppItem[], reload: () => Promise<unknown>): void {
  const itemsRef = useLatestRef(items);
  const reloadRef = useLatestRef(reload);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = window.electronAPI.onWorkspaceChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const needed =
          itemsRef.current.some(isWsGroupItem) ||
          (await window.electronAPI.hasWsGroupRows().catch(() => false));
        if (needed) void reloadRef.current();
      }, RELOAD_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
