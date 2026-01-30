import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchHistoryState, SearchHistoryEntry } from '@common/types';

import { logError } from '../utils/debug';

const INITIAL_STATE: SearchHistoryState = {
  entries: [],
  currentIndex: -1,
};

/**
 * 検索履歴の管理を行うカスタムフック
 * キーボードナビゲーションでの履歴巡回機能を提供する
 */
export function useSearchHistory() {
  const [historyState, setHistoryState] = useState<SearchHistoryState>(INITIAL_STATE);
  const entriesRef = useRef<SearchHistoryEntry[]>([]);

  // entriesRefを最新に保つ
  useEffect(() => {
    entriesRef.current = historyState.entries;
  }, [historyState.entries]);

  const loadHistory = useCallback(async () => {
    try {
      const entries = await window.electronAPI.loadSearchHistory();
      setHistoryState({ entries, currentIndex: -1 });
    } catch (error) {
      logError('検索履歴の読み込みに失敗しました:', error);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 前の履歴項目に移動（Ctrl + ↑）
  const navigateToPrevious = useCallback((): string | null => {
    const entries = entriesRef.current;
    if (entries.length === 0) return null;

    let newIndex = -1;
    setHistoryState((prev) => {
      newIndex = Math.min(prev.currentIndex + 1, entries.length - 1);
      return { ...prev, currentIndex: newIndex };
    });

    // setHistoryStateは非同期だが、newIndexは同期的に計算済み
    const targetIndex = Math.min(historyState.currentIndex + 1, entries.length - 1);
    return entries[Math.max(0, targetIndex)]?.query ?? null;
  }, [historyState.currentIndex]);

  // 次の履歴項目に移動（Ctrl + ↓）
  const navigateToNext = useCallback((): string | null => {
    const entries = entriesRef.current;
    if (entries.length === 0 || historyState.currentIndex <= 0) {
      setHistoryState((prev) => ({ ...prev, currentIndex: -1 }));
      return '';
    }

    const newIndex = historyState.currentIndex - 1;
    setHistoryState((prev) => ({ ...prev, currentIndex: newIndex }));
    return entries[newIndex]?.query ?? null;
  }, [historyState.currentIndex]);

  const resetNavigation = useCallback(() => {
    setHistoryState((prev) => ({ ...prev, currentIndex: -1 }));
  }, []);

  const addHistoryEntry = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      try {
        await window.electronAPI.addSearchHistoryEntry(query);
        await loadHistory();
      } catch (error) {
        logError('検索履歴の追加に失敗しました:', error);
      }
    },
    [loadHistory]
  );

  const clearHistory = useCallback(async () => {
    try {
      await window.electronAPI.clearSearchHistory();
      setHistoryState(INITIAL_STATE);
    } catch (error) {
      logError('検索履歴のクリアに失敗しました:', error);
    }
  }, []);

  return {
    historyState,
    navigateToPrevious,
    navigateToNext,
    resetNavigation,
    addHistoryEntry,
    clearHistory,
    loadHistory,
  };
}
