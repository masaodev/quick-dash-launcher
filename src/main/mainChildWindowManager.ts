import { randomUUID } from 'crypto';

import type { BrowserWindow, WebContents } from 'electron';
import { windowLogger } from '@common/logger';
import { MAIN_CHILD_WINDOW_NAME_PREFIX } from '@common/constants';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type {
  MainChildWindowRequest,
  MainChildWindowResult,
  MainChildWindowReturn,
} from '@common/types';

import { calculateEditorBounds } from './utils/editorWindowBounds.js';
import { resolveMainChildWindowSpec } from './utils/mainChildWindowSpec.js';
import { ModalChildWindows, resolveWorkArea } from './utils/modalChildWindows.js';
import type { ChildWindowOpenerKey } from './services/childWindowService.js';
import { getAdminWindow } from './adminWindowManager.js';
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
 *
 * 管理画面の詳細編集も同じ登録フォームを使う。管理画面から開いたときは管理ウィンドウを
 * 親・開き元にし、メインウィンドウには触らない。フォームは保存せず内容を返し
 * （returnToOpener）、管理画面が未保存の編集状態に反映する。
 */

/** requestId → 要求（ウィンドウが閉じるまで保持） */
const requests = new Map<string, MainChildWindowRequest>();

/** requestId → 子ウィンドウが返した内容（閉じたときに開き元へ渡す） */
const returns = new Map<string, MainChildWindowReturn>();

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

/** 子ウィンドウが開き元へ返す内容を預かる（閉じたときに openMainChildWindow の戻り値になる） */
export function setMainChildWindowReturn(requestId: string, value: MainChildWindowReturn): void {
  if (!requests.has(requestId)) return;
  returns.set(requestId, value);
}

/**
 * 子ウィンドウでの操作結果をメイン画面へ中継する（トースト表示用）
 */
export function relayMainChildWindowResult(result: MainChildWindowResult): void {
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IPC_CHANNELS.EVENT_MAIN_CHILD_WINDOW_RESULT, result);
}

/** 開き元（メイン画面か管理画面か）ごとの開き方 */
interface Caller {
  opener: ChildWindowOpenerKey;
  parent: BrowserWindow | null;
  /** 開いている間メインウィンドウをモーダルモードにするか */
  holdsMainModal: boolean;
}

function resolveCaller(sender: WebContents | undefined): Caller {
  const adminWindow = getAdminWindow();
  if (sender && adminWindow && sender === adminWindow.webContents) {
    return { opener: 'admin', parent: adminWindow, holdsMainModal: false };
  }
  return { opener: 'main', parent: getMainWindow(), holdsMainModal: true };
}

/**
 * 子ウィンドウを開き、閉じられるまで待つ
 *
 * @param sender 要求元の webContents（管理画面からなら管理ウィンドウを親にする）
 * @returns 子ウィンドウが閉じたときに、子が返した内容（なければ null）で解決する Promise
 *          （開けなかったときは即座に null）
 */
export async function openMainChildWindow(
  request: MainChildWindowRequest,
  sender?: WebContents
): Promise<MainChildWindowReturn | null> {
  const caller = resolveCaller(sender);
  const requestId = randomUUID();
  const spec = resolveMainChildWindowSpec(request);

  requests.set(requestId, request);
  if (caller.holdsMainModal) await enterModal();

  const cleanup = async (): Promise<MainChildWindowReturn | null> => {
    const value = returns.get(requestId) ?? null;
    requests.delete(requestId);
    returns.delete(requestId);
    if (caller.holdsMainModal) await leaveModal();
    return value;
  };

  let win: BrowserWindow;
  try {
    win = await windows.open(requestId, {
      opener: caller.opener,
      name: `${MAIN_CHILD_WINDOW_NAME_PREFIX}${requestId}`,
      html: 'index.html',
      fallbackQuery: `childRequestId=${encodeURIComponent(requestId)}`,
      title: spec.title,
      bounds: calculateEditorBounds(resolveWorkArea(caller.parent), spec.size),
      // 開き元に対してモーダルにする（前に出て、閉じるまで開き元を操作させない）
      parent: caller.parent,
      logContext: { kind: request.kind, opener: caller.opener },
    });
  } catch (error) {
    windowLogger.error({ error, kind: request.kind }, '子ウィンドウの生成に失敗しました');
    await cleanup();
    return null;
  }

  return new Promise<MainChildWindowReturn | null>((resolve) => {
    win.once('closed', () => {
      void cleanup().then(resolve);
    });
  });
}

/** 開いている子ウィンドウをすべて閉じる（アプリ終了時用） */
export function closeAllMainChildWindows(): void {
  windows.closeAll();
  requests.clear();
  returns.clear();
}
