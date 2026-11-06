import { IPC_CHANNELS } from '@common/ipcChannels';
import type { ClipboardContentSource } from '@common/types/clipboard';

import { PathManager } from '../config/pathManager.js';
import { ClipboardService } from '../services/clipboardService.js';
import { findUnusedClipboardData } from '../services/clipboardDataUsage.js';
import { LaunchUsageService } from '../services/launchUsageService.js';
import { mainI18n } from '../services/mainI18n.js';
import { handleIpc } from '../utils/ipcWrapper';
import { hideMainWindowOnExecute } from '../windowManager.js';

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
  // ランチャーの Enter。ほかの種類と同じく先にランチャーを隠し（ピン留め中は隠さない）、書き戻せたら
  // 起動の記録に数える（以前は隠さず、記録にも数えていなかった。A3-258）
  handleIpc(IPC_CHANNELS.CLIPBOARD_RESTORE_ITEM, async (_e, ref: string, itemId: string) => {
    hideMainWindowOnExecute();
    const result = await service.restoreClipboard(ref);
    if (result.success && itemId) await LaunchUsageService.getInstance()?.recordById(itemId);
    return result;
  });
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
