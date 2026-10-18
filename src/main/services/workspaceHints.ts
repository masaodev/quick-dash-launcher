import { BrowserWindow } from 'electron';
import type { WorkspaceHintKey } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { windowLogger } from '@common/logger';

import { WorkspaceService } from './workspace/index.js';

/**
 * 1 回だけ出す案内（ワークスペース・切り離しウィンドウの中の帯）
 *
 * 初めてワークスペースを開いたとき・初めてグループを切り離したときに、📌 と × の決まりを伝える。
 * 帯はウィンドウが自分で問い合わせて出し、「わかった」を押すまで出し続ける（押したら覚えて、もう出さない）。
 */

/** まだ「わかった」を押していない案内なら true（読めなければ出さない） */
export async function isHintPending(key: WorkspaceHintKey): Promise<boolean> {
  try {
    const ws = await WorkspaceService.getInstance();
    return await ws.isHintPending(key);
  } catch (error) {
    windowLogger.warn({ error, key }, '案内を出すかどうかを読めませんでした');
    return false;
  }
}

/** 「わかった」を覚え、同じ案内を出しているほかのウィンドウ（切り離しが複数あるとき）にも閉じさせる */
export async function dismissHint(key: WorkspaceHintKey): Promise<void> {
  try {
    const ws = await WorkspaceService.getInstance();
    await ws.dismissHint(key);
  } catch (error) {
    windowLogger.warn({ error, key }, '案内を閉じたことを保存できませんでした');
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC_CHANNELS.EVENT_HINT_DISMISSED, key);
  }
}
