import fs from 'fs';
import path from 'path';

import { app, shell } from 'electron';

import logger from '../../common/logger.js';

/**
 * 自動起動機能を管理するサービスクラス
 * Windows起動時にアプリケーションを自動的に起動する機能を提供
 * スタートアップフォルダーにショートカットを作成する方式を使用
 */
export class AutoLaunchService {
  private static instance: AutoLaunchService;
  private readonly SHORTCUT_NAME = 'QuickDashLauncher.lnk';

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
   * スタートアップフォルダーのパスを取得
   * @returns スタートアップフォルダーのフルパス
   */
  private getStartupFolderPath(): string {
    // %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
    const appDataPath = process.env.APPDATA;
    if (!appDataPath) {
      throw new Error('APPDATA environment variable is not set');
    }
    return path.join(appDataPath, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  }

  /**
   * ショートカットファイルのフルパスを取得
   * @returns ショートカットファイルのフルパス
   */
  private getShortcutPath(): string {
    return path.join(this.getStartupFolderPath(), this.SHORTCUT_NAME);
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

    // Windows専用機能
    if (process.platform !== 'win32') {
      logger.warn('Auto launch is only supported on Windows');
      return;
    }

    try {
      const shortcutPath = this.getShortcutPath();

      if (enabled) {
        // ショートカットを作成
        const success = shell.writeShortcutLink(shortcutPath, 'create', {
          target: process.execPath,
          description: 'QuickDashLauncher - Quick access launcher with global hotkey',
          appUserModelId: 'net.masaodev.quick-dash-launcher',
        });

        if (success) {
          logger.info(`Auto launch enabled: shortcut created at ${shortcutPath}`);
        } else {
          logger.error('Failed to create startup shortcut');
          throw new Error('Failed to create startup shortcut');
        }
      } else {
        // ショートカットを削除
        if (fs.existsSync(shortcutPath)) {
          fs.unlinkSync(shortcutPath);
          logger.info(`Auto launch disabled: shortcut removed from ${shortcutPath}`);
        } else {
          logger.info('Auto launch already disabled: shortcut does not exist');
        }
      }
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

    // Windows専用機能
    if (process.platform !== 'win32') {
      return false;
    }

    try {
      const shortcutPath = this.getShortcutPath();
      return fs.existsSync(shortcutPath);
    } catch (error) {
      logger.error('Failed to get auto launch status:', error);
      return false;
    }
  }
}

export default AutoLaunchService;
