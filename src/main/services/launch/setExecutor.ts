/**
 * セットの実行
 *
 * 行ごとに「開くもの」を開き、置き場所があればウィンドウを見つけて（無ければ開いて待って）位置を合わせる。
 *
 * - 順番に開く（既定）: 上の行から 100 ms おきに開く。ウィンドウを待って位置を合わせる処理は並行して続け、
 *   次の行を開くのは待たない（1 行ずつ最大 30 秒待つと全体が遅くなるため）
 * - 同時に開く: 全部を一度に開き、出たものから位置を合わせる
 * - 置き場所の無い行は、今までのグループと同じ（アイテムにウィンドウ設定があれば、開いていれば前面に出すだけ）
 * - 置き場所のある行が 1 つでもあれば、進み具合を画面の中央に出す（中止できる）
 * - 単一アイテムのウィンドウ切り替えも、アイテムを「セットの 1 行」として同じ処理で実行する（executeLauncherItem）
 * - パスの無い単一アイテムは開くものが無いので、行は「動かすだけ」になる（開いていなければ飛ばす）
 */
import { ipcMain, screen } from 'electron';
import type { Logger } from 'pino';
import { itemLogger } from '@common/logger';
import type {
  AppItem,
  ItemWindowSwitch,
  LauncherItem,
  LayoutEntryProgress,
  LayoutExecutionProgress,
  SetEntry,
  SetItem,
  SetWindowMatch,
  WindowConfig,
} from '@common/types';
import { isLauncherItem } from '@common/types/guards';
import { GROUP_LAUNCH_DELAY_MS } from '@common/constants';
import {
  IPC_CHANNELS,
  LAYOUT_PROGRESS_CHANNELS,
  type ProgressEventType,
} from '@common/ipcChannels';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { ANY_WINDOW_TITLE, createTitleMatcher } from '@common/utils/windowTitle';
import { isUnresolvedEntry } from '@common/utils/setWindowMatching';
import { isPathlessItem, switchToWindowConfig } from '@common/utils/itemWindowConversion';
import { fitPlacementToScreens, type ScreenArea } from '@common/utils/placementLabel';

import {
  applyWindowConfig,
  tryActivateWindow,
  type ApplyWindowOptions,
} from '../../utils/windowActivator.js';
import {
  findWindowHwndByTitle,
  holdForeground,
  maximizeWindow,
} from '../../utils/nativeWindowControl.js';
import { getDesktopCount, getWindowDesktopNumber } from '../../utils/virtualDesktop/index.js';
import { launchItem, type LaunchableItem, type LaunchResult } from '../../utils/itemLauncher.js';
import PathManager from '../../config/pathManager.js';
import { loadCachedIcons, type IconItem } from '../icon/iconFetcher.js';
import {
  getLayoutProgressWindow,
  LONG_TOAST_DURATION_MS,
  markLayoutProgressFinished,
  showLayoutProgressWindow,
  showToastWindow,
} from '../overlayWindowService.js';
import { mainI18n } from '../mainI18n.js';

/** 開いてからウィンドウが出るのを待つ既定の秒数 */
export const SET_DEFAULT_WAIT_SECONDS = 30;
/** ウィンドウを探す間隔（ミリ秒） */
export const SET_WINDOW_POLL_MS = 500;
/** 置く先のデスクトップにあるウィンドウを探すとき、ほかのデスクトップの候補を飛ばす上限 */
const MAX_DESKTOP_CANDIDATES = 20;

/** 行の指す先を解決したもの */
interface ResolvedEntry {
  /** 進み具合・ログに出す名前 */
  name: string;
  /** 開くもの（無ければ並べるだけ） */
  launch?: LaunchableItem;
  /** 指しているアイテムのウィンドウ設定（置き場所の無い行で、開いていれば前面に出すのに使う） */
  itemWindowConfig?: WindowConfig;
  /**
   * 指しているパスの無い単一アイテムの対象ウィンドウ（開くものが無いので、行に探す条件が無ければこれで探す。
   * 置き場所のある行でも借りる）
   */
  itemWindow?: SetWindowMatch;
  /** 解決できなかった理由 */
  error?: string;
  /** 進み具合の表示に出すアイコン（指しているアイテムのもの） */
  icon?: string;
}

/** 行の結果 */
export interface SetEntryResult {
  index: number;
  /** 行の名前（失敗を知らせるときに使う） */
  name: string;
  success: boolean;
  /** 動かすだけの行で、ウィンドウが開いていなかったので何もしなかった（success は true） */
  skipped?: boolean;
  /** 管理者として実行する行で、UAC で「いいえ」を押したので開かなかった（skipped・success も true） */
  adminCancelled?: boolean;
  error?: string;
}

/** 実行の結果 */
export interface SetExecutionResult {
  successCount: number;
  errorCount: number;
  cancelled: boolean;
  entries: SetEntryResult[];
  /** 同じセットを実行中だったので、何もしなかった */
  skipped?: boolean;
}

