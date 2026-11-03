import type { ElectronApplication } from '@playwright/test';

/** 撮る範囲で、ウィンドウの周りに取る余白（論理ピクセル） */
export const BACKDROP_MARGIN = 24;

/**
 * 敷くウィンドウを撮る範囲より外へ広げる幅（論理ピクセル）
 *
 * 枠なしのウィンドウにも Windows 11 は角の丸みと縁を付けるので、範囲ぴったりに敷くと、撮った画像の端（特に上）に
 * 数ピクセル、壁紙が写る。範囲より広く敷いて、端と角を撮る範囲の外に出す
 */
export const BACKDROP_BLEED = 16;

/** 撮る範囲を BACKDROP_BLEED だけ広げた範囲（敷くウィンドウの位置と大きさ） */
export function bleed(bounds: Bounds): Bounds {
  return {
    x: bounds.x - BACKDROP_BLEED,
    y: bounds.y - BACKDROP_BLEED,
    width: bounds.width + BACKDROP_BLEED * 2,
    height: bounds.height + BACKDROP_BLEED * 2,
  };
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 撮る範囲（論理ピクセル）の後ろに色付きの無地のウィンドウを敷く
 *
 * デスクトップの壁紙や他のアプリを写さず、ウィンドウの周りの余白に色を付けるため。
 * 既定では最前面に固定しない（撮るウィンドウは setAlwaysOnTop で上に出し、後から開くウィンドウもこの上に出るように）。
 * 後からウィンドウを開かない撮影は pinned で固定する（撮影中に前へ出た他のアプリが余白に写らないように）。
 * 敷いた後は focusTitle のウィンドウにフォーカスを戻す
 */
export async function showBackdrop(
  app: ElectronApplication,
  bounds: Bounds,
  focusTitle: string,
  options: { pinned?: boolean } = {}
): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, { b, title, pinned }) => {
      const backdrop = new BrowserWindow({
        ...b,
        frame: false,
        resizable: false,
        focusable: false,
        skipTaskbar: true,
        backgroundColor: '#d5deea',
        show: false,
      });
      backdrop.show();
      // pinned: 撮るウィンドウ（screen-saver の最前面）のすぐ下に固定し、撮影中に前へ出た他のアプリが間に入らないようにする
      if (pinned) backdrop.setAlwaysOnTop(true, 'floating');
      backdrop.moveTop();
      BrowserWindow.getAllWindows()
        .find((bw) => bw.getTitle() === title)
        ?.focus();
    },
    { b: bleed(bounds), title: focusTitle, pinned: options.pinned ?? false }
  );
}
