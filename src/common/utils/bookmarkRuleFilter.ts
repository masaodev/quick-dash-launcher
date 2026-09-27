/**
 * ブックマーク取込ルールの絞り込みと表示名生成
 *
 * メインプロセス（自動取込の実行）とレンダラー（取込画面の常時プレビュー）の両方で使うので、
 * ファイルや IPC に依存しない純粋関数だけを置く
 */

import type {
  BookmarkAutoImportRule,
  BookmarkFolder,
  BookmarkWithFolder,
} from '../types/bookmarkAutoImport';

/** 絞り込みに使うルールの項目 */
export type BookmarkRuleFilter = Pick<
  BookmarkAutoImportRule,
  'folderPaths' | 'folderFilterMode' | 'includeSubfolders' | 'urlPattern' | 'namePattern'
>;

/** 表示名の生成に使うルールの項目 */
export type BookmarkRuleNaming = Pick<
  BookmarkAutoImportRule,
  'prefix' | 'suffix' | 'folderNameMode'
>;

/** 正規表現として解釈できなければ null（無効なパターンは「絞り込まない」扱い） */
function compilePattern(pattern: string): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}

/** ルールの URL・名前パターンが正規表現として妥当かを返す（画面での警告用） */
export function validateBookmarkRulePatterns(
  rule: Pick<BookmarkRuleFilter, 'urlPattern' | 'namePattern'>
): {
  urlPatternValid: boolean;
  namePatternValid: boolean;
} {
  const isValid = (pattern: string) => !pattern || compilePattern(pattern) !== null;
  return {
    urlPatternValid: isValid(rule.urlPattern),
    namePatternValid: isValid(rule.namePattern),
  };
}

/**
 * ルールの条件でブックマークを絞り込む
 *
 * - フォルダ: 未選択なら全フォルダ。選択があれば「選択フォルダのみ」か「選択フォルダを除外」。
 *   includeSubfolders ならサブフォルダも同じ扱い
 * - URL・名前パターン: 正規表現（大文字小文字を区別しない）。無効な正規表現は無視する
 */
export function applyBookmarkRuleFilters(
  bookmarks: BookmarkWithFolder[],
  rule: BookmarkRuleFilter
): BookmarkWithFolder[] {
  let filtered = bookmarks;

  if (rule.folderPaths.length > 0) {
    const matchesFolder = (folderPath: string, filterPath: string): boolean => {
      if (rule.includeSubfolders) {
        return folderPath === filterPath || folderPath.startsWith(filterPath + '/');
      }
      return folderPath === filterPath;
    };
    const inSelected = (b: BookmarkWithFolder) =>
      rule.folderPaths.some((fp) => matchesFolder(b.folderPath, fp));
    filtered =
      rule.folderFilterMode === 'include'
        ? filtered.filter(inSelected)
        : filtered.filter((b) => !inSelected(b));
  }

  const urlRegex = compilePattern(rule.urlPattern);
  if (urlRegex) {
    filtered = filtered.filter((b) => urlRegex.test(b.url));
  }

  const nameRegex = compilePattern(rule.namePattern);
  if (nameRegex) {
    filtered = filtered.filter((b) => nameRegex.test(b.displayName));
  }

  return filtered;
}

/**
 * ブックマークの表示名を生成する（フォルダ名付与 → 接頭辞・接尾辞）
 */
export function buildBookmarkDisplayName(
  bookmark: BookmarkWithFolder,
  rule: BookmarkRuleNaming
): string {
  let name = bookmark.displayName;

  if (rule.folderNameMode !== 'none' && bookmark.folderPath) {
    let folderLabel = '';
    switch (rule.folderNameMode) {
      case 'parent':
        folderLabel = bookmark.folderPath.split('/').pop() || '';
        break;
      case 'fullPath':
        folderLabel = bookmark.folderPath;
        break;
      case 'relativePath': {
        const parts = bookmark.folderPath.split('/');
        folderLabel = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
        break;
      }
    }
    if (folderLabel) {
      name = `[${folderLabel}] ${name}`;
    }
  }

  if (rule.prefix) name = rule.prefix + name;
  if (rule.suffix) name = name + rule.suffix;

  return name;
}

/**
 * フォルダパス付きブックマークの一覧からフォルダツリーを組み立てる
 *
 * パスは "bookmark_bar/開発/Tools" のように "/" 区切り。ブックマークを直接含まない中間フォルダも
 * ツリーに出す（bookmarkCount は直下のブックマーク数）。順序は最初に現れた順
 */
export function buildBookmarkFolderTree(bookmarks: BookmarkWithFolder[]): BookmarkFolder[] {
  const roots: BookmarkFolder[] = [];
  const byPath = new Map<string, BookmarkFolder>();

  const ensureFolder = (folderPath: string): BookmarkFolder => {
    const existing = byPath.get(folderPath);
    if (existing) return existing;
    const slash = folderPath.lastIndexOf('/');
    const name = slash >= 0 ? folderPath.slice(slash + 1) : folderPath;
    const folder: BookmarkFolder = { path: folderPath, name, children: [], bookmarkCount: 0 };
    byPath.set(folderPath, folder);
    if (slash >= 0) {
      ensureFolder(folderPath.slice(0, slash)).children.push(folder);
    } else {
      roots.push(folder);
    }
    return folder;
  };

  for (const bookmark of bookmarks) {
    if (!bookmark.folderPath) continue;
    ensureFolder(bookmark.folderPath).bookmarkCount += 1;
  }

  return roots;
}
