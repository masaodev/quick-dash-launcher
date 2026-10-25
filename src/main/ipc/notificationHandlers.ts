import { IPC_CHANNELS } from '@common/ipcChannels';
import type { ToastOptions } from '@common/types';

import { showToastWindow } from '../services/overlayWindowService.js';
import { handleIpc } from '../utils/ipcWrapper';

export function setupNotificationHandlers(): void {
  handleIpc(IPC_CHANNELS.SHOW_TOAST_WINDOW, async (_event, options: ToastOptions) => {
    await showToastWindow(options);
  });
}
