import { useEffect, useState } from 'react';

import { logError } from '../utils/debug';
import { setSearchMemo } from '../utils/dataParser';

/**
 * 設定「検索でメモにも当てる」（searchMemo）を読んで検索に入れ、設定が変わったら追従する
 *
 * 返り値は、一覧を絞り直すきっかけ（useMemo の依存）に使う。読み込みが終わるまでは既定値（false）
 */
export function useSearchMemo(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await window.electronAPI.getSettings();
        if (cancelled) return;
        const value = settings.searchMemo ?? false;
        setSearchMemo(value);
        setEnabled(value);
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

  return enabled;
}
