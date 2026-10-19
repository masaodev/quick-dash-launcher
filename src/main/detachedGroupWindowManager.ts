import { BrowserWindow, screen } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import { windowLogger } from '@common/logger';
import { DETACHED_WINDOW_NAME_PREFIX } from '@common/constants';
import type { Bounds, MonitorAnchor, PinLevel } from '@common/types';

import PathManager from './config/pathManager.js';
import { SettingsService } from './services/settingsService.js';
import { WorkspaceService } from './services/workspace/index.js';
import { attachSnapHandler } from './utils/windowSnap.js';
import { scheduleFallbackShow } from './utils/modalChildWindows.js';
import {
  DEFAULT_WEB_PREFERENCES,
  attachCommonKeyHandlers,
  hasVisibleChildWindow,
  isAppQuitting,
} from './utils/managedWindow.js';
import {
  moveWindowToCurrentDesktop,
  pinWindow,
  unPinWindow,
} from './utils/virtualDesktop/index.js';
import { computeMonitorAnchor, placeByMonitorAnchor } from './utils/monitorAnchor.js';
import { setBoundsAcrossDisplays } from './utils/screenPosition.js';
import { notifyPinLevel } from './utils/pinMenu.js';
import { getMainWindowDisplay } from './utils/referenceDisplay.js';
import { getRendererHtmlUrl, openChildWindow } from './services/childWindowService.js';

/**
 * 初回autofit前のフォールバック表示までの待機時間（ms）
 */
const SHOW_FALLBACK_TIMEOUT_MS = 1500;

/** groupId → BrowserWindow */
const detachedWindows = new Map<string, BrowserWindow>();

/** groupId → ピンモード */
const detachedPinModes = new Map<string, PinLevel>();

/** webContents.id → groupId（IPC応答用の逆引き） */
const webContentsIdToGroupId = new Map<number, string>();

/** 生成中の groupId（二重要求の抑止用） */
const creatingGroupIds = new Set<string>();

/**
 * まだ初めての表示をしていない groupId。中身に合わせて大きさを決めた後（またはしばらく待った後）に 1 回だけ出す。
 * 隠したまま作ったもの（起動時に開き直した 📌 なしのもの）は入れない。メインウィンドウと一緒に出る
 */
const pendingInitialShow = new Set<string>();

/** 編集画面の「試しに実行」で一時的に常に最前面にしている groupId（📌 の段階は変えず、保存もしない） */
const temporaryAlwaysOnTopGroupIds = new Set<string>();

/** groupId → 最後に動かしたときの、載っていたモニターに対する位置 */
const detachedAnchors = new Map<string, MonitorAnchor>();

/** groupId → 覚えているサイズ（小さいモニターで表示だけ縮めても、元のサイズに戻せるように持つ） */
const detachedSizes = new Map<string, { width: number; height: number }>();

/**
 * groupId → QDL が位置を当て直した先と時刻。当て直した先のままの移動・サイズ変更は人の操作ではないので保存しない
 * （小さいディスプレイで縮めたサイズや寄せた位置で、覚えている位置を上書きしないため）
 */
const programmaticPlacements = new Map<string, { bounds: Bounds; at: number }>();

/** moved は位置の基準を、resized は覚えているサイズを覚え直す */
type BoundsChange = 'moved' | 'resized';

/**
 * groupId → 位置・大きさを覚えて保存する処理（setupDetachedWindow が作る）。
 * 枠のない切り離しウィンドウは、端のドラッグも中身に合わせた高さもレンダラーが setBounds で変え、
 * moved・resized が来ないので、IPC の側からも呼ぶ（rememberDetachedBoundsFromRenderer）
 */
const boundsSavers = new Map<string, (kind: BoundsChange, fromRenderer?: boolean) => void>();

/** 位置を当て直した直後、途中の大きさ（拡大率の違うディスプレイへ移すとき）も人の操作とみなさない時間（ms） */
const PROGRAMMATIC_MOVE_GRACE_MS = 300;

