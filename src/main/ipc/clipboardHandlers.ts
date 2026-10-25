import { IPC_CHANNELS } from '@common/ipcChannels';
import type { ClipboardContentSource } from '@common/types/clipboard';

import { ClipboardService } from '../services/clipboardService.js';
import { handleIpc } from '../utils/ipcWrapper';

export function setupClipboardHandlers(): void {
  const service = ClipboardService.getInstance();

  handleIpc(IPC_CHANNELS.CLIPBOARD_CHECK_CURRENT, () => service.checkCurrentClipboard());
  handleIpc(IPC_CHANNELS.CLIPBOARD_CAPTURE, () => service.captureClipboard());
  handleIpc(IPC_CHANNELS.CLIPBOARD_RESTORE, (_e, ref: string) => service.restoreClipboard(ref));
  handleIpc(IPC_CHANNELS.CLIPBOARD_CAPTURE_TO_SESSION, () => service.captureToSession());
  handleIpc(IPC_CHANNELS.CLIPBOARD_COMMIT_SESSION, (_e, id: string) => service.commitSession(id));
  handleIpc(IPC_CHANNELS.CLIPBOARD_DISCARD_SESSION, (_e, id: string) => service.discardSession(id));
  handleIpc(IPC_CHANNELS.CLIPBOARD_SAVE_TEXT, (_e, text: string) => service.saveText(text));
  handleIpc(IPC_CHANNELS.CLIPBOARD_READ_CONTENT, (_e, source: ClipboardContentSource) =>
    service.readContent(source)
  );
}
