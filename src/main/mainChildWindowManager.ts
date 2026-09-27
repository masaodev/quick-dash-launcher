import { randomUUID } from 'crypto';

import type { BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';
import { MAIN_CHILD_WINDOW_NAME_PREFIX } from '@common/constants';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type { MainChildWindowRequest, MainChildWindowResult } from '@common/types';

import { calculateEditorBounds } from './utils/editorWindowBounds.js';
import { resolveMainChildWindowSpec } from './utils/mainChildWindowSpec.js';
import { ModalChildWindows, resolveWorkArea } from './utils/modalChildWindows.js';
import { getMainWindow, setModalMode } from './windowManager.js';

/**
 * メイン画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果）
 *
 * 以前はメインウィンドウの中にモーダルを描き、ウィンドウを 850x1000 等に広げて中央へ
 * 動かしていた（閉じると元のサイズに戻すが位置は中央のまま。カーソル位置・固定位置の
 * 設定と食い違う）。管理ウィンドウのモーダルも同じ IPC を送っていたため、管理画面で
 * 詳細編集を開くだけでメインウィンドウが動いていた。
 *
 * ここではメインウィンドウを動かさず、要求（何を表示するか）をメインプロセスに預けて
 * 子ウィンドウを開く。子ウィンドウはメインのレンダラーから window.open で開く
 * （レンダラープロセス共有。常駐コストはほぼ増えない）。window.name の requestId で
 * 要求を引き取り、閉じたら破棄する。
 *
 * 子ウィンドウが開いている間はメインウィンドウをモーダルモードにし、フォーカスが
 * 外れても隠れないようにする（ウィンドウのサイズ・位置は変えない）。
 */

/** requestId → 要求（ウィンドウが閉じるまで保持） */
const requests = new Map<string, MainChildWindowRequest>();

/** requestId → 子ウィンドウ */
const windows = new ModalChildWindows();

/** 開いている子ウィンドウの数（0 → 1 でモーダルモード ON、1 → 0 で OFF） */
let openCount = 0;

async function enterModal(): Promise<void> {
  openCount += 1;
  if (openCount === 1) {
    await setModalMode(true);
  }
}

async function leaveModal(): Promise<void> {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) {
    await setModalMode(false);
  }
}

/**
 * 子ウィンドウに預けた要求を返す（レンダラーが起動時に取りに来る）
 * ウィンドウが閉じるまで保持するので、React の再マウント等で複数回呼ばれてもよい
 */
export function getMainChildWindowRequest(requestId: string): MainChildWindowRequest | null {
  return requests.get(requestId) ?? null;
}

/**
 * 子ウィンドウでの操作結果をメイン画面へ中継する（トースト表示用）
 */
export function relayMainChildWindowResult(result: MainChildWindowResult): void {
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IPC_CHANNELS.EVENT_MAIN_CHILD_WINDOW_RESULT, result);
}

/**
 * 子ウィンドウを開き、閉じられるまで待つ
 *
 * @returns 子ウィンドウが閉じたときに解決する Promise（開けなかったときは即座に解決）
 */
export async function openMainChildWindow(request: MainChildWindowRequest): Promise<void> {
  const mainWindow = getMainWindow();
  const requestId = randomUUID();
  const spec = resolveMainChildWindowSpec(request);

  requests.set(requestId, request);
  await enterModal();

  let win: BrowserWindow;
  try {
    win = await windows.open(requestId, {
      opener: 'main',
      name: `${MAIN_CHILD_WINDOW_NAME_PREFIX}${requestId}`,
      html: 'index.html',
      fallbackQuery: `childRequestId=${encodeURIComponent(requestId)}`,
      title: spec.title,
      bounds: calculateEditorBounds(resolveWorkArea(mainWindow), spec.size),
      // メインウィンドウに対してモーダルにする（前に出て、閉じるまでメイン画面を操作させない）
      parent: mainWindow,
      logContext: { kind: request.kind },
    });
  } catch (error) {
    windowLogger.error({ error, kind: request.kind }, '子ウィンドウの生成に失敗しました');
    requests.delete(requestId);
    await leaveModal();
    return;
  }

  await new Promise<void>((resolve) => {
    win.once('closed', () => {
      requests.delete(requestId);
      void leaveModal().finally(resolve);
    });
  });
}

/** 開いている子ウィンドウをすべて閉じる（アプリ終了時用） */
export function closeAllMainChildWindows(): void {
  windows.closeAll();
  requests.clear();
}