let detachedWindowSnapEnabled: boolean = true;

function applyVirtualDesktopPinToWindow(win: BrowserWindow, enabled: boolean): void {
  // 隠れているウィンドウには当てられない（失敗する）。表示のたびに当て直すので、そのときに任せる
  if (win.isDestroyed() || !win.isVisible()) return;
  const hwnd = win.getNativeWindowHandle().readBigUInt64LE();
  const success = enabled ? pinWindow(hwnd) : unPinWindow(hwnd);
  const action = enabled ? 'pin' : 'unpin';
  if (success) {
    windowLogger.info(`切り離しウィンドウの仮想デスクトップ固定: ${action}`);
  } else {
    windowLogger.warn(`切り離しウィンドウの仮想デスクトップ固定に失敗: ${action}`);
  }
}

/** 切り離しウィンドウのスナップ有効/無効キャッシュを更新する */
export function setDetachedWindowSnapEnabled(enabled: boolean): void {
  detachedWindowSnapEnabled = enabled;
}

/**
 * 指定ウィンドウが切り離しウィンドウかどうかを返す
 */
export function isDetachedGroupWindow(win: BrowserWindow): boolean {
  return [...detachedWindows.values()].includes(win);
}

/**
 * 指定グループの切り離しウィンドウのピンモードを取得する
 */
export function getDetachedPinLevel(groupId: string): PinLevel {
  return detachedPinModes.get(groupId) ?? 0;
}

/**
 * 指定グループの切り離しウィンドウのピンモードを変える
 */
export function setDetachedPinLevel(groupId: string, next: PinLevel): PinLevel {
  detachedPinModes.set(groupId, next);
  // 人が段階を変えたら、一時的な最前面は終わったものとして扱う
  temporaryAlwaysOnTopGroupIds.delete(groupId);

  const win = detachedWindows.get(groupId);
  notifyPinLevel(win, next);
  if (win && !win.isDestroyed()) {
    win.setAlwaysOnTop(next === 2);
    // setAlwaysOnTop が仮想デスクトップ固定をリセットするため再適用
    SettingsService.getInstance()
      .then((ss) => ss.get('detachedVisibleOnAllDesktops'))
      .then((enabled) => applyVirtualDesktopPinToWindow(win, enabled))
      .catch(() => {});
  }
  return next;
}

/**
 * 中身に合わせて大きさを決めたときに呼ぶ。まだ初めての表示をしていなければ true を返して、表示待ちを外す
 * （隠れているウィンドウや、隠したまま作ったウィンドウを、大きさの調整のたびに出さないため）
 */
export function takeDetachedInitialShow(win: BrowserWindow): boolean {
  const groupId = webContentsIdToGroupId.get(win.webContents.id);
  return groupId !== undefined && pendingInitialShow.delete(groupId);
}

/**
 * レンダラーが setBounds で変えた大きさを、切り離しウィンドウの覚えているサイズにする
 * （覚えないと、メインウィンドウと同じディスプレイへ移すたびに、切り離した直後の大きさに戻ってしまう）
 * - userResize: 端のドラッグ。幅・高さを覚え、位置も変わった（左端・上端）なら位置の基準も覚え直す
 * - autoFit: 中身に合わせた高さ。高さだけを覚える（幅は小さいディスプレイで表示だけ縮めたものかもしれない）。
 *   上端を動かさずに伸び縮みするので、位置の基準も覚え直す（中央を基準にしていると、次に移したとき上端がずれるため）
 */
export function rememberDetachedBoundsFromRenderer(
  win: BrowserWindow,
  change: { kind: 'userResize'; moved: boolean } | { kind: 'autoFit' }
): void {
  const groupId = webContentsIdToGroupId.get(win.webContents.id);
  if (!groupId) return;
  const save = boundsSavers.get(groupId);
  if (!save) return;
  if (change.kind === 'autoFit') {
    const { width, height } = win.getBounds();
    detachedSizes.set(groupId, { width: detachedSizes.get(groupId)?.width ?? width, height });
    save('moved', true);
    return;
  }
  save('resized', true);
  if (change.moved) save('moved', true);
}

