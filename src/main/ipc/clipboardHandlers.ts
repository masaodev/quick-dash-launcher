import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type { ClipboardContentSource } from '@common/types/clipboard';

import { ClipboardService } from '../services/clipboardService.js';

export function setupClipboardHandlers(): void {
  const service = ClipboardService.getInstance();

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CHECK_CURRENT, () => service.checkCurrentClipboard());
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CAPTURE, () => service.captureClipboard());
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_RESTORE, (_e, ref: string) =>
    service.restoreClipboard(ref)
  );
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CAPTURE_TO_SESSION, () => service.captureToSession());
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_COMMIT_SESSION, (_e, id: string) =>
    service.commitSession(id)
  );
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_DISCARD_SESSION, (_e, id: string) =>
    service.discardSession(id)
  );
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_DUPLICATE_DATA, (_e, ref: string) =>
    service.duplicateClipboardData(ref)
  );
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_SAVE_TEXT, (_e, text: string) => service.saveText(text));
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_READ_CONTENT, (_e, source: ClipboardContentSource) =>
    service.readContent(source)
  );
}
