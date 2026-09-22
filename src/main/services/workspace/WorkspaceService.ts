/**
 * ワークスペースサービスのファサードクラス
 * 各種マネージャークラスに処理を委譲する
 */
import type {
  AppItem,
  DetachedWindowState,
  Workspace,
  WorkspaceItem,
  WorkspaceItemUpdate,
  WorkspaceGroupUpdate,
  WorkspaceGroupView,
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
  MixedOrderEntry,
} from '@common/types';
import logger from '@common/logger';
import { getDescendantGroupIds } from '@common/utils/groupTreeUtils';

import PathManager from '../../config/pathManager.js';
import { BackupService } from '../backupService.js';
import type { LoadReportFile } from '../loadReportService.js';

import { WorkspaceFileStore } from './WorkspaceFileStore.js';
import type { WorkspaceReloadResult } from './WorkspaceFileStore.js';
import { WorkspaceUiStateStore } from './WorkspaceUiStateStore.js';
import { WorkspaceItemManager } from './WorkspaceItemManager.js';
import { WorkspaceGroupManager } from './WorkspaceGroupManager.js';
import { WorkspaceArchiveManager } from './WorkspaceArchiveManager.js';
import { applyOrders } from './orderUtils.js';

/**
 * ワークスペースアイテムを管理するサービスクラス
 *
 * - データ本体（workspace.json / workspace-archive.json）は WorkspaceFileStore
 * - UI 状態（折りたたみ・切り離しウィンドウ）は WorkspaceUiStateStore
 *
 * ファイルの読み込みは初期化時と reload()（メイン画面の F5）のときだけ。
 */
export class WorkspaceService {
  private store: WorkspaceFileStore | null = null;
  private uiState: WorkspaceUiStateStore | null = null;

  private itemManager: WorkspaceItemManager | null = null;
  private groupManager: WorkspaceGroupManager | null = null;
  private archiveManager: WorkspaceArchiveManager | null = null;

  private static instance: WorkspaceService;
  /** 初期化の Promise（並行呼び出しで initializeStore が二重に走らないように 1 本にまとめる） */
  private static initPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * ストアを初期化し、ファイルを読み込む
   */
  private async initializeStore(): Promise<void> {
    if (this.store) return;

    try {
      const uiState = new WorkspaceUiStateStore();
      const store = new WorkspaceFileStore(
        {
          main: PathManager.getWorkspaceFilePath(),
          archive: PathManager.getWorkspaceArchiveFilePath(),
          legacyDetached: PathManager.getLegacyWorkspaceDetachedFilePath(),
        },
        uiState,
        {
          createPreMigrationSnapshot: async () => {
            const backupService = await BackupService.getInstance();
            await backupService.createPreMigrationSnapshot();
          },
        }
      );
      await store.reload();

      this.uiState = uiState;
      this.store = store;
      this.itemManager = new WorkspaceItemManager(store);
      this.groupManager = new WorkspaceGroupManager(store);
      this.archiveManager = new WorkspaceArchiveManager(store);

      logger.info(`WorkspaceService initialized successfully at ${PathManager.getConfigFolder()}`);
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
    }
    if (!WorkspaceService.initPromise) {
      WorkspaceService.initPromise = WorkspaceService.instance.initializeStore().catch((error) => {
        // 失敗したら次の呼び出しで再試行できるようにする
        WorkspaceService.initPromise = null;
        throw error;
      });
    }
    await WorkspaceService.initPromise;
    return WorkspaceService.instance;
  }

  // --- 再読込・レポート（メイン画面の F5 から呼ばれる） ---

  /** ディスクから読み直す。旧形式なら移行、補正があれば書き戻す */
  public async reload(): Promise<WorkspaceReloadResult> {
    await this.initializeStore();
    // 初期化時の読み込み結果がまだ取り出されていなければ、それを結果として使う
    // （起動直後のメイン画面の読み込みで移行やレポートを二重に処理しないため）
    if (this.store!.hasPendingReports()) {
      return { changed: false };
    }
    return this.store!.reload();
  }

  /** 直近の読み込み結果（last-load-report.json に載せる） */
  public consumeLoadReports(): {
    files: LoadReportFile[];
    externallyChanged: Array<{ relativePath: string; content: string }>;
  } {
    return this.store?.consumeLoadReports() ?? { files: [], externallyChanged: [] };
  }

  public isCorrupted(): boolean {
    return this.store?.isCorrupted() ?? false;
  }

  // --- ワークスペース（タブ）管理 ---

  public async loadWorkspaces(): Promise<Workspace[]> {
    await this.initializeStore();
    return this.store!.get('workspaces').sort((a, b) => a.order - b.order);
  }

  public async createWorkspace(name: string): Promise<Workspace> {
    await this.initializeStore();
    const workspaces = this.store!.get('workspaces');
    const maxOrder = workspaces.length > 0 ? Math.max(...workspaces.map((w) => w.order)) : -1;
    const workspace: Workspace = {
      id: this.store!.newId(),
      displayName: name,
      order: maxOrder + 1,
      createdAt: Date.now(),
    };
    workspaces.push(workspace);
    this.store!.set('workspaces', workspaces);
    logger.info({ id: workspace.id, name }, 'Created workspace');
    return workspace;
  }

