/**
 * 画面のナビゲーションの制御（多層防御）
 *
 * QDL の画面は自前の HTML だけを表示する。リンクの踏み間違いや、万一のスクリプト注入で
 * 画面が外部のページへ移ると、そのページが preload の API（electronAPI）を使えてしまうので、
 * ページ側から始まる移動（will-navigate）は QDL の HTML の中だけに限る。
 * 再読み込み（F5・Vite の全体リロード）は will-navigate を出さないので影響しない。
 * window.open は childWindowService の setWindowOpenHandler が別に制御している
 */

import { app, type WebContents } from 'electron';
import { windowLogger } from '@common/logger';

export interface AllowedNavigationRoots {
  /** 開発時の Vite の URL（http://localhost:9000 など）。本番は undefined */
  devServerUrl?: string;
  /** 本番の HTML を置いたフォルダの file:// URL（末尾は /） */
  appRootUrl: string;
}

/** QDL 自身の HTML への移動か */
export function isAllowedNavigation(url: string, roots: AllowedNavigationRoots): boolean {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  if (target.href === 'about:blank') return true;

  if (roots.devServerUrl) {
    const dev = new URL(roots.devServerUrl);
    if (target.origin === dev.origin) return true;
  }

  if (target.protocol === 'file:') {
    // Windows のパスは大文字・小文字を区別しない
    return target.href.toLowerCase().startsWith(roots.appRootUrl.toLowerCase());
  }
  return false;
}

/** これから作られるすべての画面に、QDL の HTML の外への移動を止める処理を付ける */
export function installNavigationGuard(roots: AllowedNavigationRoots): void {
  app.on('web-contents-created', (_event, contents: WebContents) => {
    contents.on('will-navigate', (event, url) => {
      if (isAllowedNavigation(url, roots)) return;
      event.preventDefault();
      windowLogger.warn({ url }, 'QDL の画面の外へのナビゲーションを止めました');
    });
  });
}