/** フォーカスを奪わずにウィンドウを前面に表示する */
export function showWithoutFocus(win: BrowserWindow): void {
  win.showInactive();
  win.moveTop();
}

/**
 * 保存された bounds が画面内に収まるか検証する
 */
function isBoundsOnScreen(bounds: Bounds): boolean {
  const displays = screen.getAllDisplays();
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return displays.some((display) => {
    const { x, y, width, height } = display.workArea;
    return cx >= x && cx < x + width && cy >= y && cy < y + height;
  });
}

/**
 * ウィンドウの初期位置を決定する
 * 優先順位: 保存済み位置 > カーソル位置近辺 > OS既定
 */
function resolveInitialPosition(
  savedBounds: Bounds | null,
  cursorX?: number,
  cursorY?: number,
  windowWidth?: number,
  windowHeight?: number
): { x: number; y: number } | undefined {
  if (savedBounds && isBoundsOnScreen(savedBounds)) {
    return { x: savedBounds.x, y: savedBounds.y };
  }
  const w = windowWidth ?? 380;
  const h = windowHeight ?? 200;
  if (cursorX !== undefined && cursorY !== undefined) {
    return {
      x: Math.max(0, Math.round(cursorX - w / 2)),
      y: Math.max(0, Math.round(cursorY - h / 4)),
    };
  }
  // フォールバック: プライマリモニターの中央に配置
  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.workArea;
  return {
    x: Math.round(x + (width - w) / 2),
    y: Math.round(y + (height - h) / 2),
  };
}

/** メインウィンドウと同じディスプレイの作業領域 */
function getReferenceWorkArea(): Bounds {
  return getMainWindowDisplay().workArea;
}

/** ウィンドウが今載っているモニターに対する位置を求める */
function computeAnchorOnCurrentDisplay(bounds: Bounds): MonitorAnchor {
  return computeMonitorAnchor(bounds, screen.getDisplayMatching(bounds).workArea);
}

function isSameBounds(a: Bounds, b: Bounds): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** QDL が当て直したことによる移動・サイズ変更か（当て直した先のまま、または当て直した直後） */
function isProgrammaticMove(groupId: string, current: Bounds): boolean {
  const placement = programmaticPlacements.get(groupId);
  if (!placement) return false;
  if (isSameBounds(current, placement.bounds)) return true;
  if (Date.now() - placement.at < PROGRAMMATIC_MOVE_GRACE_MS) return true;
  // 人が動かした。以後は当て直した先と比べない
  programmaticPlacements.delete(groupId);
  return false;
}

function markProgrammaticPlacement(groupId: string, bounds: Bounds): void {
  programmaticPlacements.set(groupId, { bounds, at: Date.now() });
}

/**
 * 切り離しウィンドウを、覚えた位置のままメインウィンドウと同じディスプレイへ移す
 * （まだ位置を覚えていなければ、今載っているディスプレイに対する位置を使う）
 */
function placeOnMainWindowDisplay(groupId: string, win: BrowserWindow): void {
  const current = win.getBounds();
  let anchor = detachedAnchors.get(groupId);
  if (!anchor) {
    anchor = computeAnchorOnCurrentDisplay(current);
    detachedAnchors.set(groupId, anchor);
  }
  const size = detachedSizes.get(groupId) ?? { width: current.width, height: current.height };
  const target = placeByMonitorAnchor(anchor, size, getReferenceWorkArea());
  if (
    target.x === current.x &&
    target.y === current.y &&
    target.width === current.width &&
    target.height === current.height
  ) {
    return;
  }
  markProgrammaticPlacement(groupId, target);
  setBoundsAcrossDisplays(win, target);
}

