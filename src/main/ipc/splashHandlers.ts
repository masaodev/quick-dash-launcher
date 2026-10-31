import { BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { closeSplashWindow } from '../splashWindowManager';
import { handleIpc } from '../utils/ipcWrapper';

/**
 * スプラッシュスクリーン関連のIPCハンドラーを設定する
 * @param getMainWindow ランチャーを取得する関数
 */
export function setupSplashHandlers(getMainWindow: () => BrowserWindow | null): void {
  // スプラッシュスクリーンの準備完了通知
  handleIpc(IPC_CHANNELS.SPLASH_READY, async () => {
    windowLogger.info('スプラッシュスクリーンの準備が完了しました');

    // スプラッシュスクリーンを閉じてランチャーを表示
    closeSplashWindow();

    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      windowLogger.info('ランチャーを自動表示しました');
    }

    return true;
  });
}
