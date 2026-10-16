/**
 * ブックマーク取込画面（アイテム管理から）の選択を、自動取込のルールに置き換えるための純粋関数
 *
 * 画面ではフォルダや 1 件ずつのチェックで選ぶ。選んだ中身が「いくつかのフォルダの中身ぜんぶ」になっているときだけ、
 * そのフォルダ（サブフォルダ込み）を取り込むルールにできる。全部を選んでいれば「すべてのフォルダ」のルールにする
 */

import type { BookmarkWithFolder } from '../types/bookmarkAutoImport';

export interface SelectionAsRule {
  /** ルールにできるか（何も選んでいない、または 1 件ずつ選んだ分が混ざっているときは false） */
  ok: boolean;
  /** すべてのブックマークを選んでいる（ルールの folderPaths は空＝あとから増えたフォルダも対象） */
  allFolders: boolean;
  /** ルールの folderPaths（選んだフォルダのうち一番上のもの。allFolders のときは空） */
  folderPaths: string[];
}

/** folderPath がフォルダ path の中（サブフォルダ込み）にあるか */
export function isInFolder(folderPath: string, path: string): boolean {
  return folderPath === path || folderPath.startsWith(path + '/');
}

/** 一覧に出てくるフォルダの path をすべて返す（中間フォルダも含む。最初に現れた順） */
function collectFolderPaths(bookmarks: BookmarkWithFolder[]): string[] {
  const seen = new Set<string>();
  for (const bookmark of bookmarks) {
    if (!bookmark.folderPath) continue;
    const parts = bookmark.folderPath.split('/');
    for (let i = 1; i <= parts.length; i++) seen.add(parts.slice(0, i).join('/'));
  }
  return [...seen];
}

/**
 * 選んだブックマーク（一覧の位置）を、フォルダ単位のルールに置き換えられるかを調べる
 */
export function selectionAsRule(
  bookmarks: BookmarkWithFolder[],
  selected: ReadonlySet<number>
): SelectionAsRule {
  const selectedCount = bookmarks.filter((_, index) => selected.has(index)).length;
  if (selectedCount === 0) return { ok: false, allFolders: false, folderPaths: [] };
  if (selectedCount === bookmarks.length) return { ok: true, allFolders: true, folderPaths: [] };

  // フォルダごとに、中のブックマーク（サブフォルダ込み）の数と選んだ数を 1 回のなめで数える
  const totals = new Map<string, { all: number; chosen: number }>();
  bookmarks.forEach((bookmark, index) => {
    if (!bookmark.folderPath) return;
    const parts = bookmark.folderPath.split('/');
    for (let depth = 1; depth <= parts.length; depth++) {
      const path = parts.slice(0, depth).join('/');
      const entry = totals.get(path) ?? { all: 0, chosen: 0 };
      entry.all++;
      if (selected.has(index)) entry.chosen++;
      totals.set(path, entry);
    }
  });
  const fullFolders = new Set(
    collectFolderPaths(bookmarks).filter((path) => {
      const entry = totals.get(path);
      return entry !== undefined && entry.all > 0 && entry.chosen === entry.all;
    })
  );
  const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')));
  const topFolders = [...fullFolders].filter((path) => !fullFolders.has(parentOf(path)));
  const covered = bookmarks.every(
    (bookmark, index) =>
      !selected.has(index) || topFolders.some((path) => isInFolder(bookmark.folderPath, path))
  );
  return { ok: covered, allFolders: false, folderPaths: covered ? topFolders : [] };
}
