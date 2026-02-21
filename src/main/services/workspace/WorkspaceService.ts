/**
 * ワークスペースサービスのファサードクラス
 * 各種マネージャークラスに処理を委譲する
 */
import type ElectronStore from 'electron-store';
import type {
  AppItem,
  WorkspaceItem,
  WorkspaceGroup,
  ArchivedWorkspaceGroup,
  MixedOrderEntry,
} from '@common/types';
import logger from '@common/logger';

import PathManager from '../../config/pathManager.js';

import type {
  WorkspaceStoreInstance,
  ArchiveStoreInstance,
  DetachedStoreInstance,
  DetachedWindowState,
} from './types.js';
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
  private detachedStore: DetachedStoreInstance | null = null;

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

  private static readonly DEFAULT_DETACHED_DATA = {
    windows: {} as Record<string, DetachedWindowState>,
  };

  private constructor() {}

  /**
   * electron-storeを非同期で初期化
   */
  private async initializeStore(): Promise<void> {
    if (this.store && this.archiveStore && this.detachedStore) return;

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

      if (!this.detachedStore) {
        this.detachedStore = new Store!<{
          windows: Record<string, DetachedWindowState>;
        }>({
          name: 'workspace-detached',
          cwd: configFolder,
          defaults: WorkspaceService.DEFAULT_DETACHED_DATA,
        }) as unknown as DetachedStoreInstance;
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

  // --- アイテム管理 ---

  public async loadItems(): Promise<WorkspaceItem[]> {
    await this.initializeStore();
    return this.itemManager!.loadItems();
  }

  public async addItem(item: AppItem, groupId?: string): Promise<WorkspaceItem> {
    await this.initializeStore();
    return this.itemManager!.addItem(item, groupId);
  }

  public async addItemFromPath(filePath: string, groupId?: string): Promise<WorkspaceItem> {
    await this.initializeStore();
    return this.itemManager!.addItemFromPath(filePath, groupId);
  }

  public async removeItem(id: string): Promise<void> {
    await this.initializeStore();
    this.itemManager!.removeItem(id);
  }

  public async updateDisplayName(id: string, displayName: string): Promise<void> {
    await this.initializeStore();
    this.itemManager!.updateDisplayName(id, displayName);
  }

  public async updateItem(id: string, updates: Partial<WorkspaceItem>): Promise<void> {
    await this.initializeStore();
    this.itemManager!.updateItem(id, updates);
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

  // --- グループ管理 ---

  public async loadGroups(): Promise<WorkspaceGroup[]> {
    await this.initializeStore();
    return this.groupManager!.loadGroups();
  }

  public async createGroup(
    name: string,
    color: string = 'var(--color-primary)',
    parentGroupId?: string
  ): Promise<WorkspaceGroup> {
    await this.initializeStore();
    return this.groupManager!.createGroup(name, color, parentGroupId);
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

  public async setGroupsCollapsed(ids: string[], collapsed: boolean): Promise<void> {
    await this.initializeStore();
    this.groupManager!.setGroupsCollapsed(ids, collapsed);
  }

  public async reorderGroups(groupIds: string[]): Promise<void> {
    await this.initializeStore();
    this.groupManager!.reorderGroups(groupIds);
  }

  public async reorderMixed(
    parentGroupId: string | undefined,
    entries: MixedOrderEntry[]
  ): Promise<void> {
    await this.initializeStore();

    const itemOrderMap = new Map<string, number>();
    const groupOrderMap = new Map<string, number>();

    entries.forEach((entry, index) => {
      if (entry.kind === 'item') {
        itemOrderMap.set(entry.id, index);
      } else {
        groupOrderMap.set(entry.id, index);
      }
    });

    if (itemOrderMap.size > 0) {
      this.itemManager!.updateItemOrders(itemOrderMap);
    }
    if (groupOrderMap.size > 0) {
      this.groupManager!.updateGroupOrders(groupOrderMap);
    }

    logger.info(
      { parentGroupId, items: itemOrderMap.size, groups: groupOrderMap.size },
      'Reordered mixed children'
    );
  }

  public async moveGroupToParent(groupId: string, newParentGroupId?: string): Promise<void> {
    await this.initializeStore();
    this.groupManager!.moveGroupToParent(groupId, newParentGroupId);
  }

  public async moveItemToGroup(itemId: string, groupId?: string): Promise<void> {
    await this.initializeStore();
    const groups = this.groupManager!.loadGroups();
    this.itemManager!.moveItemToGroup(itemId, groupId, groups);
  }

  // --- アーカイブ管理 ---

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

  // --- 切り離しウィンドウ状態管理 ---

  public async loadDetachedWindowState(rootGroupId: string): Promise<DetachedWindowState | null> {
    await this.initializeStore();
    const windows = this.detachedStore!.get('windows');
    return windows[rootGroupId] || null;
  }

  private async updateDetachedWindowState(
    rootGroupId: string,
    updates: Partial<DetachedWindowState>
  ): Promise<void> {
    await this.initializeStore();
    const windows = this.detachedStore!.get('windows');
    const defaultState: DetachedWindowState = {
      collapsedStates: {},
      bounds: { x: 0, y: 0, width: 380, height: 200 },
    };
    windows[rootGroupId] = { ...(windows[rootGroupId] || defaultState), ...updates };
    this.detachedStore!.set('windows', windows);
  }

  public async saveDetachedCollapsedStates(
    rootGroupId: string,
    states: Record<string, boolean>
  ): Promise<void> {
    await this.updateDetachedWindowState(rootGroupId, { collapsedStates: states });
  }

  public async saveDetachedBounds(
    rootGroupId: string,
    bounds: { x: number; y: number; width: number; height: number }
  ): Promise<void> {
    await this.updateDetachedWindowState(rootGroupId, { bounds });
  }

  public async removeDetachedWindowState(rootGroupId: string): Promise<void> {
    await this.initializeStore();
    const windows = this.detachedStore!.get('windows');
    delete windows[rootGroupId];
    this.detachedStore!.set('windows', windows);
  }

  public async loadOpenDetachedGroupIds(): Promise<string[]> {
    await this.initializeStore();
    const windows = this.detachedStore!.get('windows');
    return Object.keys(windows);
  }
}

export default WorkspaceService;
