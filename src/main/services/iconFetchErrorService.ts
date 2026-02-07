import ElectronStore from 'electron-store';
import type { IconFetchErrorRecord } from '@common/types/icon';
import logger from '@common/logger';

import PathManager from '../config/pathManager.js';

let Store: typeof ElectronStore | null = null;

interface ErrorStoreData {
  errors: IconFetchErrorRecord[];
}

type ErrorStoreInstance = {
  get(key: 'errors'): IconFetchErrorRecord[];
  set(key: 'errors', value: IconFetchErrorRecord[]): void;
};

/**
 * アイコン取得エラーを管理するサービスクラス
 */
export class IconFetchErrorService {
  private errorStore: ErrorStoreInstance | null = null;
  private static instance: IconFetchErrorService | null = null;

  private constructor() {}

  private async initializeStore(): Promise<void> {
    if (this.errorStore) return;

    if (!Store) {
      const module = await import('electron-store');
      Store = module.default;
    }

    const iconCacheFolder = PathManager.getIconCacheFolder();
    this.errorStore = new Store!<ErrorStoreData>({
      name: 'icon-fetch-errors',
      cwd: iconCacheFolder,
      defaults: { errors: [] },
    }) as unknown as ErrorStoreInstance;

    logger.info(`IconFetchErrorService initialized at ${iconCacheFolder}`);
  }

  public static async getInstance(): Promise<IconFetchErrorService> {
    if (!IconFetchErrorService.instance) {
      const service = new IconFetchErrorService();
      await service.initializeStore();
      IconFetchErrorService.instance = service;
    }
    return IconFetchErrorService.instance;
  }

  /** テスト用：シングルトンインスタンスをリセット */
  public static resetInstance(): void {
    IconFetchErrorService.instance = null;
    Store = null;
  }

  private getErrors(): IconFetchErrorRecord[] {
    if (!this.errorStore) throw new Error('Error store not initialized');
    return this.errorStore.get('errors') || [];
  }

  private setErrors(errors: IconFetchErrorRecord[]): void {
    if (!this.errorStore) throw new Error('Error store not initialized');
    this.errorStore.set('errors', errors);
  }

  public async recordError(
    key: string,
    type: 'favicon' | 'icon',
    errorMessage: string
  ): Promise<void> {
    await this.initializeStore();

    const errors = this.getErrors();
    const existingIndex = errors.findIndex((e) => e.key === key && e.type === type);

    if (existingIndex >= 0) {
      errors[existingIndex] = {
        ...errors[existingIndex],
        errorMessage,
        errorAt: Date.now(),
        failCount: errors[existingIndex].failCount + 1,
      };
    } else {
      errors.push({ key, type, errorMessage, errorAt: Date.now(), failCount: 1 });
    }

    this.setErrors(errors);
    logger.info({ key, type, errorMessage }, 'Recorded icon fetch error');
  }

  public async hasError(key: string, type: 'favicon' | 'icon'): Promise<boolean> {
    await this.initializeStore();
    return this.getErrors().some((e) => e.key === key && e.type === type);
  }

  public async clearAllErrors(): Promise<void> {
    await this.initializeStore();
    this.setErrors([]);
    logger.info('Cleared all icon fetch errors');
  }

  public async getAllErrors(): Promise<IconFetchErrorRecord[]> {
    await this.initializeStore();
    return this.getErrors();
  }
}

export default IconFetchErrorService;
