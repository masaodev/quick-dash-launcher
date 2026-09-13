import { describe, it, expect, vi } from 'vitest';

vi.mock('@common/logger', () => ({
  iconLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const {
  classifyIconTarget,
  getCachedIconCandidates,
  resolveShortcutPath,
  extractExtensionFromUri,
  isScriptExtension,
} = await import('./iconCacheKeys');

const FOLDERS = {
  favicons: 'C:\\cache\\favicons',
  icons: 'C:\\cache\\apps',
  extensions: 'C:\\cache\\extensions',
};

/** 候補のうち先頭のファイル名だけを取り出す */
function firstName(candidates: string[]): string | undefined {
  return candidates[0]?.split('\\').pop();
}

/** 候補すべてのファイル名を取り出す */
function names(candidates: string[]): string[] {
  return candidates.map((c) => c.split('\\').pop()!);
}

describe('classifyIconTarget', () => {
  it.each([
    ['url', { type: 'url', path: 'https://example.com/' }, 'favicon'],
    ['UWP', { type: 'app', path: 'shell:AppsFolder\\Pkg_abc!App' }, 'uwp'],
    ['ショートカット', { type: 'app', path: 'C:\\x\\a.lnk' }, 'shortcut'],
    [
      'リンク先がショートカット',
      { type: 'app', path: 'C:\\x\\a.exe', originalPath: 'C:\\x\\b.lnk' },
      'shortcut',
    ],
    ['バッチ', { type: 'app', path: 'C:\\x\\run.bat' }, 'script'],
    ['cmd', { type: 'app', path: 'C:\\x\\run.CMD' }, 'script'],
    ['実行ファイル', { type: 'app', path: 'C:\\x\\a.exe' }, 'executable'],
    ['拡張子なしのapp', { type: 'app', path: 'wt.exe' }, 'executable'],
    ['カスタムURI', { type: 'customUri', path: 'obsidian://open?vault=x' }, 'customUri'],
    ['ファイル', { type: 'file', path: 'C:\\x\\a.txt' }, 'fileExtension'],
    ['フォルダ', { type: 'folder', path: 'C:\\x' }, 'none'],
    ['グループ', { type: 'group', path: '[グループ: 2件]' }, 'none'],
  ])('%s を分類する', (_label, item, expected) => {
    expect(classifyIconTarget(item)).toBe(expected);
  });
});

describe('getCachedIconCandidates', () => {
  it('urlは64px→32pxの順にファビコンを探す', () => {
    const candidates = getCachedIconCandidates(
      { type: 'url', path: 'https://github.com/foo/bar' },
      FOLDERS
    );

    expect(names(candidates)).toEqual(['github.com_favicon_64.png', 'github.com_favicon_32.png']);
  });

  it('スキーマを持たないurlは候補を返さない', () => {
    expect(getCachedIconCandidates({ type: 'url', path: 'github.com' }, FOLDERS)).toEqual([]);
  });

  it('UWPはパッケージファミリー名から候補を作る', () => {
    const candidates = getCachedIconCandidates(
      { type: 'app', path: 'shell:AppsFolder\\26553NeeLab.NeeView_kd481dfjqxzvw!App' },
      FOLDERS
    );

    expect(firstName(candidates)).toBe('uwp_26553NeeLab.NeeView_kd481dfjqxzvw_icon.png');
  });

  it('UWPでもAppIDの区切りが無ければ候補を返さない', () => {
    expect(
      getCachedIconCandidates({ type: 'app', path: 'shell:AppsFolder\\broken' }, FOLDERS)
    ).toEqual([]);
  });

  it('ショートカットは_lnk_icon優先、_iconにフォールバックする', () => {
    const candidates = getCachedIconCandidates({ type: 'app', path: 'C:\\x\\MyApp.lnk' }, FOLDERS);

    expect(names(candidates)).toEqual(['MyApp_lnk_icon.png', 'MyApp_icon.png']);
  });

  it('リンク先がショートカットならそちらの名前を使う', () => {
    const candidates = getCachedIconCandidates(
      { type: 'app', path: 'C:\\x\\target.exe', originalPath: 'C:\\y\\Link.lnk' },
      FOLDERS
    );

    expect(firstName(candidates)).toBe('Link_lnk_icon.png');
  });

  it('カスタムURIはスキーマ優先、拡張子にフォールバックする', () => {
    const candidates = getCachedIconCandidates(
      { type: 'customUri', path: 'ms-excel:ofe|u|https://example.com/Book%204.xlsx?web=1' },
      FOLDERS
    );

    expect(names(candidates)).toEqual(['uri_ms-excel_icon.png', 'ext_xlsx_icon.png']);
  });

  it('拡張子を持たないアイテムは候補を返さない', () => {
    expect(getCachedIconCandidates({ type: 'file', path: 'C:\\x\\README' }, FOLDERS)).toEqual([]);
  });

  it('folderなど取得対象外は候補を返さない', () => {
    expect(getCachedIconCandidates({ type: 'folder', path: 'C:\\x' }, FOLDERS)).toEqual([]);
  });
});

/**
 * 取得側（fetchIconForItem）と読み出し側（getCachedIconCandidates）の対応
 *
 * 保存先と読み出し先が食い違うと、アイコンを取得できているのに表示されない。
 * 分類ごとに、どのフォルダのどんな名前を読みにいくかを固定しておく
 */
describe('取得方法と読み出し候補の対応', () => {
  it.each([
    {
      kind: 'script',
      item: { type: 'app', path: 'C:\\x\\run.bat' },
      folder: 'extensions',
      name: 'ext_bat_icon.png',
    },
    {
      kind: 'executable',
      item: { type: 'app', path: 'C:\\x\\tool.exe' },
      folder: 'icons',
      name: 'tool_icon.png',
    },
    {
      // 実行ファイル以外の拡張子もファイル名ベース（extractIconの保存先と一致させる）
      kind: 'executable',
      item: { type: 'app', path: 'C:\\x\\tool.ps1' },
      folder: 'icons',
      name: 'tool_icon.png',
    },
    {
      kind: 'fileExtension',
      item: { type: 'file', path: 'C:\\x\\memo.TXT' },
      folder: 'extensions',
      name: 'ext_txt_icon.png',
    },
  ])('$kind は $folder フォルダの $name を読む', ({ item, folder, name }) => {
    const candidates = getCachedIconCandidates(item, FOLDERS);

    expect(candidates[0]).toContain(FOLDERS[folder as keyof typeof FOLDERS]);
    expect(firstName(candidates)).toBe(name);
  });
});

describe('resolveShortcutPath', () => {
  it('リンク先が.lnkならそちらを返す', () => {
    expect(
      resolveShortcutPath({ type: 'app', path: 'C:\\x\\a.exe', originalPath: 'C:\\y\\b.lnk' })
    ).toBe('C:\\y\\b.lnk');
  });

  it('リンク先が.lnkでなければpathを返す', () => {
    expect(resolveShortcutPath({ type: 'app', path: 'C:\\x\\a.lnk' })).toBe('C:\\x\\a.lnk');
  });
});

describe('extractExtensionFromUri', () => {
  it.each([
    ['ms-excel:ofe|u|https://example.com/Book%204.xlsx', '.xlsx'],
    ['ms-excel:ofe|u|https://example.com/Book.xlsx?web=1', '.xlsx'],
    ['obsidian://open?vault=x', ''],
  ])('%s から %s を取り出す', (uri, expected) => {
    expect(extractExtensionFromUri(uri)).toBe(expected);
  });

  it('不正なパーセントエンコードでも例外を投げない', () => {
    expect(extractExtensionFromUri('scheme:%E0%A4%A')).toBe('');
  });
});

describe('isScriptExtension', () => {
  it.each([
    ['C:\\x\\a.bat', true],
    ['C:\\x\\a.CMD', true],
    ['C:\\x\\a.com', true],
    ['C:\\x\\a.exe', false],
    ['C:\\x\\a.ps1', false],
  ])('%s -> %s', (filePath, expected) => {
    expect(isScriptExtension(filePath)).toBe(expected);
  });
});