/** 直接生成（フォールバック）用に、groupId をクエリに付けた workspace.html の URL を組み立てる */
function buildDetachedWindowUrl(groupId: string): string {
  return `${getRendererHtmlUrl('workspace.html')}?groupId=${encodeURIComponent(groupId)}`;
}

/**
 * メインプロセスで直接 BrowserWindow を生成する（開き元が使えない場合のフォールバック）
 */
function createStandaloneWindow(
  groupId: string,
  options: BrowserWindowConstructorOptions,
  pinMode: PinLevel,
  skipFocus: boolean,
  startHidden: boolean
): { success: boolean } {
  const win = new BrowserWindow(options);
  win.loadURL(buildDetachedWindowUrl(groupId));
  setupDetachedWindow(win, groupId, pinMode, skipFocus, startHidden);
  windowLogger.info(`切り離しウィンドウを直接作成しました: ${groupId}`);
  return { success: true };
}

/**
 * 切り離しグループウィンドウを作成する（既存ならフォーカスのみ）
 * @param options.skipFocus trueの場合、フォーカスを奪わずに表示する
 * @param options.startHiddenUnlessPinned trueの場合、📌 なしのものは隠したまま作る（メインウィンドウと一緒に出る）
 */
export async function createDetachedGroupWindow(
  groupId: string,
  cursorX?: number,
  cursorY?: number,
  options?: { skipFocus?: boolean; startHiddenUnlessPinned?: boolean }
): Promise<{ success: boolean }> {
  const existing = detachedWindows.get(groupId);
  if (existing && !existing.isDestroyed()) {
    if (options?.skipFocus) {
      showWithoutFocus(existing);
    } else {
      existing.focus();
    }
    return { success: true };
  }
  if (creatingGroupIds.has(groupId)) {
    // 生成中の二重要求は無視
    return { success: true };
  }

  const defaultWidth = 380;
  const defaultHeight = 200;

  // スナップ設定キャッシュの初期化
  let followMainWindow = false;
  try {
    const settingsService = await SettingsService.getInstance();
    detachedWindowSnapEnabled = await settingsService.get('windowSnapEnabled');
    followMainWindow = (await settingsService.get('detachedPositionMode')) === 'mainDisplay';
  } catch {
    // デフォルト値(true)のまま
  }

  // 保存済み状態の読み込みを試行
  let savedBounds: Bounds | null = null;
  let savedPinMode: PinLevel = 0;
  let savedAnchor: MonitorAnchor | null = null;
  try {
    const workspaceService = await WorkspaceService.getInstance();
    const state = await workspaceService.loadDetachedWindowState(groupId);
    if (state?.bounds && state.bounds.width > 0 && state.bounds.height > 0) {
      savedBounds = state.bounds;
    }
    if (state?.pinMode === 1 || state?.pinMode === 2) {
      savedPinMode = state.pinMode;
    }
    if (state?.anchor) {
      savedAnchor = state.anchor;
    }
  } catch (error) {
    windowLogger.warn({ error, groupId }, '切り離しウィンドウの保存済み状態読み込みに失敗');
  }

  let width = savedBounds?.width ?? defaultWidth;
  let height = savedBounds?.height ?? defaultHeight;
  let position = resolveInitialPosition(savedBounds, cursorX, cursorY, width, height);
  // 前回のウィンドウを開き直すとき、メインウィンドウと同じディスプレイに出す設定なら覚えた位置で当てる（ピン留めしたものは置いた場所のまま）
  const placedByAnchor = followMainWindow && savedPinMode === 0 && savedAnchor !== null;
  if (placedByAnchor && savedAnchor) {
    const target = placeByMonitorAnchor(savedAnchor, { width, height }, getReferenceWorkArea());
    position = { x: target.x, y: target.y };
    width = target.width;
    height = target.height;
  }

  const windowOptions: BrowserWindowConstructorOptions = {
    width,
    height,
    ...(position && { x: position.x, y: position.y }),
    minWidth: 100,
    minHeight: 40,
    frame: false,
    resizable: true,
    // 掴む領域（一覧のすき間）のダブルクリックで最大化しないように
    maximizable: false,
    transparent: true,
    alwaysOnTop: savedPinMode === 2,
    show: false,
    icon: PathManager.getAppIconPath(),
    webPreferences: DEFAULT_WEB_PREFERENCES,
  };

  const skipFocus = options?.skipFocus ?? false;
  const startHidden = (options?.startHiddenUnlessPinned ?? false) && savedPinMode === 0;

  if (savedAnchor) {
    detachedAnchors.set(groupId, savedAnchor);
  }
  if (savedBounds) {
    detachedSizes.set(groupId, { width: savedBounds.width, height: savedBounds.height });
  }
  if (placedByAnchor && position) {
    markProgrammaticPlacement(groupId, { x: position.x, y: position.y, width, height });
  }

  // ワークスペースのレンダラーから window.open で開き、レンダラープロセスを共有する
  // （groupId は window.name 経由でレンダラーに伝わる）
  creatingGroupIds.add(groupId);
  try {
    const win = await openChildWindow('workspace', {
      name: `${DETACHED_WINDOW_NAME_PREFIX}${groupId}`,
      html: 'workspace.html',
      options: windowOptions,
    });
    if (win) {
      setupDetachedWindow(win, groupId, savedPinMode, skipFocus, startHidden);
      windowLogger.info(`切り離しウィンドウをレンダラー共有で作成しました: ${groupId}`);
      return { success: true };
    }
    windowLogger.warn({ groupId }, 'レンダラー共有での生成に失敗したため直接生成します');
    return createStandaloneWindow(groupId, windowOptions, savedPinMode, skipFocus, startHidden);
  } finally {
    creatingGroupIds.delete(groupId);
  }
}

