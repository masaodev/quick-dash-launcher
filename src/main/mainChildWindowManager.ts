import { randomUUID } from 'crypto';

import { BrowserWindow, screen } from 'electron';
import type { BrowserWindowConstructorOptions, Rectangle } from 'electron';
import { windowLogger } from '@common/logger';
import { MAIN_CHILD_WINDOW_NAME_PREFIX } from '@common/constants';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type { MainChildWindowRequest, MainChildWindowResult } from '@common/types';

import { DEFAULT_WEB_PREFERENCES } from './utils/managedWindow.js';
import { calculateEditorBounds } from './utils/editorWindowBounds.js';
import { resolveMainChildWindowSpec } from './utils/mainChildWindowSpec.js';
import { getRendererHtmlUrl, openChildWindow } from './services/childWindowService.js';
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

/** ready-to-show が来ないときに表示する上限（ms） */
const SHOW_FALLBACK_TIMEOUT_MS = 1500;

/** requestId → 要求（ウィンドウが閉じるまで保持） */
const requests = new Map<string, MainChildWindowRequest>();

/** requestId → 子ウィンドウ */
const windows = new Map<string, BrowserWindow>();

/** 開いている子ウィンドウの数（0 → 1 でモーダルモード ON、1 → 0 で OFF） */
let openCount = 0;

/** メインウィンドウのあるディスプレイの作業領域（取れなければカーソルのあるディスプレイ） */
function resolveWorkArea(mainWindow: BrowserWindow | null): Rectangle {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return screen.getDisplayMatching(mainWindow.getBounds()).workArea;
  }
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
}

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
  const bounds = calculateEditorBounds(resolveWorkArea(mainWindow), spec.size);
  const hasParent = mainWindow !== null && !mainWindow.isDestroyed();

  const options: BrowserWindowConstructorOptions = {
    ...bounds,
    title: spec.title,
    frame: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#ffffff',
    // メインウィンドウに対してモーダルにする（前に出て、閉じるまでメイン画面を操作させない）
    ...(hasParent && { parent: mainWindow, modal: true }),
    webPreferences: DEFAULT_WEB_PREFERENCES,
  };

  requests.set(requestId, request);
  await enterModal();

  const name = `${MAIN_CHILD_WINDOW_NAME_PREFIX}${requestId}`;
  let win: BrowserWindow | null = null;
  try {
    win = await openChildWindow('main', { name, html: 'index.html', options });
    if (win) {
      windowLogger.info({ kind: request.kind }, '子ウィンドウをレンダラー共有で作成しました');
    } else {
      windowLogger.warn(
        { kind: request.kind },
        'レンダラー共有での生成に失敗したため子ウィンドウを直接生成します'
      );
      win = new BrowserWindow(options);
      void win.loadURL(
        `${getRendererHtmlUrl('index.html')}?childRequestId=${encodeURIComponent(requestId)}`
      );
    }
  } catch (error) {
    windowLogger.error({ error, kind: request.kind }, '子ウィンドウの生成に失敗しました');
    requests.delete(requestId);
    await leaveModal();
    return;
  }

  const created = win;
  created.setMenuBarVisibility(false);
  created.setMenu(null);
  windows.set(requestId, created);

  const showFallback = setTimeout(() => {
    if (!created.isDestroyed() && !created.isVisible()) {
      created.show();
    }
  }, SHOW_FALLBACK_TIMEOUT_MS);
  created.once('ready-to-show', () => {
    clearTimeout(showFallback);
    if (!created.isDestroyed()) {
      created.show();
      created.focus();
    }
  });

  await new Promise<void>((resolve) => {
    created.once('closed', () => {
      clearTimeout(showFallback);
      requests.delete(requestId);
      if (windows.get(requestId) === created) {
        windows.delete(requestId);
      }
      void leaveModal().finally(resolve);
    });
  });
}

/** 開いている子ウィンドウをすべて閉じる（アプリ終了時用） */
export function closeAllMainChildWindows(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.destroy();
  }
  windows.clear();
  requests.clear();
}
