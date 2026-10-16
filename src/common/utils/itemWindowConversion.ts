/**
 * 単一アイテムのウィンドウ切り替えの変換
 *
 * 旧形式の windowConfig（title・processName・x/y/width/height・virtualDesktopNumber・activateWindow・
 * pinToAllDesktops・moveToActiveMonitorCenter）を、セットの行と同じ形（ItemWindowSwitch）に直す。
 *
 * - データファイル・ワークスペースの読み込み時に 1 回だけ書き換える（convertLegacyWindowConfigs）
 * - 移行が保留になった間や古い CLI の --set windowConfig=… は、検証（jsonParser）がその場で直す
 * - 編集画面は B で作り直すまで windowConfig のまま扱うので、読み込み・保存で行き来させる（switchToWindowConfig）
 */
import type {
  ItemWindowSwitch,
  SetPlacement,
  SetWindowMatch,
  WindowConfig,
} from '../types/launcher';
import { isRecord } from '../types/guards';

import { ANY_WINDOW_TITLE } from './windowTitle';

/** ItemWindowSwitch のキー（保存形式のキーの順） */
export const ITEM_WINDOW_SWITCH_KEYS = [
  'window',
  'placement',
  'ifOpen',
  'activateWindow',
  'waitSeconds',
  'pinToAllDesktops',
] as const satisfies readonly (keyof ItemWindowSwitch)[];

/** 旧形式の windowConfig の中身（検証前なので型の合う項目だけ） */
type LegacyWindowConfig = Partial<WindowConfig>;

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * windowConfig を ItemWindowSwitch に直す
 *
 * - title: 空と "*" は「タイトルを問わない」なので書かない（プロセス名だけで探す）
 * - x/y/width/height/virtualDesktopNumber は placement にまとめる（1 つも無ければ placement を付けない）
 * - activateWindow: 省略は今までの既定（前面に出す）なので、true を明示して書く
 * - pinToAllDesktops: true のときだけ書く
 * - moveToActiveMonitorCenter は単一アイテムでは廃止したので捨てる
 *
 * @returns 探すウィンドウ（タイトルかプロセス名）が無ければ undefined（何にも合わない設定だったので持たない）
 */
export function windowConfigToSwitch(wc: LegacyWindowConfig): ItemWindowSwitch | undefined {
  const rawTitle = nonEmpty(wc.title);
  const title =
    rawTitle !== undefined && rawTitle.trim() !== ANY_WINDOW_TITLE ? rawTitle : undefined;
  const processName = nonEmpty(wc.processName);
  if (title === undefined && processName === undefined) return undefined;

  const window: SetWindowMatch = {};
  if (processName !== undefined) window.processName = processName;
  if (title !== undefined) window.title = title;

  const placement: SetPlacement = {};
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const value = finiteNumber(wc[key]);
    if (value !== undefined) placement[key] = value;
  }
  const desktop = finiteNumber(wc.virtualDesktopNumber);
  if (desktop !== undefined && Number.isInteger(desktop) && desktop >= 1) {
    placement.virtualDesktopNumber = desktop;
  }

  return {
    window,
    ...(Object.keys(placement).length > 0 ? { placement } : {}),
    activateWindow: wc.activateWindow !== false,
    ...(wc.pinToAllDesktops === true ? { pinToAllDesktops: true } : {}),
  };
}

/**
 * ItemWindowSwitch を windowConfig に戻す（編集画面の一時つなぎ用。B で編集画面を作り直したら消す）
 *
 * ifOpen・waitSeconds・placement.state は windowConfig に無いので落ちる
 *
 * @returns 探すウィンドウが無ければ undefined
 */
