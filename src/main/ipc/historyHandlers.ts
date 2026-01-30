import { ipcMain } from 'electron';
import { SearchHistoryEntry } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { SearchHistoryService } from '../services/searchHistoryService';

/**
 * 検索履歴関連のIPCハンドラーを設定する
 * @param configFolder 設定ファイルフォルダのパス
 */
export function setupHistoryHandlers(configFolder: string): void {
  const service = new SearchHistoryService(configFolder);

  ipcMain.handle(IPC_CHANNELS.LOAD_SEARCH_HISTORY, (): SearchHistoryEntry[] =>
    service.loadHistory()
  );

  ipcMain.handle(IPC_CHANNELS.SAVE_SEARCH_HISTORY, (_event, entries: SearchHistoryEntry[]): void =>
    service.saveHistory(entries)
  );

  ipcMain.handle(IPC_CHANNELS.ADD_SEARCH_HISTORY_ENTRY, (_event, query: string): void =>
    service.addHistoryEntry(query)
  );

  ipcMain.handle(IPC_CHANNELS.CLEAR_SEARCH_HISTORY, (): void => service.clearHistory());
}
