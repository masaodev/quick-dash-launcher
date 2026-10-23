/**
 * コンテキストメニュー用IPCハンドラー
 * 全てのReactコンテキストメニューをElectronのネイティブメニューに変換
 *
 * 画面: 右クリックメニュー
 * 画面仕様: docs/screens/context-menu.md
 *
 * 中身は画面ごとに分けてある（共通部品＝contextMenuShared、メイン・管理ウィンドウ＝launcherContextMenus、
 * ワークスペース＝workspaceContextMenus、文字入力欄＝editableContextMenu）
 */
import { setupEditableContextMenu } from './editableContextMenu.js';
import { setupLauncherContextMenus } from './launcherContextMenus.js';
import { setupWorkspaceContextMenus } from './workspaceContextMenus.js';

/** 全てのコンテキストメニューハンドラーを設定 */
export function setupContextMenuHandlers(): void {
  setupLauncherContextMenus();
  setupWorkspaceContextMenus();
  setupEditableContextMenu();
}
