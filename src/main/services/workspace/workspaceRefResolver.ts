import type {
  AppItem,
  DataFileTab,
  WorkspaceItem,
  WorkspaceRefInfo,
  WorkspaceRefItem,
} from '@common/types';
import { isClipboardItem, isLauncherItem, isSetItem } from '@common/types/guards';
import { appItemToWorkspaceItemBody } from '@common/utils/workspaceConverters';
import { isReferenceableAppItem, type ReferenceableAppItem } from '@common/utils/workspaceRefs';

import { mainI18n } from '../mainI18n.js';

/**
 * ワークスペースの参照アイテムを、ランチャーのアイテムの中身で埋める
 *
 * ランチャーのアイテムの表は、データファイルを読み直すたび（dataFileLoader.reloadConfigFiles）に
 * 作り直す。参照の解決はワークスペースの画面・CLI・起動に渡すときに行い、ストア（workspace.json）には
 * 参照のまま残す（中身を書かない）。
 */

export { isReferenceableAppItem, type ReferenceableAppItem };

/** ランチャーのアイテムの表 */
export interface MainItemIndex {
  /** 参照できるアイテム（id を持ち、フォルダ取込で展開したものでないもの） */
  byId: Map<string, ReferenceableAppItem>;
  /** フォルダ取込の行の id（展開したアイテムの expandedFromId。参照できない） */
  folderImportIds: Set<string>;
  /** データファイル → タブの名前 */
  tabNameOfFile: Map<string, string>;
}

let currentIndex: MainItemIndex | null = null;

/** データファイルの読み込み結果から表を作る */
export function buildMainItemIndex(
  items: readonly AppItem[],
  dataFileTabs: readonly DataFileTab[] = []
): MainItemIndex {
  const byId = new Map<string, ReferenceableAppItem>();
  const folderImportIds = new Set<string>();
  for (const item of items) {
    if (isLauncherItem(item) && item.expandedFromId) folderImportIds.add(item.expandedFromId);
    if (isReferenceableAppItem(item) && item.id && !byId.has(item.id)) byId.set(item.id, item);
  }
  const tabNameOfFile = new Map<string, string>();
  for (const tab of dataFileTabs) {
    for (const file of tab.files) {
      if (!tabNameOfFile.has(file)) tabNameOfFile.set(file, tab.name);
    }
  }
  return { byId, folderImportIds, tabNameOfFile };
}

/** データファイルを読み直したときに表を差し替える */
export function setMainItemIndex(index: MainItemIndex): void {
  currentIndex = index;
}

/** 直近の表（まだデータファイルを読んでいなければ null） */
export function getMainItemIndex(): MainItemIndex | null {
  return currentIndex;
}

/** テスト用: 表を捨てる */
export function resetMainItemIndexForTest(): void {
  currentIndex = null;
}

/** 所属・並び順・アーカイブの情報（参照から解決したアイテムにもそのまま引き継ぐ） */
function pickMeta(item: WorkspaceItem): Record<string, unknown> {
  const src = item as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of [
    'workspaceId',
    'groupId',
    'order',
    'addedAt',
    'archivedAt',
    'archivedGroupId',
  ]) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

/** 元が見つからない参照の表示名（ワークスペースでの表示名 → 最後に見た表示名 → 決まった文言） */
function missingDisplayName(ref: WorkspaceRefInfo): string {
  return ref.alias ?? ref.lastKnownName ?? mainI18n.t('workspace.ref.unknownName');
}

/**
 * 1 件を解決する。参照でなければそのまま返す
 *
 * 解決できた参照は指す先の種別（item / clipboard / set）の形になり、id・所属・並び順はワークスペースのもの、
 * 表示名はワークスペースでの表示名（無ければランチャーの表示名）、メモはランチャーのものになる
 */
export function resolveWorkspaceItem<T extends WorkspaceItem>(
  item: T,
  index: MainItemIndex | null
): WorkspaceItem {
  if (item.type !== 'ref') return item;
  const baseRef: WorkspaceRefInfo = {
    itemId: item.ref.itemId,
    ...(item.ref.alias !== undefined && { alias: item.ref.alias }),
    ...(item.ref.lastKnownName !== undefined && { lastKnownName: item.ref.lastKnownName }),
    status: 'missing',
  };
  const main = index?.byId.get(item.ref.itemId);
  if (!main) {
    const status = index?.folderImportIds.has(item.ref.itemId) ? 'unsupported' : 'missing';
    const ref: WorkspaceRefInfo = { ...baseRef, status };
    const unresolved: WorkspaceRefItem = {
      ...(item as WorkspaceRefItem),
      displayName: missingDisplayName(ref),
      ref,
    };
    return unresolved;
  }

  const sourceFile = 'sourceFile' in main ? main.sourceFile : undefined;
  const tabName = sourceFile ? index?.tabNameOfFile.get(sourceFile) : undefined;
  const ref: WorkspaceRefInfo = {
    ...baseRef,
    status: 'ok',
    mainDisplayName: main.displayName,
    ...(sourceFile !== undefined && { sourceFile }),
    ...(tabName !== undefined && { tabName }),
  };
  const body = appItemToWorkspaceItemBody(main);
  const resolved = {
    ...body,
    id: item.id,
    displayName: ref.alias ?? main.displayName,
    ...pickMeta(item),
    ref,
  } as WorkspaceItem;
  if (resolved.type === 'item' && isLauncherItem(main)) {
    // 起動種別はランチャーの読み込みで判定済み（.lnk はリンク先から）
    resolved.launcherType = main.type === 'clipboard' ? 'file' : main.type;
  }
  if (!isClipboardItem(main) && !isSetItem(main) && main.icon) {
    resolved.icon = main.icon;
  }
  return resolved;
}

/** まとめて解決する */
export function resolveWorkspaceItems<T extends WorkspaceItem>(
  items: readonly T[],
  index: MainItemIndex | null
): WorkspaceItem[] {
  return items.map((item) => resolveWorkspaceItem(item, index));
}

/** ランチャーのアイテムを指すワークスペースの参照の数（アイテムの id → 件数。アーカイブを含める） */
export function countRefsByItemId(items: readonly WorkspaceItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.ref) continue;
    counts.set(item.ref.itemId, (counts.get(item.ref.itemId) ?? 0) + 1);
  }
  return counts;
}
