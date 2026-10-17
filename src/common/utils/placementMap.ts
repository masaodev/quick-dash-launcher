/**
 * ウィンドウ位置の図（ミニマップ）の配置を計算する
 *
 * 今つながっている画面を実物の大きさと並びのまま縮め、記録した位置を重ねる。
 * 座標は placementLabel.ts と同じく物理ピクセル。画面の番号も言葉と同じく左から（同じなら上から）振る。
 */
import type { SetPlacement } from '../types/launcher';

import {
  screenIndexOfCenter,
  sortScreens,
  type PixelRect,
  type ScreenArea,
} from './placementLabel';

/** 図に重ねるウィンドウ位置。before＝前の位置（位置を更新の確認で破線にする） */
export interface MapPlacementInput {
  placement: SetPlacement;
  variant?: 'current' | 'before';
  /** 四角の中に描く短い印（セット全体の図の行番号） */
  tag?: string;
}

/** 図の中の画面（図の座標） */
export interface MapScreen extends PixelRect {
  /** 左から 1, 2, …（言葉の「画面 N」と同じ） */
  number: number;
  /** タスクバーなど作業領域の外の部分（無ければ空） */
  outside: PixelRect[];
  /** current のウィンドウが乗っている */
  active: boolean;
}

/** 図の中のウィンドウ位置（図の座標） */
export interface MapWindow extends PixelRect {
  variant: 'current' | 'before';
  /** 今つながっているどの画面にも入らない */
  offscreen: boolean;
  /** 入力の何番目か */
  index: number;
  tag?: string;
}

export interface MinimapLayout {
  /** 図の大きさ（fit なら中身の縦横比に合わせて width×height より小さくなる） */
  width: number;
  height: number;
  screens: MapScreen[];
  windows: MapWindow[];
}

/** 図に描ける位置か（座標と大きさがそろっている。デスクトップ番号や最大化だけの位置は描けない） */
export function hasPlacementRect(
  placement: SetPlacement | undefined
): placement is SetPlacement & { x: number; y: number; width: number; height: number } {
  return (
    placement?.x !== undefined &&
    placement.y !== undefined &&
    placement.width !== undefined &&
    placement.height !== undefined
  );
}

/** 作業領域の外（上下左右の帯）を矩形で返す */
function outsideOfWorkArea(screen: ScreenArea): PixelRect[] {
  const b = screen.bounds;
  const w = screen.workArea;
  if (w.width <= 0 || w.height <= 0) return [];
  const rects: PixelRect[] = [
    { x: b.x, y: b.y, width: b.width, height: w.y - b.y },
    { x: b.x, y: w.y + w.height, width: b.width, height: b.y + b.height - (w.y + w.height) },
    { x: b.x, y: w.y, width: w.x - b.x, height: w.height },
    { x: w.x + w.width, y: w.y, width: b.x + b.width - (w.x + w.width), height: w.height },
  ];
  return rects.filter((r) => r.width > 0 && r.height > 0);
}

/**
 * 図の配置を計算する
 *
 * 画面と、どの画面にも入らないウィンドウ位置が全部収まるよう、width×height の枠に縦横同じ倍率で縮めて中央に置く。
 * fit なら、図の大きさを中身の縦横比に合わせて縮める（横長の並びで上下が空かないように）。
 * 最大化のウィンドウは、乗っている画面の作業領域いっぱいに描く。座標を持たない位置は描かない。
 * 画面の情報が無ければ null（図を出さない）
 */
export function computeMinimapLayout(
  screens: readonly ScreenArea[],
  placements: readonly MapPlacementInput[],
  width: number,
  height: number,
  padding = 2,
  fit = false
): MinimapLayout | null {
  if (screens.length === 0) return null;
  const sorted = sortScreens(screens);

  const rects = placements.flatMap((p, index) => {
    if (!hasPlacementRect(p.placement)) return [];
    const { x, y, width: w, height: h } = p.placement;
    let rect: PixelRect = { x, y, width: w, height: h };
    const screenIndex = screenIndexOfCenter(rect, sorted);
    if (p.placement.state === 'maximized' && screenIndex !== -1) {
      const work = sorted[screenIndex].workArea;
      rect = work.width > 0 && work.height > 0 ? { ...work } : { ...sorted[screenIndex].bounds };
    }
    return [{ rect, screenIndex, variant: p.variant ?? 'current', index, tag: p.tag }];
  });

  const all = [...sorted.map((s) => s.bounds), ...rects.map((r) => r.rect)];
  const x0 = Math.min(...all.map((r) => r.x));
  const y0 = Math.min(...all.map((r) => r.y));
  const x1 = Math.max(...all.map((r) => r.x + r.width));
  const y1 = Math.max(...all.map((r) => r.y + r.height));
  const scale = Math.min((width - padding * 2) / (x1 - x0), (height - padding * 2) / (y1 - y0));
  const outWidth = fit ? Math.ceil((x1 - x0) * scale + padding * 2) : width;
  const outHeight = fit ? Math.ceil((y1 - y0) * scale + padding * 2) : height;
  const offsetX = (outWidth - (x1 - x0) * scale) / 2;
  const offsetY = (outHeight - (y1 - y0) * scale) / 2;
  const map = (r: PixelRect): PixelRect => ({
    x: offsetX + (r.x - x0) * scale,
    y: offsetY + (r.y - y0) * scale,
    width: r.width * scale,
    height: r.height * scale,
  });

  const active = new Set(
    rects.filter((r) => r.variant === 'current' && r.screenIndex !== -1).map((r) => r.screenIndex)
  );
  return {
    width: outWidth,
    height: outHeight,
    screens: sorted.map((s, i) => ({
      ...map(s.bounds),
      number: i + 1,
      outside: outsideOfWorkArea(s).map(map),
      active: active.has(i),
    })),
    windows: rects.map((r) => ({
      ...map(r.rect),
      variant: r.variant,
      offscreen: r.screenIndex === -1,
      index: r.index,
      ...(r.tag !== undefined ? { tag: r.tag } : {}),
    })),
  };
}