/**
 * 生成済みの BrowserWindow に切り離しウィンドウとしての管理・イベントを設定する
 * レンダラー共有（did-create-window）と直接生成の両経路から呼ばれる
 */
function setupDetachedWindow(
  win: BrowserWindow,
  groupId: string,
  pinMode: PinLevel,
  skipFocus: boolean,
  startHidden: boolean
): void {
  win.setMenuBarVisibility(false);
  win.setMenu(null);

  detachedWindows.set(groupId, win);
  detachedPinModes.set(groupId, pinMode);
  // closed イベント内で webContents にアクセスできないため事前に保存
  const wcId = win.webContents.id;
  webContentsIdToGroupId.set(wcId, groupId);

  // 開き直したときの段階をボタンに知らせる（レンダラーが先に問い合わせると、まだ登録前で 0 が返るため）
  notifyPinLevel(win, pinMode);

  if (!startHidden) pendingInitialShow.add(groupId);
  const cancelFallbackShow = startHidden
    ? () => {}
    : scheduleFallbackShow(
        win,
        () => {
          if (!pendingInitialShow.delete(groupId)) return;
          if (skipFocus) showWithoutFocus(win);
          else win.show();
        },
        SHOW_FALLBACK_TIMEOUT_MS
      );

  // bounds 保存用のデバウンスタイマー。QDL が位置を当て直したときの移動は保存しない
  // 位置の基準は動かしたとき、覚えているサイズは大きさを変えたときだけ覚え直す
  // （小さいディスプレイで表示だけ縮めたサイズを、動かしただけで覚えてしまわないため）
  let boundsTimer: ReturnType<typeof setTimeout> | null = null;
  let anchorPending = false;
  let sizePending = false;
  const saveBoundsDebounced = (kind: BoundsChange, fromRenderer = false) => {
    if (win.isDestroyed()) return;
    // レンダラーが変えた大きさは人の操作か中身に合わせたもので、QDL の当て直しではない
    if (!fromRenderer && isProgrammaticMove(groupId, win.getBounds())) return;
    if (kind === 'moved') anchorPending = true;
    else sizePending = true;
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(async () => {
      if (win.isDestroyed()) return;
      const bounds = win.getBounds();
      if (sizePending) {
        detachedSizes.set(groupId, { width: bounds.width, height: bounds.height });
        sizePending = false;
      }
      let anchor: MonitorAnchor | undefined;
      if (anchorPending) {
        anchor = computeAnchorOnCurrentDisplay(bounds);
        detachedAnchors.set(groupId, anchor);
        anchorPending = false;
      }
      const size = detachedSizes.get(groupId) ?? bounds;
      try {
        const ws = await WorkspaceService.getInstance();
        await ws.saveDetachedBounds(
          groupId,
          { x: bounds.x, y: bounds.y, width: size.width, height: size.height },
          anchor
        );
      } catch (error) {
        windowLogger.warn({ error, groupId }, '切り離しウィンドウの bounds 保存に失敗');
      }
    }, 300);
  };

  // 位置の基準は動かしたとき（と中身に合わせて高さを変えたとき。rememberDetachedBoundsFromRenderer）だけ覚え直す
  win.on('moved', () => saveBoundsDebounced('moved'));
  win.on('resized', () => saveBoundsDebounced('resized'));
  boundsSavers.set(groupId, saveBoundsDebounced);

  win.on('closed', () => {
    cancelFallbackShow();
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsSavers.delete(groupId);
    webContentsIdToGroupId.delete(wcId);
    detachedWindows.delete(groupId);
    detachedPinModes.delete(groupId);
    temporaryAlwaysOnTopGroupIds.delete(groupId);
    forgetPlacement(groupId);
    // 明示的に閉じた場合はエントリごと削除（アプリ終了時は次回復元のため残す）
    if (!isAppQuitting()) {
      WorkspaceService.getInstance()
        .then((ws) => ws.removeDetachedWindowState(groupId))
        .catch((error) => {
          windowLogger.warn({ error, groupId }, '切り離しウィンドウ状態の削除に失敗');
        });
    }
    windowLogger.info(`切り離しウィンドウを閉じました: ${groupId}`);
  });

  attachCommonKeyHandlers(win);

  attachSnapHandler(win, () => detachedWindowSnapEnabled);

  // 仮想デスクトップ固定の適用（ウィンドウ表示後に実行する必要がある）。
  // 隠すと固定が外れる（メインと一緒に隠して出し直すと 1 つのデスクトップにしか出なくなった）ので、表示のたびに当て直す
  win.on('show', () => {
    // 初めての表示を別の経路（メインと一緒に出すなど）で済ませたら、表示待ちを外す
    // （残っていると、隠れている間に中身の高さが変わったとき、このウィンドウだけが出てしまう）
    pendingInitialShow.delete(groupId);
    SettingsService.getInstance()
      .then((ss) => ss.get('detachedVisibleOnAllDesktops'))
      .then((enabled) => applyVirtualDesktopPinToWindow(win, enabled))
      .catch(() => {
        // デフォルトは固定なし
      });
  });

  // エントリの存在を確保（復元対象として認識されるように初期 bounds を保存）。
  // 覚えた位置で開き直したときは、エントリも位置もあるので書かない
  if (!detachedAnchors.has(groupId)) {
    const initialBounds = win.getBounds();
    const initialAnchor = computeAnchorOnCurrentDisplay(initialBounds);
    detachedAnchors.set(groupId, initialAnchor);
    detachedSizes.set(groupId, { width: initialBounds.width, height: initialBounds.height });
    WorkspaceService.getInstance()
      .then((ws) => ws.saveDetachedBounds(groupId, initialBounds, initialAnchor))
      .catch((error) => {
        windowLogger.warn({ error, groupId }, '切り離しウィンドウの初期 bounds 保存に失敗');
      });
  }
}

