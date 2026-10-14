import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type { ToastOptions } from '@common/types';

import { showToastWindow } from '../services/overlayWindowService.js';

export function setupNotificationHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SHOW_TOAST_WINDOW, async (_event, options: ToastOptions) => {
    await showToastWindow(options);
  });
}
