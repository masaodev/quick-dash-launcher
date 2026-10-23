import type { BrowserWindow } from 'electron';

/**
 * 枠なしウィンドウのドラッグできる所（-webkit-app-region: drag）を右クリックしたときに出る、
 * Windows のウィンドウメニュー（移動・サイズ変更・最大化など）を出さない
 *
 * メイン・ワークスペース・切り離しウィンドウは大きさや最大化を QDL が決めるので、
 * このメニューは使い道が無く、余白の右クリックで出ると紛らわしい（2026-10-24 本人）
 */
export function suppressSystemContextMenu(win: BrowserWindow): void {
  win.on('system-context-menu', (event) => event.preventDefault());
}
