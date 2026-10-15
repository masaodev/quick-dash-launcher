/**
 * セットの実行
 *
 * 行ごとに「開くもの」を開き、置き場所があればウィンドウを見つけて（無ければ開いて待って）位置を合わせる。
 *
 * - 順番に開く（既定）: 上の行から 100 ms おきに開く。ウィンドウを待って位置を合わせる処理は並行して続け、
 *   次の行を開くのは待たない（1 行ずつ最大 30 秒待つと全体が遅くなるため）
 * - 同時に開く: 全部を一度に開き、出たものから位置を合わせる
 * - 置き場所の無い行は、今までのグループと同じ（アイテムにウィンドウ設定があれば、開いていれば前面に出すだけ）
 * - 置き場所のある行が 1 つでもあれば、進み具合を画面の隅に出す（中止できる）
 */
import { ipcMain, screen } from 'electron';
import type { Logger } from 'pino';
import { itemLogger } from '@common/logger';
import type {
  AppItem,
  LauncherItem,
  LayoutEntryProgress,
  LayoutExecutionProgress,
  SetEntry,
  SetItem,
  WindowConfig,
  WindowItem,
} from '@common/types';
import { isLauncherItem, isWindowItem } from '@common/types/guards';
import { GROUP_LAUNCH_DELAY_MS } from '@common/constants';
import {
  IPC_CHANNELS,
  LAYOUT_PROGRESS_CHANNELS,
  type ProgressEventType,
} from '@common/ipcChannels';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { ANY_WINDOW_TITLE, createTitleMatcher } from '@common/utils/windowTitle';
import { pickWindowPlacement } from '@common/utils/windowPlacement';
import { isUnresolvedEntry } from '@common/utils/setWindowMatching';
import { fitPlacementToScreens, type ScreenArea } from '@common/utils/placementLabel';

import { applyWindowConfig, tryActivateWindow } from '../../utils/windowActivator.js';
import { findWindowHwndByTitle, maximizeWindow } from '../../utils/nativeWindowControl.js';
import { launchItem, type LaunchableItem } from '../../utils/itemLauncher.js';
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

