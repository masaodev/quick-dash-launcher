import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import type { SearchHistoryEntry } from '@common/types';
import type { SearchBoxEditFlags } from '@common/types/electronApi';

import { useLatestRef } from './useLatestRef';

/** 元に戻す・やり直しが今できるか（入力欄の履歴は画面側でしか分からない） */
function isCommandEnabled(command: 'undo' | 'redo'): boolean {
  try {
    // 入力欄の元に戻せる状態を読む代わりの API が無い（Chromium では今も使える）。読めなければ押せるままにする
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.queryCommandEnabled(command);
  } catch {
    return true;
  }
}

/**
 * メインウィンドウの検索欄の右クリック（文字のメニューの下に「検索履歴 ▸」。A3-190）
 *
 * 入力欄の右クリックは普段 main 側でまとめて出す（editableContextMenu）が、検索欄は履歴を添えたいので
 * 画面側で受けて頼む。選んだ検索語は検索欄に入れるだけで、「検索履歴を消す」は確かめてから消す
 */
export function useSearchBoxContextMenu({
  historyEntries,
  onPickHistory,
  clearHistory,
}: {
  historyEntries: SearchHistoryEntry[];
  onPickHistory: (query: string) => void;
  clearHistory: () => Promise<void>;
}) {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const entriesRef = useLatestRef(historyEntries);
  const onPickHistoryRef = useLatestRef(onPickHistory);

  useEffect(() => {
    const cleanups = [
      window.electronAPI.onSearchBoxMenuPickHistory((query) => onPickHistoryRef.current(query)),
      window.electronAPI.onSearchBoxMenuClearHistory(() => setIsClearConfirmOpen(true)),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  const handleContextMenu = useCallback((e: MouseEvent<HTMLInputElement>) => {
    e.preventDefault();
    const input = e.currentTarget;
    const hasSelection = input.selectionStart !== input.selectionEnd;
    const flags: SearchBoxEditFlags = {
      canUndo: isCommandEnabled('undo'),
      canRedo: isCommandEnabled('redo'),
      canCut: hasSelection,
      canCopy: hasSelection,
      canPaste: true,
      canSelectAll: input.value.length > 0,
    };
    void window.electronAPI.showSearchBoxContextMenu(
      flags,
      entriesRef.current.map((entry) => entry.query)
    );
  }, []);

  const confirmClear = useCallback(async () => {
    setIsClearConfirmOpen(false);
    await clearHistory();
  }, [clearHistory]);

  const cancelClear = useCallback(() => setIsClearConfirmOpen(false), []);

  return { handleContextMenu, isClearConfirmOpen, confirmClear, cancelClear };
}
