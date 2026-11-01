import { useEffect, useState } from 'react';
import { listWsGroupCandidates, type WsGroupCandidate } from '@common/utils/wsGroupExpansion';

import { logError } from '../utils/debug';

/** ワークスペースの変更がまとめて届くことがあるので、少し待ってから 1 回だけ読み直す */
const RELOAD_DELAY_MS = 300;

/**
 * WSグループで選べるグループの一覧を読み、ワークスペースが変わったら読み直す
 * （アイテム管理で、WSグループの行が指すグループが見つかるかを確かめるのに使う）
 *
 * @param enabled false の間は読まない（WSグループの行が無いとき）
 * @returns 読めるまでは null。読めなかったときも null のまま（見つからないとは数えない）
 */
export function useWsGroupCandidates(enabled: boolean): WsGroupCandidate[] | null {
  const [candidates, setCandidates] = useState<WsGroupCandidate[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      const api = window.electronAPI.workspaceAPI;
      Promise.all([api.loadWorkspaces(), api.loadGroups(), api.loadArchivedGroups()])
        .then(([workspaces, groups, archivedGroups]) => {
          if (!cancelled) setCandidates(listWsGroupCandidates(workspaces, groups, archivedGroups));
        })
        .catch((error) => {
          logError('アイテム管理でワークスペースのグループを読めませんでした:', error);
        });
    };
    load();
    const unsubscribe = window.electronAPI.onWorkspaceChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(load, RELOAD_DELAY_MS);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled]);

  return candidates;
}
