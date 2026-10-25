import type { ElectronApplication } from '@playwright/test';

/** 撮る範囲で、ウィンドウの周りに取る余白（論理ピクセル） */
export const BACKDROP_MARGIN = 24;

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
 * 最前面には固定しない（撮るウィンドウは setAlwaysOnTop で上に出し、後から開くウィンドウもこの上に出るように）。
 * 敷いた後は focusTitle のウィンドウにフォーカスを戻す
 */
export async function showBackdrop(
  app: ElectronApplication,
  bounds: Bounds,
  focusTitle: string
): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, { b, title }) => {
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
      backdrop.moveTop();
      BrowserWindow.getAllWindows()
        .find((bw) => bw.getTitle() === title)
        ?.focus();
    },
    { b: bounds, title: focusTitle }
  );
}
