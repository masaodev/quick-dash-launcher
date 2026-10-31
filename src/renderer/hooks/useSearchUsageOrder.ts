import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppItem } from '@common/types';
import type { LaunchUsageSnapshot } from '@common/types/launchUsage';

import { logError } from '../utils/debug';
import { launchCountOf } from '../utils/searchUsageOrder';

/**
 * 設定「検索結果をよく開く順に並べる」（searchSortByUsage）がオンのとき、起動の記録を読んで回数を引けるようにする
 *
 * オフのときは記録を読まず null を返す。記録はウィンドウに戻ってきたとき（focus）に読み直す
 * （ホットキーで出すたびに、直前に開いた分まで反映する）
 */
export function useSearchUsageOrder(): ((item: AppItem) => number) | null {
  const [enabled, setEnabled] = useState(false);
  const [usage, setUsage] = useState<LaunchUsageSnapshot | null>(null);
  const lastJson = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await window.electronAPI.getSettings();
        if (!cancelled) setEnabled(settings.searchSortByUsage ?? false);
      } catch (error) {
        logError('検索の設定の読み込みに失敗しました:', error);
      }
    };
    load();
    const unsubscribe = window.electronAPI.onSettingsChanged(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      window.electronAPI
        .getLaunchUsage()
        .then((next) => {
          if (cancelled) return;
          // 変わっていなければ置き換えない（戻ってくるたびに一覧を並べ直さないように）
          const json = JSON.stringify(next);
          if (json === lastJson.current) return;
          lastJson.current = json;
          setUsage(next);
        })
        .catch((error) => logError('起動の記録を読めませんでした:', error));
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
    };
  }, [enabled]);

  const countOf = useCallback((item: AppItem) => (usage ? launchCountOf(item, usage) : 0), [usage]);
  return enabled ? countOf : null;
}