function forgetPlacement(groupId: string): void {
  pendingInitialShow.delete(groupId);
  detachedAnchors.delete(groupId);
  detachedSizes.delete(groupId);
  programmaticPlacements.delete(groupId);
}

function destroyWindowIfAlive(groupId: string): void {
  const win = detachedWindows.get(groupId);
  if (win && !win.isDestroyed()) {
    // closed イベントに頼らず明示的にマップから削除
    const wcId = win.webContents?.id;
    if (wcId !== undefined) {
      webContentsIdToGroupId.delete(wcId);
    }
    detachedWindows.delete(groupId);
    detachedPinModes.delete(groupId);
    temporaryAlwaysOnTopGroupIds.delete(groupId);
    forgetPlacement(groupId);
    win.destroy();
    windowLogger.info(`切り離しウィンドウを破棄しました: ${groupId}`);
  }
}

/** 常に最前面かどうか（編集画面の「試しに実行」用） */
export function getDetachedAlwaysOnTop(groupId: string): boolean {
  return temporaryAlwaysOnTopGroupIds.has(groupId) || getDetachedPinLevel(groupId) === 2;
}

/**
 * 編集画面の「試しに実行」用に、一時的に常に最前面にする・元に戻す（📌 の段階は変えず、保存もしない）
 * 一時的に最前面にしている間に人が段階を変えたら、戻すときはその段階のままにする
 * @returns 常に最前面になったら true
 */
