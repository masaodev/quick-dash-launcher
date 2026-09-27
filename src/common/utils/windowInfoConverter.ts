import type { WindowInfo, WindowItem } from '../types';

export interface WindowInfoToWindowItemOptions {
  /**
   * 今の位置・サイズ（x/y/width/height）も記録するか。既定は false
   *
   * 記録すると、アクティブ化のたびに登録時の場所へ戻される。位置の再現は
   * ウィンドウ配置（layout）の役目なので、既定では「タイトルとプロセス名で探して前面に出す」だけにする
   */
  includePosition?: boolean;
}

/**
 * ウィンドウ検索の結果（開いているウィンドウ）を、ワークスペースやデータファイルに登録できる
 * ウィンドウ操作アイテムに変換する
 *
 * hwnd は閉じると無効になるので持たない。タイトルとプロセス名で毎回探し直す方式に合わせる。
 * タイトルが変わるウィンドウ（ブラウザ等）は後で編集してワイルドカード（`*`）にする想定
 */
export function windowInfoToWindowItem(
  info: WindowInfo,
  options: WindowInfoToWindowItemOptions = {}
): WindowItem {
  const item: WindowItem = {
    type: 'window',
    displayName: info.title,
    windowTitle: info.title,
  };
  if (info.processName) {
    item.processName = info.processName;
  }
  if (options.includePosition) {
    item.x = info.x;
    item.y = info.y;
    item.width = info.width;
    item.height = info.height;
  }
  return item;
}
