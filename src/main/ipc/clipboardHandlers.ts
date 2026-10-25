import { IPC_CHANNELS } from '@common/ipcChannels';
import type { ClipboardContentSource } from '@common/types/clipboard';

import { PathManager } from '../config/pathManager.js';
import { ClipboardService } from '../services/clipboardService.js';
import { findUnusedClipboardData } from '../services/clipboardDataUsage.js';
import { mainI18n } from '../services/mainI18n.js';
import { handleIpc } from '../utils/ipcWrapper';

/** どのアイテムからも使われていない実データ（読めないファイルがあれば、消してよいかを決められないので例外） */
function unusedClipboardDataOrThrow(): string[] {
  const refs = findUnusedClipboardData(PathManager.getConfigFolder());
  if (!refs) throw new Error(mainI18n.t('clipboardService.unusedDataUnreadable'));
  return refs;
}

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
  handleIpc(IPC_CHANNELS.CLIPBOARD_COUNT_UNUSED_DATA, () => unusedClipboardDataOrThrow().length);
  handleIpc(IPC_CHANNELS.CLIPBOARD_DELETE_UNUSED_DATA, async () => {
    const refs = unusedClipboardDataOrThrow();
    let deleted = 0;
    for (const ref of refs) {
      if (await service.deleteClipboardData(ref)) deleted++;
    }
    return deleted;
  });
}
