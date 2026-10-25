/**
 * セットの編集で使う補助（アイテムの一覧・行の表示・位置の表示の文言・記録の反映）
 */
import i18next from 'i18next';
import { isIconFetchTarget } from '@common/constants';
import type {
  AppItem,
  ItemWindowSwitch,
  LauncherItem,
  SetEntry,
  SetWindowMatch,
  WindowInfo,
  WorkspaceItem,
} from '@common/types';
import { isLauncherItem } from '@common/types/guards';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import {
  hasItemWindowSwitch,
  isPathlessItem,
  pickItemWindowSwitch,
} from '@common/utils/itemWindowConversion';
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
import { desktopLabel } from '@common/utils/desktopLabel';

import { ITEM_TYPE_ICONS } from './itemTypeIcons';
import { sortByTabOrder } from './tabOrder';

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
  /**
   * 単一アイテムのウィンドウ切り替えの設定（対象ウィンドウがあるものだけ）。
   * 行に対象ウィンドウもウィンドウ位置も無いとき、この設定で開く（行の詳細で案内する）
   */
  itemSwitch?: ItemWindowSwitch;
  /** パスの無い単一アイテム（開くものが無いので、行は「ウィンドウを動かすだけ」） */
  pathless?: boolean;
}

/**
 * 単一アイテムの行の種類（アイコン・結び付けに使う）
 *
 * パスの無い単一アイテムは開くものが無く、既にあるウィンドウを探すだけなので 'window' にする
 */
function launcherKind(item: Pick<LauncherItem, 'type'>): SetTargetKind | 'window' {
  if (item.type === 'windowSwitch') return 'window';
  return item.type === 'clipboard' ? 'none' : item.type;
}