export function switchToWindowConfig(s: ItemWindowSwitch): WindowConfig | undefined {
  if (!s.window?.title && !s.window?.processName) return undefined;
  const p = s.placement ?? {};
  const config: WindowConfig = { title: s.window.title ?? '' };
  if (s.window.processName) config.processName = s.window.processName;
  if (p.x !== undefined) config.x = p.x;
  if (p.y !== undefined) config.y = p.y;
  if (p.width !== undefined) config.width = p.width;
  if (p.height !== undefined) config.height = p.height;
  if (p.virtualDesktopNumber !== undefined) config.virtualDesktopNumber = p.virtualDesktopNumber;
  if (s.activateWindow === false) config.activateWindow = false;
  if (s.pinToAllDesktops) config.pinToAllDesktops = true;
  return config;
}

/**
 * 編集画面の windowConfig を保存する形にする（一時つなぎ。B で編集画面を作り直したら消す）
 *
 * 位置の無い・既定値だけのキーは書かない。前面に出すはチェックの値をそのまま書く
 */
export function windowConfigToSwitchFields(wc: WindowConfig | undefined): ItemWindowSwitch {
  return (wc && windowConfigToSwitch(wc)) || {};
}

/** ウィンドウ切り替えを持つか（探すウィンドウの条件があるか） */
export function hasItemWindowSwitch(item: ItemWindowSwitch): boolean {
  return !!(item.window?.title || item.window?.processName);
}

/** ItemWindowSwitch のキーを除いた形を返す（ウィンドウ切り替えを丸ごと差し替えるとき） */
export function omitItemWindowSwitch<T extends ItemWindowSwitch>(
  source: T
): Omit<T, keyof ItemWindowSwitch> {
  const rest = { ...source } as Record<string, unknown>;
  for (const key of ITEM_WINDOW_SWITCH_KEYS) delete rest[key];
  return rest as Omit<T, keyof ItemWindowSwitch>;
}

/** ItemWindowSwitch のキーだけを写す（値の無いキーは持たない） */
export function pickItemWindowSwitch(source: ItemWindowSwitch): ItemWindowSwitch {
  const result: Record<string, unknown> = {};
  for (const key of ITEM_WINDOW_SWITCH_KEYS) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result as ItemWindowSwitch;
}

/**
 * アイテム（JSON のまま）の windowConfig を新しいキーに置き換える（windowConfig のあった位置に書く）
 *
 * windowConfig が新しいキーと一緒に書かれていたら windowConfig を優先する（古い CLI で書き直した、など）。
 * ifOpen・waitSeconds は windowConfig に無いので、あれば残す
 *
 * @returns 置き換えた形。windowConfig がオブジェクトでなければ undefined（検証で不正として扱う）
 */
export function replaceWindowConfig(
  raw: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!isRecord(raw.windowConfig)) return undefined;
  const converted = windowConfigToSwitch(raw.windowConfig as LegacyWindowConfig);
  const switchKeys = new Set<string>(ITEM_WINDOW_SWITCH_KEYS);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'windowConfig') {
      if (!converted) continue;
      Object.assign(result, converted);
      if (raw.ifOpen !== undefined) result.ifOpen = raw.ifOpen;
      if (raw.waitSeconds !== undefined) result.waitSeconds = raw.waitSeconds;
    } else if (!switchKeys.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

function isLegacyWindowConfigItem(item: unknown): item is Record<string, unknown> {
  return isRecord(item) && item.type === 'item' && item.windowConfig !== undefined;
}

/** 旧形式の windowConfig を持つ単一アイテムを含むか */
export function hasLegacyWindowConfig(items: unknown): boolean {
  return Array.isArray(items) && items.some(isLegacyWindowConfigItem);
}

/**
 * アイテムの配列（JSON のまま）の中の windowConfig を新しいキーに置き換える
 *
 * windowConfig がオブジェクトでないもの（壊れたもの）はそのまま残す（読み込みで不正なアイテムとして扱われる）
 */
export function convertLegacyWindowConfigs(items: unknown[]): {
  items: unknown[];
  changed: boolean;
} {
  let changed = false;
  const result = items.map((raw) => {
    if (!isLegacyWindowConfigItem(raw)) return raw;
    const replaced = replaceWindowConfig(raw);
    if (!replaced) return raw;
    changed = true;
    return replaced;
  });
  return { items: result, changed };
}
