/**
 * ワークスペースサービスのファサードクラス
 * 各種マネージャークラスに処理を委譲する
 */
import * as path from 'path';

import type {
  AppItem,
  DetachedWindowState,
  WorkspaceWindowState,
  PinLevel,
  Workspace,
  WorkspaceItem,
  WorkspaceItemUpdate,
  WorkspaceRefItem,
  WorkspaceGroupUpdate,
  WorkspaceGroupView,
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
  MixedOrderEntry,
} from '@common/types';
import logger from '@common/logger';
import { getDescendantGroupIds } from '@common/utils/groupTreeUtils';
import { FileUtils } from '@common/utils/fileUtils';
import { isRecord } from '@common/types/guards';
import { appItemToWorkspaceItemBody } from '@common/utils/workspaceConverters';

import PathManager from '../../config/pathManager.js';
import { BackupService } from '../backupService.js';
import { releaseClipboardData } from '../clipboardDataUsage.js';
import { SettingsService } from '../settingsService.js';
import type { GroupNameResolver } from '../data/setMigration.js';
import type { LoadReportFile } from '../loadReportService.js';
import { markKnownFolderPath, withFolderMarker } from '../../utils/folderPathProbe.js';
import { mainI18n } from '../mainI18n.js';

import { WorkspaceFileStore } from './WorkspaceFileStore.js';
import {
  countRefsByItemId,
  getMainItemIndex,
  resolveWorkspaceItem,
  resolveWorkspaceItems,
  type ReferenceableAppItem,
} from './workspaceRefResolver.js';
import type { WorkspaceReloadResult } from './WorkspaceFileStore.js';
import { WorkspaceUiStateStore } from './WorkspaceUiStateStore.js';
import { WorkspaceItemManager } from './WorkspaceItemManager.js';
import { WorkspaceGroupManager } from './WorkspaceGroupManager.js';
import { WorkspaceArchiveManager } from './WorkspaceArchiveManager.js';
import { applyOrders } from './orderUtils.js';
import { WorkspaceGroupRequiredError } from './workspacePlacement.js';

/**
 * ワークスペースアイテムを管理するサービスクラス
 *
 * - データ本体（workspace.json / workspace-archive.json）は WorkspaceFileStore
 * - UI 状態（折りたたみ・切り離しウィンドウ）は WorkspaceUiStateStore
 *
 * ファイルの読み込みは初期化時と reload()（メイン画面の F5）のときだけ。
 */
/**
 * ワークスペースのグループが指していたデータファイルのアイテムを、名前から引く表を作る
 *
 * データファイルを読み込み処理に通さず（外部変更の検知などの副作用を避けて）中身だけ読む。
 * フォルダ取込で展開したアイテムは読み込まないと分からないので引けない（参照先の無い行になる）
 */
function readDataFileNameResolver(): GroupNameResolver {
  const map = new Map<string, { itemId: string }>();
  for (const fileName of PathManager.getDataFiles()) {
    const content = FileUtils.safeReadTextFile(path.join(PathManager.getConfigFolder(), fileName));
    if (content === null) continue;
    try {
      const raw: unknown = JSON.parse(content);
      if (!isRecord(raw) || !Array.isArray(raw.items)) continue;
      for (const item of raw.items) {
        if (
          isRecord(item) &&
          (item.type === 'item' || item.type === 'window') &&
          typeof item.displayName === 'string' &&
          typeof item.id === 'string'
        ) {
          map.set(item.displayName, { itemId: item.id });
        }
      }
    } catch {
      // 壊れたファイルは読み飛ばす
    }
  }
  return (name) => map.get(name);
}

export class WorkspaceService {
  private store: WorkspaceFileStore | null = null;
  private uiState: WorkspaceUiStateStore | null = null;

