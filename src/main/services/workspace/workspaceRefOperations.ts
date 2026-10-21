import logger from '@common/logger';
import type {
  AppItem,
  WorkspaceItem,
  WorkspaceLinkCandidate,
  WorkspaceLinkCopiesPreview,
  WorkspaceLinkCopyEntry,
} from '@common/types';
import { isClipboardItem, isLauncherItem } from '@common/types/guards';
import { pickItemWindowSwitch } from '@common/utils/itemWindowConversion';
import { samePathKey } from '@common/utils/workspaceRefs';

import PathManager from '../../config/pathManager.js';
import { ClipboardService } from '../clipboardService.js';
import { reloadConfigFiles } from '../data/dataFileLoader.js';
import { updateItemMemoById } from '../data/dataItemWriter.js';
import { notifyDataChanged } from '../../ipc/notifications.js';

import { WorkspaceService } from './WorkspaceService.js';
import {
  getMainItemIndex,
  isReferenceableAppItem,
  type MainItemIndex,
  type ReferenceableAppItem,
} from './workspaceRefResolver.js';

/**
 * 参照アイテムの操作（ワークスペースの IPC・右クリック・CLI から共通で使う）
 *
 * メインウィンドウのアイテムの表（workspaceRefResolver）が要る操作をまとめる。表はデータファイルを読み直す
 * たびに作り直されるので、まだ読んでいなければここで読む
 */

const EMPTY_INDEX: MainItemIndex = {
  byId: new Map(),
  folderImportIds: new Set(),
  tabNameOfFile: new Map(),
};

/**
 * メインウィンドウのアイテムの表を返す（まだ無い、または refresh のときはデータファイルを読む）
 *
 * 読めなくてもワークスペースは開けるよう、失敗したら手元の表か空の表を返す（参照は「見つからない」として出る）
 */
export async function ensureMainItemIndex(refresh = false): Promise<MainItemIndex> {
  const existing = getMainItemIndex();
  if (existing && !refresh) return existing;
  try {
    await reloadConfigFiles(PathManager.getConfigFolder(), 'internal');
  } catch (error) {
    logger.error({ error }, '参照の解決のためのデータファイルの読み込みに失敗しました');
  }
  return getMainItemIndex() ?? existing ?? EMPTY_INDEX;
}

/**
 * クリップボードアイテムなら実データを複製した参照に差し替える
 * （コピーはメインウィンドウと 1 つのファイルを共有しない。メインウィンドウで消したときにコピーが復元できなくなるため）。
 * 複製できなければ元の参照のまま
 */
export function withOwnClipboardData<T extends AppItem>(item: T): T {
  if (!isClipboardItem(item)) return item;
  const newRef = ClipboardService.getInstance().duplicateClipboardData(item.clipboardDataRef);
  return newRef ? { ...item, clipboardDataRef: newRef } : item;
}

/** ワークスペースへ足した結果 */
export interface AddToWorkspaceResult {
  item: WorkspaceItem;
  /** 参照で足したか */
  linked: boolean;
  /** 参照で足すつもりだったが、参照できないアイテムなのでコピーで足したか */
  fellBackToCopy: boolean;
}

/**
 * メインウィンドウのアイテムをワークスペースへ足す（既定は参照。copy ならコピー）
 *
 * 参照にできるのは、id を持ち、今のデータファイルにあるメインウィンドウのアイテム（通常アイテム・クリップボード・
 * セット）。フォルダ取込で展開したアイテム・ウィンドウ検索の結果などはコピーで足す
 */
