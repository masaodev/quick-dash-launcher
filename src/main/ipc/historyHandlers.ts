import { ipcMain } from 'electron';
import { SearchHistoryService } from '../services/searchHistoryService';
import { SearchHistoryEntry } from '@common/types';

let searchHistoryService: SearchHistoryService | null = null;

/**
 * 検索履歴関連のIPCハンドラーを設定する
 * @param configFolder 設定ファイルフォルダのパス
 */
export function setupHistoryHandlers(configFolder: string) {
  searchHistoryService = new SearchHistoryService(configFolder);

  // 検索履歴の読み込み
  ipcMain.handle('load-search-history', async (): Promise<SearchHistoryEntry[]> => {
    if (!searchHistoryService) return [];
    return searchHistoryService.loadHistory();
  });

  // 検索履歴の保存
  ipcMain.handle('save-search-history', async (_event, entries: SearchHistoryEntry[]): Promise<void> => {
    if (!searchHistoryService) return;
    searchHistoryService.saveHistory(entries);
  });

  // 検索履歴エントリーの追加
  ipcMain.handle('add-search-history-entry', async (_event, query: string): Promise<void> => {
    if (!searchHistoryService) return;
    searchHistoryService.addHistoryEntry(query);
  });

  // 検索履歴のクリア
  ipcMain.handle('clear-search-history', async (): Promise<void> => {
    if (!searchHistoryService) return;
    searchHistoryService.clearHistory();
  });
}