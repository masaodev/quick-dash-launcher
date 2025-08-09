import * as path from 'path';
import { BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';

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
    show: false,
    icon: path.join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // スプラッシュ画面のHTMLを読み込み
  if (process.env.NODE_ENV === 'development') {
    // 開発環境では専用のエントリーポイントを使用
    await splashWindow.loadURL('http://localhost:9000/splash.html');
  } else {
    // プロダクション環境では静的ファイルを読み込み
    await splashWindow.loadFile(path.join(__dirname, '../splash.html'));
  }

  splashWindow.on('closed', () => {
    splashWindow = null;
    windowLogger.info('スプラッシュウィンドウが閉じられました');
  });

  // ウィンドウの準備が完了したら表示
  splashWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.show();
      windowLogger.info('スプラッシュウィンドウを表示しました');
    }
  });

  return splashWindow;
}

/**
 * スプラッシュウィンドウを取得する
 */
export function getSplashWindow(): BrowserWindow | null {
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

/**
 * スプラッシュウィンドウが表示中かどうかを確認
 */
export function isSplashWindowVisible(): boolean {
  return splashWindow !== null && !splashWindow.isDestroyed() && splashWindow.isVisible();
}