export function toggleDetachedAlwaysOnTop(groupId: string): boolean {
  const win = detachedWindows.get(groupId);
  if (!win || win.isDestroyed()) return false;
  if (temporaryAlwaysOnTopGroupIds.delete(groupId)) {
    const onTop = getDetachedPinLevel(groupId) === 2;
    win.setAlwaysOnTop(onTop);
  } else if (getDetachedPinLevel(groupId) !== 2) {
    temporaryAlwaysOnTopGroupIds.add(groupId);
    win.setAlwaysOnTop(true);
  }
  // setAlwaysOnTop が仮想デスクトップ固定をリセットするため再適用
  SettingsService.getInstance()
    .then((ss) => ss.get('detachedVisibleOnAllDesktops'))
    .then((enabled) => applyVirtualDesktopPinToWindow(win, enabled))
    .catch(() => {});
  return getDetachedAlwaysOnTop(groupId);
}

/**
 * 指定グループの切り離しウィンドウを閉じる
 */
export function closeDetachedGroupWindow(groupId: string): { success: boolean } {
  destroyWindowIfAlive(groupId);
  return { success: true };
}

/**
 * すべての切り離しウィンドウを非表示にする（hide）
 * ピンモード 1以上（表示固定/最上面固定）のウィンドウと、編集・確認の子ウィンドウを開いているものはスキップする
 */
export function hideAllDetachedGroupWindows(): { success: boolean } {
  for (const [groupId, win] of detachedWindows.entries()) {
    if (
      !win.isDestroyed() &&
      (detachedPinModes.get(groupId) ?? 0) === 0 &&
      !hasVisibleChildWindow(win)
    ) {
      win.hide();
    }
  }
  return { success: true };
}

/**
 * ピン留めしていない切り離しウィンドウを再表示する（フォーカスを奪わない）
 * ピン留めしたものは出たままなので触らない。ほかのアプリが前面のうちは手前に来ないことがあるので、
 * メインウィンドウにフォーカスを移した後に bringDetachedToFront で手前に出し直す
 * @param options.placeOnMainWindowDisplay true なら、ピン留めしていないウィンドウを表示する前にメインウィンドウと同じディスプレイへ移す
 *   （子ウィンドウを開いていて隠さなかったものは動かさない）
 */
export function showAllDetachedGroupWindows(options?: { placeOnMainWindowDisplay?: boolean }): {
  success: boolean;
} {
  for (const [groupId, win] of detachedWindows.entries()) {
    if (!win.isDestroyed()) {
      const pinMode = detachedPinModes.get(groupId) ?? 0;
      if (pinMode === 0) {
        if (options?.placeOnMainWindowDisplay && !hasVisibleChildWindow(win)) {
          placeOnMainWindowDisplay(groupId, win);
        }
        showWithoutFocus(win);
      }
    }
  }
  return { success: true };
}

