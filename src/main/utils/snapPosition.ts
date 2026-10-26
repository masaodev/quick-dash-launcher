/**
 * 吸着後の位置を計算する（Electron に依存しない計算だけ。ウィンドウへの当て込みは windowSnap）
 *
 * - ディスプレイの作業領域: 内側の同じ辺どうし（左端と左端など）を揃える
 * - ほかのウィンドウ: 外側の辺どうしをくっつける（自分の右端を相手の左端に、など）か、同じ辺どうしを揃える。
 *   相手と縦（横の吸着なら）・横（縦の吸着なら）の範囲が重なるか近いときだけ吸着する
 *
 * 横（x）と縦（y）は別々に、閾値未満でいちばん近い候補へ寄せる。
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnappedPosition {
  x: number;
  y: number;
  snapped: boolean;
}

/** 吸着する距離（px）。この距離未満なら寄せる */
export const DEFAULT_SNAP_THRESHOLD = 20;

/** 範囲 [aStart, aEnd) と [bStart, bEnd) が、margin を含めて重なるか */
function rangesNear(aStart: number, aEnd: number, bStart: number, bEnd: number, margin: number) {
  return aStart < bEnd + margin && aEnd > bStart - margin;
}

/** 候補のうち、現在値から閾値未満でいちばん近いものを返す（無ければ null） */
function nearest(current: number, candidates: number[], threshold: number): number | null {
  let best: number | null = null;
  let bestDistance = threshold;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - current);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * 吸着後の位置を返す
 * @param bounds 動かしたウィンドウの位置と大きさ
 * @param workAreas 全ディスプレイの作業領域
 * @param windowRects 吸着先にするほかのウィンドウ（表示中のもの）
 */
export function computeSnappedPosition(
  bounds: Rect,
  workAreas: Rect[],
  windowRects: Rect[],
  threshold: number = DEFAULT_SNAP_THRESHOLD
): SnappedPosition {
  const { x, y, width, height } = bounds;
  const right = x + width;
  const bottom = y + height;

  // 候補はどれも「動かしたウィンドウの x（または y）をいくつにするか」で持つ
  const xCandidates: number[] = [];
  const yCandidates: number[] = [];

  for (const area of workAreas) {
    xCandidates.push(area.x, area.x + area.width - width);
    yCandidates.push(area.y, area.y + area.height - height);
  }

  for (const target of windowRects) {
    const targetRight = target.x + target.width;
    const targetBottom = target.y + target.height;

    if (rangesNear(y, bottom, target.y, targetBottom, threshold)) {
      // くっつける（相手の右・左に並べる）、揃える（左端・右端）
      xCandidates.push(targetRight, target.x - width, target.x, targetRight - width);
    }
    if (rangesNear(x, right, target.x, targetRight, threshold)) {
      // くっつける（相手の下・上に並べる）、揃える（上端・下端）
      yCandidates.push(targetBottom, target.y - height, target.y, targetBottom - height);
    }
  }

  const snappedX = nearest(x, xCandidates, threshold);
  const snappedY = nearest(y, yCandidates, threshold);

  return {
    x: snappedX ?? x,
    y: snappedY ?? y,
    snapped: (snappedX !== null && snappedX !== x) || (snappedY !== null && snappedY !== y),
  };
}