/** 行の指す先を解決したもの */
interface ResolvedEntry {
  /** 進み具合・ログに出す名前 */
  name: string;
  /** 開くもの（無ければ並べるだけ） */
  launch?: LaunchableItem;
  /** 指しているアイテムのウィンドウ設定（置き場所の無い行で、開いていれば前面に出すのに使う） */
  itemWindowConfig?: WindowConfig;
  /** 指しているのがウィンドウ操作アイテムのとき */
  windowItem?: WindowItem;
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

/** 実行の差し替え口（テスト用） */
export interface SetExecutorDeps {
  launch: (item: LaunchableItem, logger: Logger) => Promise<void>;
  findWindow: (match: WindowConfig, exclude?: ReadonlySet<bigint>) => bigint | null;
  applyConfig: typeof applyWindowConfig;
  activate: typeof tryActivateWindow;
  maximize: (hwnd: bigint) => boolean;
  sleep: (ms: number) => Promise<void>;
  /** 画面の範囲（物理ピクセル。どの画面にも入らない位置を主画面に収めるのに使う） */
  screens?: () => ScreenArea[];
  progress?: {
    show: () => Promise<void>;
    send: (event: ProgressEventType, progress: LayoutExecutionProgress) => void;
    onCancel: (handler: () => void) => () => void;
  };
}

function lastSegment(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** 行の指す先を解決する */
export function resolveSetEntry(entry: SetEntry, resolve: SetItemResolver): ResolvedEntry {
  if (entry.itemId) {
    const item = resolve(entry.itemId);
    if (!item) {
      return {
        name: entry.label ?? entry.itemId,
        error: mainI18n.t('set.errors.itemNotFound'),
      };
    }
    if (isWindowItem(item)) {
      return { name: item.displayName, windowItem: item };
    }
    if (isLauncherItem(item)) {
      return {
        name: item.displayName,
        launch: {
          type: item.type,
          path: item.path,
          args: item.args,
          displayName: item.displayName,
        },
        itemWindowConfig: (item as LauncherItem).windowConfig,
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
 * 行に見つけ方が無ければ、ウィンドウ操作アイテムの条件、または開く exe の名前から推測する
 */
export function buildSetWindowConfig(
  entry: SetEntry,
  resolved: ResolvedEntry
): WindowConfig | undefined {
  let title = entry.window?.title;
  let processName = entry.window?.processName;
  if (!title && !processName) {
    if (resolved.windowItem) {
      title = resolved.windowItem.windowTitle;
      processName = resolved.windowItem.processName;
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
    activateWindow: entry.activateWindow,
  };
}

const defaultDeps: SetExecutorDeps = {
  launch: launchItem,
  findWindow: (config, exclude) =>
    findWindowHwndByTitle(createTitleMatcher(config.title), config.processName, exclude),
  applyConfig: applyWindowConfig,
  activate: tryActivateWindow,
  maximize: (hwnd) => maximizeWindow(hwnd),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  // ウィンドウの座標（GetWindowRect）は物理ピクセルなので、画面の範囲も物理ピクセルに直す
  screens: () =>
    screen.getAllDisplays().map((display) => ({
      bounds: screen.dipToScreenRect(null, display.bounds),
      workArea: screen.dipToScreenRect(null, display.workArea),
    })),
  progress: {
    show: async () => {
      await showLayoutProgressWindow();
    },
    send: (eventType, progress) => {
      try {
        const win = getLayoutProgressWindow();
        if (win && !win.isDestroyed()) {
          const labels = { cancel: mainI18n.t('common.cancel'), close: mainI18n.t('common.close') };
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
  },
};

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
  logger: Logger
): Promise<SetExecutionResult> {
  const parallel = item.launchMode === 'parallel';
  logger.info(
    { setName: item.displayName, entryCount: item.entries.length, parallel },
    'セットを実行中'
  );

  const resolved = item.entries.map((entry) => resolveSetEntry(entry, resolve));
  const hasPlacement = item.entries.some((entry) => entry.placement);
  const screens = hasPlacement ? (deps.screens?.() ?? []) : [];

  let cancelled = false;
  const progress: LayoutExecutionProgress = {
    layoutName: item.displayName,
    entries: resolved.map((r, index): LayoutEntryProgress => ({
      index,
      windowTitle: r.name,
      // 行の名前と動かすウィンドウが別のものでも分かるように、exe 名を添える
      ...(item.entries[index].window?.processName
        ? { processName: item.entries[index].window!.processName }
        : {}),
      ...(r.icon ? { icon: r.icon } : {}),
      status: 'waiting',
    })),
    isComplete: false,
    isCancelled: false,
  };
  const showProgress = hasPlacement && deps.progress;
  let removeCancel: (() => void) | undefined;
  if (showProgress) {
    await deps.progress!.show();
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
    const found = deps.findWindow(config, skip);
    if (found !== null) claimed.add(found);
    return found;
  };
  const update = (index: number, status: LayoutEntryProgress['status'], error?: string) => {
    progress.entries[index].status = status;
    if (error) progress.entries[index].errorMessage = error;
    if (showProgress) deps.progress!.send('update', progress);
  };
  const finish = (index: number, error?: string) => {
    results.push({
      index,
      name: resolved[index].name,
      success: !error,
      ...(error ? { error } : {}),
    });
    update(index, error ? 'failed' : 'success', error);
  };
  /** 動かすだけの行で、ウィンドウが開いていなかった（失敗とは数えず、理由だけ添える） */
  const skip = (index: number) => {
    results.push({ index, name: resolved[index].name, success: true, skipped: true });
    update(index, 'skipped', mainI18n.t('set.run.notOpen'));
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
        if (r.windowItem) {
          const config: WindowConfig = {
            // タイトルが空のウィンドウ操作は exe 名だけで探す（位置のある行と同じ）
            title: r.windowItem.windowTitle || ANY_WINDOW_TITLE,
            ...pickWindowPlacement(r.windowItem),
          };
          const result = await deps.activate(config, r.name, logger);
          return finish(
            index,
            result.windowFound ? undefined : mainI18n.t('layout.windowNotFound')
          );
        }
        if (!r.launch) {
          // 動かすだけの行で位置が無い: 開いていれば前面に出す（探す条件が空ならどのウィンドウにも合うので失敗にする）
          if (!entry.window?.processName && !entry.window?.title) {
            return finish(index, mainI18n.t('layout.windowNotFound'));
          }
          const result = await deps.activate(
            {
              title: entry.window.title || ANY_WINDOW_TITLE,
              processName: entry.window.processName,
            },
            r.name,
            logger
          );
          return result.windowFound ? finish(index) : skip(index);
        }
        const itemConfig = entry.window
          ? { title: entry.window.title || ANY_WINDOW_TITLE, processName: entry.window.processName }
          : r.itemWindowConfig;
        if (itemConfig && entry.ifOpen !== 'openNew') {
          const result = await deps.activate(itemConfig, r.name, logger);
          // 前面に出すのを Windows に断られても、見つかっていれば開き直さない（二重に開かない）
          if (result.windowFound) return finish(index);
        }
        await deps.launch(r.launch, logger);
        return finish(index);
      }

      // 置き場所のある行。今は無い画面の位置なら、主画面に収める（見えない所へ動かさない）
      const fitted = fitPlacementToScreens(entry.placement, screens);
      if (fitted !== entry.placement) {
        logger.info(
          { setName: item.displayName, index, placement: entry.placement, fitted },
          '記録した位置がどの画面にも入らないので、主画面に収めます'
        );
      }
      const config = buildSetWindowConfig({ ...entry, placement: fitted }, r);
      if (!config) {
        // 見つけ方を決められない（URL など）: 開くだけにする
        if (r.launch) await deps.launch(r.launch, logger);
        return finish(index);
      }

      let hwnd = entry.ifOpen === 'openNew' ? null : findUnclaimed(config);
      if (hwnd === null) {
        // 動かすだけの行（ウィンドウ操作アイテムを指す行を除く）は、開いていなければ飛ばす
        if (!r.launch) {
          return r.windowItem ? finish(index, mainI18n.t('layout.windowNotFound')) : skip(index);
        }
        // もう 1 つ開くときは、開く前からあるウィンドウを除いて新しいものを待つ
        const before = new Set<bigint>();
        if (entry.ifOpen === 'openNew') {
          let found: bigint | null;
          while ((found = deps.findWindow(config, before)) !== null) before.add(found);
        }
        await deps.launch(r.launch, logger);
        markOpened();
        hwnd = await waitForWindow(config, before, entry.waitSeconds ?? SET_DEFAULT_WAIT_SECONDS);
        if (hwnd === null) {
          return finish(index, mainI18n.t(cancelled ? 'layout.cancelled' : 'layout.timedOut'));
        }
      }
      markOpened();
      if (cancelled) return finish(index, mainI18n.t('layout.cancelled'));

      const applied = await deps.applyConfig(hwnd, config, r.name, logger);
      if (entry.placement.state === 'maximized') deps.maximize(hwnd);
      // 管理者権限で動くウィンドウなどは、位置を当てても動かない（大きさは見ない）
      return finish(
        index,
        applied.positionNotApplied ? mainI18n.t('set.run.couldNotMove') : undefined
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
    config: WindowConfig,
    exclude: ReadonlySet<bigint>,
    waitSeconds: number
  ): Promise<bigint | null> => {
    const deadline = waitSeconds * 1000;
    // ウィンドウを探す時間も数える（sleep の合計だけだと、ウィンドウが多いときに長く待ちすぎる）
    const end = Date.now() + deadline;
    for (let elapsed = 0; elapsed < deadline && Date.now() < end; elapsed += SET_WINDOW_POLL_MS) {
      if (cancelled) return null;
      const found = findUnclaimed(config, exclude);
      if (found !== null) return found;
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
      names: names.join(', '),
    })}`,
    duration: LONG_TOAST_DURATION_MS,
  });
}
