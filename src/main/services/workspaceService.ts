import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import ElectronStore from 'electron-store';

import type {
  AppItem,
  LauncherItem,
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
} from '../../common/types.js';
import logger from '../../common/logger.js';
import PathManager from '../config/pathManager.js';
import { detectItemTypeSync } from '../../common/utils/itemTypeDetector.js';

// electron-storeを動的にインポート
let Store: typeof ElectronStore | null = null;

/**
 * electron-storeのインスタンス型（workspace.json用）
 */
type StoreInstance = {
  get(key: 'items'): WorkspaceItem[];
  get(key: 'groups'): WorkspaceGroup[];
  set(key: 'items', value: WorkspaceItem[]): void;
  set(key: 'groups', value: WorkspaceGroup[]): void;
  store: { items: WorkspaceItem[]; groups: WorkspaceGroup[] };
  clear(): void;
  path: string;
};

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
 * ワークスペースアイテムを管理するサービスクラス
 * electron-storeを使用してworkspace.jsonに永続化を行う
 */
export class WorkspaceService {
  /**
   * electron-storeのインスタンス（workspace.json用）
   */
  private store: StoreInstance | null = null;

  /**
   * electron-storeのインスタンス（execution-history.json用）
   */
  private historyStore: HistoryStoreInstance | null = null;

  private static instance: WorkspaceService;

  /**
   * デフォルト設定値
   */
  private static readonly DEFAULT_DATA = {
    items: [] as WorkspaceItem[],
    groups: [] as WorkspaceGroup[],
  };

  private static readonly DEFAULT_HISTORY_DATA = {
    history: [] as ExecutionHistoryItem[],
  };

  /**
   * 実行履歴の最大保持件数
   */
  private static readonly MAX_HISTORY_ITEMS = 10;

  private constructor() {
    // electron-storeは後で非同期に初期化
    this.store = null;
    this.historyStore = null;
  }

  /**
   * electron-storeを非同期で初期化
   */
  private async initializeStore(): Promise<void> {
    if (this.store && this.historyStore) return; // 既に初期化済み

    try {
      if (!Store) {
        // electron-storeを動的にインポート
        const module = await import('electron-store');
        Store = module.default;
      }

      // PathManagerから設定フォルダを取得
      const configFolder = PathManager.getConfigFolder();

      // workspace.jsonを初期化
      if (!this.store) {
        this.store = new Store!<{ items: WorkspaceItem[]; groups: WorkspaceGroup[] }>({
          name: 'workspace',
          cwd: configFolder,
          defaults: WorkspaceService.DEFAULT_DATA,
        }) as unknown as StoreInstance;
      }

      // execution-history.jsonを初期化
      if (!this.historyStore) {
        this.historyStore = new Store!<{ history: ExecutionHistoryItem[] }>({
          name: 'execution-history',
          cwd: configFolder,
          defaults: WorkspaceService.DEFAULT_HISTORY_DATA,
        }) as unknown as HistoryStoreInstance;
      }

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

  /**
   * 全てのワークスペースアイテムを取得
   * @returns ワークスペースアイテムの配列（order順にソート済み）
   */
  public async loadItems(): Promise<WorkspaceItem[]> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const items = this.store.get('items') || [];
      // order順にソート
      return items.sort((a, b) => a.order - b.order);
    } catch (error) {
      logger.error({ error }, 'Failed to load workspace items');
      return [];
    }
  }

  /**
   * アイテムをワークスペースに追加
   * @param item 追加するアイテム（LauncherItem or GroupItem）
   * @returns 追加されたWorkspaceItem
   */
  public async addItem(item: AppItem): Promise<WorkspaceItem> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const items = await this.loadItems();

      // グループアイテムは現状サポートしない（将来的に拡張可能）
      if (item.type === 'group') {
        throw new Error('Group items are not supported in workspace yet');
      }

      const launcherItem = item as LauncherItem;

