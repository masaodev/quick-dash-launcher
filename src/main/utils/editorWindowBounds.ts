/** 矩形（Electron の Rectangle と同じ形） */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** ワークスペースアイテム編集ウィンドウの標準サイズ */
export const EDITOR_WINDOW_SIZE = { width: 850, height: 800 } as const;

/**
 * 編集ウィンドウの位置・サイズを決める
 *
 * 開き元と同じディスプレイの作業領域の中央に置き、作業領域より大きくならないよう切り詰める。
 * 以前のモーダル方式は「プライマリの右端」に決め打ちで位置がずれていたので、必ず開き元の
 * ディスプレイの作業領域を渡すこと
 */
export function calculateEditorBounds(
  workArea: Rect,
  preferred: { width: number; height: number } = EDITOR_WINDOW_SIZE
): Rect {
  const width = Math.min(preferred.width, workArea.width);
  const height = Math.min(preferred.height, workArea.height);
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  };
}
