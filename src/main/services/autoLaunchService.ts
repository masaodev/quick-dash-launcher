import fs from 'fs';
import path from 'path';

import { app, shell } from 'electron';
import logger from '@common/logger';
import type { AutoLaunchStatus } from '@common/types';

import { EnvConfig } from '../config/envConfig.js';
import type { StartupTask as StartupTaskType } from '../winrt/generated/windows/application-model/StartupTask.js';

/** Store 版のマニフェスト（resources/appx/extensions.xml）に書いた StartupTask の TaskId */
const STARTUP_TASK_ID = 'QuickDashLauncherStartup';

/** WinRT の StartupTaskState（数値）を AutoLaunchStatus の state に読み替える */
const STARTUP_TASK_STATES = [
  'disabled',
  'disabledByUser',
  'enabled',
  'disabledByPolicy',
  'enabledByPolicy',
] as const;

type StoreState = (typeof STARTUP_TASK_STATES)[number];

/**
 * 自動起動機能を管理するサービスクラス（Windows専用）
 * - ポータブル版・インストーラー版: スタートアップフォルダーにショートカットを作る
 * - Store 版（MSIX）: マニフェストの StartupTask を WinRT の API（dynwinrt 経由）で切り替える
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

  /**
   * Store 版かどうか
   * MSIX でも既にある %APPDATA% のファイルは本物が書き換わるため、Store 版がショートカットに触れると
   * 同じ PC のポータブル版・インストーラー版のショートカットを上書き・削除してしまう。Store 版は StartupTask だけを使う
   */
  private isStoreBuild(): boolean {
    return process.windowsStore === true;
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

  /**
   * ショートカットのターゲットにする実行ファイルのパスを返す
   *
   * ポータブル版（electron-builderのportableターゲット）は起動時に%TEMP%配下へ
   * 自己展開して実行されるため、process.execPathは一時フォルダのexeを指す。
   * その場合はランチャーが設定する PORTABLE_EXECUTABLE_FILE（元のexeのフルパス）を使う。
   */
  private getTargetPath(): string {
    return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  }

  /**
   * Store 版の StartupTask を取得する（dynwinrt はネイティブ部品なので Store 版のときだけ読み込む）
   * 生成物の index.js は変数を require に渡していてバンドルできないため、クラスのファイルを直接読む
   */
  private async getStartupTask(): Promise<StartupTaskType> {
    const { StartupTask } =
      await import('../winrt/generated/windows/application-model/StartupTask.js');
    return StartupTask.getAsync(STARTUP_TASK_ID);
  }

  private toStoreState(state: number): StoreState {
    return STARTUP_TASK_STATES[state] ?? 'disabled';
  }

  /**
   * 設定の値を OS に反映する
   * Store 版で利用者が Windows 側（タスク マネージャー・設定アプリ）で無効にしていると、アプリからは有効にできない。
   * そのときは状態を返すだけで、例外にはしない
   */
  public async setAutoLaunch(enabled: boolean): Promise<void> {
    if (!this.isSupported()) {
      logger.warn('Auto launch is only supported on packaged Windows builds');
      return;
    }

    if (this.isStoreBuild()) {
      const task = await this.getStartupTask();
      if (enabled) {
        const state = this.toStoreState(await task.requestEnableAsync());
        logger.info(`Auto launch (StartupTask) requested: ${state}`);
      } else {
        task.disable();
        logger.info(`Auto launch (StartupTask) disabled: ${this.toStoreState(task.state)}`);
      }
      return;
    }

    const shortcutPath = this.getShortcutPath();

    if (enabled) {
      // 'create'は既存ショートカットを上書きするため、起動ごとに呼ばれることで
      // exeの移動やバージョン更新（ファイル名変更）によるパス変更にも追従する
      const target = this.getTargetPath();
      const success = shell.writeShortcutLink(shortcutPath, 'create', {
        target,
        description: 'QuickDashLauncher - Quick access launcher with global hotkey',
        appUserModelId: 'net.masaodev.quick-dash-launcher',
      });

      if (!success) {
        throw new Error('Failed to create startup shortcut');
      }
      logger.info(`Auto launch enabled: shortcut created at ${shortcutPath} -> ${target}`);
    } else {
      if (fs.existsSync(shortcutPath)) {
        fs.unlinkSync(shortcutPath);
        logger.info(`Auto launch disabled: shortcut removed from ${shortcutPath}`);
      }
    }
  }

  /**
   * 起動時に設定の値を OS に反映する
   * Store 版では、Windows 側で有効にされた StartupTask を起動のたびに無効へ戻さないよう、
   * 設定がオンで Windows 側が（利用者の操作ではなく）無効のときだけ有効にする
   */
  public async applyOnStartup(enabled: boolean): Promise<void> {
    if (!this.isSupported() || !this.isStoreBuild()) {
      await this.setAutoLaunch(enabled);
      return;
    }
    try {
      const task = await this.getStartupTask();
      if (enabled && this.toStoreState(task.state) === 'disabled') {
        await this.setAutoLaunch(true);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to apply auto launch (StartupTask) on startup');
    }
  }

  /** OS 側の自動起動の状態（設定画面で、Windows 側で無効にされているときの案内に使う） */
  public async getAutoLaunchStatus(): Promise<AutoLaunchStatus> {
    if (!this.isSupported()) {
      return { mode: 'unsupported' };
    }
    if (this.isStoreBuild()) {
      const task = await this.getStartupTask();
      return { mode: 'store', state: this.toStoreState(task.state) };
    }
    return { mode: 'shortcut', enabled: fs.existsSync(this.getShortcutPath()) };
  }
}

export default AutoLaunchService;