      // 新しいorder値を計算（最大値+1）
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.order)) : -1;

      // WorkspaceItemを作成
      const workspaceItem: WorkspaceItem = {
        id: randomUUID(),
        displayName: launcherItem.name,
        originalName: launcherItem.name,
        path: launcherItem.path,
        type: launcherItem.type,
        icon: launcherItem.icon,
        customIcon: launcherItem.customIcon,
        args: launcherItem.args,
        originalPath: launcherItem.originalPath,
        order: maxOrder + 1,
        addedAt: Date.now(),
      };

      // アイテムを追加
      items.push(workspaceItem);

      // 保存
      this.store.set('items', items);
      logger.info(
        { id: workspaceItem.id, name: workspaceItem.displayName },
        'Added item to workspace'
      );

      return workspaceItem;
    } catch (error) {
      logger.error({ error }, 'Failed to add workspace item');
      throw error;
    }
  }

  /**
   * ファイルパスからワークスペースにアイテムを追加
   * @param filePath 追加するファイルまたはフォルダーのパス
   * @param icon オプションのアイコン（base64エンコードされたデータURL）
   * @returns 追加されたWorkspaceItem
   */
  public async addItemFromPath(filePath: string, icon?: string): Promise<WorkspaceItem> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const items = await this.loadItems();

      // ファイル/フォルダーの存在確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`File or folder does not exist: ${filePath}`);
      }

      // アイテムタイプを判定
      const itemType = detectItemTypeSync(filePath);

      // ファイル名を取得
      const fileName = path.basename(filePath);

      // 新しいorder値を計算（最大値+1）
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.order)) : -1;

      // WorkspaceItemを作成
      const workspaceItem: WorkspaceItem = {
        id: randomUUID(),
        displayName: fileName,
        originalName: fileName,
        path: filePath,
        type: itemType,
        icon: icon,
        order: maxOrder + 1,
        addedAt: Date.now(),
      };

      // アイテムを追加
      items.push(workspaceItem);

      // 保存
      this.store.set('items', items);
      logger.info(
        { id: workspaceItem.id, name: workspaceItem.displayName, path: filePath },
        'Added item from path to workspace'
      );

      return workspaceItem;
    } catch (error) {
      logger.error({ error, path: filePath }, 'Failed to add workspace item from path');
      throw error;
    }
  }

  /**
   * ワークスペースからアイテムを削除
   * @param id 削除するアイテムのID
   */
  public async removeItem(id: string): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const items = await this.loadItems();
      const filteredItems = items.filter((item) => item.id !== id);

      if (items.length === filteredItems.length) {
        logger.warn({ id }, 'Item not found in workspace');
        return;
      }

      this.store.set('items', filteredItems);
      logger.info({ id }, 'Removed item from workspace');
    } catch (error) {
      logger.error({ error, id }, 'Failed to remove workspace item');
      throw error;
    }
  }

  /**
   * アイテムの表示名を更新
   * @param id 更新するアイテムのID
   * @param displayName 新しい表示名
   */
  public async updateDisplayName(id: string, displayName: string): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const items = await this.loadItems();
      const item = items.find((i) => i.id === id);

      if (!item) {
        logger.warn({ id }, 'Item not found in workspace');
        throw new Error(`Item not found: ${id}`);
      }

      item.displayName = displayName;
      this.store.set('items', items);
      logger.info({ id, displayName }, 'Updated workspace item display name');
    } catch (error) {
      logger.error({ error, id }, 'Failed to update workspace item display name');
      throw error;
    }
  }

  /**
   * アイテムの並び順を変更
   * @param itemIds 新しい順序でのアイテムIDの配列
   */
  public async reorderItems(itemIds: string[]): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const items = await this.loadItems();

      // itemIdsの順序に従ってorder値を再計算
      const itemMap = new Map(items.map((item) => [item.id, item]));
      const reorderedItems: WorkspaceItem[] = [];

      itemIds.forEach((id, index) => {
        const item = itemMap.get(id);
        if (item) {
          item.order = index;
          reorderedItems.push(item);
        }
      });

      // itemIdsに含まれていないアイテムも保持（末尾に追加）
      items.forEach((item) => {
        if (!itemIds.includes(item.id)) {
          item.order = reorderedItems.length;
          reorderedItems.push(item);
        }
      });

      this.store.set('items', reorderedItems);
      logger.info({ count: itemIds.length }, 'Reordered workspace items');
    } catch (error) {
      logger.error({ error }, 'Failed to reorder workspace items');
      throw error;
    }
  }

  /**
   * ワークスペースファイルのパスを取得
   * @returns workspace.jsonのフルパス
   */
  public async getWorkspacePath(): Promise<string> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');
    return this.store.path;
  }

  /**
   * ワークスペースをクリア（全アイテムを削除）
   * テスト用またはリセット機能で使用
   */
  public async clear(): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      this.store.set('items', []);
      logger.info('Cleared all workspace items');
    } catch (error) {
      logger.error({ error }, 'Failed to clear workspace');
      throw error;
    }
  }

  // ==================== グループ管理メソッド ====================

  /**
   * 全てのワークスペースグループを取得
   * @returns ワークスペースグループの配列（order順にソート済み）
   */
  public async loadGroups(): Promise<WorkspaceGroup[]> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const groups = this.store.get('groups') || [];
      // order順にソート
      return groups.sort((a, b) => a.order - b.order);
    } catch (error) {
      logger.error({ error }, 'Failed to load workspace groups');
      return [];
    }
  }

  /**
   * 新しいグループを作成
   * @param name グループ名
   * @param color グループの色（デフォルト: var(--color-primary)）
   * @returns 作成されたWorkspaceGroup
   */
  public async createGroup(
    name: string,
    color: string = 'var(--color-primary)'
  ): Promise<WorkspaceGroup> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const groups = await this.loadGroups();

      // 新しいorder値を計算（最大値+1）
      const maxOrder = groups.length > 0 ? Math.max(...groups.map((g) => g.order)) : -1;

      // WorkspaceGroupを作成
      const workspaceGroup: WorkspaceGroup = {
        id: randomUUID(),
        name,
        color,
        order: maxOrder + 1,
        collapsed: false,
        createdAt: Date.now(),
      };

      // グループを追加
      groups.push(workspaceGroup);

      // 保存
      this.store.set('groups', groups);
      logger.info({ id: workspaceGroup.id, name: workspaceGroup.name }, 'Created workspace group');

      return workspaceGroup;
    } catch (error) {
      logger.error({ error, name }, 'Failed to create workspace group');
      throw error;
    }
  }

  /**
   * グループを更新
   * @param id 更新するグループのID
   * @param updates 更新する内容
   */
  public async updateGroup(id: string, updates: Partial<WorkspaceGroup>): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const groups = await this.loadGroups();
      const group = groups.find((g) => g.id === id);

      if (!group) {
        logger.warn({ id }, 'Group not found in workspace');
        throw new Error(`Group not found: ${id}`);
      }

      // 更新可能なフィールドのみ更新（id, order, createdAtは除外）
      if (updates.name !== undefined) group.name = updates.name;
      if (updates.color !== undefined) group.color = updates.color;
      if (updates.collapsed !== undefined) group.collapsed = updates.collapsed;

      this.store.set('groups', groups);
      logger.info({ id, updates }, 'Updated workspace group');
    } catch (error) {
      logger.error({ error, id }, 'Failed to update workspace group');
      throw error;
    }
  }

  /**
   * グループを削除
   * @param id 削除するグループのID
   * @param deleteItems グループ内のアイテムも削除するか（false: 未分類に移動）
   */
  public async deleteGroup(id: string, deleteItems: boolean): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const groups = await this.loadGroups();
      const items = await this.loadItems();

      const filteredGroups = groups.filter((group) => group.id !== id);

      if (groups.length === filteredGroups.length) {
        logger.warn({ id }, 'Group not found in workspace');
        return;
      }

      // グループ内のアイテムを処理
      if (deleteItems) {
        // アイテムも削除
        const filteredItems = items.filter((item) => item.groupId !== id);
        this.store.set('items', filteredItems);
        logger.info(
          { id, deletedItems: items.length - filteredItems.length },
          'Deleted group and its items'
        );
      } else {
        // アイテムを未分類に移動（groupIdをundefinedに）
        items.forEach((item) => {
          if (item.groupId === id) {
            delete item.groupId;
          }
        });
        this.store.set('items', items);
        logger.info({ id }, 'Deleted group and moved items to uncategorized');
      }

      this.store.set('groups', filteredGroups);
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete workspace group');
      throw error;
    }
  }

  /**
   * グループの並び順を変更
   * @param groupIds 新しい順序でのグループIDの配列
   */
  public async reorderGroups(groupIds: string[]): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const groups = await this.loadGroups();

      // groupIdsの順序に従ってorder値を再計算
      const groupMap = new Map(groups.map((group) => [group.id, group]));
      const reorderedGroups: WorkspaceGroup[] = [];

      groupIds.forEach((id, index) => {
        const group = groupMap.get(id);
        if (group) {
          group.order = index;
          reorderedGroups.push(group);
        }
      });

      // groupIdsに含まれていないグループも保持（末尾に追加）
      groups.forEach((group) => {
        if (!groupIds.includes(group.id)) {
          group.order = reorderedGroups.length;
          reorderedGroups.push(group);
        }
      });

      this.store.set('groups', reorderedGroups);
      logger.info({ count: groupIds.length }, 'Reordered workspace groups');
    } catch (error) {
      logger.error({ error }, 'Failed to reorder workspace groups');
      throw error;
    }
  }

  /**
   * アイテムをグループに移動
   * @param itemId 移動するアイテムのID
   * @param groupId 移動先のグループID（undefined: 未分類に移動）
   */
  public async moveItemToGroup(itemId: string, groupId?: string): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const items = await this.loadItems();
      const item = items.find((i) => i.id === itemId);

      if (!item) {
        logger.warn({ itemId }, 'Item not found in workspace');
        throw new Error(`Item not found: ${itemId}`);
      }

      // groupIdが指定されている場合は、そのグループが存在するか確認
      if (groupId) {
        const groups = await this.loadGroups();
        const group = groups.find((g) => g.id === groupId);
        if (!group) {
          logger.warn({ groupId }, 'Group not found in workspace');
          throw new Error(`Group not found: ${groupId}`);
        }
      }

      // アイテムのgroupIdを更新
      if (groupId) {
        item.groupId = groupId;
      } else {
        delete item.groupId;
      }

      this.store.set('items', items);
      logger.info({ itemId, groupId }, 'Moved item to group');
    } catch (error) {
      logger.error({ error, itemId, groupId }, 'Failed to move item to group');
      throw error;
    }
  }

  /**
   * 指定したグループのアイテムを取得
   * @param groupId グループID（undefined: 未分類のアイテムを取得）
   * @returns グループ内のアイテム配列（order順にソート済み）
   */
  public async getItemsByGroup(groupId?: string): Promise<WorkspaceItem[]> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');

    try {
      const items = await this.loadItems();
      return items.filter((item) => item.groupId === groupId);
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to get items by group');
      return [];
    }
  }

  // ==================== 実行履歴管理メソッド ====================

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

      // グループアイテムの場合
      if (item.type === 'group') {
        const groupItem = item as { name: string; type: 'group'; itemNames: string[] };
        const historyItem: ExecutionHistoryItem = {
          id: randomUUID(),
          itemName: groupItem.name,
          itemPath: `[グループ: ${groupItem.itemNames.join(', ')}]`,
          itemType: 'group',
          executedAt: Date.now(),
        };
        history.unshift(historyItem);
      }
      // 通常のアイテムの場合
      else {
        const launcherItem = item as LauncherItem;
        const historyItem: ExecutionHistoryItem = {
          id: randomUUID(),
          itemName: launcherItem.name,
          itemPath: launcherItem.path,
          itemType: launcherItem.type,
          icon: launcherItem.icon,
          executedAt: Date.now(),
        };
        history.unshift(historyItem);
      }

      // 最大件数を超えた分を削除
      const trimmedHistory = history.slice(0, WorkspaceService.MAX_HISTORY_ITEMS);

      // 保存
      this.historyStore.set('history', trimmedHistory);
      logger.info(
        { itemName: item.name, count: trimmedHistory.length },
        'Added item to execution history'
      );
    } catch (error) {
      logger.error({ error, itemName: item.name }, 'Failed to add execution history');
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

export default WorkspaceService;
