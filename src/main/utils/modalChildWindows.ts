import { BrowserWindow, screen } from 'electron';
import type { BrowserWindowConstructorOptions, Rectangle } from 'electron';
import { windowLogger } from '@common/logger';

import {
  getRendererHtmlUrl,
  openChildWindow,
  type ChildWindowHtml,
  type ChildWindowOpenerKey,
} from '../services/childWindowService.js';

import { DEFAULT_WEB_PREFERENCES } from './managedWindow.js';

/** ready-to-show が来ないときに表示する上限（ms） */
const DEFAULT_SHOW_FALLBACK_TIMEOUT_MS = 1500;

/**
 * 表示イベントが来ないときの保険として、一定時間後にまだ隠れていれば表示する
 *
 * @param show 表示のしかた（既定は win.show()。フォーカスを奪わない表示などに差し替える）
 * @returns 保険を取り消す関数（表示できたとき・閉じたときに呼ぶ）
 */
export function scheduleFallbackShow(
  win: BrowserWindow,
  show: () => void = () => win.show(),
  timeoutMs: number = DEFAULT_SHOW_FALLBACK_TIMEOUT_MS
): () => void {
  const timer = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      show();
    }
  }, timeoutMs);
  return () => clearTimeout(timer);
}

/** 開き元ウィンドウのあるディスプレイの作業領域（取れなければカーソルのあるディスプレイ） */
export function resolveWorkArea(callerWindow: BrowserWindow | null): Rectangle {
  if (callerWindow && !callerWindow.isDestroyed()) {
    return screen.getDisplayMatching(callerWindow.getBounds()).workArea;
  }
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
}

export interface OpenModalChildWindowRequest {
  /** 開き元レンダラー（window.open を依頼する先） */
  opener: ChildWindowOpenerKey;
  /** window.name（レンダラーはこれで何を表示するかを知る） */
  name: string;
  /** 書き込む HTML */
  html: ChildWindowHtml;
  /** レンダラー共有で開けず直接生成したときに付けるクエリ（window.name の代わり） */
  fallbackQuery: string;
  title: string;
  bounds: Rectangle;
  /** モーダルにする親（閉じるまで親を操作させない）。null なら親なしで開く */
  parent: BrowserWindow | null;
  /** ログに添える情報 */
  logContext?: Record<string, unknown>;
}

/**
 * モーダルな子ウィンドウ（登録・編集フォームなど）の生成と管理
 *
 * 開き元のレンダラーから window.open で開き（レンダラープロセス共有）、開けなければ
 * 通常の BrowserWindow を直接作る。準備ができたら表示し（来なければ保険で表示）、
 * 閉じたら表から外す。キーごとに 1 枚まで持ち、同じキーで開き直すと前面に出す。
 */
export class ModalChildWindows {
  /** キー → 子ウィンドウ */
  private readonly windows = new Map<string, BrowserWindow>();

  /** 同じキーのウィンドウが開いていれば前面に出して true を返す */
  focus(key: string): boolean {
    const existing = this.windows.get(key);
    if (!existing || existing.isDestroyed()) return false;
    existing.show();
    existing.focus();
    return true;
  }

  /**
   * 子ウィンドウを開く
   *
   * 生成に失敗したときは例外を投げる。閉じたことを知りたいときは、戻り値の
   * 'closed' イベントを待つ（表からの削除はこのクラスが行う）
   */
  async open(key: string, request: OpenModalChildWindowRequest): Promise<BrowserWindow> {
    const { opener, name, html, fallbackQuery, title, bounds, parent, logContext } = request;
    const hasParent = parent !== null && !parent.isDestroyed();

    const options: BrowserWindowConstructorOptions = {
      ...bounds,
      title,
      frame: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      show: false,
      backgroundColor: '#ffffff',
      ...(hasParent && { parent, modal: true }),
      webPreferences: DEFAULT_WEB_PREFERENCES,
    };

    let win = await openChildWindow(opener, { name, html, options });
    if (win) {
      windowLogger.info({ ...logContext, title }, '子ウィンドウをレンダラー共有で作成しました');
    } else {
      windowLogger.warn(
        { ...logContext, title },
        'レンダラー共有での生成に失敗したため子ウィンドウを直接生成します'
      );
      win = new BrowserWindow(options);
      void win.loadURL(`${getRendererHtmlUrl(html)}?${fallbackQuery}`);
    }

    this.track(key, win);
    return win;
  }

  /** 開いている子ウィンドウをすべて閉じる（アプリ終了時用） */
  closeAll(): void {
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) win.destroy();
    }
    this.windows.clear();
  }

  private track(key: string, win: BrowserWindow): void {
    win.setMenuBarVisibility(false);
    win.setMenu(null);
    this.windows.set(key, win);

    const cancelFallback = scheduleFallbackShow(win);
    win.once('ready-to-show', () => {
      cancelFallback();
      if (!win.isDestroyed()) {
        win.show();
        win.focus();
      }
    });
    win.once('closed', () => {
      cancelFallback();
      if (this.windows.get(key) === win) {
        this.windows.delete(key);
      }
    });
  }
}
