/**
 * セットの行とウィンドウを結び付ける規則（「ウィンドウを追加」「位置を更新」と実行で共通）
 *
 * - 行に見つけ方（window）があればそれで探す
 * - 無ければ開くものから推測する（exe はパス、フォルダはエクスプローラーのタイトル、ファイルはタイトルに含まれる名前）
 * - URL・カスタム URI はどのウィンドウか決まらないので結び付けない
 */
import type { SetEntry, SetPlacement, SetWindowMatch } from '../types/launcher';
import type { WindowInfo } from '../types/window';

import { ANY_WINDOW_TITLE, createTitleMatcher } from './windowTitle';

/** 結び付けの判定に使うウィンドウの情報 */
export type MatchableWindow = Pick<
  WindowInfo,
  | 'hwnd'
  | 'title'
  | 'processName'
  | 'executablePath'
  | 'windowState'
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'desktopNumber'
>;

/** 行の開くものの種類（アイテムの type、または open のパスから判定したもの） */
export type SetTargetKind = 'app' | 'folder' | 'file' | 'url' | 'customUri' | 'none';

/** 結び付けの判定に使う行の情報 */
export interface MatchableEntry {
  /** 行の位置（entries の添字） */
  index: number;
  /** 行の見つけ方 */
  window?: SetWindowMatch;
  /** 開くものの種類とパス */
  target: { kind: SetTargetKind; path?: string };
  /** 置く先の仮想デスクトップ番号（合うウィンドウが複数あれば、このデスクトップのものを先に使う） */
  desktopNumber?: number;
}

/**
 * 条件に合うウィンドウを一覧の前から探す。番号があれば、そのデスクトップにあるものを先に使う
 * （同じアプリのウィンドウが複数のデスクトップにあるとき、ほかのデスクトップのものを取らない）
 */
function findPreferringDesktop(
  windows: readonly MatchableWindow[],
  desktopNumber: number | undefined,
  predicate: (w: MatchableWindow) => boolean
): MatchableWindow | undefined {
  if (desktopNumber !== undefined) {
    const onDesktop = windows.find((w) => w.desktopNumber === desktopNumber && predicate(w));
    if (onDesktop) return onDesktop;
  }
  return windows.find(predicate);
}

function lower(value: string | undefined): string {
  return (value ?? '').toLowerCase();
}

/** パスの最後の部分（区切りは \ と / の両方） */
function baseName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] ?? '';
}

