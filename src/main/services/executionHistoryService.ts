import { randomUUID } from 'crypto';

import ElectronStore from 'electron-store';
import type { AppItem, ExecutionHistoryItem } from '@common/types.js';
import logger from '@common/logger.js';
import { isWindowInfo, isLauncherItem, isWindowOperationItem } from '@common/utils/typeGuards.js';

import PathManager from '../config/pathManager.js';

// electron-storeを動的にインポート
let Store: typeof ElectronStore | null = null;

/**
 * electron-storeのインスタンス型（execution-history.json用）
 */
type HistoryStoreInstance = {
  get(key: 'history'): ExecutionHistoryItem[];
  set(key: 'history', value: ExecutionHistoryItem[]): void;
  store: { history: ExecutionHistoryItem[] };
  clear(): void;
  path: string;
};

/**
 * 実行履歴を管理するサービスクラス
 * electron-storeを使用してexecution-history.jsonに永続化を行う
 */
export class ExecutionHistoryService {
  /**
   * electron-storeのインスタンス（execution-history.json用）
   */
  private historyStore: HistoryStoreInstance | null = null;
  private static instance: ExecutionHistoryService;

  /**
   * デフォルト設定値
   */
  private static readonly DEFAULT_HISTORY_DATA = {
    history: [] as ExecutionHistoryItem[],
  };

  /**
   * 実行履歴の最大保持件数
   */
  private static readonly MAX_HISTORY_ITEMS = 10;

  private constructor() {
    // electron-storeは後で非同期に初期化
    this.historyStore = null;
  }

  /**
   * electron-storeを非同期で初期化
   */
  private async initializeStore(): Promise<void> {
    if (this.historyStore) return; // 既に初期化済み

    try {
      if (!Store) {
        // electron-storeを動的にインポート
        const module = await import('electron-store');
        Store = module.default;
      }

      // PathManagerから設定フォルダを取得
      const configFolder = PathManager.getConfigFolder();

      // execution-history.jsonを初期化
      this.historyStore = new Store!<{ history: ExecutionHistoryItem[] }>({
        name: 'execution-history',
        cwd: configFolder,
        defaults: ExecutionHistoryService.DEFAULT_HISTORY_DATA,
      }) as unknown as HistoryStoreInstance;

      logger.info(`ExecutionHistoryService initialized successfully at ${configFolder}`);
    } catch (error) {
      logger.error({ error }, 'Failed to initialize ExecutionHistoryService');
      throw error;
    }
  }

  /**
   * ExecutionHistoryServiceのシングルトンインスタンスを取得
   */
  public static async getInstance(): Promise<ExecutionHistoryService> {
    if (!ExecutionHistoryService.instance) {
      ExecutionHistoryService.instance = new ExecutionHistoryService();
      await ExecutionHistoryService.instance.initializeStore();
    }
    return ExecutionHistoryService.instance;
  }

  /**
   * 実行履歴を全て取得
   * @returns 実行履歴の配列（実行日時の新しい順）
   */
  public async loadExecutionHistory(): Promise<ExecutionHistoryItem[]> {
    await this.initializeStore();
    if (!this.historyStore) throw new Error('History store not initialized');

    try {
      const history = this.historyStore.get('history') || [];
      // 実行日時の新しい順にソート
      return history.sort((a, b) => b.executedAt - a.executedAt);
    } catch (error) {
      logger.error({ error }, 'Failed to load execution history');
      return [];
    }
  }