/**
 * 表示中の切り離しウィンドウを、ほかのウィンドウの下にあっても手前に出す（ディスプレイの中では動かさない）。
 * 📌 なしのものも対象（showAllDetachedGroupWindows で出しただけでは、ほかのアプリの下に残ることがある）。
 * 別の仮想デスクトップにあれば今のデスクトップへ連れてくる（すべてのデスクトップに表示しない設定のとき）。
 * QDL が前面になってから呼ぶ（ほかのアプリが前面の間は、Windows が並べ替えを無視することがある）
 */
export function bringDetachedToFront(): void {
  for (const win of detachedWindows.values()) {
    if (win.isDestroyed()) continue;
    // Win+D（デスクトップの表示）で最小化されていると、isVisible() は false になり、moveTop() だけでも戻らない（A3-132）
    if (win.isMinimized()) win.showInactive();
    if (win.isVisible()) {
      moveWindowToCurrentDesktop(win.getNativeWindowHandle().readBigUInt64LE());
      win.moveTop();
    }
  }
}

/**
 * すべての切り離しウィンドウを閉じる（アプリ終了時用）
 */
export function closeAllDetachedGroupWindows(): void {
  for (const groupId of detachedWindows.keys()) {
    destroyWindowIfAlive(groupId);
  }
  detachedWindows.clear();
  webContentsIdToGroupId.clear();
}

/**
 * そのグループの切り離しウィンドウが開いているか
 */
export function hasDetachedGroupWindow(groupId: string): boolean {
  const win = detachedWindows.get(groupId);
  return win !== undefined && !win.isDestroyed();
}

/**
 * webContents.id からグループIDを逆引きする
 */
export function getGroupIdByWebContentsId(id: number): string | undefined {
  return webContentsIdToGroupId.get(id);
}

/**
 * 全切り離しウィンドウに仮想デスクトップ固定設定を一括適用する
 */
export async function applyDetachedVisibilityOnAllDesktops(): Promise<void> {
  const settingsService = await SettingsService.getInstance();
  const enabled = await settingsService.get('detachedVisibleOnAllDesktops');
  for (const [, win] of detachedWindows) {
    applyVirtualDesktopPinToWindow(win, enabled);
  }
}

/**
 * 前回開いていた切り離しウィンドウを復元する（存在するグループのみ）
 * @param options.skipFocus trueの場合、フォーカスを奪わずに表示する
 * @param options.startHiddenUnlessPinned trueの場合、📌 なしのものは隠したまま作る（起動時。メインウィンドウと一緒に出る）
 */
export async function restoreDetachedWindows(options?: {
  skipFocus?: boolean;
  startHiddenUnlessPinned?: boolean;
}): Promise<void> {
  try {
    const workspaceService = await WorkspaceService.getInstance();
    const openGroupIds = await workspaceService.loadOpenDetachedGroupIds();
    if (openGroupIds.length === 0) return;

    const groups = await workspaceService.loadGroups();
    // サブグループは切り離さない（以前に切り離したもの・後でサブグループにしたものは、開くと空になる）
    const topLevelGroupIds = new Set(groups.filter((g) => !g.parentGroupId).map((g) => g.id));

    for (const groupId of openGroupIds) {
      if (topLevelGroupIds.has(groupId)) {
        await createDetachedGroupWindow(groupId, undefined, undefined, options);
      } else {
        // 存在しないグループ・サブグループのエントリを削除
        await workspaceService.removeDetachedWindowState(groupId);
      }
    }

    windowLogger.info(
      `切り離しウィンドウを復元しました: ${openGroupIds.length}件中${openGroupIds.filter((id) => topLevelGroupIds.has(id)).length}件`
    );
  } catch (error) {
    windowLogger.error({ error }, '切り離しウィンドウの復元に失敗しました');
  }
}
