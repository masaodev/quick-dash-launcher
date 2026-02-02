/**
 * クリップボード関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { ClipboardService } from '../services/clipboardService.js';

/**
 * クリップボード関連のIPCハンドラーをセットアップ
 */
export function setupClipboardHandlers(): void {
  const clipboardService = ClipboardService.getInstance();

  // 現在のクリップボード状態を確認
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CHECK_CURRENT, async () => {
    return await clipboardService.checkCurrentClipboard();
  });

  // クリップボードをキャプチャ
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CAPTURE, async () => {
    return await clipboardService.captureClipboard();
  });

  // クリップボードを復元
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_RESTORE, async (_event, dataFileRef: string) => {
    return await clipboardService.restoreClipboard(dataFileRef);
  });

  // クリップボードデータを削除
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_DELETE_DATA, async (_event, dataFileRef: string) => {
    return await clipboardService.deleteClipboardData(dataFileRef);
  });

  // クリップボードプレビューを取得
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_GET_PREVIEW, async (_event, dataFileRef: string) => {
    return await clipboardService.getClipboardPreview(dataFileRef);
  });
}
