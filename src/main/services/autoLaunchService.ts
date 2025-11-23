import fs from 'fs';
import path from 'path';

import { app } from 'electron';

import logger from '../../common/logger.js';

/**
 * 自動起動機能を管理するサービスクラス
 * Windows起動時にアプリケーションを自動的に起動する機能を提供
 */
export class AutoLaunchService {
  private static instance: AutoLaunchService;

  private constructor() {}

  /**
   * AutoLaunchServiceのシングルトンインスタンスを取得
   */
  public static getInstance(): AutoLaunchService {
    if (!AutoLaunchService.instance) {
      AutoLaunchService.instance = new AutoLaunchService();
    }
    return AutoLaunchService.instance;
  }

  /**
   * 自動起動設定を更新
   * @param enabled 自動起動を有効にする場合true
   */
  public async setAutoLaunch(enabled: boolean): Promise<void> {
    // 開発環境ではスキップ（パッケージ化されていないため）
    if (!app.isPackaged) {
      logger.warn('Auto launch is disabled in development mode');
      return;
    }

    try {
      if (process.platform === 'win32') {
        // Windows用の実装
        const appFolder = path.dirname(process.execPath);
        const exeName = path.basename(process.execPath);
        const updateExe = path.resolve(appFolder, '..', 'Update.exe');

        // Update.exeの存在確認（NSISインストーラー版かどうか）
        if (fs.existsSync(updateExe)) {
          // NSISインストーラー版の場合、Update.exe経由で起動
          logger.info(`Using NSIS installer path: ${updateExe}`);
          app.setLoginItemSettings({
            openAtLogin: enabled,
            path: updateExe,
            args: ['--processStart', `"${exeName}"`],
          });
        } else {
          // ポータブル版または直接実行の場合
          logger.info(`Using portable mode path: ${process.execPath}`);
          app.setLoginItemSettings({
            openAtLogin: enabled,
            path: process.execPath,
          });
        }
      } else {
        // Windows以外のプラットフォーム（将来の拡張用）
        app.setLoginItemSettings({
          openAtLogin: enabled,
        });
      }

      // 設定の確認ログ
      const settings = app.getLoginItemSettings();
      logger.info(
        `Auto launch ${enabled ? 'enabled' : 'disabled'} (actual: ${settings.openAtLogin})`
      );
    } catch (error) {
      logger.error('Failed to set auto launch:', error);
      throw error;
    }
  }

  /**
   * 自動起動設定の現在の状態を取得
   * @returns 自動起動が有効な場合true
   */
  public getAutoLaunchStatus(): boolean {
    // 開発環境では常にfalse
    if (!app.isPackaged) {
      return false;
    }

    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  }
}

export default AutoLaunchService;
