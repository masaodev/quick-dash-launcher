/**
 * ワークスペースサービスのファサードクラス
 * 各種マネージャークラスに処理を委譲する
 */
import ElectronStore from 'electron-store';
import type {
  AppItem,
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
  ArchivedWorkspaceGroup,
} from '@common/types.js';
import logger from '@common/logger.js';

import PathManager from '../../config/pathManager.js';
import { ExecutionHistoryService } from '../executionHistoryService.js';

import type { WorkspaceStoreInstance, ArchiveStoreInstance } from './types.js';
import { WorkspaceItemManager } from './WorkspaceItemManager.js';
import { WorkspaceGroupManager } from './WorkspaceGroupManager.js';
import { WorkspaceArchiveManager } from './WorkspaceArchiveManager.js';

// electron-storeを動的にインポート
let Store: typeof ElectronStore | null = null;

/**
 * ワークスペースアイテムを管理するサービスクラス
 * electron-storeを使用してworkspace.jsonに永続化を行う
 */
export class WorkspaceService {
  private store: WorkspaceStoreInstance | null = null;
  private archiveStore: ArchiveStoreInstance | null = null;

  private itemManager: WorkspaceItemManager | null = null;
  private groupManager: WorkspaceGroupManager | null = null;
  private archiveManager: WorkspaceArchiveManager | null = null;

  private static instance: WorkspaceService;

  /**
   * デフォルト設定値
   */
  private static readonly DEFAULT_DATA = {
    items: [] as WorkspaceItem[],
    groups: [] as WorkspaceGroup[],
  };

  private static readonly DEFAULT_ARCHIVE_DATA = {
    groups: [] as ArchivedWorkspaceGroup[],
    items: [] as WorkspaceItem[],
  };

  private constructor() {
    this.store = null;
    this.archiveStore = null;
  }

  /**
   * electron-storeを非同期で初期化
   */
  private async initializeStore(): Promise<void> {
    if (this.store && this.archiveStore) return;

    try {
      if (!Store) {
        const module = await import('electron-store');
        Store = module.default;
      }

      const configFolder = PathManager.getConfigFolder();

      if (!this.store) {
        this.store = new Store!<{ items: WorkspaceItem[]; groups: WorkspaceGroup[] }>({
          name: 'workspace',
          cwd: configFolder,
          defaults: WorkspaceService.DEFAULT_DATA,
        }) as unknown as WorkspaceStoreInstance;
      }

      if (!this.archiveStore) {
        this.archiveStore = new Store!<{
          groups: ArchivedWorkspaceGroup[];
          items: WorkspaceItem[];
        }>({
          name: 'workspace-archive',
          cwd: configFolder,
          defaults: WorkspaceService.DEFAULT_ARCHIVE_DATA,
        }) as unknown as ArchiveStoreInstance;
      }

      // マネージャーを初期化
      this.itemManager = new WorkspaceItemManager(this.store);
      this.groupManager = new WorkspaceGroupManager(this.store);
      this.archiveManager = new WorkspaceArchiveManager(this.store, this.archiveStore);

      logger.info(`WorkspaceService initialized successfully at ${configFolder}`);
    } catch (error) {
      logger.error({ error }, 'Failed to initialize WorkspaceService');
      throw error;
    }
  }

