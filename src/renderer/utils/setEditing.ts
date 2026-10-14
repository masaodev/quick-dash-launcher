/**
 * セットの編集で使う補助（アイテムの一覧・行の表示・位置の表示の文言・記録の反映）
 */
import i18next from 'i18next';
import type { AppItem, LauncherItem, SetEntry, WindowInfo, WorkspaceItem } from '@common/types';
import { isLauncherItem, isWindowItem } from '@common/types/guards';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import {
  computePlacementLabel,
  type PlacementLabel,
  type ScreenArea,
} from '@common/utils/placementLabel';
import {
  isUnresolvedEntry,
  opensAsTab,
  decideWindowMatch,
  placementFromWindow,
  type MatchableEntry,
  type SetTargetKind,
} from '@common/utils/setWindowMatching';

/** セットに追加できるアイテム（追加の画面の 1 行） */
export interface SetCatalogItem {
  /** 一覧の中で一意のキー（id、展開分は "dir:" ＋パス） */
  key: string;
  /** 行に書く id（フォルダ取込の展開分は持たない） */
  id?: string;
  displayName: string;
  kind: SetTargetKind | 'window';
  path?: string;
  args?: string;
  icon?: string;
  /** 所属するタブの名前（ワークスペースのアイテムは「ワークスペース」） */
  groupName: string;
  /** セットと同じタブか（先に並べる） */
  sameGroup: boolean;
}

function launcherKind(item: LauncherItem): SetTargetKind {
  return item.type === 'clipboard' ? 'none' : item.type;
}

/**
 * セットに追加できるアイテムを集める
 *
 * @param currentFile セットを置くデータファイル（同じタブのアイテムを先に並べる）。ワークスペースなら undefined
 * @param includeWorkspace ワークスペースのアイテムも含める（ワークスペースのセット）
 */
export async function loadSetCatalog(
  currentFile: string | undefined,
  includeWorkspace: boolean
): Promise<SetCatalogItem[]> {
  const [allItems, settings] = await Promise.all([
    window.electronAPI.loadDataFiles('internal'),
    window.electronAPI.getSettings(),
  ]);
  const tabOf = (file: string | undefined) =>
    settings.dataFileTabs.find((tab) => file !== undefined && tab.files.includes(file));
  const currentTab = tabOf(currentFile);

  const launchers = allItems.filter((item): item is LauncherItem => isLauncherItem(item));
  const icons = await window.electronAPI.loadCachedIcons(launchers).catch(() => ({}));

  const result: SetCatalogItem[] = [];
  if (includeWorkspace) {
    const workspaceItems: WorkspaceItem[] = await window.electronAPI.workspaceAPI.loadItems();
    for (const item of workspaceItems) {
      if (item.type !== 'item' && item.type !== 'window') continue;
      result.push({
        key: item.id,
        id: item.id,
        displayName: item.displayName,
        kind: item.type === 'window' ? 'window' : item.launcherType,
        path: item.type === 'item' ? item.path : undefined,
        args: item.type === 'item' ? item.args : undefined,
        icon: item.icon,
        groupName: i18next.t('set.picker.workspace'),
        sameGroup: true,
      });
    }
  }

  for (const item of allItems) {
    if (!isLauncherItem(item) && !isWindowItem(item)) continue;
    const tab = tabOf(item.sourceFile);
    const sameGroup = !includeWorkspace && !!currentTab && tab === currentTab;
    const groupName = tab?.name ?? item.sourceFile ?? '';
    if (isWindowItem(item)) {
      if (!item.id) continue;
      result.push({
        key: item.id,
        id: item.id,
        displayName: item.displayName,
        kind: 'window',
        groupName,
        sameGroup,
      });
      continue;
    }
    // フォルダ取込の展開分は id を持たないので、パスで持つ
    const id = item.isDirExpanded ? undefined : item.id;
    result.push({
      key: id ?? `dir:${item.path}`,
      id,
      displayName: item.displayName,
      kind: launcherKind(item),
      path: item.path,
      args: item.args,
      icon: (icons as Record<string, string>)[item.path] || item.icon,
      groupName,
      sameGroup,
    });
  }

  // 同じタブ（またはワークスペース）を先に。その中は今の並びのまま
  return [...result.filter((r) => r.sameGroup), ...result.filter((r) => !r.sameGroup)];
}