/** 単一アイテムのウィンドウ切り替えを、追加の画面の 1 行に持たせる項目 */
function switchFieldsOf(item: { path: string } & ItemWindowSwitch): Partial<SetCatalogItem> {
  if (!hasItemWindowSwitch(item)) return {};
  return {
    itemSwitch: pickItemWindowSwitch(item),
    ...(isPathlessItem(item) ? { pathless: true } : {}),
  };
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
  // 参照は指す先のメインウィンドウのアイテムが下に並ぶので出さない（選べばメインのアイテムの id が入る）
  const workspaceItems = includeWorkspace
    ? (await window.electronAPI.workspaceAPI.loadItems()).filter(
        (item): item is Extract<WorkspaceItem, { type: 'item' }> =>
          item.type === 'item' && !item.ref
      )
    : [];
  // ワークスペースのアイテムは読んだだけではアイコンを持たないので、メインウィンドウのアイテムと同じくキャッシュから読む。
  // 同じパスでもカスタムアイコンが違うことがあるので、メインウィンドウのアイテムとは分けて読む
  const [icons, workspaceIcons] = await Promise.all([
    window.electronAPI.loadCachedIcons(launchers).catch(() => ({})),
    workspaceItems.length > 0
      ? window.electronAPI
          .loadCachedIcons(
            workspaceItems.map((item) => ({
              displayName: item.displayName,
              path: item.path,
              type: item.launcherType,
              customIcon: item.customIcon,
              originalPath: item.originalPath,
            }))
          )
          .catch(() => ({}))
      : Promise.resolve({}),
  ]);

  const result: SetCatalogItem[] = [];
  for (const item of workspaceItems) {
    result.push({
      key: item.id,
      id: item.id,
      displayName: item.displayName,
      kind: launcherKind({ type: item.launcherType }),
      path: item.path,
      args: item.args,
      icon: (workspaceIcons as Record<string, string>)[item.path] || item.icon,
      groupName: i18next.t('set.picker.workspace'),
      sameGroup: true,
      ...switchFieldsOf(item),
    });
  }

  // タブは設定の順に並べる（読み込んだ一覧は名前順で、先頭のアイテムのタブが最初になってしまう）
  const launchersInTabOrder = sortByTabOrder(
    launchers,
    settings.dataFileTabs,
    (item) => item.sourceFile
  );
  for (const item of launchersInTabOrder) {
    const tab = tabOf(item.sourceFile);
    const sameGroup = !includeWorkspace && !!currentTab && tab === currentTab;
    const groupName = tab?.name ?? item.sourceFile ?? '';
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
      ...switchFieldsOf(item),
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
  /** 開くものが無く、ウィンドウを動かすだけ（開くもの無しの行・パスの無い単一アイテムを指す行） */
  moveOnly?: boolean;
  /** 指している単一アイテムのウィンドウ切り替えの設定（行に設定が無いときに使われる） */
  itemSwitch?: ItemWindowSwitch;
}

/** 開くもののパスから種類を決める */
export function kindFromPath(path: string): SetTargetKind {
  const type = detectItemTypeSync(path);
  // 空のパス（切り替えるだけ）・クリップボードは開くものが無い
  return type === 'clipboard' || type === 'windowSwitch' ? 'none' : type;
}

function lastSegment(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * 行が自分で持つパス（アイテムを指さない行）のアイコンを読む
 *
 * キャッシュにあればそれを使い、無いものだけ ensureIcons で取る（ワークスペースと同じ取り方。
 * 取れなかったものは記録され、次からは取りに行かない）。フォルダなど、アイコンを取らない種類は読まない。
 *
 * @returns Map<パス, base64 データ URL>。取れなかったパスは入らない
 */
export async function loadSetEntryIcons(
  entries: readonly SetEntry[]
): Promise<Map<string, string>> {
  const items = new Map<string, LauncherItem>();
  for (const entry of entries) {
    if (entry.itemId || !entry.open?.path) continue;
    const { path } = entry.open;
    const type = kindFromPath(path);
    if (!isIconFetchTarget(type)) continue;
    items.set(path, { displayName: lastSegment(path), path, type } as LauncherItem);
  }
  const icons = new Map<string, string>();
  if (items.size === 0) return icons;

  const put = (found: Record<string, string>) => {
    for (const [path, icon] of Object.entries(found)) if (icon) icons.set(path, icon);
  };
  put(await window.electronAPI.loadCachedIcons([...items.values()]).catch(() => ({})));
  const missing = [...items.values()].filter((item) => !icons.has(item.path));
  if (missing.length > 0) put(await window.electronAPI.ensureIcons(missing).catch(() => ({})));
  return icons;
}

/**
 * 行の表示を作る
 *
 * @param ownIcons 行が自分で持つパスのアイコン（loadSetEntryIcons の結果）
 */
export function describeSetEntry(
  entry: SetEntry,
  catalog: ReadonlyMap<string, SetCatalogItem>,
  ownIcons?: ReadonlyMap<string, string>
): SetEntryView {
  if (entry.itemId) {
    const item = catalog.get(entry.itemId);
    if (!item) {
      return {
        name: entry.label ?? i18next.t('set.missingItemName'),
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
      // パスの無い単一アイテムは、パスの代わりに何も出さない（行の 2 段目は対象ウィンドウの exe 名）
      ...(item.pathless ? { moveOnly: true } : { path: item.path }),
      ...(item.itemSwitch ? { itemSwitch: item.itemSwitch } : {}),
    };
  }
  if (entry.open) {
    return {
      name: entry.label ?? lastSegment(entry.open.path),
      icon: ownIcons?.get(entry.open.path),
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
    moveOnly: true,
  };
}

/**
 * 行がアイテムのウィンドウ切り替えの設定で動くか（行に対象ウィンドウもウィンドウ位置も無く、指すアイテムにある）
 *
 * 実行（setExecutor）は、行に設定が無ければアイテムの設定で探して前面に出す・位置を当てる。行の詳細でそれを案内する
 */
export function usesItemSwitch(entry: SetEntry, view: SetEntryView): boolean {
  return (
    !!entry.itemId &&
    !view.missing &&
    !!view.itemSwitch &&
    !hasWindowMatch(entry.window) &&
    !entry.placement
  );
}

/** 探す条件（exe 名かタイトル）があるか */
function hasWindowMatch(match: SetWindowMatch | undefined): boolean {
  return !!(match?.processName || match?.title);
}

/**
 * 行で探すウィンドウの条件。行に無ければ、パスの無い単一アイテムの対象ウィンドウを借りる（実行と同じ）
 */
export function entryWindowMatch(entry: SetEntry, view: SetEntryView): SetWindowMatch | undefined {
  if (hasWindowMatch(entry.window)) return entry.window;
  return view.moveOnly && view.holding === 'ref' ? view.itemSwitch?.window : undefined;
}

/** 結び付けの判定に使う形にする */
export function toMatchableEntry(
  entry: SetEntry,
  index: number,
  catalog: ReadonlyMap<string, SetCatalogItem>
): MatchableEntry {
  const view = describeSetEntry(entry, catalog);
  const kind = view.kind === 'window' ? 'none' : view.kind;
  return {
    index,
    window: entryWindowMatch(entry, view),
    target: { kind, path: view.path },
    desktopNumber: entry.placement?.virtualDesktopNumber,
  };
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

/** 行の置き場所の表示（置き場所が無ければ undefined。仮想デスクトップの番号があれば添える） */
export function placementText(
  entry: SetEntry,
  screens: readonly ScreenArea[],
  desktopNames?: Readonly<Record<number, string | undefined>>
): string | undefined {
  if (!entry.placement) return undefined;
  const place = formatPlacementLabel(computePlacementLabel(entry.placement, screens));
  const desktop = entry.placement.virtualDesktopNumber;
  // 全デスクトップに表示するときは、どのデスクトップかは意味がないので出さない
  return desktop === undefined || entry.pinToAllDesktops
    ? place
    : i18next.t('set.placement.onDesktop', { place, desktop: desktopLabel(desktop, desktopNames) });
}

/**
 * 開いているウィンドウの今の位置の表示（ウィンドウを追加・位置を更新の画面）
 *
 * デスクトップが 2 つ以上あるときだけ、いるデスクトップ（全デスクトップに表示中ならそのこと）を添える
 */
export function windowPlacementText(
  window: WindowInfo,
  screens: readonly ScreenArea[],
  desktopCount: number,
  desktopNames?: Readonly<Record<number, string | undefined>>
): string {
  const multi = desktopCount >= 2;
  const desktop =
    multi && !window.isPinned && window.desktopNumber !== undefined && window.desktopNumber > 0
      ? window.desktopNumber
      : undefined;
  const text =
    placementText(
      {
        placement: {
          x: window.x,
          y: window.y,
          width: window.width,
          height: window.height,
          ...(desktop !== undefined ? { virtualDesktopNumber: desktop } : {}),
          // 記録すると「最大化」になるので、ウィンドウを選ぶ画面でも同じ言葉で出す
          ...(window.windowState === 'maximized' ? { state: 'maximized' as const } : {}),
        },
      },
      screens,
      desktopNames
    ) ?? '';
  return multi && window.isPinned
    ? i18next.t('set.placement.onAllDesktops', { place: text })
    : text;
}

/** ウィンドウの exe 名（拡張子なし。タイトルの下に添える） */
export function windowProcessLabel(window: WindowInfo): string | undefined {
  return window.processName?.replace(/\.exe$/i, '') || undefined;
}

/** 記録で足す行の名前（ウィンドウタイトル。タイトルが空なら exe 名） */
export function windowDisplayName(window: WindowInfo): string {
  return window.title.trim() || windowProcessLabel(window) || '';
}

/**
 * ウィンドウから新しい行を作る（動かすだけの行）
 *
 * ほかのアプリの起動の引数は取れないので、exe を開く行にすると開いていたファイルが開かない。
 * 位置を記録するのが主なので開くものは持たず、要るときは行の詳細で足してもらう。
 * 最小化中のウィンドウは座標が画面の外になるので、位置を持たない（元に戻してから「位置を更新」で入れる）
 */
export function entryFromWindow(window: WindowInfo, desktopCount?: number): SetEntry {
  return {
    window: decideWindowMatch(window),
    ...(window.windowState !== 'minimized'
      ? { placement: placementFromWindow(window, desktopCount) }
      : {}),
    label: windowDisplayName(window),
  };
}

/** QDL 自身のウィンドウ（登録画面など）は、セットの行の対象にしない */
export function isOwnWindow(window: WindowInfo): boolean {
  return /quick-?dash-?launcher|^electron\.exe$/i.test(window.processName ?? '');
}

/** タイトルを「 - 」「 | 」「 — 」で分けた部品（一部だけで探す候補。区切りが無ければ空） */
export function titleParts(title: string): string[] {
  const parts = title
    .replace(/[*?]/g, '')
    .split(/\s+[-|—–]\s+/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return parts.length >= 2 ? [...new Set(parts)] : [];
}

/**
 * 行にウィンドウを結び付ける（見つけ方が無ければ決め、置き場所を今の位置にする）
 *
 * 最小化中のウィンドウは座標が画面の外になるので、見つけ方だけ決めて置き場所は前のままにする
 */
export function linkEntryToWindow(
  entry: SetEntry,
  window: WindowInfo,
  desktopCount?: number
): SetEntry {
  const linked: SetEntry = {
    ...entry,
    window: entry.window ?? decideWindowMatch(window),
  };
  if (window.windowState !== 'minimized') {
    linked.placement = placementFromWindow(window, desktopCount);
    // 全デスクトップに表示する行は、デスクトップの番号を持たない
    if (entry.pinToAllDesktops) delete linked.placement.virtualDesktopNumber;
  }
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
  return setEntryNamesBy(entries, (id) => {
    const item = byId.get(id);
    return item && 'displayName' in item ? item.displayName : undefined;
  });
}

/** セットの行の名前（アイテムの名前は nameOf で引く。引けず名前も無い行は除く） */
export function setEntryNamesBy(
  entries: readonly SetEntry[],
  nameOf: (itemId: string) => string | undefined
): string[] {
  return entries
    .map((entry) => {
      const name = entry.itemId ? nameOf(entry.itemId) : undefined;
      if (name) return name;
      if (entry.label) return entry.label;
      if (entry.open) return lastSegment(entry.open.path);
      return entry.window?.title ?? entry.window?.processName ?? '';
    })
    .filter((name) => name !== '');
}

/** ツールチップに出す行の名前（先頭 3 行。残りは件数） */
export function setEntriesSummary(
  entries: readonly SetEntry[],
  nameOf: (itemId: string) => string | undefined
): string {
  const names = setEntryNamesBy(entries, nameOf).slice(0, 3);
  // 名前が 1 つも分からなければ出さない（「行:  ほか N 件」にしない）
  if (names.length === 0) return '';
  const rest = entries.length - names.length;
  const joined = names.join(i18next.t('common.listSeparator'));
  return rest > 0
    ? i18next.t('launcher.tooltip.setRowsMore', { names: joined, count: rest })
    : i18next.t('launcher.tooltip.setRows', { names: joined });
}

/** アイコンが取れていないときの、種類ごとの絵文字（メイン画面と同じ表に、動かすだけの行を足す） */
export const SET_KIND_ICONS: Readonly<Record<string, string>> = { ...ITEM_TYPE_ICONS, none: '🖥️' };