export async function addAppItemToWorkspace(
  item: AppItem,
  groupId: string | undefined,
  workspaceId: string | undefined,
  options: { copy?: boolean } = {}
): Promise<AddToWorkspaceResult> {
  const service = await WorkspaceService.getInstance();
  const referenceable = isReferenceableAppItem(item);
  if (!options.copy && referenceable && item.id) {
    // 表に無ければ（登録した直後など、表を作り直す前）1 回だけ読み直して引き直す
    const main =
      (await ensureMainItemIndex()).byId.get(item.id) ??
      (await ensureMainItemIndex(true)).byId.get(item.id);
    if (main) {
      const added = await service.addRef({ ...main, id: item.id }, groupId, workspaceId);
      return { item: added, linked: true, fellBackToCopy: false };
    }
  }
  const added = await service.addItem(withOwnClipboardData(item), groupId, workspaceId);
  // 「メインウィンドウのアイテムだが参照できない」もの（展開したアイテム・データファイルに見つからないもの）だけ知らせる
  // （ウィンドウ検索の結果・ファイルのドロップなどはもともとコピー）
  const fellBackToCopy =
    !options.copy &&
    (referenceable || (isLauncherItem(item) && (!!item.isDirExpanded || !!item.expandedFromId)));
  return { item: added, linked: false, fellBackToCopy };
}

/** 参照をコピーにする（クリップボードは実データを複製する） */
export async function convertRefToCopy(id: string): Promise<WorkspaceItem> {
  const service = await WorkspaceService.getInstance();
  const index = await ensureMainItemIndex();
  const item = (await service.loadItems()).find((i) => i.id === id);
  if (item?.type !== 'ref') throw new Error(`Not a reference item: ${id}`);
  const main = index.byId.get(item.ref.itemId);
  if (!main) throw new Error(`The original item was not found: ${item.ref.itemId}`);
  return service.convertRefToCopy(id, withOwnClipboardData(main));
}

const pathKey = samePathKey;

function candidateOf(item: ReferenceableAppItem, index: MainItemIndex): WorkspaceLinkCandidate {
  const tabName = item.sourceFile ? index.tabNameOfFile.get(item.sourceFile) : undefined;
  return {
    itemId: item.id ?? '',
    displayName: item.displayName,
    ...(tabName !== undefined && { tabName }),
  };
}

/** パスと引数が同じメインウィンドウのアイテム（通常アイテムだけ。表の並び順） */
function findSamePathItems(
  path: string,
  args: string | undefined,
  index: MainItemIndex
): ReferenceableAppItem[] {
  const key = pathKey(path, args);
  if (key === null) return [];
  return [...index.byId.values()].filter(
    (main) => isLauncherItem(main) && pathKey(main.path, main.args) === key
  );
}

/** コピーの指す先の候補（パスと引数が同じメインウィンドウのアイテム） */
export async function findLinkCandidates(id: string): Promise<WorkspaceLinkCandidate[]> {
  const service = await WorkspaceService.getInstance();
  const index = await ensureMainItemIndex();
  const item = (await service.loadItems()).find((i) => i.id === id);
  if (item?.type !== 'item') return [];
  return findSamePathItems(item.path, item.args, index).map((main) => candidateOf(main, index));
}

/**
 * アイテム（コピーまたは参照）を、メインウィンドウのアイテムの参照にする
 *
 * - コピーのメモは、メインウィンドウのアイテムにメモが無ければメインへ移す（両方にあれば、コピーのメモは捨てる）。
 *   メモが有るかはデータファイルの今の内容で決める（一括で同じアイテムへ続けて移すとき、先に移したメモを上書きしない）
 * - ワークスペースのセットの行がこのアイテムを指していれば、メインウィンドウのアイテムの id に付け替える
 *   （参照はセットの行を選ぶ候補に出さないので、ワークスペースの id のままだと編集画面で見つからなくなる）
 */
