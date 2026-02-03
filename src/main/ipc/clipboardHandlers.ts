import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { ClipboardService } from '../services/clipboardService.js';

export function setupClipboardHandlers(): void {
  const service = ClipboardService.getInstance();

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CHECK_CURRENT, () => service.checkCurrentClipboard());
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CAPTURE, () => service.captureClipboard());
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_RESTORE, (_e, ref: string) =>
    service.restoreClipboard(ref)
  );
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_DELETE_DATA, (_e, ref: string) =>
    service.deleteClipboardData(ref)
  );
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_GET_PREVIEW, (_e, ref: string) =>
    service.getClipboardPreview(ref)
  );
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CAPTURE_TO_SESSION, () => service.captureToSession());
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_COMMIT_SESSION, (_e, id: string) =>
    service.commitSession(id)
  );
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_DISCARD_SESSION, (_e, id: string) =>
    service.discardSession(id)
  );
}