/** 実行中のセットの id。Enter の二度押しなどで同じセットが重ねて開かれないようにする */
const runningSets = new Set<string>();

/** そのセットを実行中か（実行中に押し直したときに「起動します」と知らせないため） */
export function isSetRunning(id: string | undefined): boolean {
  return id !== undefined && runningSets.has(id);
}

/** id からアイテムを探す */
export type SetItemResolver = (itemId: string) => AppItem | undefined;

/** id を持つアイテムを id で引けるようにする（id の無いアイテムは除く） */
export function indexItemsById(items: readonly AppItem[]): Map<string, AppItem> {
  const byId = new Map<string, AppItem>();
  for (const appItem of items) {
    if ('id' in appItem && appItem.id) byId.set(appItem.id, appItem);
  }
  return byId;
}

/** 実行の差し替え口（テスト用） */
export interface SetExecutorDeps {
  launch: (item: LaunchableItem, logger: Logger) => Promise<LaunchResult>;
  findWindow: (match: WindowConfig, exclude?: ReadonlySet<bigint>) => bigint | null;
  applyConfig: typeof applyWindowConfig;
  activate: typeof tryActivateWindow;
  maximize: (hwnd: bigint) => boolean;
  /** 前面のウィンドウを控え、呼ぶと hwnd に取られていた前面を戻す関数を返す（前面に出さない行で使う） */
  holdForeground?: (hwnd: bigint) => () => void;
  sleep: (ms: number) => Promise<void>;
  /** 画面の範囲（物理ピクセル。どの画面にも入らない位置を主画面に収めるのに使う） */
  screens?: () => ScreenArea[];
  /** ウィンドウのいる仮想デスクトップ番号（1 から。全デスクトップに表示中・取れないときは -1） */
  desktopOf?: (hwnd: bigint) => number;
  /** 仮想デスクトップの数（取れないときは 0 以下） */
  desktopCount?: () => number;
  progress?: {
    /** 進み具合を出す（行の数に合わせて高さを決める） */
    show: (entryCount: number) => Promise<void>;
    send: (event: ProgressEventType, progress: LayoutExecutionProgress) => void;
    onCancel: (handler: () => void) => () => void;
    /** 開くもののアイコンをキャッシュから読む（パス → データ URL。その場で取りには行かない） */
    loadIcons?: (items: IconItem[]) => Promise<Record<string, string>>;
  };
}

