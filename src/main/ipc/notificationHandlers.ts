/**
 * システム通知IPCハンドラー
 *
 * レンダラープロセスからの通知リクエストを処理します。
 */

import { ipcMain } from 'electron';
import { SHOW_NOTIFICATION } from '@common/ipcChannels.js';

import {
  showNotification,
  NotificationOptions,
  NotificationType,
} from '../services/notificationService.js';

export interface ShowNotificationRequest {
  title: string;
  body: string;
  type?: NotificationType;
}

export function setupNotificationHandlers(): void {
  ipcMain.handle(
    SHOW_NOTIFICATION,
    async (_event, request: ShowNotificationRequest): Promise<void> => {
      const options: NotificationOptions = {
        title: request.title,
        body: request.body,
        type: request.type,
      };

      showNotification(options);
    }
  );
}
