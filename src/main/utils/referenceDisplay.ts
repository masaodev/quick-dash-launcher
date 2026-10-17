import { screen } from 'electron';
import type { Display, Rectangle } from 'electron';

/**
 * 「メインウィンドウと同じディスプレイ」を返す
 *
 * ワークスペースと切り離しウィンドウは、メインウィンドウと同じディスプレイに出す。
 * メインウィンドウを置く処理（windowManager）が bounds の取り出し方を登録する（ここから windowManager を
 * import すると循環するため）。メインウィンドウがまだ無いときは、マウスカーソルのあるディスプレイを返す。
 */

type BoundsProvider = () => Rectangle | null;

let mainWindowBoundsProvider: BoundsProvider | null = null;

export function registerMainWindowBoundsProvider(provider: BoundsProvider): void {
  mainWindowBoundsProvider = provider;
}

export function getMainWindowDisplay(): Display {
  const bounds = mainWindowBoundsProvider?.();
  if (bounds) {
    return screen.getDisplayMatching(bounds);
  }
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}
