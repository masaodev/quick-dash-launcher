import { SearchHistoryEntry } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { SearchHistoryService } from '../services/searchHistoryService';
import { handleIpc } from '../utils/ipcWrapper';

/**
 * 検索履歴関連のIPCハンドラーを設定する
 * @param configFolder 設定ファイルフォルダのパス
 */
export function setupHistoryHandlers(configFolder: string): void {
  const service = new SearchHistoryService(configFolder);

  handleIpc(IPC_CHANNELS.LOAD_SEARCH_HISTORY, (): SearchHistoryEntry[] => service.loadHistory());

  handleIpc(IPC_CHANNELS.ADD_SEARCH_HISTORY_ENTRY, (_event, query: string): void =>
    service.addHistoryEntry(query)
  );

  handleIpc(IPC_CHANNELS.CLEAR_SEARCH_HISTORY, (): void => service.clearHistory());
}
