import { ipcMain } from 'electron';
import { SearchHistoryEntry } from '@common/types';
import {
  LOAD_SEARCH_HISTORY,
  SAVE_SEARCH_HISTORY,
  ADD_SEARCH_HISTORY_ENTRY,
  CLEAR_SEARCH_HISTORY,
} from '@common/ipcChannels.js';

import { SearchHistoryService } from '../services/searchHistoryService';

let searchHistoryService: SearchHistoryService | null = null;

/**
 * 検索履歴関連のIPCハンドラーを設定する
 * @param configFolder 設定ファイルフォルダのパス
 */
export function setupHistoryHandlers(configFolder: string) {
  searchHistoryService = new SearchHistoryService(configFolder);

  // 検索履歴の読み込み
  ipcMain.handle(LOAD_SEARCH_HISTORY, async (): Promise<SearchHistoryEntry[]> => {
    if (!searchHistoryService) return [];
    return searchHistoryService.loadHistory();
  });

  // 検索履歴の保存
  ipcMain.handle(
    SAVE_SEARCH_HISTORY,
    async (_event, entries: SearchHistoryEntry[]): Promise<void> => {
      if (!searchHistoryService) return;
      searchHistoryService.saveHistory(entries);
    }
  );

  // 検索履歴エントリーの追加
  ipcMain.handle(ADD_SEARCH_HISTORY_ENTRY, async (_event, query: string): Promise<void> => {
    if (!searchHistoryService) return;
    searchHistoryService.addHistoryEntry(query);
  });

  // 検索履歴のクリア
  ipcMain.handle(CLEAR_SEARCH_HISTORY, async (): Promise<void> => {
    if (!searchHistoryService) return;
    searchHistoryService.clearHistory();
  });
}
