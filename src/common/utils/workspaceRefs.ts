/**
 * ワークスペースの参照アイテムまわりの判定（メインプロセスと画面で共用）
 */
import type { AppItem, ClipboardItem, LauncherItem, SetItem } from '../types';
import { isLauncherItem, isWindowInfo } from '../types/guards';

/** 参照できるランチャーのアイテム（ウィンドウ検索の結果は除く） */
export type ReferenceableAppItem = LauncherItem | ClipboardItem | SetItem;

/** 参照できるランチャーのアイテムか（id を持つ通常アイテム・クリップボード・セット。展開したものは除く） */
export function isReferenceableAppItem(item: AppItem): item is ReferenceableAppItem {
  if (isWindowInfo(item)) return false;
  if (!item.id) return false;
  if (isLauncherItem(item) && (item.isDirExpanded || item.expandedFromId)) return false;
  return true;
}

/**
 * 「同じアイテム」とみなすパスのキー（大文字小文字・前後の空白・末尾の区切り文字の違いを無視し、引数も比べる）。
 * パスが無ければ null（比べない）
 *
 * 選ぶ画面の「追加済み」と、コピーを参照に変えるときの候補で同じ判定を使う
 */
export function samePathKey(path: string | undefined, args: string | undefined): string | null {
  const trimmed = (path ?? '').trim().replace(/[\\/]+$/, '');
  if (!trimmed) return null;
  return [trimmed.toLowerCase(), (args ?? '').trim()].join('\n');
}
