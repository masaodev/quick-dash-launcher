import { useState, useEffect, useCallback } from 'react';
import { SearchHistoryEntry, SearchHistoryState } from '@common/types';

/**
 * 検索履歴の管理を行うカスタムフック
 * キーボードナビゲーションでの履歴巡回機能を提供する
 */
export function useSearchHistory() {
  const [historyState, setHistoryState] = useState<SearchHistoryState>({
    entries: [],
    currentIndex: -1,
  });

  // 検索履歴をロードする
  const loadHistory = useCallback(async () => {
    try {
      const entries = await window.electronAPI.loadSearchHistory();
      setHistoryState(prevState => ({
        ...prevState,
        entries,
        currentIndex: -1, // 履歴ナビゲーションをリセット
      }));
    } catch (error) {
      console.error('検索履歴の読み込みに失敗しました:', error);
    }
  }, []);

  // 初回ロード
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 前の履歴項目に移動（Ctrl + ↑）
  const navigateToPrevious = useCallback((): string | null => {
    setHistoryState(prevState => {
      if (prevState.entries.length === 0) return prevState;

      const newIndex = prevState.currentIndex < prevState.entries.length - 1
        ? prevState.currentIndex + 1
        : prevState.entries.length - 1;

      return {
        ...prevState,
        currentIndex: newIndex,
      };
    });

    // 現在の履歴エントリーのクエリを返す
    const currentEntry = historyState.entries[historyState.currentIndex >= 0 
      ? Math.min(historyState.currentIndex + 1, historyState.entries.length - 1)
      : 0];
    
    return currentEntry?.query || null;
  }, [historyState.entries, historyState.currentIndex]);

  // 次の履歴項目に移動（Ctrl + ↓）
  const navigateToNext = useCallback((): string | null => {
    setHistoryState(prevState => {
      if (prevState.entries.length === 0 || prevState.currentIndex <= 0) {
        return {
          ...prevState,
          currentIndex: -1, // 履歴ナビゲーションを終了
        };
      }

      const newIndex = prevState.currentIndex - 1;
      return {
        ...prevState,
        currentIndex: newIndex,
      };
    });

    // 現在の履歴エントリーのクエリを返す（または空文字列）
    const newIndex = historyState.currentIndex - 1;
    if (newIndex < 0) {
      return ''; // 履歴から抜ける場合は空文字列を返す
    }

    const currentEntry = historyState.entries[newIndex];
    return currentEntry?.query || null;
  }, [historyState.entries, historyState.currentIndex]);

  // 履歴ナビゲーションをリセット
  const resetNavigation = useCallback(() => {
    setHistoryState(prevState => ({
      ...prevState,
      currentIndex: -1,
    }));
  }, []);

  // 新しい検索履歴エントリーを追加
  const addHistoryEntry = useCallback(async (query: string) => {
    if (!query.trim()) return;

    try {
      await window.electronAPI.addSearchHistoryEntry(query);
      // 履歴を再ロードしてUIを更新
      await loadHistory();
    } catch (error) {
      console.error('検索履歴の追加に失敗しました:', error);
    }
  }, [loadHistory]);

  // 検索履歴をクリア
  const clearHistory = useCallback(async () => {
    try {
      await window.electronAPI.clearSearchHistory();
      setHistoryState({
        entries: [],
        currentIndex: -1,
      });
    } catch (error) {
      console.error('検索履歴のクリアに失敗しました:', error);
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