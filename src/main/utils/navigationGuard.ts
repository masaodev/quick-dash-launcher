/**
 * 画面のナビゲーションの制御（多層防御）
 *
 * QDL の画面は、メインプロセスが読み込んだ HTML（loadURL・loadFile）と、window.open で開いて
 * HTML を書き込む子ウィンドウだけで、ページ側から別の URL へ移ることは無い。リンクの踏み間違いや、
 * 万一のスクリプト注入で画面が外部のページへ移ると、そのページが preload の API（electronAPI）を
 * 使えてしまうので、ページ側から始まる移動はすべて止める。
 *
 * - 止めるもの: will-navigate（メインフレーム）と will-frame-navigate（iframe を含むすべてのフレーム）
 * - 止めないもの: メインプロセスからの loadURL・loadFile、再読み込み（F5・Vite の全体リロード）、
 *   同じ文書の中の移動（#hash）。どれも will-navigate を出さない
 * - 通すもの: 今と同じ URL への移動。開発サーバーでは Vite が依存の最適化のあとに同じ URL へ移り直す
 *   ことがあり、止めるとスプラッシュの準備完了が届かず白いまま閉じない。同じページの読み直しなので
 *   外部のページが API を使うことにはならない
 * - 止められないもの: about:blank への移動（Electron がどちらの通知も出さない。10/12 E2E で確認）。
 *   画面が空白になるだけで、外部のページが API を使うことにはならない
 * - window.open は childWindowService の setWindowOpenHandler が別に制御している
 * - 対象は画面（getType() が 'window'）だけ。DevTools などには付けない
 */

import { app, type Event, type WebContents } from 'electron';
import { windowLogger } from '@common/logger';

function blockNavigation(event: Event, url: string): void {
  event.preventDefault();
  windowLogger.warn({ url }, 'ページ側から始まった画面の移動を止めました');
}

/** 画面に、ページ側から始まる移動を止める処理を付ける */
export function guardNavigation(contents: WebContents): void {
  if (contents.getType() !== 'window') return;
  contents.on('will-navigate', (event, url) => {
    // 今と同じ URL への移動は読み直しなので通す（Vite の依存の最適化のあとの移り直し）
    if (url === contents.getURL()) return;
    blockNavigation(event, url);
  });
  // メインフレームは will-navigate で止めるので、ここは iframe だけ（二重にログを残さない）
  contents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame) blockNavigation(event, event.url);
  });
}

/** これから作られるすべての画面に guardNavigation を付ける（ウィンドウを作る前に呼ぶ） */
export function installNavigationGuard(): void {
  app.on('web-contents-created', (_event, contents) => guardNavigation(contents));
}