  /**
   * WorkspaceServiceのシングルトンインスタンスを取得
   */
  public static async getInstance(): Promise<WorkspaceService> {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService();
      await WorkspaceService.instance.initializeStore();
    }
    return WorkspaceService.instance;
  }

  // ==================== アイテム管理メソッド ====================

  public async loadItems(): Promise<WorkspaceItem[]> {
    await this.initializeStore();
    return this.itemManager!.loadItems();
  }

  public async addItem(item: AppItem, groupId?: string): Promise<WorkspaceItem> {
    await this.initializeStore();
    return this.itemManager!.addItem(item, groupId);
  }

  public async addItemFromPath(
    filePath: string,
    icon?: string,
    groupId?: string
  ): Promise<WorkspaceItem> {
    await this.initializeStore();
    return this.itemManager!.addItemFromPath(filePath, icon, groupId);
  }

  public async removeItem(id: string): Promise<void> {
    await this.initializeStore();
    this.itemManager!.removeItem(id);
  }

  public async updateDisplayName(id: string, displayName: string): Promise<void> {
    await this.initializeStore();
    this.itemManager!.updateDisplayName(id, displayName);
  }

  public async reorderItems(itemIds: string[]): Promise<void> {
    await this.initializeStore();
    this.itemManager!.reorderItems(itemIds);
  }

  public async getItemsByGroup(groupId?: string): Promise<WorkspaceItem[]> {
    await this.initializeStore();
    return this.itemManager!.getItemsByGroup(groupId);
  }

  public async getWorkspacePath(): Promise<string> {
    await this.initializeStore();
    return this.store!.path;
  }

  public async clear(): Promise<void> {
    await this.initializeStore();
    this.itemManager!.clear();
  }

  // ==================== グループ管理メソッド ====================

  public async loadGroups(): Promise<WorkspaceGroup[]> {
    await this.initializeStore();
    return this.groupManager!.loadGroups();
  }

  public async createGroup(
    name: string,
    color: string = 'var(--color-primary)'
  ): Promise<WorkspaceGroup> {
    await this.initializeStore();
    return this.groupManager!.createGroup(name, color);
  }

  public async updateGroup(id: string, updates: Partial<WorkspaceGroup>): Promise<void> {
    await this.initializeStore();
    this.groupManager!.updateGroup(id, updates);
  }

  public async deleteGroup(id: string, deleteItems: boolean): Promise<void> {
    await this.initializeStore();
    const items = this.itemManager!.loadItems();
    this.groupManager!.deleteGroup(id, deleteItems, items);
  }

  public async reorderGroups(groupIds: string[]): Promise<void> {
    await this.initializeStore();
    this.groupManager!.reorderGroups(groupIds);
  }

  public async moveItemToGroup(itemId: string, groupId?: string): Promise<void> {
    await this.initializeStore();
    const groups = this.groupManager!.loadGroups();
    this.itemManager!.moveItemToGroup(itemId, groupId, groups);
  }

  // ==================== 実行履歴管理メソッド（ファサードパターン） ====================

  public async loadExecutionHistory(): Promise<ExecutionHistoryItem[]> {
    const historyService = await ExecutionHistoryService.getInstance();
    return historyService.loadExecutionHistory();
  }

  public async addExecutionHistory(item: AppItem): Promise<void> {
    const historyService = await ExecutionHistoryService.getInstance();
    await historyService.addExecutionHistory(item);
  }

  public async clearExecutionHistory(): Promise<void> {
    const historyService = await ExecutionHistoryService.getInstance();
    await historyService.clearExecutionHistory();
  }

  // ==================== アーカイブ管理メソッド ====================

  public async archiveGroup(groupId: string): Promise<void> {
    await this.initializeStore();
    const groups = this.groupManager!.loadGroups();
    const items = this.itemManager!.loadItems();
    this.archiveManager!.archiveGroup(groupId, groups, items);
  }

  public async loadArchivedGroups(): Promise<ArchivedWorkspaceGroup[]> {
    await this.initializeStore();
    return this.archiveManager!.loadArchivedGroups();
  }

  public async restoreGroup(groupId: string): Promise<void> {
    await this.initializeStore();
    const groups = this.groupManager!.loadGroups();
    const items = this.itemManager!.loadItems();
    this.archiveManager!.restoreGroup(groupId, groups, items);
  }

  public async deleteArchivedGroup(groupId: string): Promise<void> {
    await this.initializeStore();
    this.archiveManager!.deleteArchivedGroup(groupId);
  }
}

export default WorkspaceService;
