import fs from 'fs';
import path from 'path';

import { app, shell } from 'electron';
import logger from '@common/logger';

import { EnvConfig } from '../config/envConfig.js';

/**
 * 自動起動機能を管理するサービスクラス
 * スタートアップフォルダーにショートカットを作成する方式を使用（Windows専用）
 */
export class AutoLaunchService {
  private static instance: AutoLaunchService;
  private readonly SHORTCUT_NAME = 'QuickDashLauncher.lnk';

  private constructor() {}

  public static getInstance(): AutoLaunchService {
    if (!AutoLaunchService.instance) {
      AutoLaunchService.instance = new AutoLaunchService();
    }
    return AutoLaunchService.instance;
  }

  private isSupported(): boolean {
    return app.isPackaged && process.platform === 'win32';
  }

  private getShortcutPath(): string {
    const appDataPath = EnvConfig.appData;
    if (!appDataPath) {
      throw new Error('APPDATA environment variable is not set');
    }
    return path.join(
      appDataPath,
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      'Startup',
      this.SHORTCUT_NAME
    );
  }

  public async setAutoLaunch(enabled: boolean): Promise<void> {
    if (!this.isSupported()) {
      logger.warn('Auto launch is only supported on packaged Windows builds');
      return;
    }

    const shortcutPath = this.getShortcutPath();

    if (enabled) {
      const success = shell.writeShortcutLink(shortcutPath, 'create', {
        target: process.execPath,
        description: 'QuickDashLauncher - Quick access launcher with global hotkey',
        appUserModelId: 'net.masaodev.quick-dash-launcher',
      });

      if (!success) {
        throw new Error('Failed to create startup shortcut');
      }
      logger.info(`Auto launch enabled: shortcut created at ${shortcutPath}`);
    } else {
      if (fs.existsSync(shortcutPath)) {
        fs.unlinkSync(shortcutPath);
        logger.info(`Auto launch disabled: shortcut removed from ${shortcutPath}`);
      }
    }
  }

  public getAutoLaunchStatus(): boolean {
    if (!this.isSupported()) {
      return false;
    }
    return fs.existsSync(this.getShortcutPath());
  }
}

export default AutoLaunchService;