function lastSegment(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * アイテムのウィンドウ切り替えを、位置の無い行で「開いていれば前面に出す」のに使う条件にする
 * （セットの行がウィンドウの見つけ方を持たないとき、指すアイテムの見つけ方を使う）
 */
function itemWindowConfigOf(item: LauncherItem): WindowConfig | undefined {
  // 位置・前面に出すか・ピン止めも今までどおり当てる（行に見つけ方が無いときだけ使う）
  const config = switchToWindowConfig(item);
  return config && { ...config, title: config.title || ANY_WINDOW_TITLE };
}

/** 行の指す先を解決する */
export function resolveSetEntry(entry: SetEntry, resolve: SetItemResolver): ResolvedEntry {
  if (entry.itemId) {
    const item = resolve(entry.itemId);
    if (!item) {
      return {
        name: entry.label ?? mainI18n.t('set.missingItemName'),
        error: mainI18n.t('set.errors.itemNotFound'),
      };
    }
    if (isLauncherItem(item) && isPathlessItem(item)) {
      // 開くものが無い（動かすだけの行）。探す条件は行に無ければアイテムのものを借りる
      return {
        name: item.displayName,
        itemWindow: item.window,
        itemWindowConfig: itemWindowConfigOf(item),
        ...(item.icon ? { icon: item.icon } : {}),
      };
    }
    if (isLauncherItem(item)) {
      return {
        name: item.displayName,
        launch: {
          type: item.type,
          path: item.path,
          args: item.args,
          displayName: item.displayName,
          // セットの行は持たず、指すアイテムの「常に管理者として実行」に従う
          ...(item.runAsAdmin === true && { runAsAdmin: true }),
        },
        itemWindowConfig: itemWindowConfigOf(item),
        ...(item.icon ? { icon: item.icon } : {}),
      };
    }
    return {
      name: 'displayName' in item ? item.displayName : entry.itemId,
      error: mainI18n.t('set.errors.unsupportedType'),
    };
  }
  if (entry.open) {
    const name = entry.label ?? lastSegment(entry.open.path);
    return {
      name,
      launch: {
        type: detectItemTypeSync(entry.open.path) as LaunchableItem['type'],
        path: entry.open.path,
        args: entry.open.args,
        displayName: name,
      },
    };
  }
  const title = entry.window?.title ?? entry.window?.processName ?? entry.label ?? '';
  // 旧グループの名前でアイテムが見つからず、名前だけ残した行
  if (isUnresolvedEntry(entry)) {
    return { name: title, error: mainI18n.t('set.errors.itemNotFound') };
  }
  return { name: title };
}

/**
 * 置き場所のある行で探すウィンドウの条件
 *
 * 行に見つけ方が無ければ、パスの無い単一アイテムの条件、または開く exe の名前から推測する
 */
export function buildSetWindowConfig(
  entry: SetEntry,
  resolved: ResolvedEntry
): WindowConfig | undefined {
  let title = entry.window?.title;
  let processName = entry.window?.processName;
  if (!title && !processName) {
    if (resolved.itemWindow) {
      title = resolved.itemWindow.title;
      processName = resolved.itemWindow.processName;
    } else if (resolved.launch?.type === 'app' && /\.exe$/i.test(resolved.launch.path.trim())) {
      // .lnk・.bat・shell:AppsFolder なども app と判定されるが、ウィンドウの exe 名とは合わないので推測しない
      processName = lastSegment(resolved.launch.path.trim());
    } else {
      return undefined;
    }
  }
  const p = entry.placement ?? {};
  return {
    title: title || ANY_WINDOW_TITLE,
    processName,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    virtualDesktopNumber: p.virtualDesktopNumber,
    // セットの行は既定で前面に出さない（出すのは true を書いた行だけ）
    activateWindow: entry.activateWindow === true,
  };
}

const defaultDeps: SetExecutorDeps = {
  launch: launchItem,
  findWindow: (config, exclude) =>
    findWindowHwndByTitle(createTitleMatcher(config.title), config.processName, exclude),
  applyConfig: applyWindowConfig,
  activate: tryActivateWindow,
  maximize: (hwnd) => maximizeWindow(hwnd),
  holdForeground: (hwnd) => holdForeground(hwnd),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  desktopOf: (hwnd) => getWindowDesktopNumber(hwnd),
  desktopCount: () => getDesktopCount(),
  // ウィンドウの座標（GetWindowRect）は物理ピクセルなので、画面の範囲も物理ピクセルに直す
  screens: () =>
    screen.getAllDisplays().map((display) => ({
      bounds: screen.dipToScreenRect(null, display.bounds),
      workArea: screen.dipToScreenRect(null, display.workArea),
    })),
  progress: {
    show: async (entryCount) => {
      await showLayoutProgressWindow(entryCount);
    },
    send: (eventType, progress) => {
      try {
        const win = getLayoutProgressWindow();
        if (win && !win.isDestroyed()) {
          const labels = {
            cancel: mainI18n.t('set.progress.stop'),
            close: mainI18n.t('common.close'),
            escToStop: mainI18n.t('set.progress.escToStop'),
            done: mainI18n.t('set.progress.done'),
            // 数は表示側で数えて {success} などに入れる
            summary: mainI18n.t('set.progress.summary', {
              success: '{success}',
              failed: '{failed}',
              skipped: '{skipped}',
            }),
          };
          win.webContents.send(LAYOUT_PROGRESS_CHANNELS[eventType], { ...progress, labels });
        }
      } catch (error) {
        itemLogger.warn({ error: String(error) }, '進み具合の表示に送れませんでした');
      } finally {
        if (eventType === 'complete') markLayoutProgressFinished();
      }
    },
    onCancel: (handler) => {
      ipcMain.once(IPC_CHANNELS.LAYOUT_CANCEL, handler);
      return () => ipcMain.removeListener(IPC_CHANNELS.LAYOUT_CANCEL, handler);
    },
    loadIcons: (items) =>
      loadCachedIcons(items, {
        favicons: PathManager.getFaviconsFolder(),
        icons: PathManager.getAppsFolder(),
        extensions: PathManager.getExtensionsFolder(),
      }),
  },
};

/** 進み具合で名前の下に出す 1 行（exe 名と置く先の仮想デスクトップ） */
function progressDetail(entry: SetEntry, resolved: ResolvedEntry): string | undefined {
  const parts: string[] = [];
  const processName = entry.window?.processName ?? resolved.itemWindow?.processName;
  if (processName) parts.push(processName);
  const desktop = entry.placement?.virtualDesktopNumber;
  if (desktop !== undefined && !entry.pinToAllDesktops) {
    parts.push(mainI18n.t('set.progress.desktop', { number: desktop }));
  }
  return parts.length > 0 ? parts.join(mainI18n.t('set.progress.separator')) : undefined;
}

/** 進み具合で、アイコンが無いときに既定のアイコンを決める種別（動かすだけの行は windowSwitch） */
function progressItemType(resolved: ResolvedEntry): string | undefined {
  if (resolved.launch) return resolved.launch.type;
  if (resolved.error) return undefined;
  return 'windowSwitch';
}

/**
 * セットを実行する
 *
 * @param resolve 行の itemId からアイテムを探す（メイン画面・ワークスペースで探す範囲が違う）
 */
export async function executeSet(
  item: Pick<SetItem, 'displayName' | 'entries' | 'launchMode'> & { id?: string },
  resolve: SetItemResolver,
  deps: SetExecutorDeps = defaultDeps,
  logger: Logger = itemLogger
): Promise<SetExecutionResult> {
  // 1 回目のウィンドウがまだ出ていない間に 2 回目が走ると、「開いていない」と判断してもう 1 つずつ開いてしまう。
  // id の無い実行（登録画面の試しに実行）は、同じ名前の別のセットとぶつからないよう排他しない
  const key = item.id;
  if (key !== undefined && runningSets.has(key)) {
    logger.info({ setName: item.displayName }, '同じセットを実行中なので、重ねては開きません');
    return { successCount: 0, errorCount: 0, cancelled: false, entries: [], skipped: true };
  }
  if (key !== undefined) runningSets.add(key);
  try {
    return await runSet(item, resolve, deps, logger);
  } finally {
    if (key !== undefined) runningSets.delete(key);
  }
}

async function runSet(
  item: Pick<SetItem, 'displayName' | 'entries' | 'launchMode'>,
  resolve: SetItemResolver,
  deps: SetExecutorDeps,
  logger: Logger,
  /** 単一アイテムを 1 行として実行する（セットの実行では渡さない） */
  single = false
): Promise<SetExecutionResult> {
  const parallel = item.launchMode === 'parallel';
  logger.info(
    { setName: item.displayName, entryCount: item.entries.length, parallel },
    'セットを実行中'
  );

  const resolved = item.entries.map((entry) => resolveSetEntry(entry, resolve));
  /**
   * 単一アイテムは今までどおり、前面に出すウィンドウが別の仮想デスクトップにあればそこへ切り替える
   * （セットの実行は利用者のデスクトップを変えない）
   */
  const applyOptions: ApplyWindowOptions | undefined = single ? { followDesktop: true } : undefined;
  /** 行の「全デスクトップに表示」を当てる（セットの行・単一アイテムで同じ） */
  const withPin = (config: WindowConfig, entry: SetEntry): WindowConfig =>
    entry.pinToAllDesktops ? { ...config, pinToAllDesktops: true } : config;
  const withSingle = (config: WindowConfig, entry: SetEntry): WindowConfig =>
    withPin(single ? { ...config, activateWindow: entry.activateWindow !== false } : config, entry);
  const activate = (config: WindowConfig, name: string) =>
    applyOptions
      ? deps.activate(config, name, logger, applyOptions)
      : deps.activate(config, name, logger);
  const hasPlacement = item.entries.some((entry) => entry.placement);
  const screens = hasPlacement ? (deps.screens?.() ?? []) : [];

  let cancelled = false;
  const progress: LayoutExecutionProgress = {
    layoutName: item.displayName,
    entries: resolved.map((r, index): LayoutEntryProgress => {
      const detail = progressDetail(item.entries[index], r);
      const itemType = progressItemType(r);
      return {
        index,
        windowTitle: r.name,
        // 行の名前と動かすウィンドウが別のものでも分かるように、exe 名を添える
        ...(item.entries[index].window?.processName
          ? { processName: item.entries[index].window!.processName }
          : {}),
        ...(r.icon ? { icon: r.icon } : {}),
        ...(itemType ? { itemType } : {}),
        ...(detail ? { detail } : {}),
        status: 'waiting',
        statusText: mainI18n.t('set.progress.queued'),
      };
    }),
    isComplete: false,
    isCancelled: false,
  };
  const showProgress = hasPlacement && deps.progress;
  let removeCancel: (() => void) | undefined;
  if (showProgress) {
    await loadProgressIcons(progress.entries, resolved, deps.progress!.loadIcons);
    await deps.progress!.show(item.entries.length);
    removeCancel = deps.progress!.onCancel(() => {
      cancelled = true;
      logger.info({ setName: item.displayName }, 'セットの実行が中止されました');
    });
    deps.progress!.send('start', progress);
  }

  const results: SetEntryResult[] = [];
  /**
   * どれかの行が位置を合わせると決めたウィンドウ。同じアプリのウィンドウが 2 つあり、見つけ方が同じ行が 2 つ
   * あるとき、2 つの行が同じウィンドウを取り合わないように、ほかの行が取ったものは除いて探す
   */
  const claimed = new Set<bigint>();
  const findUnclaimed = (config: WindowConfig, exclude?: ReadonlySet<bigint>) => {
    const skip = new Set<bigint>(claimed);
    for (const hwnd of exclude ?? []) skip.add(hwnd);
    let found = deps.findWindow(config, skip);
    // 合うウィンドウが複数あれば、置く先のデスクトップにあるものを先に使う（ほかのデスクトップから引き抜かない）
    const want = config.virtualDesktopNumber;
    if (found !== null && want !== undefined && deps.desktopOf) {
      const first = found;
      let candidate: bigint | null = found;
      for (let i = 0; i < MAX_DESKTOP_CANDIDATES; i++) {
        if (candidate === null || deps.desktopOf(candidate) === want) break;
        skip.add(candidate);
        candidate = deps.findWindow(config, skip);
      }
      found = candidate ?? first;
    }
    if (found !== null) claimed.add(found);
    return found;
  };
  const update = (
    index: number,
    status: LayoutEntryProgress['status'],
    error?: string,
    statusText?: string
  ) => {
    progress.entries[index].status = status;
    progress.entries[index].statusText = statusText ?? mainI18n.t(STATUS_TEXT_KEYS[status]);
    if (error) progress.entries[index].errorMessage = error;
    if (showProgress) deps.progress!.send('update', progress);
  };
  /** 行を終える。うまくいったときは何をしたか（successText）を右に出す（既定は「位置を合わせました」） */
  const finish = (index: number, error?: string, successText?: string) => {
    results.push({
      index,
      name: resolved[index].name,
      success: !error,
      ...(error ? { error } : {}),
    });
    update(index, error ? 'failed' : 'success', error, error ? undefined : successText);
  };
  const wasOpenText = () => mainI18n.t('set.progress.wasOpen');
  /**
   * 動かすだけの行で、ウィンドウが見つからなかった（失敗とは数えず、理由だけ添える）。
   * 同じ exe のウィンドウはあるならタイトルが合わないだけなので、そう知らせる（タブの切り替えなど）。
   * ほかの行の条件に合うウィンドウはその行のものなので除く（行の順番で知らせる文が変わらないように）
   */
  const otherRowsWindows = (index: number): Set<bigint> => {
    const taken = new Set<bigint>(claimed);
    item.entries.forEach((entry, i) => {
      if (i === index || !entry.window) return;
      if (!entry.window.processName && !entry.window.title) return;
      const config = {
        title: entry.window.title || ANY_WINDOW_TITLE,
        processName: entry.window.processName,
      };
      let found: bigint | null;
      while ((found = deps.findWindow(config, taken)) !== null) taken.add(found);
    });
    return taken;
  };
  const skip = (index: number) => {
    results.push({ index, name: resolved[index].name, success: true, skipped: true });
    const match = item.entries[index].window ?? resolved[index].itemWindow;
    const exeOpen =
      !!match?.processName &&
      !!match.title &&
      match.title !== ANY_WINDOW_TITLE &&
      deps.findWindow(
        { title: ANY_WINDOW_TITLE, processName: match.processName },
        otherRowsWindows(index)
      ) !== null;
    update(
      index,
      'skipped',
      exeOpen
        ? mainI18n.t('set.run.titleNotMatched', {
            exe: match!.processName!.replace(/\.exe$/i, ''),
          })
        : mainI18n.t('set.run.notOpen')
    );
  };

  /** 管理者として実行する行で、UAC で「いいえ」を押した（失敗にせず、知らせない） */
  const skipAdminCancelled = (index: number) => {
    results.push({
      index,
      name: resolved[index].name,
      success: true,
      skipped: true,
      adminCancelled: true,
    });
    update(index, 'skipped', mainI18n.t('set.run.adminCancelled'));
  };
  /** 開いた結果で行を終える（UAC で「いいえ」は飛ばしたことにする） */
  const finishLaunch = (index: number, launched: LaunchResult) => {
    if (!launched.success && launched.cancelled) return skipAdminCancelled(index);
    return finish(
      index,
      launched.success ? undefined : launched.error,
      mainI18n.t('set.progress.opened')
    );
  };

  /**
   * 1 行を実行する。opened は「開く」まで済んだら解決し（順番に開くときの次の行の合図）、
   * done は位置合わせまで終わったら解決する
   */
  const startEntry = (index: number): { opened: Promise<void>; done: Promise<void> } => {
    let markOpened!: () => void;
    const opened = new Promise<void>((r) => (markOpened = r));
    const done = runEntry(index, () => markOpened()).finally(() => markOpened());
    return { opened, done };
  };

  const runEntry = async (index: number, markOpened: () => void): Promise<void> => {
    const entry = item.entries[index];
    const r = resolved[index];
    if (cancelled) return finish(index, mainI18n.t('layout.cancelled'));
    if (r.error) return finish(index, r.error);
    update(index, 'launching');

    try {
      // 置き場所の無い行: 今までのグループと同じ
      if (!entry.placement) {
        if (!r.launch) {
          // 動かすだけの行で位置が無い: 開いていれば前面に出す。行に探す条件が無ければ、パスの無い単一アイテムの
          // 設定（ウィンドウ位置も含む）で探す。どちらも無ければどのウィンドウにも合うので失敗にする
          const config =
            entry.window?.processName || entry.window?.title
              ? {
                  title: entry.window.title || ANY_WINDOW_TITLE,
                  processName: entry.window.processName,
                }
              : r.itemWindowConfig;
          if (!config) return finish(index, mainI18n.t('layout.windowNotFound'));
          // 単一アイテムは前面に出すかを設定どおりにし、別のデスクトップにあればそこへ切り替える
          const result = await activate(withSingle(config, entry), r.name);
          return result.windowFound ? finish(index, undefined, wasOpenText()) : skip(index);
        }
        const itemConfig = entry.window
          ? { title: entry.window.title || ANY_WINDOW_TITLE, processName: entry.window.processName }
          : r.itemWindowConfig;
        if (itemConfig && entry.ifOpen !== 'openNew') {
          const result = await activate(withSingle(itemConfig, entry), r.name);
          // 前面に出すのを Windows に断られても、見つかっていれば開き直さない（二重に開かない）
          if (result.windowFound) return finish(index, undefined, wasOpenText());
        }
        const launched = await deps.launch(r.launch, logger);
        return finishLaunch(index, launched);
      }

      // 置き場所のある行。今は無い画面の位置なら、主画面に収める（見えない所へ動かさない）
      const fitted = fitPlacementToScreens(entry.placement, screens);
      if (fitted !== entry.placement) {
        logger.info(
          { setName: item.displayName, index, placement: entry.placement, fitted },
          '記録した位置がどの画面にも入らないので、主画面に収めます'
        );
      }
      // 今は無い仮想デスクトップ（デスクトップを減らした後など）: 位置だけ合わせて知らせる
      const desktopCount = deps.desktopCount?.() ?? 0;
      // 全デスクトップに表示する行は、デスクトップの番号を使わない
      const missingDesktop =
        !entry.pinToAllDesktops &&
        fitted.virtualDesktopNumber !== undefined &&
        desktopCount > 0 &&
        fitted.virtualDesktopNumber > desktopCount
          ? fitted.virtualDesktopNumber
          : undefined;
      const config = buildSetWindowConfig(
        {
          ...entry,
          placement:
            missingDesktop === undefined ? fitted : { ...fitted, virtualDesktopNumber: undefined },
        },
        r
      );
      if (!config) {
        // 見つけ方を決められない（URL など）: 開くだけにする
        if (!r.launch) return finish(index, undefined, wasOpenText());
        return finishLaunch(index, await deps.launch(r.launch, logger));
      }

      let hwnd = entry.ifOpen === 'openNew' ? null : findUnclaimed(config);
      const wasOpen = hwnd !== null;
      if (hwnd === null) {
        // 動かすだけの行は、開いていなければ飛ばす
        if (!r.launch) return skip(index);
        // もう 1 つ開くときは、開く前からあるウィンドウを除いて新しいものを待つ
        const before = new Set<bigint>();
        if (entry.ifOpen === 'openNew') {
          let found: bigint | null;
          while ((found = deps.findWindow(config, before)) !== null) before.add(found);
        }
        const launched = await deps.launch(r.launch, logger);
        if (!launched.success) return finishLaunch(index, launched);
        markOpened();
        hwnd = await waitForWindow(
          index,
          config,
          before,
          entry.waitSeconds ?? SET_DEFAULT_WAIT_SECONDS
        );
        if (hwnd === null) {
          return finish(index, mainI18n.t(cancelled ? 'layout.cancelled' : 'layout.timedOut'));
        }
      }
      markOpened();
      if (cancelled) return finish(index, mainI18n.t('layout.cancelled'));

      // 前面に出さない行は、最大化の解除（位置を当てる前）と最大化で前面に出てしまうので、取られたら戻す
      const applyTarget = applyOptions ? withSingle(config, entry) : withPin(config, entry);
      const releaseForeground = applyTarget.activateWindow
        ? undefined
        : deps.holdForeground?.(hwnd);
      let applied: Awaited<ReturnType<SetExecutorDeps['applyConfig']>>;
      try {
        applied = applyOptions
          ? await deps.applyConfig(hwnd, applyTarget, r.name, logger, applyOptions)
          : await deps.applyConfig(hwnd, applyTarget, r.name, logger);
        if (entry.placement.state === 'maximized') deps.maximize(hwnd);
      } finally {
        releaseForeground?.();
      }
      // 管理者権限で動くウィンドウなどは、位置を当てても動かない（大きさは見ない）
      if (applied.positionNotApplied) return finish(index, mainI18n.t('set.run.couldNotMove'));
      return finish(
        index,
        missingDesktop === undefined
          ? undefined
          : mainI18n.t('set.run.desktopNotFound', { number: missingDesktop }),
        mainI18n.t(wasOpen ? 'set.progress.placedExisting' : 'set.progress.placed')
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        { setName: item.displayName, index, error: message },
        'セットの行の実行に失敗しました'
      );
      return finish(index, message);
    }
  };

  const waitForWindow = async (
    index: number,
    config: WindowConfig,
    exclude: ReadonlySet<bigint>,
    waitSeconds: number
  ): Promise<bigint | null> => {
    const deadline = waitSeconds * 1000;
    // ウィンドウを探す時間も数える（sleep の合計だけだと、ウィンドウが多いときに長く待ちすぎる）
    const start = Date.now();
    const end = start + deadline;
    let shownSeconds = -1;
    for (let elapsed = 0; elapsed < deadline && Date.now() < end; elapsed += SET_WINDOW_POLL_MS) {
      if (cancelled) return null;
      const found = findUnclaimed(config, exclude);
      if (found !== null) return found;
      // 待っている秒数は、1 秒変わったときだけ送る。打ち切りと同じく探す時間も数える
      //（sleep の合計だけだと「12 / 30 秒」のまま打ち切られることがある）
      const seconds = Math.floor(Math.max(elapsed, Date.now() - start) / 1000);
      if (seconds !== shownSeconds) {
        shownSeconds = seconds;
        update(
          index,
          'launching',
          undefined,
          mainI18n.t('set.progress.waitingWindow', { elapsed: seconds, total: waitSeconds })
        );
      }
      await deps.sleep(SET_WINDOW_POLL_MS);
    }
    return null;
  };

  try {
    if (parallel) {
      await Promise.all(item.entries.map((_, i) => startEntry(i).done));
    } else {
      const dones: Promise<void>[] = [];
      try {
        for (let i = 0; i < item.entries.length; i++) {
          const { opened, done } = startEntry(i);
          dones.push(done);
          await opened;
          if (i < item.entries.length - 1) await deps.sleep(GROUP_LAUNCH_DELAY_MS);
        }
      } finally {
        // 途中で投げても、始めた行の終わりは待つ（未処理の reject を残さない）
        await Promise.allSettled(dones);
      }
      await Promise.all(dones);
    }
  } finally {
    // 例外で抜けても、中止の受け口を外し、進み具合の表示を終わらせる（残るとその後のトーストが出ない）
    removeCancel?.();
    progress.isComplete = true;
    progress.isCancelled = cancelled;
    if (showProgress) deps.progress!.send('complete', progress);
  }

  results.sort((a, b) => a.index - b.index);
  const successCount = results.filter((r) => r.success).length;
  const summary: SetExecutionResult = {
    successCount,
    errorCount: results.length - successCount,
    cancelled,
    entries: results,
  };
  logger.info(
    { setName: item.displayName, ...summary, entries: undefined },
    'セットの実行が終わりました'
  );
  return summary;
}

/** 行の状態ごとに、右に出す文字の既定（うまくいった行は何をしたかで finish が差し替える） */
const STATUS_TEXT_KEYS = {
  waiting: 'set.progress.queued',
  launching: 'set.progress.opening',
  success: 'set.progress.placed',
  failed: 'set.progress.failed',
  skipped: 'set.progress.skipped',
} as const satisfies Record<LayoutEntryProgress['status'], string>;

/**
 * 進み具合に出すアイコンを、行が指すアイテムに無ければ開くもののパスでキャッシュから引く
 *
 * パスを書いた行はアイテムを指さないのでアイコンを持たない。メインウィンドウと同じキャッシュを読むだけで、
 * その場で取りには行かない（実行の出だしを遅らせない）。読めなければ表示側が種別の既定のアイコンを出す
 */
async function loadProgressIcons(
  entries: LayoutEntryProgress[],
  resolved: ResolvedEntry[],
  loadIcons: ((items: IconItem[]) => Promise<Record<string, string>>) | undefined
): Promise<void> {
  if (!loadIcons) return;
  const targets = resolved
    .map((r, index) => ({ launch: r.launch, index }))
    .filter(({ launch, index }) => !entries[index].icon && launch && launch.path.trim() !== '');
  if (targets.length === 0) return;
  try {
    const icons = await loadIcons(
      targets.map(({ launch }) => ({ type: launch!.type, path: launch!.path }))
    );
    for (const { launch, index } of targets) {
      const icon = icons[launch!.path];
      if (icon) entries[index].icon = icon;
    }
  } catch (error) {
    itemLogger.warn({ error: String(error) }, '進み具合のアイコンを読めませんでした');
  }
}

/**
 * 開けなかった行をトーストで知らせる
 *
 * 置き場所のある行があるセットは進み具合の表示に結果が出るので、ここでは知らせない
 */
export async function notifySetFailures(
  item: Pick<SetItem, 'displayName' | 'entries'>,
  result: SetExecutionResult
): Promise<void> {
  if (result.cancelled || result.errorCount === 0) return;
  if (item.entries.some((entry) => entry.placement)) return;
  const names = result.entries.filter((r) => !r.success).map((r) => r.name || '?');
  await showToastWindow({
    displayName: item.displayName,
    type: 'warning',
    message: `${item.displayName}: ${mainI18n.t('set.errors.someFailed', {
      count: names.length,
      names: names.join(mainI18n.t('common.listSeparator')),
    })}`,
    duration: LONG_TOAST_DURATION_MS,
  });
}

/** 単一アイテムを 1 行として実行するときの、行の itemId（アイテムの id とぶつからない値） */
const SINGLE_ITEM_ROW_ID = ':single-item:';

/** 単一アイテムの実行に要る項目 */
export type ExecutableLauncherItem = Pick<
  LauncherItem,
  'displayName' | 'path' | 'type' | 'args' | 'icon' | 'id' | 'runAsAdmin'
> &
  ItemWindowSwitch;

/**
 * ウィンドウ切り替えを持つ単一アイテムを、セットの 1 行として実行する
 *
 * - パスの無い単一アイテムは開くものが無い（動かすだけの行）。開いていれば切り替え（位置があれば当て）、
 *   開いていなければ何も開かずに飛ばす（結果の行に skipped が付く）
 *
 * - 位置が無ければ、ウィンドウが見つかれば前面に出して終わり、無ければ開く（開いたウィンドウは動かさない）
 * - 位置があれば、見つからなければ開いて waitSeconds（既定 30）待ち、出てきたウィンドウに位置を当てる
 * - ifOpen が openNew なら、いつも開く
 * - 前面に出す（activateWindow）の既定は true（セットの行は false）
 * - 進み具合の表示は出さない。うまくいかなかったときだけトーストで知らせる（notifyLauncherItemFailure）
 *
 * window を持たないアイテムはこの関数を通さず、普通に開く
 */
export async function executeLauncherItem(
  item: ExecutableLauncherItem,
  deps: SetExecutorDeps = defaultDeps,
  logger: Logger = itemLogger
): Promise<SetExecutionResult> {
  // 二重実行の防止はセットと同じ（1 回目のウィンドウが出る前の 2 回目で、もう 1 つ開かないように）
  const key = item.id !== undefined ? `item:${item.id}` : undefined;
  if (key !== undefined && runningSets.has(key)) {
    logger.info({ name: item.displayName }, '同じアイテムを実行中なので、重ねては開きません');
    return { successCount: 0, errorCount: 0, cancelled: false, entries: [], skipped: true };
  }
  const entry: SetEntry = {
    itemId: SINGLE_ITEM_ROW_ID,
    ...(item.window ? { window: item.window } : {}),
    ...(item.placement ? { placement: item.placement } : {}),
    ...(item.ifOpen ? { ifOpen: item.ifOpen } : {}),
    ...(item.waitSeconds !== undefined ? { waitSeconds: item.waitSeconds } : {}),
    activateWindow: item.activateWindow ?? true,
    ...(item.pinToAllDesktops === true ? { pinToAllDesktops: true } : {}),
  };
  const launcher: LauncherItem = {
    displayName: item.displayName,
    path: item.path,
    type: item.type,
    ...(item.args ? { args: item.args } : {}),
    ...(item.icon ? { icon: item.icon } : {}),
    ...(item.runAsAdmin === true ? { runAsAdmin: true } : {}),
    // パスの無い単一アイテムかを行の解決で見分ける（対象ウィンドウ自体は行の window で探す）
    ...(item.window ? { window: item.window } : {}),
  };
  if (key !== undefined) runningSets.add(key);
  try {
    return await runSet(
      { displayName: item.displayName, entries: [entry] },
      (itemId) => (itemId === SINGLE_ITEM_ROW_ID ? launcher : undefined),
      { ...deps, progress: undefined },
      logger,
      true
    );
  } finally {
    if (key !== undefined) runningSets.delete(key);
  }
}

/**
 * 単一アイテムのウィンドウ切り替えがうまくいかなかったことをトーストで知らせる
 *
 * - パスの無い単一アイテムで、ウィンドウが開いていなかった（飛ばした）: 情報のトーストで知らせる
 *   （何も起きないと壊れて見えるため）
 * - うまくいったとき・二重実行で何もしなかったときは知らせない
 */
export async function notifyLauncherItemFailure(
  item: Pick<ExecutableLauncherItem, 'displayName' | 'type' | 'waitSeconds'>,
  result: SetExecutionResult
): Promise<void> {
  if (result.cancelled) return;
  // 管理者として実行で UAC の「いいえ」を押したときは知らせない
  if (result.entries.some((entry) => entry.adminCancelled)) return;
  if (result.entries.some((entry) => entry.skipped)) {
    await showToastWindow({
      displayName: item.displayName,
      itemType: item.type,
      type: 'info',
      message: mainI18n.t('set.run.itemNotOpen'),
    });
    return;
  }
  const failed = result.entries.find((entry) => !entry.success);
  if (!failed) return;
  const message =
    failed.error === mainI18n.t('layout.timedOut')
      ? mainI18n.t('set.run.itemWindowTimedOut', {
          seconds: item.waitSeconds ?? SET_DEFAULT_WAIT_SECONDS,
        })
      : (failed.error ?? '');
  await showToastWindow({
    displayName: item.displayName,
    itemType: item.type,
    type: 'warning',
    message,
    duration: LONG_TOAST_DURATION_MS,
  });
}