  private itemManager: WorkspaceItemManager | null = null;
  private groupManager: WorkspaceGroupManager | null = null;
  private archiveManager: WorkspaceArchiveManager | null = null;
  /** 前回の syncRefs で解決した参照の中身（変わったときだけ画面に読み直させる） */
  private lastRefSignature = '[]';

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
          prepareSetMigration: async () => {
            const settingsService = await SettingsService.getInstance();
            return {
              resolveName: readDataFileNameResolver(),
              parallel: await settingsService.getLegacyParallelGroupLaunch(),
              snapshot: async () => {
                const backupService = await BackupService.getInstance();
                await backupService.createPreSetMigrationSnapshot();
              },
            };
          },
          createPreWindowMigrationSnapshot: async () => {
            const backupService = await BackupService.getInstance();
            await backupService.createPreWindowMigrationSnapshot();
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

  /** 直近の読み込み結果（読み込みレポートに載せる） */
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
    this.releasingClipboardData(() =>
      this.store!.update((main) => {
        main.workspaces = main.workspaces.filter((w) => w.id !== id);
        main.groups = main.groups.filter((g) => g.workspaceId !== id);
        main.items = main.items.filter((i) => i.workspaceId !== id);
      })
    );
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

  /**
   * 足す先のグループを決める（A3-157。未分類は無く、どのアイテムもグループに入る）
   *
   * - groupId があればそれ（ワークスペースはグループのもの）
   * - 無ければ、そのワークスペースにグループが 1 つも無いときだけ「未分類」グループを作って入れる
   * - グループがあるのに指定が無ければ WorkspaceGroupRequiredError（どこへ入れるかは利用者に選ばせる）
   */
  private resolvePlacement(
    groupId?: string,
    workspaceId?: string
  ): { groupId: string; workspaceId: string } {
    const groups = this.groupManager!.loadGroups();
    if (groupId !== undefined) {
      const group = groups.find((g) => g.id === groupId);
      if (!group) throw new Error(`Group not found: ${groupId}`);
      return { groupId, workspaceId: group.workspaceId };
    }
    const targetWorkspaceId = workspaceId || this.store!.resolveDefaultWorkspaceId();
    if (groups.some((g) => g.workspaceId === targetWorkspaceId)) {
      throw new WorkspaceGroupRequiredError();
    }
    const created = this.groupManager!.createGroup(
      mainI18n.t('workspace.groups.uncategorized'),
      undefined,
      undefined,
      targetWorkspaceId
    );
    return { groupId: created.id, workspaceId: targetWorkspaceId };
  }

  /**
   * 足す先のグループを先に決める（まとめて足すとき、ループの前に 1 回だけ呼ぶ）。
   * グループの無いワークスペースなら「未分類」グループをここで作る
   */
  public async resolveAddPlacement(
    groupId?: string,
    workspaceId?: string
  ): Promise<{ groupId: string; workspaceId: string }> {
    await this.initializeStore();
    return this.resolvePlacement(groupId, workspaceId);
  }

  public async addItem(
    item: AppItem,
    groupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceItem> {
    await this.initializeStore();
    // メイン画面の判定でフォルダと分かっているもの（ドット入りのフォルダ名）は、見た目でも分かるようにして保存する
    const marked =
      'type' in item && item.type === 'folder' && 'path' in item && !item.originalPath
        ? { ...item, path: markKnownFolderPath(item.path) }
        : item;
    const place = this.resolvePlacement(groupId, workspaceId);
    return this.itemManager!.addItem(marked, place.groupId, place.workspaceId);
  }

  /** 中身（ワークスペースの編集フォームで新しく入力したもの）からアイテムを作る */
  public async createItem(
    body: WorkspaceItemUpdate,
    groupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceItem> {
    await this.initializeStore();
    const marked =
      body.type === 'item' ? { ...body, path: await withFolderMarker(body.path) } : body;
    const place = this.resolvePlacement(groupId, workspaceId);
    return this.itemManager!.createItem(marked, place.groupId, place.workspaceId);
  }

  public async addItemFromPath(
    filePath: string,
    groupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceItem> {
    await this.initializeStore();
    const markedPath = await withFolderMarker(filePath);
    const place = this.resolvePlacement(groupId, workspaceId);
    return this.itemManager!.addItemFromPath(markedPath, place.groupId, place.workspaceId);
  }

  public async removeItem(id: string): Promise<void> {
    await this.initializeStore();
    this.releasingClipboardData(() => this.itemManager!.removeItem(id));
  }

  public async updateDisplayName(id: string, displayName: string): Promise<void> {
    await this.initializeStore();
    const item = this.itemManager!.loadItems().find((i) => i.id === id);
    // 参照で、メインウィンドウの表示名と同じ名前にしたら、ワークスペースでの表示名を消す（以後はメインに追随する）
    const mainName =
      item?.type === 'ref' ? getMainItemIndex()?.byId.get(item.ref.itemId)?.displayName : undefined;
    this.itemManager!.updateDisplayName(id, mainName === displayName.trim() ? '' : displayName);
  }

  // --- 参照アイテム ---

  /** ワークスペースの画面・CLI に渡す形（参照をメインウィンドウのアイテムの中身で埋めたもの） */
  public async loadResolvedItems(): Promise<WorkspaceItem[]> {
    return resolveWorkspaceItems(await this.loadItems(), getMainItemIndex());
  }

  /** アーカイブのアイテム（参照を埋めたもの） */
  public async loadResolvedArchivedItems(): Promise<ArchivedWorkspaceItem[]> {
    return resolveWorkspaceItems(
      await this.loadArchivedItems(),
      getMainItemIndex()
    ) as ArchivedWorkspaceItem[];
  }

  /** 1 件を id で引いて、参照を埋めた形で返す（無ければ undefined） */
  public async findResolvedItem(id: string): Promise<WorkspaceItem | undefined> {
    const item = (await this.loadItems()).find((i) => i.id === id);
    return item ? resolveWorkspaceItem(item, getMainItemIndex()) : undefined;
  }

  /** メインウィンドウのアイテムを指す参照を足す */
  public async addRef(
    main: ReferenceableAppItem & { id: string },
    groupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceItem> {
    await this.initializeStore();
    const place = this.resolvePlacement(groupId, workspaceId);
    const added = this.itemManager!.addRef(
      main.id,
      main.displayName,
      place.groupId,
      place.workspaceId
    );
    return resolveWorkspaceItem(added, getMainItemIndex());
  }

  /**
   * データファイルを読み直したあと、参照の「最後に見た表示名」を今のメインウィンドウの表示名に合わせる
   *
   * @returns 参照の解決した中身が前回から変わったか（変わればワークスペースの画面に再取得を知らせる）
   */
  public async syncRefs(): Promise<boolean> {
    await this.initializeStore();
    const all = [...this.itemManager!.loadItems(), ...this.archiveManager!.getAllArchivedItems()];
    const refs = all.filter((item) => item.type === 'ref');
    const index = getMainItemIndex();
    // 解決した中身を前回と比べ、変わったときだけ画面に読み直させる（メインの関係ないアイテムの変更では知らせない）
    const signature = JSON.stringify(resolveWorkspaceItems(refs, index));
    const changed = signature !== this.lastRefSignature;
    this.lastRefSignature = signature;
    if (refs.length === 0 || !index) return changed;
    const sync = (item: WorkspaceRefItem): boolean => {
      const name = index.byId.get(item.ref.itemId)?.displayName;
      if (name === undefined || name === item.ref.lastKnownName) return false;
      item.ref.lastKnownName = name;
      return true;
    };
    try {
      this.itemManager!.updateRefs(sync, 'main');
      this.itemManager!.updateRefs(sync, 'archive');
    } catch (error) {
      // 控えの名前は表示の補助なので、書けなくても読み込みは止めない
      logger.warn({ error }, '参照アイテムの表示名の控えを更新できませんでした');
    }
    return changed;
  }

  /**
   * ワークスペースのセットの行が指すアイテムを付け替える（コピーを参照に変えたとき、ワークスペースの id →
   * メインウィンドウのアイテムの id）
   */
  public async relinkSetEntries(fromId: string, toId: string): Promise<void> {
    await this.initializeStore();
    const items = this.itemManager!.loadItems();
    let changed = false;
    for (const item of items) {
      if (item.type !== 'set' || !item.entries.some((e) => e.itemId === fromId)) continue;
      item.entries = item.entries.map((e) => (e.itemId === fromId ? { ...e, itemId: toId } : e));
      changed = true;
    }
    if (changed) this.store!.set('items', items);
  }

  /**
   * 参照をコピー（中身を持つアイテム）にする。表示名はワークスペースでの表示名があればそれ
   *
   * @param main 中身にするメインウィンドウのアイテム（クリップボードは呼び出し側で実データを複製しておく）
   */
  public async convertRefToCopy(id: string, main: ReferenceableAppItem): Promise<WorkspaceItem> {
    await this.initializeStore();
    const item = this.itemManager!.loadItems().find((i) => i.id === id);
    if (item?.type !== 'ref') throw new Error(`Not a reference item: ${id}`);
    const body = appItemToWorkspaceItemBody(main);
    const marked =
      body.type === 'item' && 'type' in main && main.type === 'folder' && !body.originalPath
        ? { ...body, path: markKnownFolderPath(body.path) }
        : body;
    return this.itemManager!.replaceWithContent(id, {
      ...marked,
      displayName: item.ref.alias ?? main.displayName,
    });
  }

  /**
   * アイテムを、メインウィンドウのアイテムの参照に置き換える（コピー → 参照・参照の指し直し）
   *
   * コピーの表示名がメインウィンドウの表示名と違えば、ワークスペースでの表示名として残す。
   * 参照の指し直しでは、ワークスペースでの表示名をそのまま引き継ぐ
   */
  public async replaceWithRef(
    id: string,
    main: ReferenceableAppItem & { id: string }
  ): Promise<WorkspaceItem> {
    await this.initializeStore();
    const item = this.itemManager!.loadItems().find((i) => i.id === id);
    if (!item) throw new Error(`Item not found: ${id}`);
    const alias =
      item.type === 'ref'
        ? item.ref.alias
        : item.displayName !== main.displayName
          ? item.displayName
          : undefined;
    // コピーを参照にすると、コピーが持っていたクリップボードの実データは使われなくなる
    const replaced = this.releasingClipboardData(() =>
      this.itemManager!.replaceWithRef(id, main.id, main.displayName, alias)
    );
    return resolveWorkspaceItem(replaced, getMainItemIndex());
  }

  /**
   * 参照の指す先を付け替える（アイテム管理の「重複を統合」で消えるアイテム → 残すアイテム）
   *
   * @returns 付け替えた件数
   */
  public async remapRefs(idMap: ReadonlyMap<string, string>): Promise<number> {
    await this.initializeStore();
    let count = 0;
    const remap = (item: WorkspaceRefItem): boolean => {
      const next = idMap.get(item.ref.itemId);
      if (next === undefined || next === item.ref.itemId) return false;
      item.ref.itemId = next;
      item.refItemId = next;
      count++;
      return true;
    };
    this.itemManager!.updateRefs(remap, 'main');
    this.itemManager!.updateRefs(remap, 'archive');
    return count;
  }

  /** メインウィンドウのアイテムの id ごとの、参照の件数（ワークスペースとアーカイブの合計。0 件は返さない） */
  public async countRefs(itemIds: readonly string[]): Promise<Record<string, number>> {
    await this.initializeStore();
    const counts = countRefsByItemId([
      ...this.itemManager!.loadItems(),
      ...this.archiveManager!.getAllArchivedItems(),
    ]);
    const result: Record<string, number> = {};
    for (const id of itemIds) {
      const count = counts.get(id);
      if (count) result[id] = count;
    }
    return result;
  }

  public async updateItem(id: string, update: WorkspaceItemUpdate): Promise<void> {
    await this.initializeStore();
    const marked =
      update.type === 'item' ? { ...update, path: await withFolderMarker(update.path) } : update;
    // 本文を書き換えたクリップボードアイテムは、新しい実データを指す（古いものは使われなくなる）
    this.releasingClipboardData(() => this.itemManager!.updateItem(id, marked));
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

  /**
   * グループを、サブグループとアイテムごと複製する（複製は元と同じ親の最後に入る）
   *
   * @param name 複製の名前（サブグループは元の名前のまま）
   * @param duplicateClipboardData クリップボードアイテムの実データを写して新しい参照を返す（写せなければ null）。
   *   元と同じ実データを指したままにすると、片方を消したときにもう片方が復元できなくなるため
   */
  public async duplicateGroup(
    groupId: string,
    name: string,
    duplicateClipboardData: (dataFileRef: string) => string | null
  ): Promise<WorkspaceGroupView> {
    await this.initializeStore();
    const groups = this.groupManager!.loadGroups();
    const source = groups.find((g) => g.id === groupId);
    if (!source) throw new Error(`Group not found: ${groupId}`);

    const items = this.store!.get('items');
    let nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.order)) + 1 : 0;
    const copies: WorkspaceItem[] = [];

    const copyContents = (fromId: string, toId: string): void => {
      const children = items.filter((i) => i.groupId === fromId).sort((a, b) => a.order - b.order);
      for (const item of children) {
        const copy = {
          ...item,
          id: this.store!.newId(),
          addedAt: Date.now(),
          order: nextOrder++,
          groupId: toId,
        } as WorkspaceItem;
        if (copy.type === 'clipboard' && copy.dataFileRef) {
          const newRef = duplicateClipboardData(copy.dataFileRef);
          if (newRef) copy.dataFileRef = newRef;
        }
        copies.push(copy);
      }
      const subgroups = groups
        .filter((g) => g.parentGroupId === fromId)
        .sort((a, b) => a.order - b.order);
      for (const sub of subgroups) {
        const created = this.groupManager!.createGroup(sub.displayName, sub.color, toId);
        copyContents(sub.id, created.id);
      }
    };

    const created = this.groupManager!.createGroup(
      name,
      source.color,
      source.parentGroupId,
      source.workspaceId
    );
    copyContents(source.id, created.id);
    if (copies.length > 0) this.store!.set('items', [...this.store!.get('items'), ...copies]);
    logger.info(
      { sourceId: groupId, newId: created.id, items: copies.length },
      'Duplicated workspace group'
    );
    return { ...created, collapsed: false };
  }

  public async updateGroup(id: string, updates: WorkspaceGroupUpdate): Promise<void> {
    await this.initializeStore();
    this.groupManager!.updateGroup(id, updates);
  }

  /** グループを、サブグループと中のアイテムごと消す（未分類が無いので、中身を移す先は無い。A3-157） */
  public async deleteGroup(id: string): Promise<void> {
    await this.initializeStore();
    const items = this.itemManager!.loadItems();
    this.releasingClipboardData(() => this.groupManager!.deleteGroup(id, items));
    this.pruneUiState();
  }

  /** グループの折りたたみ（UI 状態。データファイルには書かない） */
  public async setGroupsCollapsed(ids: string[], collapsed: boolean): Promise<void> {
    await this.initializeStore();
    this.uiState!.setGroupsCollapsed(ids, collapsed);
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
    insertOrder?: number,
    duplicateClipboardData?: (dataFileRef: string) => string | null
  ): Promise<WorkspaceItem> {
    await this.initializeStore();
    return this.itemManager!.duplicateItem(
      sourceItemId,
      targetGroupId,
      insertOrder,
      duplicateClipboardData
    );
  }

  public async moveItemToGroup(itemId: string, groupId: string): Promise<void> {
    await this.initializeStore();
    const groups = this.groupManager!.loadGroups();
    this.itemManager!.moveItemToGroup(itemId, groupId, groups);
  }

  /**
   * アイテムを別のワークスペースのグループへ移す（アーカイブのアイテムなら復元して移す）
   *
   * @param groupId 移す先のグループ。省略できるのは、移す先にグループが 1 つも無いときだけ（「未分類」グループを作る）
   */
  public async moveItemToWorkspace(
    itemId: string,
    targetWorkspaceId: string,
    groupId?: string
  ): Promise<void> {
    await this.initializeStore();
    const place = this.resolvePlacement(groupId, targetWorkspaceId);
    const items = this.store!.get('items');
    const item = items.find((i) => i.id === itemId);
    if (item) {
      item.workspaceId = place.workspaceId;
      item.groupId = place.groupId;
      this.store!.set('items', items);
      logger.info({ itemId, ...place }, 'Moved item to workspace');
      return;
    }

    // アーカイブから復元してワークスペースに移動
    this.archiveManager!.restoreItemToWorkspace(itemId, place, items);
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

  public async deleteArchivedGroup(groupId: string): Promise<void> {
    await this.initializeStore();
    this.releasingClipboardData(() => this.archiveManager!.deleteArchivedGroup(groupId));
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

  /** 位置・サイズを保存する。anchor（載っているモニターに対する位置）を渡せば一緒に保存する */
  public async saveDetachedBounds(
    rootGroupId: string,
    bounds: DetachedWindowState['bounds'],
    anchor?: DetachedWindowState['anchor']
  ): Promise<void> {
    await this.initializeStore();
    this.uiState!.updateDetached(rootGroupId, anchor ? { bounds, anchor } : { bounds });
  }

  public async saveDetachedPinMode(rootGroupId: string, pinMode: PinLevel): Promise<void> {
    await this.initializeStore();
    this.uiState!.updateDetached(rootGroupId, { pinMode });
  }

  // --- ワークスペースウィンドウの状態（UI 状態） ---

  public async loadWorkspaceWindowState(): Promise<WorkspaceWindowState> {
    await this.initializeStore();
    return this.uiState!.getWorkspaceWindow();
  }

  public async saveWorkspaceWindowState(updates: Partial<WorkspaceWindowState>): Promise<void> {
    await this.initializeStore();
    this.uiState!.updateWorkspaceWindow(updates);
  }

  /** ピン留めしていない切り離しウィンドウを、すべて表示固定にする（古い設定からの読み替え） */
  public async pinAllUnpinnedDetached(): Promise<number> {
    await this.initializeStore();
    return this.uiState!.pinAllUnpinnedDetached();
  }

  public async removeDetachedWindowState(rootGroupId: string): Promise<void> {
    await this.initializeStore();
    this.uiState!.removeDetached(rootGroupId);
  }

  public async loadOpenDetachedGroupIds(): Promise<string[]> {
    await this.initializeStore();
    return this.uiState!.listDetachedGroupIds();
  }

  /** ワークスペースとアーカイブのアイテムが指しているクリップボードの実データ */
  private clipboardDataRefs(): Set<string> {
    const refs = new Set<string>();
    for (const item of [
      ...this.itemManager!.loadItems(),
      ...this.archiveManager!.getAllArchivedItems(),
    ]) {
      if (item.type === 'clipboard') refs.add(item.dataFileRef);
    }
    return refs;
  }

  /**
   * 書き換えのあと、ワークスペースで使われなくなったクリップボードの実データを消す
   * （メインウィンドウのアイテムが同じ実データを使っていれば消さない。A3-67）
   */
  private releasingClipboardData<T>(change: () => T): T {
    const before = this.clipboardDataRefs();
    const result = change();
    const after = this.clipboardDataRefs();
    releaseClipboardData(
      PathManager.getConfigFolder(),
      [...before].filter((ref) => !after.has(ref))
    );
    return result;
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
