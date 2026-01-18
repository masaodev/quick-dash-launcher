import { ipcMain } from 'electron';
import { SearchHistoryEntry } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { SearchHistoryService } from '../services/searchHistoryService';

let searchHistoryService: SearchHistoryService | null = null;

/**
 * 検索履歴関連のIPCハンドラーを設定する
 * @param configFolder 設定ファイルフォルダのパス
 */
export function setupHistoryHandlers(configFolder: string) {
  searchHistoryService = new SearchHistoryService(configFolder);

  // 検索履歴の読み込み
  ipcMain.handle(IPC_CHANNELS.LOAD_SEARCH_HISTORY, async (): Promise<SearchHistoryEntry[]> => {
    if (!searchHistoryService) return [];
    return searchHistoryService.loadHistory();
  });

  // 検索履歴の保存
  ipcMain.handle(
    IPC_CHANNELS.SAVE_SEARCH_HISTORY,
    async (_event, entries: SearchHistoryEntry[]): Promise<void> => {
      if (!searchHistoryService) return;
      searchHistoryService.saveHistory(entries);
    }
  );

  // 検索履歴エントリーの追加
  ipcMain.handle(
    IPC_CHANNELS.ADD_SEARCH_HISTORY_ENTRY,
    async (_event, query: string): Promise<void> => {
      if (!searchHistoryService) return;
      searchHistoryService.addHistoryEntry(query);
    }
  );

  // 検索履歴のクリア
  ipcMain.handle(IPC_CHANNELS.CLEAR_SEARCH_HISTORY, async (): Promise<void> => {
    if (!searchHistoryService) return;
    searchHistoryService.clearHistory();
  });
}
