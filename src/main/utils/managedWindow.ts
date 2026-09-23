import type { BrowserWindow, WebPreferences } from 'electron';

import { EnvConfig } from '../config/envConfig.js';

/**
 * 全ウィンドウ共通の webPreferences
 *
 * preload は session 単位で登録しているため（main.ts）、ここには含めない。
 */
export const DEFAULT_WEB_PREFERENCES: WebPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  spellcheck: false,
};

/** アプリ終了処理中か（before-quit 以降は true） */
let appQuitting = false;

/** アプリ終了処理に入ったことを記録する（before-quit で呼ぶ） */
export function markAppQuitting(): void {
  appQuitting = true;
}

/** アプリ終了処理中かどうか */
export function isAppQuitting(): boolean {
  return appQuitting;
}

/**
 * 閉じる操作でウィンドウを破棄せず隠す（アプリ終了時だけ実際に閉じる）
 *
 * @param onHidden 隠したあとに呼ぶ処理（表示状態フラグの更新など）
 */
export function hideOnClose(win: BrowserWindow, onHidden?: () => void): void {
  win.on('close', (event) => {
    if (appQuitting) return;
    event.preventDefault();
    win.hide();
    onHidden?.();
  });
}

/**
 * ウィンドウ共通のキー操作を設定する
 *
 * - 開発時は Ctrl+Shift+I で DevTools を開閉する
 * - suppressEscape: Escape をページに渡さない（ウィンドウ既定の動作を止める）
 */
export function attachCommonKeyHandlers(
  win: BrowserWindow,
  options: { suppressEscape?: boolean } = {}
): void {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (options.suppressEscape && input.key === 'Escape') {
      event.preventDefault();
    }
    if (
      EnvConfig.isDevelopment &&
      input.control &&
      input.shift &&
      input.key.toLowerCase() === 'i'
    ) {
      win.webContents.toggleDevTools();
    }
  });
}
