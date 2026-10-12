import { useEffect, useState } from 'react';

import { logError } from '../utils/debug';

/**
 * 設定「操作のヒントを表示」（showKeyboardHints）を読み、設定が変わったら追従する
 *
 * 読み込みが終わるまでは既定値（true）として扱う
 */
export function useShowKeyboardHints(): boolean {
  const [showKeyboardHints, setShowKeyboardHints] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await window.electronAPI.getSettings();
        if (!cancelled) setShowKeyboardHints(settings.showKeyboardHints ?? true);
      } catch (error) {
        logError('操作のヒントの設定の読み込みに失敗しました:', error);
      }
    };
    load();
    const unsubscribe = window.electronAPI.onSettingsChanged(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return showKeyboardHints;
}
