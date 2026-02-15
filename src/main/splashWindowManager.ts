import * as path from 'path';

import { BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { EnvConfig } from './config/envConfig.js';
import PathManager from './config/pathManager.js';

let splashWindow: BrowserWindow | null = null;

/**
 * スプラッシュウィンドウを作成し、表示する
 */
export async function createSplashWindow(): Promise<BrowserWindow> {
  windowLogger.info('スプラッシュウィンドウを作成中...');

  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    center: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    show: true,
    icon: PathManager.getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    if (EnvConfig.isDevelopment) {
      const url = `${EnvConfig.devServerUrl}/splash.html`;
      windowLogger.info(`開発環境: ${url} を読み込み中...`);
      await splashWindow.loadURL(url);
    } else {
      const filePath = path.join(__dirname, '../splash.html');
      windowLogger.info(`本番環境: ${filePath} を読み込み中...`);
      await splashWindow.loadFile(filePath);
    }
  } catch (error) {
    windowLogger.error({ error }, 'スプラッシュウィンドウのHTML読み込みエラー');
  }

  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  splashWindow.focus();
  splashWindow.moveTop();
  windowLogger.info('スプラッシュウィンドウを表示しました');

  return splashWindow;
}

/**
 * スプラッシュウィンドウに初期化完了を通知する
 */
export function notifySplashInitComplete(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send(IPC_CHANNELS.SPLASH_INIT_COMPLETE);
  }
}

/**
 * スプラッシュウィンドウを閉じる
 */
export function closeSplashWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    windowLogger.info('スプラッシュウィンドウを閉じています...');
    splashWindow.close();
    splashWindow = null;
  }
}
