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

/** スキームと、その後ろの「//ホスト」まで（URL・カスタム URI の、大文字小文字を区別しない部分） */
const URL_HEAD = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i;

/**
 * 「同じアイテム」とみなすパスのキー（前後の空白・末尾の区切り文字の違いを無視し、引数も比べる）。
 * パスが無ければ null（比べない）
 *
 * ファイルのパスは大文字小文字を区別しない（Windows のファイルシステムと同じ）。URL・カスタム URI は
 * スキームとホストだけ区別せず、その後ろ（パス・クエリ）は区別する（`?v=abcDEF` と `?v=ABCdef` は別の動画）
 *
 * 選ぶ画面の「追加済み」、コピーを参照に変えるときの候補、ドロップ・貼り付けで同じアイテムを探すときに同じ判定を使う
 */
export function samePathKey(path: string | undefined, args: string | undefined): string | null {
  const trimmed = (path ?? '').trim().replace(/[\\/]+$/, '');
  if (!trimmed) return null;
  const head = URL_HEAD.exec(trimmed)?.[0];
  const key = head ? head.toLowerCase() + trimmed.slice(head.length) : trimmed.toLowerCase();
  return [key, (args ?? '').trim()].join('\n');
}
