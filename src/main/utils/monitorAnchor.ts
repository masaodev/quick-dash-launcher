import type { MonitorAnchor, MonitorAnchorEdge } from '@common/types';

/**
 * モニターに対するウィンドウの位置（どの基準からどれだけ離れているか）を扱う純粋関数
 *
 * 切り離しウィンドウを「メインウィンドウと同じディスプレイ」に出すときに使う。縦・横それぞれで、
 * 作業領域の端にくっつけたウィンドウは端を、それ以外は作業領域の中央を基準にして、基準からの距離を覚える。
 * 大きさの違うモニターへ移しても、端に寄せたウィンドウは端に出て、メイン（モニターの中央に出る）の横に置いた
 * ウィンドウはメインとの位置関係を保つ。
 */

/** 端にくっつけたとみなす距離（px）。吸着（snapPosition の DEFAULT_SNAP_THRESHOLD）の距離と同じ */
const EDGE_THRESHOLD = 20;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AxisAnchor {
  edge: MonitorAnchorEdge;
  offset: number;
}

function anchorAxis(pos: number, size: number, areaPos: number, areaSize: number): AxisAnchor {
  const startGap = pos - areaPos;
  if (Math.abs(startGap) < EDGE_THRESHOLD) {
    return { edge: 'start', offset: startGap };
  }
  const endGap = areaPos + areaSize - (pos + size);
  if (Math.abs(endGap) < EDGE_THRESHOLD) {
    return { edge: 'end', offset: endGap };
  }
  return { edge: 'center', offset: pos + size / 2 - (areaPos + areaSize / 2) };
}

function placeAxis(
  anchor: AxisAnchor,
  size: number,
  areaPos: number,
  areaSize: number
): { pos: number; size: number } {
  // モニターより大きいウィンドウは、表示するときだけ作業領域の大きさまで縮める
  const fitted = Math.min(size, areaSize);
  let pos: number;
  switch (anchor.edge) {
    case 'start':
      pos = areaPos + anchor.offset;
      break;
    case 'end':
      pos = areaPos + areaSize - anchor.offset - fitted;
      break;
    case 'center':
      pos = areaPos + areaSize / 2 + anchor.offset - fitted / 2;
      break;
  }
  // はみ出す分は作業領域の中へ寄せる
  const clamped = Math.min(Math.max(pos, areaPos), areaPos + areaSize - fitted);
  return { pos: Math.round(clamped), size: fitted };
}

/** ウィンドウの位置を、載っているモニターの作業領域に対する位置として表す */
export function computeMonitorAnchor(bounds: Rect, workArea: Rect): MonitorAnchor {
  const h = anchorAxis(bounds.x, bounds.width, workArea.x, workArea.width);
  const v = anchorAxis(bounds.y, bounds.height, workArea.y, workArea.height);
  return { horizontal: h.edge, offsetX: h.offset, vertical: v.edge, offsetY: v.offset };
}

/** 覚えた位置を、別の（または同じ）モニターの作業領域に当てはめた bounds を返す */
export function placeByMonitorAnchor(
  anchor: MonitorAnchor,
  size: { width: number; height: number },
  workArea: Rect
): Rect {
  const h = placeAxis(
    { edge: anchor.horizontal, offset: anchor.offsetX },
    size.width,
    workArea.x,
    workArea.width
  );
  const v = placeAxis(
    { edge: anchor.vertical, offset: anchor.offsetY },
    size.height,
    workArea.y,
    workArea.height
  );
  return { x: h.pos, y: v.pos, width: h.size, height: v.size };
}

const EDGES: readonly MonitorAnchorEdge[] = ['start', 'center', 'end'];

/** 保存ファイルから読んだ値が MonitorAnchor として使えるか */
export function isMonitorAnchor(raw: unknown): raw is MonitorAnchor {
  if (typeof raw !== 'object' || raw === null) return false;
  const a = raw as Record<string, unknown>;
  return (
    EDGES.includes(a.horizontal as MonitorAnchorEdge) &&
    EDGES.includes(a.vertical as MonitorAnchorEdge) &&
    typeof a.offsetX === 'number' &&
    Number.isFinite(a.offsetX) &&
    typeof a.offsetY === 'number' &&
    Number.isFinite(a.offsetY)
  );
}