  public async renameWorkspace(id: string, name: string): Promise<void> {
    await this.initializeStore();
    const workspaces = this.store!.get('workspaces');
    const ws = workspaces.find((w) => w.id === id);
    if (!ws) throw new Error(`Workspace not found: ${id}`);
    ws.displayName = name;
    this.store!.set('workspaces', workspaces);
    logger.info({ id, name }, 'Renamed workspace');
  }

  public async deleteWorkspace(id: string): Promise<void> {
    await this.initializeStore();
    const workspaces = this.store!.get('workspaces');
    if (workspaces.length <= 1) throw new Error('Cannot delete the last workspace');
    if (!workspaces.some((w) => w.id === id)) throw new Error(`Workspace not found: ${id}`);

    // 所属グループ・アイテムも削除（1 回の書き込み）
    this.store!.update((main) => {
      main.workspaces = main.workspaces.filter((w) => w.id !== id);
      main.groups = main.groups.filter((g) => g.workspaceId !== id);
      main.items = main.items.filter((i) => i.workspaceId !== id);
    });
    this.pruneUiState();

    logger.info({ id }, 'Deleted workspace with associated groups and items');
  }

  public async reorderWorkspaces(ids: string[]): Promise<void> {
    await this.initializeStore();
    const workspaces = this.store!.get('workspaces');
    const wsMap = new Map(workspaces.map((w) => [w.id, w]));
    ids.forEach((id, index) => {
      const ws = wsMap.get(id);
      if (ws) ws.order = index;
    });
    this.store!.set('workspaces', workspaces);
    logger.info({ count: ids.length }, 'Reordered workspaces');
  }

  // --- アイテム管理 ---

  public async loadItems(): Promise<WorkspaceItem[]> {
    await this.initializeStore();
    return this.itemManager!.loadItems();
  }