/** 追加の画面で選んだアイテムを行にする */
export function catalogItemToEntry(item: SetCatalogItem): SetEntry {
  if (item.id) return { itemId: item.id };
  return {
    open: item.args ? { path: item.path ?? '', args: item.args } : { path: item.path ?? '' },
    label: item.displayName,
  };
}

/** 行の表示に使う情報 */
export interface SetEntryView {
  name: string;
  icon?: string;
  kind: SetTargetKind | 'window';
  /** 開くものの持ち方 */
  holding: 'ref' | 'own' | 'none';
  /** 参照先が見つからない */
  missing: boolean;
  path?: string;
}

/** 開くもののパスから種類を決める */
export function kindFromPath(path: string): SetTargetKind {
  const type = detectItemTypeSync(path);
  return type === 'clipboard' ? 'none' : type;
}

function lastSegment(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** 行の表示を作る */
export function describeSetEntry(
  entry: SetEntry,
  catalog: ReadonlyMap<string, SetCatalogItem>
): SetEntryView {
  if (entry.itemId) {
    const item = catalog.get(entry.itemId);
    if (!item) {
      return {
        name: entry.label ?? entry.itemId,
        kind: 'none',
        holding: 'ref',
        missing: true,
      };
    }
    return {
      name: item.displayName,
      icon: item.icon,
      kind: item.kind,
      holding: 'ref',
      missing: false,
      path: item.path,
    };
  }
  if (entry.open) {
    return {
      name: entry.label ?? lastSegment(entry.open.path),
      kind: kindFromPath(entry.open.path),
      holding: 'own',
      missing: false,
      path: entry.open.path,
    };
  }
  // 旧グループの名前でアイテムが見つからなかった行は、参照先が無い行として出す
  if (isUnresolvedEntry(entry)) {
    return { name: entry.label ?? '', kind: 'none', holding: 'ref', missing: true };
  }
  return {
    name: entry.label ?? entry.window?.title ?? entry.window?.processName ?? '',
    kind: 'none',
    holding: 'none',
    missing: false,
  };
}

/** 結び付けの判定に使う形にする */
export function toMatchableEntry(
  entry: SetEntry,
  index: number,
  catalog: ReadonlyMap<string, SetCatalogItem>
): MatchableEntry {
  const view = describeSetEntry(entry, catalog);
  const kind = view.kind === 'window' ? 'none' : view.kind;
  return { index, window: entry.window, target: { kind, path: view.path } };
}

/** 既にあるウィンドウにタブとして開くことがある行か（フォルダ・Web の URL） */
export function entryOpensAsTab(view: SetEntryView): boolean {
  if (view.kind === 'window' || view.kind === 'none') return false;
  return opensAsTab(view.kind);
}

/** 位置の表示を文言にする */
export function formatPlacementLabel(label: PlacementLabel): string {
  const t = i18next.t.bind(i18next);
  const screen = (base: string, screenNumber?: number) =>
    screenNumber === undefined
      ? base
      : t('set.placement.onScreen', { screen: screenNumber, place: base });
  switch (label.kind) {
    case 'none':
      return t('set.placement.none');
    case 'offscreen':
      return t('set.placement.offscreen');
    case 'maximized':
      return screen(t('set.placement.maximized'), label.screenNumber);
    case 'shape':
      return screen(t(`set.placement.shapes.${label.shape}`), label.screenNumber);
    case 'region':
      return screen(
        t('set.placement.region', {
          region: t(`set.placement.regions.${label.region}`),
          width: label.width,
          height: label.height,
        }),
        label.screenNumber
      );
  }
}

/** 行の置き場所の表示（置き場所が無ければ undefined） */
export function placementText(entry: SetEntry, screens: readonly ScreenArea[]): string | undefined {
  if (!entry.placement) return undefined;
  return formatPlacementLabel(computePlacementLabel(entry.placement, screens));
}

/** 記録の画面でウィンドウごとに選ぶこと */
export type RecordChoice =
  { kind: 'skip' } | { kind: 'newRow' } | { kind: 'link'; entryIndex: number };

/** ウィンドウの exe 名（拡張子なし。タイトルの下に添える） */
export function windowProcessLabel(window: WindowInfo): string | undefined {
  return window.processName?.replace(/\.exe$/i, '') || undefined;
}

/** 記録で足す行の名前（ウィンドウタイトル。タイトルが空なら exe 名） */
export function windowDisplayName(window: WindowInfo): string {
  return window.title.trim() || windowProcessLabel(window) || '';
}

/** ウィンドウから新しい行を作る（エクスプローラー・ストアアプリは開き直せないので並べるだけ） */
export function entryFromWindow(window: WindowInfo, allWindows: readonly WindowInfo[]): SetEntry {
  const entry: SetEntry = {
    window: decideWindowMatch(window, allWindows),
    placement: placementFromWindow(window),
    label: windowDisplayName(window),
  };
  const process = window.processName?.toLowerCase();
  if (
    window.executablePath &&
    process !== 'explorer.exe' &&
    process !== 'applicationframehost.exe'
  ) {
    entry.open = { path: window.executablePath };
  }
  return entry;
}

/**
 * 行にウィンドウを結び付ける（見つけ方が無ければ決め、置き場所を今の位置にする）
 *
 * 最小化中のウィンドウは座標が画面の外になるので、見つけ方だけ決めて置き場所は前のままにする
 */
export function linkEntryToWindow(
  entry: SetEntry,
  window: WindowInfo,
  allWindows: readonly WindowInfo[]
): SetEntry {
  const linked: SetEntry = {
    ...entry,
    window: entry.window ?? decideWindowMatch(window, allWindows),
  };
  if (window.windowState !== 'minimized') linked.placement = placementFromWindow(window);
  return linked;
}

/** 選んだウィンドウについて知らせること（最小化中・管理者権限） */
export function windowPickNotes(window: WindowInfo): Array<'minimized' | 'elevated'> {
  const notes: Array<'minimized' | 'elevated'> = [];
  if (window.windowState === 'minimized') notes.push('minimized');
  if (window.isElevated) notes.push('elevated');
  return notes;
}

/** AppItem の一覧から id で引く表を作る（実行時と同じく id を持つものだけ） */
export function indexById(items: readonly AppItem[]): Map<string, AppItem> {
  const map = new Map<string, AppItem>();
  for (const item of items) {
    if ('id' in item && item.id) map.set(item.id, item);
  }
  return map;
}

/** セットの行の名前（トーストで中身を見せる） */
export function setEntryNames(entries: readonly SetEntry[], items: readonly AppItem[]): string[] {
  const byId = indexById(items);
  return entries
    .map((entry) => {
      const item = entry.itemId ? byId.get(entry.itemId) : undefined;
      if (item && 'displayName' in item) return item.displayName;
      if (entry.label) return entry.label;
      if (entry.open) return lastSegment(entry.open.path);
      return entry.window?.title ?? entry.window?.processName ?? '';
    })
    .filter((name) => name !== '');
}

/** アイコンが取れていないときの、種類ごとの絵文字（メイン画面と同じ） */
export const SET_KIND_ICONS: Record<string, string> = {
  url: '🌐',
  folder: '📁',
  app: '⚙️',
  file: '📄',
  customUri: '🔗',
  window: '🪟',
  none: '🖥️',
};
