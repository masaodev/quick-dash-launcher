import { useEffect, useState } from 'react';

import { logError } from '../utils/debug';
import { setSearchNormalization } from '../utils/dataParser';

/**
 * 設定「検索で全角と半角を区別しない」「検索でひらがなとカタカナを区別しない」を読んで検索に入れ、
 * 設定が変わったら追従する
 *
 * 返り値は、一覧を絞り直すきっかけ（useMemo の依存）に使う文字列。読み込みが終わるまでは既定値（どちらもオフ）
 */
export function useSearchNormalization(): string {
  const [key, setKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await window.electronAPI.getSettings();
        if (cancelled) return;
        const ignoreWidth = settings.searchIgnoreWidth ?? false;
        const ignoreKana = settings.searchIgnoreKana ?? false;
        setSearchNormalization({ ignoreWidth, ignoreKana });
        setKey(`${ignoreWidth}|${ignoreKana}`);
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

  return key;
}