  public async addItem(
    item: AppItem,
    groupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceItem> {
    await this.initializeStore();
    return this.itemManager!.addItem(item, groupId, workspaceId);
  }

  public async addItemFromPath(
    filePath: string,
    groupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceItem> {
    await this.initializeStore();
    return this.itemManager!.addItemFromPath(filePath, groupId, workspaceId);
  }

  public async removeItem(id: string): Promise<void> {
    await this.initializeStore();
    this.itemManager!.removeItem(id);
  }

  public async updateDisplayName(id: string, displayName: string): Promise<void> {
    await this.initializeStore();
    this.itemManager!.updateDisplayName(id, displayName);
  }

  public async updateItem(id: string, update: WorkspaceItemUpdate): Promise<void> {
    await this.initializeStore();
    this.itemManager!.updateItem(id, update);
  }

  public async reorderItems(itemIds: string[]): Promise<void> {
    await this.initializeStore();
    this.itemManager!.reorderItems(itemIds);
  }

  public async getItemsByGroup(groupId?: string): Promise<WorkspaceItem[]> {
    await this.initializeStore();
    return this.itemManager!.getItemsByGroup(groupId);
  }

  // --- グループ管理 ---

  /** グループ一覧（UI 状態の折りたたみを合成して返す） */
  public async loadGroups(): Promise<WorkspaceGroupView[]> {
    await this.initializeStore();
    const collapsed = this.uiState!.getCollapsedGroups();
    return this.groupManager!.loadGroups().map((group) => ({
      ...group,
      collapsed: collapsed[group.id] === true,
    }));
  }

  public async createGroup(
    name: string,
    color?: string,
    parentGroupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceGroupView> {
    await this.initializeStore();
    const group = this.groupManager!.createGroup(name, color, parentGroupId, workspaceId);
    return { ...group, collapsed: false };
  }

  public async updateGroup(id: string, updates: WorkspaceGroupUpdate): Promise<void> {
    await this.initializeStore();
    this.groupManager!.updateGroup(id, updates);
  }

  public async deleteGroup(id: string, deleteItems: boolean): Promise<void> {
    await this.initializeStore();
    const items = this.itemManager!.loadItems();
    this.groupManager!.deleteGroup(id, deleteItems, items);
    this.pruneUiState();
  }

  /** グループの折りたたみ（UI 状態。データファイルには書かない） */
  public async setGroupsCollapsed(ids: string[], collapsed: boolean): Promise<void> {
    await this.initializeStore();
    this.uiState!.setGroupsCollapsed(ids, collapsed);
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

    // アイテムとグループを 1 回の書き込みで更新する
    let updatedItems = 0;
    let updatedGroups = 0;
    this.store!.update((main) => {
      updatedItems = applyOrders(main.items, itemOrderMap);
      updatedGroups = applyOrders(main.groups, groupOrderMap);
      return updatedItems + updatedGroups > 0 ? undefined : false;
    });

    logger.info(
      { parentGroupId, items: updatedItems, groups: updatedGroups },
      'Reordered mixed children'
    );
  }

  public async moveGroupToParent(groupId: string, newParentGroupId?: string): Promise<void> {
    await this.initializeStore();
    this.groupManager!.moveGroupToParent(groupId, newParentGroupId);
  }

  public async duplicateItem(
    sourceItemId: string,
    targetGroupId?: string,
    insertOrder?: number
  ): Promise<WorkspaceItem> {
    await this.initializeStore();
    return this.itemManager!.duplicateItem(sourceItemId, targetGroupId, insertOrder);
  }

  public async moveItemToGroup(itemId: string, groupId?: string): Promise<void> {
    await this.initializeStore();
    const groups = this.groupManager!.loadGroups();
    this.itemManager!.moveItemToGroup(itemId, groupId, groups);
  }

  public async moveItemToWorkspace(itemId: string, targetWorkspaceId: string): Promise<void> {
    await this.initializeStore();
    const items = this.store!.get('items');
    const item = items.find((i) => i.id === itemId);
    if (item) {
      item.workspaceId = targetWorkspaceId;
      // グループから外す（移動先ワークスペースにはそのグループが存在しないため）
      delete item.groupId;
      this.store!.set('items', items);
      logger.info({ itemId, targetWorkspaceId }, 'Moved item to workspace');
      return;
    }

    // アーカイブから復元してワークスペースに移動
    this.archiveManager!.restoreItemToWorkspace(itemId, targetWorkspaceId, items);
  }

  public async moveGroupToWorkspace(groupId: string, targetWorkspaceId: string): Promise<void> {
    await this.initializeStore();
    const groups = this.store!.get('groups');
    const items = this.store!.get('items');

    // メインストアにグループが存在する場合
    if (groups.some((g) => g.id === groupId)) {
      const allGroupIds = new Set([groupId, ...getDescendantGroupIds(groupId, groups)]);

      this.store!.update((main) => {
        // グループの workspaceId を更新（トップレベルグループは parentGroupId を解除）
        for (const group of main.groups) {
          if (allGroupIds.has(group.id)) {
            group.workspaceId = targetWorkspaceId;
            if (group.id === groupId) {
              delete group.parentGroupId;
            }
          }
        }
        // 所属アイテムの workspaceId を更新
        for (const item of main.items) {
          if (item.groupId && allGroupIds.has(item.groupId)) {
            item.workspaceId = targetWorkspaceId;
          }
        }
      });
      logger.info(
        { groupId, targetWorkspaceId, groupCount: allGroupIds.size },
        'Moved group to workspace'
      );
      return;
    }

    // アーカイブから復元して移動
    this.archiveManager!.restoreGroup(groupId, groups, items, { targetWorkspaceId });
    logger.info({ groupId, targetWorkspaceId }, 'Moved archived group to workspace');
  }

  // --- アーカイブ管理 ---

  public async archiveGroup(groupId: string): Promise<void> {
    await this.initializeStore();
    const groups = this.groupManager!.loadGroups();
    const items = this.itemManager!.loadItems();
    this.archiveManager!.archiveGroup(groupId, groups, items);
    this.pruneUiState();
  }

  public async loadArchivedGroups(): Promise<ArchivedWorkspaceGroup[]> {
    await this.initializeStore();
    return this.archiveManager!.loadArchivedGroups();
  }

  public async loadArchivedItems(): Promise<ArchivedWorkspaceItem[]> {
    await this.initializeStore();
    return this.archiveManager!.getAllArchivedItems();
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
    this.pruneUiState();
  }

  // --- 切り離しウィンドウ状態管理（UI 状態） ---

  public async loadDetachedWindowState(rootGroupId: string): Promise<DetachedWindowState | null> {
    await this.initializeStore();
    return this.uiState!.getDetached(rootGroupId);
  }

  public async saveDetachedCollapsedStates(
    rootGroupId: string,
    states: Record<string, boolean>
  ): Promise<void> {
    await this.initializeStore();
    this.uiState!.updateDetached(rootGroupId, { collapsedStates: states });
  }

  public async saveDetachedBounds(
    rootGroupId: string,
    bounds: DetachedWindowState['bounds']
  ): Promise<void> {
    await this.initializeStore();
    this.uiState!.updateDetached(rootGroupId, { bounds });
  }

  public async saveDetachedPinMode(rootGroupId: string, pinMode: 0 | 1 | 2): Promise<void> {
    await this.initializeStore();
    this.uiState!.updateDetached(rootGroupId, { pinMode });
  }

  public async removeDetachedWindowState(rootGroupId: string): Promise<void> {
    await this.initializeStore();
    this.uiState!.removeDetached(rootGroupId);
  }

  public async loadOpenDetachedGroupIds(): Promise<string[]> {
    await this.initializeStore();
    return this.uiState!.listDetachedGroupIds();
  }

  /** 存在しなくなったグループの UI 状態を捨てる */
  private pruneUiState(): void {
    const groupIds = new Set([
      ...this.store!.get('groups').map((g) => g.id),
      ...this.store!.archiveStore.get('groups').map((g) => g.id),
    ]);
    this.uiState!.pruneMissingGroups(groupIds);
  }
}

export default WorkspaceService;
