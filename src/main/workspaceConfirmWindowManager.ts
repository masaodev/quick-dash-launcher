import { randomUUID } from 'crypto';

import { BrowserWindow } from 'electron';
import type { WebContents } from 'electron';
import { windowLogger } from '@common/logger';
import { WORKSPACE_CONFIRM_WINDOW_NAME_PREFIX } from '@common/constants';
import type { ConfirmWindowRequest, ConfirmWindowResult } from '@common/types';

import { calculateEditorBounds } from './utils/editorWindowBounds.js';
import { ModalChildWindows, resolveWorkArea } from './utils/modalChildWindows.js';

/**
 * ワークスペースの確認ウィンドウ（グループの削除・アーカイブ）
 *
 * 以前はワークスペースウィンドウの中に確認ダイアログを描き、ワークスペースが縮んでいて
 * 収まらないときはウィンドウを 600x400 まで広げていた（閉じると戻す）。ここでは開き元の
 * ウィンドウを動かさず、独立した子ウィンドウで確認する。
 *
 * 子ウィンドウはワークスペースのレンダラーから window.open で開く（レンダラープロセス共有）。
 * 要求は requestId で預かり、子ウィンドウは window.name から requestId を取り出して受け取る。
 * 確認されたら結果を預けて閉じ、閉じたときに開き元へ返す（キャンセル・閉じたときは null）。
 */

/** 確認ウィンドウの標準サイズ（作業領域で切り詰める） */
const CONFIRM_WINDOW_SIZE = { width: 520, height: 320 };

/** requestId → 要求（ウィンドウが閉じるまで保持） */
const requests = new Map<string, ConfirmWindowRequest>();

/** requestId → 確認結果 */
const results = new Map<string, ConfirmWindowResult>();

/** requestId → 確認ウィンドウ */
const windows = new ModalChildWindows();

/** 確認ウィンドウに預けた要求を返す（レンダラーが起動時に取りに来る） */
export function getWorkspaceConfirmRequest(requestId: string): ConfirmWindowRequest | null {
  return requests.get(requestId) ?? null;
}

/** 確認結果を預かる（閉じたときに openWorkspaceConfirm の戻り値になる） */
export function setWorkspaceConfirmResult(requestId: string, result: ConfirmWindowResult): void {
  if (!requests.has(requestId)) return;
  results.set(requestId, result);
}

/**
 * 確認ウィンドウを開き、閉じられるまで待つ
 *
 * @param caller 開き元（ワークスペース本体または切り離しウィンドウ）の webContents
 * @returns 確認されたら結果、キャンセル・閉じた・開けなかったときは null
 */
export async function openWorkspaceConfirm(
  caller: WebContents,
  request: ConfirmWindowRequest
): Promise<ConfirmWindowResult | null> {
  const requestId = randomUUID();
  const callerWindow = BrowserWindow.fromWebContents(caller);
  requests.set(requestId, request);

  const cleanup = (): ConfirmWindowResult | null => {
    const result = results.get(requestId) ?? null;
    requests.delete(requestId);
    results.delete(requestId);
    return result;
  };

  let win: BrowserWindow;
  try {
    win = await windows.open(requestId, {
      opener: 'workspace',
      name: `${WORKSPACE_CONFIRM_WINDOW_NAME_PREFIX}${requestId}`,
      html: 'workspace.html',
      fallbackQuery: `confirmRequestId=${encodeURIComponent(requestId)}`,
      title: request.title,
      bounds: calculateEditorBounds(resolveWorkArea(callerWindow), CONFIRM_WINDOW_SIZE),
      // 開き元に対してモーダルにする（前に出て、閉じるまで開き元を操作させない）
      parent: callerWindow,
      logContext: { kind: 'confirm' },
    });
  } catch (error) {
    windowLogger.error({ error }, '確認ウィンドウの生成に失敗しました');
    cleanup();
    return null;
  }

  return new Promise<ConfirmWindowResult | null>((resolve) => {
    win.once('closed', () => resolve(cleanup()));
  });
}

/** 開いている確認ウィンドウをすべて閉じる（アプリ終了時用） */
export function closeAllWorkspaceConfirms(): void {
  windows.closeAll();
  requests.clear();
  results.clear();
}