function normalizePath(path: string): string {
  return path.replace(/\//g, '\\').toLowerCase();
}

/**
 * 見つけ方にウィンドウが当てはまるかを判定する関数を作る（プロセス名は部分一致、タイトルはワイルドカード）
 *
 * 同じ見つけ方で多くのウィンドウを調べるときに、タイトルの照合（正規表現）を 1 回だけ作るために使う
 */
export function createWindowMatcher(match: SetWindowMatch): (window: MatchableWindow) => boolean {
  const processName = match.processName?.trim();
  const lowerProcessName = processName?.toLowerCase();
  const title = match.title?.trim() ? match.title : ANY_WINDOW_TITLE;
  // 見つけ方が空（プロセス名もタイトルも無い）なら、どのウィンドウとも結び付けない
  if (!processName && title === ANY_WINDOW_TITLE) return () => false;
  const matchesTitle = createTitleMatcher(title);
  return (window) => {
    if (lowerProcessName && !lower(window.processName).includes(lowerProcessName)) {
      return false;
    }
    return matchesTitle(window.title);
  };
}

/** 見つけ方にウィンドウが当てはまるか（プロセス名は部分一致、タイトルはワイルドカード） */
export function matchesWindow(match: SetWindowMatch, window: MatchableWindow): boolean {
  return createWindowMatcher(match)(window);
}

/** 開くものからウィンドウを推測できるか */
function matchesTarget(target: MatchableEntry['target'], window: MatchableWindow): boolean {
  const path = target.path?.trim();
  if (!path) return false;
  switch (target.kind) {
    case 'app': {
      if (!window.executablePath) return false;
      // ファイル名だけで登録した exe（notepad.exe など）は、ファイル名で比べる
      if (!/[\\/]/.test(path)) return lower(baseName(window.executablePath)) === lower(path);
      return normalizePath(window.executablePath) === normalizePath(path);
    }
    case 'folder':
      return (
        lower(window.processName) === 'explorer.exe' &&
        lower(window.title) === lower(baseName(path))
      );
    case 'file': {
      const name = baseName(path);
      return name !== '' && lower(window.title).includes(name.toLowerCase());
    }
    default:
      return false;
  }
}

/** 行がこのウィンドウと結び付くかを判定する関数を作る（見つけ方のタイトルの照合を 1 回だけ作る） */
function createEntryMatcher(entry: MatchableEntry): (window: MatchableWindow) => boolean {
  if (entry.window) return createWindowMatcher(entry.window);
  return (window) => matchesTarget(entry.target, window);
}

/** 行がこのウィンドウと結び付くか */
export function entryMatchesWindow(entry: MatchableEntry, window: MatchableWindow): boolean {
  return createEntryMatcher(entry)(window);
}

/**
 * 指す先の無い行か（旧グループの名前でアイテムが見つからず、名前だけ残した行）
 *
 * 開くものも見つけ方も置き場所も無いので、何もできない
 */
export function isUnresolvedEntry(entry: SetEntry): boolean {
  return !entry.itemId && !entry.open && !entry.window && !entry.placement;
}

/** 位置を記録できない行の理由（url は自動では探さない行。手で結び付ければ記録できる） */
export type UnlinkedReason = 'url' | 'notFound';

/** 自動の結び付けの結果 */
export interface AutoLinkResult {
  /** 行の添字 → 結び付けたウィンドウ */
  links: Map<number, MatchableWindow>;
  /** どの行とも結び付かなかったウィンドウ（最小化中を除く） */
  unlinkedWindows: MatchableWindow[];
  /** 最小化中で位置を記録できないウィンドウ */
  minimizedWindows: MatchableWindow[];
  /** ウィンドウと結び付かなかった行 */
  unlinkedEntries: { index: number; reason: UnlinkedReason }[];
}

/**
 * 開くものからウィンドウを自動で探せるか
 *
 * URL・カスタム URI は、どのアプリのどのウィンドウが開くか分からないので自動では探さない（手で結び付ける）
 */
export function canAutoLink(kind: SetTargetKind): boolean {
  return kind !== 'url' && kind !== 'customUri';
}

/** 既にあるウィンドウにタブとして開くことがある種類（そのウィンドウごと動く） */
export function opensAsTab(kind: SetTargetKind): boolean {
  return kind === 'folder' || kind === 'url';
}

/**
 * 行とウィンドウを自動で結び付ける（1 つのウィンドウは 1 行とだけ結び付く。上の行から順に、一覧の前のウィンドウを優先）
 */
export function autoLinkWindows(
  entries: readonly MatchableEntry[],
  windows: readonly MatchableWindow[]
): AutoLinkResult {
  const minimizedWindows = windows.filter((w) => w.windowState === 'minimized');
  const candidates = windows.filter((w) => w.windowState !== 'minimized');
  const used = new Set<MatchableWindow>();
  const links = new Map<number, MatchableWindow>();
  const unlinkedEntries: AutoLinkResult['unlinkedEntries'] = [];

  for (const entry of entries) {
    // 見つけ方を持つ行（並べるだけの行を含む）は種類によらず探す
    if (!entry.window && !canAutoLink(entry.target.kind)) {
      unlinkedEntries.push({ index: entry.index, reason: 'url' });
      continue;
    }
    const matches = createEntryMatcher(entry);
    const found = findPreferringDesktop(
      candidates,
      entry.desktopNumber,
      (w) => !used.has(w) && matches(w)
    );
    if (found) {
      used.add(found);
      links.set(entry.index, found);
    } else {
      unlinkedEntries.push({ index: entry.index, reason: 'notFound' });
    }
  }

  return {
    links,
    unlinkedWindows: candidates.filter((w) => !used.has(w)),
    minimizedWindows,
    unlinkedEntries,
  };
}

/**
 * 記録するウィンドウの見つけ方を決める（exe 名とタイトル全体）
 *
 * 記録したときに開いていたウィンドウの数で保存する中身が変わらないよう、いつもタイトル全体を保存する
 * （利用者は「そのページ・そのファイルのウィンドウ」をその位置に置きたい）。タイトルが変わるものは、
 * 行の詳細の候補で一部だけ・タイトルを問わない（*）にしてもらう
 */
export function decideWindowMatch(window: MatchableWindow): SetWindowMatch {
  const title = window.title.trim() ? window.title : undefined;
  if (!window.processName) return { title: window.title };
  return title ? { processName: window.processName, title } : { processName: window.processName };
}

/**
 * ウィンドウの今の位置から置き場所を作る（最大化中なら state を付ける）
 *
 * @param desktopCount 仮想デスクトップの数。2 未満なら番号を記録しない（デスクトップ 1 つで記録したセットを、
 *   後でデスクトップを増やして別のデスクトップから開いたとき、見えないデスクトップ 1 へ引き戻さない）
 */
export function placementFromWindow(window: MatchableWindow, desktopCount?: number): SetPlacement {
  const placement: SetPlacement = {
    x: window.x,
    y: window.y,
    width: window.width,
    height: window.height,
  };
  const singleDesktop = desktopCount !== undefined && desktopCount < 2;
  if (!singleDesktop && window.desktopNumber !== undefined && window.desktopNumber > 0) {
    placement.virtualDesktopNumber = window.desktopNumber;
  }
  if (window.windowState === 'maximized') placement.state = 'maximized';
  return placement;
}

/** 位置を更新した結果 */
export interface RerecordResult {
  entries: SetEntry[];
  /** 位置が変わった行の数 */
  changed: number;
  /** ウィンドウが見つからず、前の位置のままの行の数 */
  notFound: number;
}

function samePlacement(a: SetPlacement | undefined, b: SetPlacement): boolean {
  return (
    !!a &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.virtualDesktopNumber === b.virtualDesktopNumber &&
    a.state === b.state
  );
}

/**
 * 置き場所のある行の位置を、今開いているウィンドウから取り直す（メイン画面の右クリック「位置を更新」）
 *
 * 行の見つけ方で探す（1 つのウィンドウは 1 行とだけ）。行の追加・削除はしない。見つからない行は前の位置のまま
 */
export function rerecordSetPlacements(
  entries: readonly SetEntry[],
  windows: readonly MatchableWindow[],
  desktopCount?: number
): RerecordResult {
  const candidates = windows.filter((w) => w.windowState !== 'minimized');
  const used = new Set<MatchableWindow>();
  let changed = 0;
  let notFound = 0;
  const result = entries.map((entry) => {
    if (!entry.placement || !entry.window) return entry;
    const matches = createWindowMatcher(entry.window);
    const found = findPreferringDesktop(
      candidates,
      entry.placement.virtualDesktopNumber,
      (w) => !used.has(w) && matches(w)
    );
    if (!found) {
      notFound++;
      return entry;
    }
    used.add(found);
    // 編集画面の「位置を更新」と同じく、今の状態をそのまま記録する（仮想デスクトップの番号が空だった行にも
    // 今のデスクトップの番号を入れる。全デスクトップに表示中で番号が無ければ空、デスクトップが 1 つなら入れない）
    const placement = placementFromWindow(found, desktopCount);
    // 全デスクトップに表示する行は、デスクトップの番号を持たない
    if (entry.pinToAllDesktops) delete placement.virtualDesktopNumber;
    if (samePlacement(entry.placement, placement)) return entry;
    changed++;
    return { ...entry, placement };
  });
  return { entries: result, changed, notFound };
}
