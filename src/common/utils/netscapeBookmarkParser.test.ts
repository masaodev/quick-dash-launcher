import { describe, it, expect } from 'vitest';

import { parseNetscapeBookmarkHtml } from './netscapeBookmarkParser';

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1" LAST_MODIFIED="2" PERSONAL_TOOLBAR_FOLDER="true">ブックマーク バー</H3>
    <DL><p>
        <DT><A HREF="https://github.com/" ADD_DATE="1">GitHub</A>
        <DT><H3 ADD_DATE="1">開発 &amp; ツール</H3>
        <DL><p>
            <DT><A HREF="https://docs.github.com/" ADD_DATE="1">GitHub Docs</A>
            <DT><H3>空フォルダ</H3>
            <DL><p>
            </DL><p>
            <DT><A HREF="javascript:void(0)">ブックマークレット</A>
        </DL><p>
        <DT><A HREF="https://www.google.com/">Google</A>
    </DL><p>
    <DT><A HREF="https://example.com/">ルート直下</A>
</DL><p>
`;

describe('parseNetscapeBookmarkHtml', () => {
  it('H3 と </DL> の入れ子からフォルダパスを復元する', () => {
    const result = parseNetscapeBookmarkHtml(SAMPLE);
    expect(result).toEqual([
      { displayName: 'GitHub', url: 'https://github.com/', folderPath: 'ブックマーク バー' },
      {
        displayName: 'GitHub Docs',
        url: 'https://docs.github.com/',
        folderPath: 'ブックマーク バー/開発 & ツール',
      },
      { displayName: 'Google', url: 'https://www.google.com/', folderPath: 'ブックマーク バー' },
      { displayName: 'ルート直下', url: 'https://example.com/', folderPath: '' },
    ]);
  });

  it('http / https 以外は捨て、名前が空なら URL を使う', () => {
    const html =
      '<DL><DT><A HREF="https://x.example/">   </A><DT><A HREF="file:///c:/a">A</A></DL>';
    expect(parseNetscapeBookmarkHtml(html)).toEqual([
      { displayName: 'https://x.example/', url: 'https://x.example/', folderPath: '' },
    ]);
  });

  it('タグ名の大文字小文字を区別しない', () => {
    const html = '<dl><dt><h3>Work</h3><dl><dt><a href="https://w.example/">W</a></dl></dl>';
    expect(parseNetscapeBookmarkHtml(html)).toEqual([
      { displayName: 'W', url: 'https://w.example/', folderPath: 'Work' },
    ]);
  });
});
