import type { WorkspaceHintKey } from '@common/types';
import { windowLogger } from '@common/logger';

import { LONG_TOAST_DURATION_MS, showToastWindow } from './overlayWindowService.js';
import { mainI18n } from './mainI18n.js';
import { WorkspaceService } from './workspace/index.js';

/** 案内の文言キー */
const HINT_MESSAGE_KEYS = {
  workspaceOpened: 'toast.hints.workspaceOpened',
  groupDetached: 'toast.hints.groupDetached',
} as const satisfies Record<WorkspaceHintKey, string>;

/**
 * 1 回だけ出す案内をトーストで出す（もう出していれば何もしない）
 *
 * 初めてワークスペースを開いたとき・初めてグループを切り離したときに、📌 と × の決まりを伝える
 */
export async function showHintOnce(key: WorkspaceHintKey): Promise<void> {
  try {
    const ws = await WorkspaceService.getInstance();
    if (!(await ws.takeHint(key))) return;
    await showToastWindow({
      message: mainI18n.t(HINT_MESSAGE_KEYS[key]),
      type: 'info',
      duration: LONG_TOAST_DURATION_MS,
    });
  } catch (error) {
    windowLogger.warn({ error, key }, '案内のトーストを出せませんでした');
  }
}
