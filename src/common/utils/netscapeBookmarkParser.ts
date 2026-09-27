/**
 * HTML ブックマークファイル（Netscape Bookmark File Format）の解析
 *
 * Chrome / Edge / Firefox がエクスポートする形式。フォルダは <H3>、その中身は直後の <DL> に
 * 入れ子で並ぶ。<H3> と </DL> でフォルダの出入りを追い、<A HREF> をそのときのフォルダパスに
 * 紐づける。パスは "フォルダ/サブフォルダ" の "/" 区切り（ブラウザ直読みと同じ形。ルート直下の
 * ブックマークは空文字）。ファイルに依存しないので、取込画面のプレビューでも同じ結果になる
 */

import type { BookmarkWithFolder } from '../types/bookmarkAutoImport';

/** HTML エンティティのうちブックマーク名に出やすいものを戻す */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Netscape 形式の HTML からフォルダ付きブックマークを抜き出す
 *
 * http / https 以外の URL（javascript: など）は捨てる。名前が空なら URL を名前にする
 */
export function parseNetscapeBookmarkHtml(htmlContent: string): BookmarkWithFolder[] {
  const bookmarks: BookmarkWithFolder[] = [];
  const folderStack: string[] = [];
  // フォルダの開始（<H3>名前</H3>）、フォルダの終了（</DL>）、ブックマーク（<A HREF>名前</A>）を出現順に拾う
  const tokenRegex = /<H3[^>]*>([^<]*)<\/H3>|<\/DL>|<A\s+[^>]*HREF="([^"]*)"[^>]*>([^<]*)<\/A>/gi;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(htmlContent)) !== null) {
    if (match[1] !== undefined) {
      folderStack.push(decodeHtmlEntities(match[1].trim()));
      continue;
    }
    if (match[2] !== undefined) {
      const url = match[2];
      const name = decodeHtmlEntities(match[3].trim());
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        bookmarks.push({
          displayName: name || url,
          url,
          folderPath: folderStack.join('/'),
        });
      }
      continue;
    }
    // </DL>: ルートの <DL> でも閉じるので、H3 で入ったフォルダがあるときだけ 1 段戻る
    if (folderStack.length > 0) {
      folderStack.pop();
    }
  }

  return bookmarks;
}
