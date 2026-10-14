/**
 * セットの置き場所（座標）から「右上」「左半分」などの位置の表示を計算する
 *
 * 言葉はデータに保存せず、表示のたびに今の画面構成から計算する。
 * 座標はウィンドウの外枠（GetWindowRect）の物理ピクセルなので、画面の作業領域も物理ピクセルで渡す。
 */
import type { SetPlacement } from '../types/launcher';

/** 矩形（物理ピクセル） */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 画面 1 枚。bounds＝画面全体、workArea＝タスクバーを除いた範囲 */
export interface ScreenArea {
  bounds: PixelRect;
  workArea: PixelRect;
}

/** Windows 11 のスナップレイアウトで選べる形 */
export type PlacementShape =
  | 'full'
  | 'leftHalf'
  | 'rightHalf'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'leftThird'
  | 'centerThird'
  | 'rightThird'
  | 'leftTwoThirds'
  | 'rightTwoThirds';

/** どの形にも当てはまらないときの 9 マスの名前 */
export type PlacementRegion =
  | 'topLeft'
  | 'top'
  | 'topRight'
  | 'left'
  | 'center'
  | 'right'
  | 'bottomLeft'
  | 'bottom'
  | 'bottomRight';

/**
 * 位置の表示。screenNumber は画面が 2 枚以上あるときだけ付く（左から 1, 2, …）
 */
export type PlacementLabel =
  | { kind: 'maximized'; screenNumber?: number }
  | { kind: 'shape'; shape: PlacementShape; screenNumber?: number }
  | {
      kind: 'region';
      region: PlacementRegion;
      width: number;
      height: number;
      screenNumber?: number;
    }
  /** 今つながっているどの画面にも入らない（記録したときの画面が外れた） */
  | { kind: 'offscreen' }
  /** 座標を持たない（位置を変えない置き場所） */
  | { kind: 'none' };

/** 各辺のずれの許容幅（作業領域に対する割合）。見えない枠（数 px）の分を吸収する */
export const PLACEMENT_SHAPE_TOLERANCE = 0.03;

/** 形ごとの左・上・右・下（作業領域に対する割合） */
const SHAPES: readonly { shape: PlacementShape; l: number; t: number; r: number; b: number }[] = [
  { shape: 'full', l: 0, t: 0, r: 1, b: 1 },
  { shape: 'leftHalf', l: 0, t: 0, r: 1 / 2, b: 1 },
  { shape: 'rightHalf', l: 1 / 2, t: 0, r: 1, b: 1 },
  { shape: 'topLeft', l: 0, t: 0, r: 1 / 2, b: 1 / 2 },
  { shape: 'topRight', l: 1 / 2, t: 0, r: 1, b: 1 / 2 },
  { shape: 'bottomLeft', l: 0, t: 1 / 2, r: 1 / 2, b: 1 },
  { shape: 'bottomRight', l: 1 / 2, t: 1 / 2, r: 1, b: 1 },
  { shape: 'leftThird', l: 0, t: 0, r: 1 / 3, b: 1 },
  { shape: 'centerThird', l: 1 / 3, t: 0, r: 2 / 3, b: 1 },
  { shape: 'rightThird', l: 2 / 3, t: 0, r: 1, b: 1 },
  { shape: 'leftTwoThirds', l: 0, t: 0, r: 2 / 3, b: 1 },
  { shape: 'rightTwoThirds', l: 1 / 3, t: 0, r: 1, b: 1 },
];

const REGIONS: readonly PlacementRegion[][] = [
  ['topLeft', 'top', 'topRight'],
  ['left', 'center', 'right'],
  ['bottomLeft', 'bottom', 'bottomRight'],
];

function contains(rect: PixelRect, px: number, py: number): boolean {
  return px >= rect.x && px < rect.x + rect.width && py >= rect.y && py < rect.y + rect.height;
}

/** 画面を左から（同じなら上から）並べる */
function sortScreens(screens: readonly ScreenArea[]): ScreenArea[] {
  return [...screens].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
}

/**
 * 置き場所の位置の表示を計算する
 *
 * 1. ウィンドウの中心点が入っている画面を選ぶ（どこにも入らなければ offscreen）
 * 2. その画面の作業領域に対する割合に直す
 * 3. 12 の形と比べ、各辺のずれが許容幅以内ならその形
 * 4. 当てはまらなければ、中心が入る 9 マスの名前と大きさ
 */
export function computePlacementLabel(
  placement: SetPlacement,
  screens: readonly ScreenArea[]
): PlacementLabel {
  const { x, y, width, height } = placement;
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return { kind: 'none' };
  }

  const sorted = sortScreens(screens);
  const cx = x + width / 2;
  const cy = y + height / 2;
  const index = sorted.findIndex((s) => contains(s.bounds, cx, cy));
  if (index === -1) return { kind: 'offscreen' };

  const screenNumber = sorted.length > 1 ? index + 1 : undefined;
  const withScreen = <T extends object>(label: T): T & { screenNumber?: number } =>
    screenNumber === undefined ? label : { ...label, screenNumber };

  if (placement.state === 'maximized') return withScreen({ kind: 'maximized' as const });

  // 作業領域が取れていない（幅か高さが 0）ときは画面全体で計算する（割り算が NaN にならないように）
  const work = sorted[index].workArea;
  const area = work.width > 0 && work.height > 0 ? work : sorted[index].bounds;
  const l = (x - area.x) / area.width;
  const t = (y - area.y) / area.height;
  const r = (x + width - area.x) / area.width;
  const b = (y + height - area.y) / area.height;

  const tol = PLACEMENT_SHAPE_TOLERANCE;
  const match = SHAPES.find(
    (s) =>
      Math.abs(s.l - l) <= tol &&
      Math.abs(s.t - t) <= tol &&
      Math.abs(s.r - r) <= tol &&
      Math.abs(s.b - b) <= tol
  );
  if (match) return withScreen({ kind: 'shape' as const, shape: match.shape });

  const col = Math.min(2, Math.max(0, Math.floor(((cx - area.x) / area.width) * 3)));
  const row = Math.min(2, Math.max(0, Math.floor(((cy - area.y) / area.height) * 3)));
  return withScreen({ kind: 'region' as const, region: REGIONS[row][col], width, height });
}