  /**
   * アイテム実行を履歴に追加
   * @param item 実行されたアイテム
   */
  public async addExecutionHistory(item: AppItem): Promise<void> {
    await this.initializeStore();
    if (!this.historyStore) throw new Error('History store not initialized');

    try {
      const history = await this.loadExecutionHistory();

      // WindowInfoは履歴に追加しない
      if (isWindowInfo(item)) {
        logger.info('WindowInfo is not supported in execution history');
        return;
      }

      // ウィンドウ操作アイテムの場合
      if (isWindowOperationItem(item)) {
        // 同じ名前のアイテムを履歴から削除
        const filteredHistory = history.filter((h) => h.itemName !== item.name);

        const historyItem: ExecutionHistoryItem = {
          id: randomUUID(),
          itemName: item.name,
          itemPath: `[ウィンドウ操作: ${item.windowTitle}]`,
          itemType: 'windowOperation',
          executedAt: Date.now(),
          windowX: item.x,
          windowY: item.y,
          windowWidth: item.width,
          windowHeight: item.height,
          virtualDesktopNumber: item.virtualDesktopNumber,
          activateWindow: item.activateWindow,
          exactMatch: item.exactMatch,
          processName: item.processName,
        };
        filteredHistory.unshift(historyItem);
        history.length = 0;
        history.push(...filteredHistory);
      }
      // グループアイテムの場合
      else if (!isLauncherItem(item)) {
        const groupItem = item as { name: string; type: 'group'; itemNames: string[] };

        // 同じ名前のアイテムを履歴から削除
        const filteredHistory = history.filter((h) => h.itemName !== groupItem.name);

        const historyItem: ExecutionHistoryItem = {
          id: randomUUID(),
          itemName: groupItem.name,
          itemPath: `[グループ: ${groupItem.itemNames.join(', ')}]`,
          itemType: 'group',
          executedAt: Date.now(),
        };
        filteredHistory.unshift(historyItem);
        history.length = 0;
        history.push(...filteredHistory);
      }
      // 通常のアイテムの場合
      else {
        const launcherItem = item;

        // 同じ名前のアイテムを履歴から削除
        const filteredHistory = history.filter((h) => h.itemName !== launcherItem.name);

        const historyItem: ExecutionHistoryItem = {
          id: randomUUID(),
          itemName: launcherItem.name,
          itemPath: launcherItem.path,
          itemType: launcherItem.type,
          icon: launcherItem.icon,
          args: launcherItem.args,
          executedAt: Date.now(),
        };

        // windowConfigが存在する場合、その情報を展開して保存
        if (launcherItem.windowConfig) {
          historyItem.exactMatch = launcherItem.windowConfig.exactMatch;
          historyItem.processName = launcherItem.windowConfig.processName;
          historyItem.windowX = launcherItem.windowConfig.x;
          historyItem.windowY = launcherItem.windowConfig.y;
          historyItem.windowWidth = launcherItem.windowConfig.width;
          historyItem.windowHeight = launcherItem.windowConfig.height;
          historyItem.virtualDesktopNumber = launcherItem.windowConfig.virtualDesktopNumber;
          historyItem.activateWindow = launcherItem.windowConfig.activateWindow;
          historyItem.moveToActiveMonitorCenter = launcherItem.windowConfig.moveToActiveMonitorCenter;
        }

        filteredHistory.unshift(historyItem);
        history.length = 0;
        history.push(...filteredHistory);
      }

      // 最大件数を超えた分を削除
      const trimmedHistory = history.slice(0, ExecutionHistoryService.MAX_HISTORY_ITEMS);

      // 保存
      this.historyStore.set('history', trimmedHistory);
      const itemName = isLauncherItem(item) ? item.name : item.name;
      logger.info({ itemName, count: trimmedHistory.length }, 'Added item to execution history');
    } catch (error) {
      const itemName = isWindowInfo(item) ? item.title : item.name;
      logger.error({ error, itemName }, 'Failed to add execution history');
      // エラーでも処理は継続（履歴追加の失敗はアイテム実行を妨げない）
    }
  }

  /**
   * 実行履歴をクリア
   */
  public async clearExecutionHistory(): Promise<void> {
    await this.initializeStore();
    if (!this.historyStore) throw new Error('History store not initialized');

    try {
      this.historyStore.set('history', []);
      logger.info('Cleared execution history');
    } catch (error) {
      logger.error({ error }, 'Failed to clear execution history');
      throw error;
    }
  }
}

export default ExecutionHistoryService;
