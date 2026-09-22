import { BrowserWindow } from 'electron';
import { dataLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

/**
 * データ変更・ワークスペース変更を全ウィンドウへ通知する
 *
 * dataHandlers / workspaceHandlers の双方から使うため、どちらにも依存しない
 * 独立モジュールに置く（相互 import を作らない）。
 */

/**
 * データファイルの変更を全ウィンドウに通知する
 */
export function notifyDataChanged(): void {
  const allWindows = BrowserWindow.getAllWindows();

  for (const window of allWindows) {
    if (window.isDestroyed()) continue;

    if (window.webContents.isLoading()) {
      // 読み込み中の場合、読み込み完了後に通知
      window.webContents.once('did-finish-load', () => {
        if (!window.isDestroyed()) {
          window.webContents.send(IPC_CHANNELS.EVENT_DATA_CHANGED);
        }
      });
    } else {
      window.webContents.send(IPC_CHANNELS.EVENT_DATA_CHANGED);
    }
  }

  dataLogger.info({ windowCount: allWindows.length }, 'データ変更通知を送信しました');
}

/**
 * ワークスペースの変更を全ウィンドウに通知する
 */
export function notifyWorkspaceChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.webContents.send(IPC_CHANNELS.WORKSPACE_CHANGED);
  }
}
