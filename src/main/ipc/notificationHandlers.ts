/**
 * システム通知IPCハンドラー
 *
 * レンダラープロセスからの通知リクエストを処理します。
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { showNotification, NotificationOptions } from '../services/notificationService.js';
import { showToastWindow, ToastOptions } from '../services/toastWindowService.js';

/**
 * システム通知関連のIPCハンドラーを登録する
 */
export function setupNotificationHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_NOTIFICATION,
    async (_event, options: NotificationOptions): Promise<void> => {
      showNotification(options);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SHOW_TOAST_WINDOW,
    async (_event, options: ToastOptions): Promise<void> => {
      await showToastWindow(options);
    }
  );
}
