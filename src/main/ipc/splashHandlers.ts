import { ipcMain, BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { closeSplashWindow } from '../splashWindowManager';

/**
 * スプラッシュスクリーン関連のIPCハンドラーを設定する
 * @param getMainWindow メインウィンドウを取得する関数
 */
export function setupSplashHandlers(getMainWindow: () => BrowserWindow | null): void {
  // スプラッシュスクリーンの準備完了通知
  ipcMain.handle(IPC_CHANNELS.SPLASH_READY, async () => {
    windowLogger.info('スプラッシュスクリーンの準備が完了しました');

    // スプラッシュスクリーンを閉じてメインウィンドウを表示
    closeSplashWindow();

    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      windowLogger.info('メインウィンドウを自動表示しました');
    }

    return true;
  });
}
