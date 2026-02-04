import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { showNotification, NotificationOptions } from '../services/notificationService.js';
import { showToastWindow, ToastOptions } from '../services/toastWindowService.js';

export function setupNotificationHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SHOW_NOTIFICATION, (_event, options: NotificationOptions) => {
    showNotification(options);
  });

  ipcMain.handle(IPC_CHANNELS.SHOW_TOAST_WINDOW, async (_event, options: ToastOptions) => {
    await showToastWindow(options);
  });
}
