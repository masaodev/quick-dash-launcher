/**
 * 単一アイテムのウィンドウ切り替えの変換
 *
 * 旧形式の windowConfig（title・processName・x/y/width/height・virtualDesktopNumber・activateWindow・
 * pinToAllDesktops・moveToActiveMonitorCenter）を、セットの行と同じ形（ItemWindowSwitch）に直す。
 *
 * - データファイル・ワークスペースの読み込み時に 1 回だけ書き換える（convertLegacyWindowConfigs）
 * - 移行が保留になった間や古い CLI の --set windowConfig=… は、検証（jsonParser）がその場で直す
 * - 登録・編集画面は ItemWindowSwitch のキーをそのまま持つ（保存するときは itemWindowSwitchFields で写す）
 *
 * 廃止した種別「ウィンドウ操作」（type: 'window'）も、同じ読み込み時にパスの無い単一アイテムに変換する
 * （windowItemToPathlessItem。id は変えないので、セットの行はそのまま変換後のアイテムを指す）
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
 * ItemWindowSwitch を windowConfig に戻す（セットの行がアイテムのウィンドウ切り替えを借りるとき、
 * ウィンドウを探して前面に出す処理（windowActivator）に渡す形にする）
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
 * 登録・編集画面の値から、保存するウィンドウ切り替えのキーを写す
 *
 * 対象ウィンドウ（exe 名かタイトル）が無ければ何も書かない（ウィンドウ位置などだけ残っていても、
 * 探す相手が無いので使えない）。値の無いキーは書かない
 */
export function itemWindowSwitchFields(source: ItemWindowSwitch): ItemWindowSwitch {
  return hasItemWindowSwitch(source) ? pickItemWindowSwitch(source) : {};
}

/** ウィンドウ切り替えを持つか（探すウィンドウの条件があるか） */
export function hasItemWindowSwitch(item: ItemWindowSwitch): boolean {
  return !!(item.window?.title || item.window?.processName);
}

/**
 * パスの無い単一アイテムか（path が空で、対象ウィンドウがある）
 *
 * 開くものが無いので、開いたときは合うウィンドウが開いていれば切り替えるだけ（無ければ何も開かない）
 */
export function isPathlessItem(item: { path?: string } & ItemWindowSwitch): boolean {
  return !item.path?.trim() && hasItemWindowSwitch(item);
}

/**
 * 対象ウィンドウを 1 語で表す（パスの無い単一アイテムの、パスの代わりの表示に使う）
 *
 * exe 名とタイトルの両方があれば「exe 名 / タイトル」。どちらも無ければ空
 */
export function describeWindowMatch(match: SetWindowMatch | undefined): string {
  return [match?.processName, match?.title].filter((v): v is string => !!v).join(' / ');
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

/** ウィンドウ操作アイテムだけが持つキー（パスの無い単一アイテムに変換するときに置き換える） */
const WINDOW_ITEM_KEYS = new Set<string>([
  'type',
  'windowTitle',
  'processName',
  'x',
  'y',
  'width',
  'height',
  'virtualDesktopNumber',
  'moveToActiveMonitorCenter',
  'activateWindow',
  'pinToAllDesktops',
]);

/** 変換後のアイテムで先頭に並べるキー（保存形式の単一アイテムの順） */
const PATHLESS_HEAD_KEYS = ['id', 'type', 'displayName', 'path'] as const;

/**
 * 廃止した種別「ウィンドウ操作」（type: 'window'）のアイテム（JSON のまま）を、パスの無い単一アイテムにする
 *
 * - windowTitle → window.title（空・"*" は書かない＝タイトルを問わない。windowConfigToSwitch と同じ解釈）、
 *   processName → window.processName。ただし exe 名が無く、タイトルが "*" だけのときは "*" を残す（どのウィンドウにも
 *   合う指定だったので、そのまま動くようにする）
 * - x/y/width/height/virtualDesktopNumber → placement（1 つも無ければ付けない）
 * - activateWindow は false のときだけ書く（単一アイテムの既定も前面に出す）。pinToAllDesktops は true のときだけ書く
 * - moveToActiveMonitorCenter は単一アイテムでは廃止したので捨てる
 * - id・displayName・customIcon・memo・updatedAt、ワークスペースの所属・並び順などはそのまま残す
 */
export function windowItemToPathlessItem(raw: Record<string, unknown>): Record<string, unknown> {
  const converted = windowConfigToSwitch({
    title: typeof raw.windowTitle === 'string' ? raw.windowTitle : '',
    processName: typeof raw.processName === 'string' ? raw.processName : undefined,
    x: raw.x as number | undefined,
    y: raw.y as number | undefined,
    width: raw.width as number | undefined,
    height: raw.height as number | undefined,
    virtualDesktopNumber: raw.virtualDesktopNumber as number | undefined,
    activateWindow: raw.activateWindow === false ? false : undefined,
    pinToAllDesktops: raw.pinToAllDesktops === true ? true : undefined,
  });
  const switchFields: Record<string, unknown> = converted ? { ...converted } : {};
  if (!converted && typeof raw.windowTitle === 'string' && raw.windowTitle.trim() !== '') {
    // タイトルが "*" だけ（exe 名なし）: 探す条件を残す
    switchFields.window = { title: raw.windowTitle };
  }
  // 単一アイテムの既定は前面に出すので、true は書かない
  if (switchFields.activateWindow === true) delete switchFields.activateWindow;

  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (WINDOW_ITEM_KEYS.has(key) || (PATHLESS_HEAD_KEYS as readonly string[]).includes(key)) {
      continue;
    }
    rest[key] = value;
  }
  return {
    ...(raw.id !== undefined ? { id: raw.id } : {}),
    type: 'item',
    ...(raw.displayName !== undefined ? { displayName: raw.displayName } : {}),
    path: '',
    ...rest,
    ...switchFields,
  };
}

function isLegacyWindowConfigItem(item: unknown): item is Record<string, unknown> {
  return isRecord(item) && item.type === 'item' && item.windowConfig !== undefined;
}

function isLegacyWindowItem(item: unknown): item is Record<string, unknown> {
  return isRecord(item) && item.type === 'window';
}

/** 旧形式の windowConfig を持つ単一アイテム、または廃止したウィンドウ操作アイテムを含むか */
export function hasLegacyWindowConfig(items: unknown): boolean {
  return (
    Array.isArray(items) &&
    items.some((item) => isLegacyWindowConfigItem(item) || isLegacyWindowItem(item))
  );
}

/**
 * アイテムの配列（JSON のまま）の中の windowConfig を新しいキーに置き換え、ウィンドウ操作アイテムを
 * パスの無い単一アイテムにする
 *
 * windowConfig がオブジェクトでないもの（壊れたもの）はそのまま残す（読み込みで不正なアイテムとして扱われる）
 */
export function convertLegacyWindowConfigs(items: unknown[]): {
  items: unknown[];
  changed: boolean;
} {
  let changed = false;
  const result = items.map((raw) => {
    if (isLegacyWindowItem(raw)) {
      changed = true;
      return windowItemToPathlessItem(raw);
    }
    if (!isLegacyWindowConfigItem(raw)) return raw;
    const replaced = replaceWindowConfig(raw);
    if (!replaced) return raw;
    changed = true;
    return replaced;
  });
  return { items: result, changed };
}
