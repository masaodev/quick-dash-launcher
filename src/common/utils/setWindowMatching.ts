/**
 * セットの行とウィンドウを結び付ける規則（「今の位置を記録」と実行で共通）
 *
 * - 行に見つけ方（window）があればそれで探す
 * - 無ければ開くものから推測する（exe はパス、フォルダはエクスプローラーのタイトル、ファイルはタイトルに含まれる名前）
 * - URL・カスタム URI はどのウィンドウか決まらないので結び付けない
 */
import type { SetPlacement, SetWindowMatch } from '../types/launcher';
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
}

/** exe 名だけでは区別できないので、いつもタイトルも保存する exe（小文字） */
const ALWAYS_WITH_TITLE = new Set(['explorer.exe', 'applicationframehost.exe']);

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

/** 見つけ方にウィンドウが当てはまるか（プロセス名は部分一致、タイトルはワイルドカード） */
export function matchesWindow(match: SetWindowMatch, window: MatchableWindow): boolean {
  const processName = match.processName?.trim();
  if (processName && !lower(window.processName).includes(processName.toLowerCase())) {
    return false;
  }
  const title = match.title?.trim() ? match.title : ANY_WINDOW_TITLE;
  // 見つけ方が空（プロセス名もタイトルも無い）なら、どのウィンドウとも結び付けない
  if (!processName && title === ANY_WINDOW_TITLE) return false;
  return createTitleMatcher(title)(window.title);
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

/** 行がこのウィンドウと結び付くか */
export function entryMatchesWindow(entry: MatchableEntry, window: MatchableWindow): boolean {
  if (entry.window) return matchesWindow(entry.window, window);
  return matchesTarget(entry.target, window);
}

/** 位置を記録できない行の理由 */
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

/** URL・カスタム URI の行は置き場所を持てない */
export function canHavePlacement(kind: SetTargetKind): boolean {
  return kind !== 'url' && kind !== 'customUri';
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
    if (!entry.window && !canHavePlacement(entry.target.kind)) {
      unlinkedEntries.push({ index: entry.index, reason: 'url' });
      continue;
    }
    const found = candidates.find((w) => !used.has(w) && entryMatchesWindow(entry, w));
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
 * 記録するウィンドウの見つけ方を決める
 *
 * その exe のウィンドウが 1 つだけなら exe 名だけ（タイトルが変わるアプリでも見失わない）。
 * 2 つ以上あるとき、またはエクスプローラー・ストアアプリ（exe 名が共通）のときはタイトルも保存する
 */
export function decideWindowMatch(
  window: MatchableWindow,
  allWindows: readonly MatchableWindow[]
): SetWindowMatch {
  const processName = window.processName;
  if (!processName) return { title: window.title };
  const sameExe = allWindows.filter((w) => lower(w.processName) === lower(processName)).length;
  if (sameExe <= 1 && !ALWAYS_WITH_TITLE.has(processName.toLowerCase())) return { processName };
  return { processName, title: window.title };
}

/** ウィンドウの今の位置から置き場所を作る（最大化中なら state を付ける） */
export function placementFromWindow(window: MatchableWindow): SetPlacement {
  const placement: SetPlacement = {
    x: window.x,
    y: window.y,
    width: window.width,
    height: window.height,
  };
  if (window.desktopNumber !== undefined && window.desktopNumber > 0) {
    placement.virtualDesktopNumber = window.desktopNumber;
  }
  if (window.windowState === 'maximized') placement.state = 'maximized';
  return placement;
}
