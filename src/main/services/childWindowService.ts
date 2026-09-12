import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

import { ipcMain, net } from 'electron';
import type { BrowserWindow, BrowserWindowConstructorOptions, WebContents } from 'electron';
import { windowLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { EnvConfig } from '../config/envConfig.js';

/**
 * レンダラープロセス共有の子ウィンドウ生成サービス
 *
 * メインプロセスで BrowserWindow を作るとウィンドウごとにレンダラープロセスが立ち、
 * 1枚あたり約60MBの固定メモリを消費する。開き元となるレンダラーに window.open を
 * 依頼すると、子ウィンドウは開き元と同じレンダラープロセスを共有する。
 *
 * Electron 44 では window.open の子を URL へナビゲーションさせると preload が
 * 適用されないため、about:blank で開き、対象 HTML の内容を開き元が document.write で
 * 書き込む。相対パスは開き元ドキュメントの URL を基準に解決される（同じ dist 配下）。
 *
 * 生成された BrowserWindow は did-create-window で受け取り、以降の管理（表示・位置・
 * イベント）は呼び出し側が通常の BrowserWindow と同じように行う。
 *
 * 注意: 子ウィンドウは開き元と JS スレッドも共有する。重い処理を行うウィンドウは
 * 独立プロセス（通常の BrowserWindow）にすること。
 */

/** 開き元レンダラーの識別子 */
export type ChildWindowOpenerKey = 'main' | 'workspace';

/** 子ウィンドウとして書き込む HTML ファイル名（dist 直下） */
export type ChildWindowHtml = 'workspace.html' | 'overlay.html';

export interface OpenChildWindowRequest {
  /** window.name として使う名前。同名の生成が進行中の間は新しい要求を受け付けない */
  name: string;
  /** 書き込む HTML */
  html: ChildWindowHtml;
  /** BrowserWindow のコンストラクタオプション（webPreferences.preload は不要） */
  options: BrowserWindowConstructorOptions;
  /** 生成完了を待つ上限（ms）。超過時は null を返し、呼び出し側が直接生成にフォールバックする */
  timeoutMs?: number;
}

/** 生成中の子ウィンドウ1件分の状態 */
interface PendingCreation {
  options: BrowserWindowConstructorOptions;
  /** did-create-window で受け取った BrowserWindow */
  window: BrowserWindow | null;
  /** 開き元レンダラーから HTML 書き込み完了の通知を受けたか */
  written: boolean;
  /** 完了（成功・失敗とも）時に1回だけ呼ぶ */
  finish: (win: BrowserWindow | null) => void;
}

const DEFAULT_TIMEOUT_MS = 5000;

/** openerKey → 開き元の webContents */
const openers = new Map<ChildWindowOpenerKey, WebContents>();

/** 開き元の登録待ち（起動時に開き元より先に子の生成が要求された場合用） */
const openerWaiters = new Map<ChildWindowOpenerKey, Set<(wc: WebContents) => void>>();

/** window.name → 生成待ち */
const pendingCreations = new Map<string, PendingCreation>();

/** 本番ビルドの HTML 内容キャッシュ（実行中に変化しないため） */
const htmlCache = new Map<ChildWindowHtml, string>();

let ipcRegistered = false;

/** dist 直下の HTML の場所（開発時は Vite サーバー、本番はビルド成果物） */
export function getRendererHtmlUrl(html: ChildWindowHtml): string {
  if (EnvConfig.isDevelopment) {
    return `${EnvConfig.devServerUrl}/${html}`;
  }
  return pathToFileURL(path.join(__dirname, `../${html}`)).href;
}

/**
 * 子ウィンドウに書き込む HTML の内容を取得する
 * 開発時は Vite が変換済みの HTML（HMR クライアント込み）を毎回取得する
 */
async function loadRendererHtml(html: ChildWindowHtml): Promise<string> {
  if (EnvConfig.isDevelopment) {
    const response = await net.fetch(getRendererHtmlUrl(html));
    if (!response.ok) {
      throw new Error(`${html} の取得に失敗: HTTP ${response.status}`);
    }
    return response.text();
  }
  const cached = htmlCache.get(html);
  if (cached !== undefined) return cached;
  const content = await fs.promises.readFile(path.join(__dirname, `../${html}`), 'utf8');
  htmlCache.set(html, content);
  return content;
}

function isRegisteredOpener(webContents: WebContents): boolean {
  for (const wc of openers.values()) {
    if (wc === webContents) return true;
  }
  return false;
}

/** ウィンドウの受け取りと書き込み完了の両方が揃ったら完了にする */
function finishIfComplete(pending: PendingCreation): void {
  if (pending.window && pending.written) {
    pending.finish(pending.window);
  }
}

function registerIpcOnce(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;
  // 開き元レンダラーが HTML の書き込みを終えた通知
  ipcMain.on(IPC_CHANNELS.WINDOW_CHILD_WRITTEN, (event, name: unknown) => {
    if (typeof name !== 'string' || !isRegisteredOpener(event.sender)) return;
    const pending = pendingCreations.get(name);
    if (!pending) return;
    pending.written = true;
    finishIfComplete(pending);
  });
}

/**
 * 開き元となるレンダラーを登録する
 * window.open の許可判定と、生成されたウィンドウの受け取りをここで行う。
 * 生成待ちに対応しない window.open（外部リンク等）は全て拒否する。
 */
export function registerChildWindowOpener(
  key: ChildWindowOpenerKey,
  webContents: WebContents
): void {
  registerIpcOnce();
  openers.set(key, webContents);

  webContents.setWindowOpenHandler(({ url, frameName }) => {
    const pending = pendingCreations.get(frameName);
    // 子ウィンドウは about:blank で開き、開き元が HTML を書き込む（ナビゲーションなし）
    if (!pending || pending.window || url !== 'about:blank') {
      windowLogger.warn(
        { url, frameName, opener: key },
        '許可されていない window.open を拒否しました'
      );
      return { action: 'deny' };
    }
    return { action: 'allow', overrideBrowserWindowOptions: pending.options };
  });

  webContents.on('did-create-window', (win, details) => {
    const pending = pendingCreations.get(details.frameName);
    if (!pending || pending.window) {
      // タイムアウト後に遅れて生成された等、受け取り先のない子ウィンドウは破棄
      windowLogger.warn({ frameName: details.frameName }, '管理外の子ウィンドウを破棄しました');
      win.destroy();
      return;
    }
    pending.window = win;
    finishIfComplete(pending);
  });

  webContents.once('destroyed', () => {
    if (openers.get(key) === webContents) {
      openers.delete(key);
    }
  });

  const waiters = openerWaiters.get(key);
  if (waiters) {
    openerWaiters.delete(key);
    for (const resolve of waiters) resolve(webContents);
  }
}

/**
 * 登録済み（かつ生存中）の開き元を返す。未登録なら登録されるまで待つ
 * @returns 開き元の Promise と、待ちを取り下げる関数
 */
function waitForOpener(key: ChildWindowOpenerKey): {
  promise: Promise<WebContents>;
  cancel: () => void;
} {
  const existing = openers.get(key);
  if (existing && !existing.isDestroyed()) {
    return { promise: Promise.resolve(existing), cancel: () => {} };
  }
  let waiter: ((wc: WebContents) => void) | null = null;
  const promise = new Promise<WebContents>((resolve) => {
    waiter = resolve;
    const set = openerWaiters.get(key) ?? new Set();
    set.add(resolve);
    openerWaiters.set(key, set);
  });
  return {
    promise,
    cancel: () => {
      if (waiter) openerWaiters.get(key)?.delete(waiter);
    },
  };
}

/**
 * 開き元レンダラーに window.open を依頼し、生成された BrowserWindow を返す
 *
 * 次の場合は null を返す（呼び出し側で直接生成にフォールバックする）:
 * - 同名の生成が進行中（呼び出し側で二重要求を抑止すること）
 * - 開き元が登録されないまま、または生成が完了しないままタイムアウト
 * - HTML の取得失敗、開き元の破棄
 */
export function openChildWindow(
  openerKey: ChildWindowOpenerKey,
  request: OpenChildWindowRequest
): Promise<BrowserWindow | null> {
  const { name, html, options } = request;
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (pendingCreations.has(name)) {
    windowLogger.warn({ name }, '同名の子ウィンドウを生成中のため要求を無視しました');
    return Promise.resolve(null);
  }

  return new Promise<BrowserWindow | null>((resolve) => {
    const cleanups: Array<() => void> = [];
    let settled = false;

    const pending: PendingCreation = {
      options,
      window: null,
      written: false,
      finish: (win) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pendingCreations.delete(name);
        for (const cleanup of cleanups) cleanup();
        resolve(win);
      },
    };
    const timer = setTimeout(() => {
      windowLogger.warn({ name, openerKey }, '子ウィンドウの生成がタイムアウトしました');
      pending.finish(null);
    }, timeoutMs);

    // 要求を受けた時点で登録し、同名の同時要求と window.open の許可判定に使う
    pendingCreations.set(name, pending);

    const openerWait = waitForOpener(openerKey);
    cleanups.push(openerWait.cancel);

    void (async () => {
      try {
        const [opener, htmlContent] = await Promise.all([
          openerWait.promise,
          loadRendererHtml(html),
        ]);
        if (settled) return;

        const send = () => {
          if (settled) return;
          if (opener.isDestroyed()) {
            windowLogger.warn({ name, openerKey }, '開き元レンダラーが破棄されています');
            pending.finish(null);
            return;
          }
          opener.send(IPC_CHANNELS.WINDOW_OPEN_CHILD, { html: htmlContent, name });
        };
        if (opener.isLoading()) {
          opener.once('did-finish-load', send);
          cleanups.push(() => opener.removeListener('did-finish-load', send));
        } else {
          send();
        }
      } catch (error) {
        windowLogger.warn({ error, name, openerKey }, '子ウィンドウの生成に失敗しました');
        pending.finish(null);
      }
    })();
  });
}

/**
 * 生成待ちを全て打ち切る（アプリ終了時用）
 */
export function cancelAllChildWindowCreations(): void {
  for (const pending of [...pendingCreations.values()]) {
    pending.finish(null);
  }
}
