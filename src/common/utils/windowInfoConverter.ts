import type { LauncherItem, WindowInfo } from '../types';

import { decideWindowMatch, placementFromWindow } from './setWindowMatching';

export interface WindowInfoToPathlessItemOptions {
  /**
   * 今の位置・サイズも記録するか（placement を付ける）。既定は false
   *
   * 記録すると、切り替えるたびに記録した位置へ戻す。既定では「exe 名とタイトルで探して切り替える」だけにする
   */
  includePosition?: boolean;
  /**
   * 仮想デスクトップの数（placementFromWindow と同じ）。2 未満・省略なら仮想デスクトップの番号を記録しない
   * （ワークスペースに追加するときは、切り替えでほかのデスクトップへ引き戻さない）
   */
  desktopCount?: number;
}

/**
 * ウィンドウ検索の結果（開いているウィンドウ）を、パスの無い単一アイテムに変換する
 *
 * 対象ウィンドウは exe 名と、最後の部品（アプリ名と版）を落としたタイトルの一部一致（セットの行に記録するときと同じ decideWindowMatch）。
 * 開くもの（パス）は持たない。exe のパスは使わない（あとで本人がパスを入れれば、開いていないときに開ける）。
 * hwnd は閉じると無効になるので持たない。タイトルが変わるウィンドウ（ブラウザ等）は後で編集して一部だけにする想定
 */
export function windowInfoToPathlessItem(
  info: WindowInfo,
  options: WindowInfoToPathlessItemOptions = {}
): LauncherItem {
  const item: LauncherItem = {
    type: 'windowSwitch',
    displayName: info.title,
    path: '',
    window: decideWindowMatch(info),
  };
  if (options.includePosition) {
    item.placement = placementFromWindow(info, options.desktopCount ?? 0);
  }
  return item;
}
