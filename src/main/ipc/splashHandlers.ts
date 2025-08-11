import { ipcMain } from 'electron';
import { closeSplashWindow } from '../splashWindowManager';
import { windowLogger } from '@common/logger';

/**
 * スプラッシュスクリーン関連のIPCハンドラーを設定する
 */
export function setupSplashHandlers(): void {
  // スプラッシュスクリーンの準備完了通知
  ipcMain.handle('splash-ready', async () => {
    windowLogger.info('スプラッシュスクリーンの準備が完了しました');
    
    // スプラッシュスクリーンを閉じる
    setTimeout(() => {
      closeSplashWindow();
    }, 500); // 0.5秒後に閉じる（フェードアウト効果のため）
    
    return true;
  });
}