import { BrowserWindow, screen } from 'electron';
import { windowLogger } from '@common/logger';

const DEFAULT_SNAP_THRESHOLD = 20;
const WM_EXITSIZEMOVE = 0x0232;

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SnappedPosition {
  x: number;
  y: number;
  snapped: boolean;
}

/**
 * 全ディスプレイのworkAreaに対して吸着位置を計算する
 * いずれかの辺が閾値以内であれば吸着後の座標を返す
 */
export function calculateSnappedPosition(
  newBounds: Bounds,
  threshold: number = DEFAULT_SNAP_THRESHOLD
): SnappedPosition {
  const displays = screen.getAllDisplays();
  let snappedX = newBounds.x;
  let snappedY = newBounds.y;
  let snapped = false;

  const windowRight = newBounds.x + newBounds.width;
  const windowBottom = newBounds.y + newBounds.height;

  for (const display of displays) {
    const workArea = display.workArea;
    const workAreaRight = workArea.x + workArea.width;
    const workAreaBottom = workArea.y + workArea.height;

    // 左辺: ウィンドウ左端 ↔ workArea左端
    if (Math.abs(newBounds.x - workArea.x) < threshold) {
      snappedX = workArea.x;
      snapped = true;
    }
    // 右辺: ウィンドウ右端 ↔ workArea右端
    if (Math.abs(windowRight - workAreaRight) < threshold) {
      snappedX = workAreaRight - newBounds.width;
      snapped = true;
    }
    // 上辺: ウィンドウ上端 ↔ workArea上端
    if (Math.abs(newBounds.y - workArea.y) < threshold) {
      snappedY = workArea.y;
      snapped = true;
    }
    // 下辺: ウィンドウ下端 ↔ workArea下端
    if (Math.abs(windowBottom - workAreaBottom) < threshold) {
      snappedY = workAreaBottom - newBounds.height;
      snapped = true;
    }
  }

  return { x: snappedX, y: snappedY, snapped };
}

/**
 * BrowserWindowにスナップハンドラーを登録する
 * @param win 対象のBrowserWindow
 * @param getEnabled 吸着が有効かどうかを返すコールバック（同期的、キャッシュ値を使用）
 * @returns ハンドラー解除関数
 */
export function attachSnapHandler(win: BrowserWindow, getEnabled: () => boolean): () => void {
  win.hookWindowMessage(WM_EXITSIZEMOVE, () => {
    if (!getEnabled() || win.isDestroyed()) return;

    const bounds = win.getBounds();
    const { x, y, snapped } = calculateSnappedPosition(bounds);
    if (snapped) {
      win.setPosition(x, y);
    }
  });

  windowLogger.info('ウィンドウスナップハンドラーを登録しました');

  return () => {
    if (!win.isDestroyed()) {
      win.unhookWindowMessage(WM_EXITSIZEMOVE);
    }
  };
}