export async function linkToMainItem(id: string, mainItemId: string): Promise<WorkspaceItem> {
  const service = await WorkspaceService.getInstance();
  const index = await ensureMainItemIndex();
  const item = (await service.loadItems()).find((i) => i.id === id);
  if (!item) throw new Error(`Item not found: ${id}`);
  const main = index.byId.get(mainItemId);
  if (!main) throw new Error(`The launcher item was not found: ${mainItemId}`);

  // 先に参照へ置き換える（ワークスペースへ書けなければ、メインのメモも書かない）
  const linked = await service.replaceWithRef(id, { ...main, id: mainItemId });
  await service.relinkSetEntries(id, mainItemId);
  const copyMemo = item.type !== 'ref' ? item.memo?.trim() : undefined;
  if (
    copyMemo &&
    updateItemMemoById(PathManager.getConfigFolder(), mainItemId, item.memo ?? '', {
      onlyIfEmpty: true,
    })
  ) {
    notifyDataChanged();
  }
  logger.info({ id, mainItemId }, 'Linked workspace item to launcher item');
  return linked;
}

/** ウィンドウ切り替え・カスタムアイコンが違うか */
function settingsDiffer(copy: WorkspaceItem, main: ReferenceableAppItem): boolean {
  if (copy.type !== 'item' || !isLauncherItem(main)) return false;
  if ((copy.customIcon ?? '') !== (main.customIcon ?? '')) return true;
  return JSON.stringify(pickItemWindowSwitch(copy)) !== JSON.stringify(pickItemWindowSwitch(main));
}

/**
 * 「メインウィンドウと同じアイテムを参照に変える」の一覧を作る（そのワークスペースのコピーのうち、
 * パスと引数が同じメインウィンドウのアイテムがあるもの）
 */
export async function previewLinkCopies(workspaceId: string): Promise<WorkspaceLinkCopiesPreview> {
  const service = await WorkspaceService.getInstance();
  const index = await ensureMainItemIndex();
  const workspaces = await service.loadWorkspaces();
  const items = (await service.loadItems()).filter((i) => i.workspaceId === workspaceId);
  const entries: WorkspaceLinkCopyEntry[] = [];
  // メモを移す先（同じメインのアイテムへは 2 件目から移せないので、メモが消えると知らせる）
  const memoTargets = new Set<string>();
  let notMatchable = 0;
  for (const item of items) {
    if (item.type === 'ref') continue;
    if (item.type !== 'item' || pathKey(item.path, item.args) === null) {
      notMatchable++;
      continue;
    }
    const mains = findSamePathItems(item.path, item.args, index);
    if (mains.length === 0) continue;
    const main = mains[0];
    const copyMemo = item.memo?.trim() ?? '';
    const mainMemo = main.memo?.trim() ?? '';
    let memo: WorkspaceLinkCopyEntry['memo'] =
      copyMemo === '' || copyMemo === mainMemo ? 'none' : mainMemo === '' ? 'move' : 'conflict';
    if (memo === 'move' && mains.length === 1 && main.id) {
      if (memoTargets.has(main.id)) memo = 'conflict';
      else memoTargets.add(main.id);
    }
    entries.push({
      id: item.id,
      displayName: item.displayName,
      candidates: mains.map((m) => candidateOf(m, index)),
      ...(mains.length === 1 &&
        item.displayName !== main.displayName && { alias: item.displayName }),
      memo,
      settingsDiffer: mains.length === 1 && settingsDiffer(item, main),
    });
  }
  return {
    workspaceName: workspaces.find((w) => w.id === workspaceId)?.displayName ?? '',
    entries,
    notMatchable,
  };
}

/** 一覧で選んだコピーを参照に変える（候補が 1 件のものだけ）。変えた件数を返す */
export async function applyLinkCopies(ids: readonly string[]): Promise<number> {
  const service = await WorkspaceService.getInstance();
  const index = await ensureMainItemIndex();
  const items = await service.loadItems();
  let count = 0;
  for (const id of ids) {
    const item = items.find((i) => i.id === id);
    if (item?.type !== 'item') continue;
    const mains = findSamePathItems(item.path, item.args, index);
    if (mains.length !== 1 || !mains[0].id) continue;
    await linkToMainItem(id, mains[0].id);
    count++;
  }
  logger.info({ count }, 'Linked workspace copies to launcher items');
  return count;
}
