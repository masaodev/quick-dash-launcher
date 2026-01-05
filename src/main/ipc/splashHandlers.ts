import { ipcMain, BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';
import { SPLASH_READY } from '@common/ipcChannels.js';

import { closeSplashWindow } from '../splashWindowManager';
import { getIsFirstLaunch } from '../main';

/**
 * スプラッシュスクリーン関連のIPCハンドラーを設定する
 * @param getMainWindow メインウィンドウを取得する関数
 */
export function setupSplashHandlers(getMainWindow: () => BrowserWindow | null): void {
  // スプラッシュスクリーンの準備完了通知
  ipcMain.handle(SPLASH_READY, async () => {
    windowLogger.info('スプラッシュスクリーンの準備が完了しました');

    // 初回起動判定を取得
    const isFirstLaunch = getIsFirstLaunch();

    // スプラッシュスクリーンを閉じる
    setTimeout(() => {
      closeSplashWindow();

      // 初回起動の場合はメインウィンドウを表示
      if (isFirstLaunch) {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          windowLogger.info(
            '初回起動: メインウィンドウを自動表示しました（ホットキーが未設定のため）'
          );
        }
      }
    }, 500); // 0.5秒後に閉じる（フェードアウト効果のため）

    return true;
  });
}
