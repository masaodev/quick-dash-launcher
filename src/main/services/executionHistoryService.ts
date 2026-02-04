import { randomUUID } from 'crypto';

import ElectronStore from 'electron-store';
import type { AppItem, ExecutionHistoryItem } from '@common/types';
import logger from '@common/logger';
import { isWindowInfo, isWindowItem, isClipboardItem, isGroupItem } from '@common/types/guards';

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
   * 履歴アイテムの基本プロパティを作成
   */
  private createBaseHistoryItem(
    itemName: string
  ): Pick<ExecutionHistoryItem, 'id' | 'itemName' | 'executedAt'> {
    return {
      id: randomUUID(),
      itemName,
      executedAt: Date.now(),
    };
  }

  /**
   * 履歴リストを更新するヘルパー
   * 同名アイテムを除外した後、新しいアイテムを先頭に追加し、最大件数で切り詰める
   */
  private updateHistoryList(
    history: ExecutionHistoryItem[],
    newItem: ExecutionHistoryItem
  ): ExecutionHistoryItem[] {
    const filtered = history.filter((h) => h.itemName !== newItem.itemName);
    return [newItem, ...filtered].slice(0, ExecutionHistoryService.MAX_HISTORY_ITEMS);
  }

  /**
   * アイテムから履歴アイテムを作成
   */
  private createHistoryItem(
    item: Exclude<AppItem, import('@common/types').WindowInfo>
  ): ExecutionHistoryItem {
    const base = this.createBaseHistoryItem(item.displayName);

    if (isWindowItem(item)) {
      return {
        ...base,
        itemPath: `[ウィンドウ操作: ${item.windowTitle}]`,
        itemType: 'windowOperation',
        windowX: item.x,
        windowY: item.y,
        windowWidth: item.width,
        windowHeight: item.height,
        moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
        virtualDesktopNumber: item.virtualDesktopNumber,
        activateWindow: item.activateWindow,
        pinToAllDesktops: item.pinToAllDesktops,
        processName: item.processName,
      };
    }

    if (isClipboardItem(item)) {
      return {
        ...base,
        itemPath: `[クリップボード: ${item.preview?.substring(0, 20) || 'データ'}...]`,
        itemType: 'clipboard',
        customIcon: item.customIcon,
        clipboardDataRef: item.clipboardDataRef,
        clipboardFormats: item.formats,
      };
    }

    if (isGroupItem(item)) {
      const itemNames = item.itemNames || [];
      return {
        ...base,
        itemPath: `[グループ: ${itemNames.join(', ')}]`,
        itemType: 'group',
        itemNames,
      };
    }

    // 通常のLauncherItemの場合
    const historyItem: ExecutionHistoryItem = {
      ...base,
      itemPath: item.path,
      itemType: item.type,
      customIcon: item.customIcon,
      args: item.args,
    };

    if (item.windowConfig) {
      historyItem.processName = item.windowConfig.processName;
      historyItem.windowX = item.windowConfig.x;
      historyItem.windowY = item.windowConfig.y;
      historyItem.windowWidth = item.windowConfig.width;
      historyItem.windowHeight = item.windowConfig.height;
      historyItem.virtualDesktopNumber = item.windowConfig.virtualDesktopNumber;
      historyItem.activateWindow = item.windowConfig.activateWindow;
      historyItem.moveToActiveMonitorCenter = item.windowConfig.moveToActiveMonitorCenter;
    }

    return historyItem;
  }

  /**
   * アイテム実行を履歴に追加
   * @param item 実行されたアイテム
   */
  public async addExecutionHistory(item: AppItem): Promise<void> {
    await this.initializeStore();
    if (!this.historyStore) throw new Error('History store not initialized');

    try {
      if (isWindowInfo(item)) {
        logger.info('WindowInfo is not supported in execution history');
        return;
      }

      const history = await this.loadExecutionHistory();
      const historyItem = this.createHistoryItem(item);
      const updatedHistory = this.updateHistoryList(history, historyItem);
      this.historyStore.set('history', updatedHistory);

      logger.info(
        { itemName: item.displayName, count: updatedHistory.length },
        'Added item to execution history'
      );
    } catch (error) {
      const itemName = isWindowInfo(item) ? item.title : item.displayName;
      logger.error({ error, itemName }, 'Failed to add execution history');
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
