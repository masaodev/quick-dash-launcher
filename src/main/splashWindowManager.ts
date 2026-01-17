import * as path from 'path';

import { BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';

import { EnvConfig } from './config/envConfig.js';
import PathManager from './config/pathManager.js';

let splashWindow: BrowserWindow | null = null;

/**
 * スプラッシュウィンドウを作成し、表示する
 * アプリケーション起動時に表示される小さなローディング画面
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

  // スプラッシュ画面のHTMLを読み込み
  try {
    if (EnvConfig.isDevelopment) {
      // 開発環境では専用のエントリーポイントを使用
      windowLogger.info(`開発環境: ${EnvConfig.devServerUrl}/splash.html を読み込み中...`);
      await splashWindow.loadURL(`${EnvConfig.devServerUrl}/splash.html`);
    } else {
      // プロダクション環境では静的ファイルを読み込み
      const filePath = path.join(__dirname, '../splash.html');
      windowLogger.info(`本番環境: ${filePath} を読み込み中...`);
      await splashWindow.loadFile(filePath);
    }
    windowLogger.info('スプラッシュウィンドウのHTMLを読み込み完了');
  } catch (error) {
    windowLogger.error({ error }, 'スプラッシュウィンドウのHTML読み込みエラー');
  }

  splashWindow.on('closed', () => {
    splashWindow = null;
    windowLogger.info('スプラッシュウィンドウが閉じられました');
  });

  // フォーカスを当てて確実に見えるようにする
  splashWindow.focus();
  splashWindow.moveTop();
  windowLogger.info('スプラッシュウィンドウを表示しました');

  return splashWindow;
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
