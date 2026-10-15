import { describe, it, expect } from 'vitest';
import {
  getConversionFileExtension,
  getConversionGroups,
  isSupportedBrowser,
} from '@common/itemConversions';
import type { ConversionGroup, DefaultBrowser } from '@common/itemConversions';

const CHROME: DefaultBrowser = {
  exePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  name: 'Google Chrome',
};
const EDGE: DefaultBrowser = {
  exePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  name: 'Microsoft Edge',
};
const FIREFOX: DefaultBrowser = {
  exePath: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
  name: 'Firefox',
};
const OPERA: DefaultBrowser = {
  exePath: 'C:\\Users\\me\\AppData\\Local\\Programs\\Opera\\opera.exe',
  name: 'Opera',
};

const URL = 'https://example.com/';
const SP_EXCEL = 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/book.xlsx';

/** 候補を「パス｜引数」の一覧にして比べやすくする */
function flatten(groups: ConversionGroup[]): string[] {
  return groups.flatMap((group) => group.candidates.map((c) => `${c.path}|${c.args}`));
}

describe('getConversionGroups', () => {
  it('普通の URL からは既定のブラウザの 3 つの形を出す', () => {
    const groups = getConversionGroups(URL, '', CHROME);
    expect(groups.map((g) => g.kind)).toEqual(['browser']);
    expect(groups[0].title).toBe('Google Chrome');
    expect(flatten(groups)).toEqual([
      `${CHROME.exePath}|--new-window ${URL}`,
      `${CHROME.exePath}|--app=${URL}`,
      `${CHROME.exePath}|--incognito ${URL}`,
    ]);
  });

  it('Edge のシークレットは --inprivate で、呼び名も InPrivate にする', () => {
    const groups = getConversionGroups(URL, '', EDGE);
    const priv = groups[0].candidates.find((c) => c.kind === 'browser' && c.mode === 'private');
    expect(priv?.args).toBe(`--inprivate ${URL}`);
    expect(priv?.kind === 'browser' && priv.privateName).toBe('inPrivate');
  });

  it('Firefox はアプリのウィンドウを出さず、引数の書き方が違う', () => {
    const groups = getConversionGroups(URL, '', FIREFOX);
    expect(flatten(groups)).toEqual([
      `${FIREFOX.exePath}|-new-window ${URL}`,
      `${FIREFOX.exePath}|-private-window ${URL}`,
    ]);
  });

  it('既定のブラウザが分からない・対応していないときは、普通の URL に候補は無い', () => {
    expect(getConversionGroups(URL, '', null)).toEqual([]);
    expect(isSupportedBrowser(OPERA)).toBe(false);
    expect(isSupportedBrowser(CHROME)).toBe(true);
  });

  it('SharePoint の Excel ではブラウザの形と Office の形を両方出す', () => {
    const groups = getConversionGroups(SP_EXCEL, '', CHROME);
    expect(groups.map((g) => g.kind)).toEqual(['browser', 'office']);
    expect(groups[1].candidates.map((c) => c.path)).toEqual([
      `ms-excel:ofe|ofc|u|${SP_EXCEL}`,
      `ms-excel:ofe|u|${SP_EXCEL}`,
      `ms-excel:ofv|u|${SP_EXCEL}`,
    ]);
  });

  it('新しいウィンドウの形からは、URL に戻すと同じブラウザの別の形を出す（いまの形は出さない）', () => {
    const groups = getConversionGroups(CHROME.exePath, `--new-window ${URL}`, CHROME);
    expect(groups.map((g) => g.kind)).toEqual(['url', 'browser']);
    expect(flatten(groups)).toEqual([
      `${URL}|`,
      `${CHROME.exePath}|--app=${URL}`,
      `${CHROME.exePath}|--incognito ${URL}`,
    ]);
  });

  it('アプリのウィンドウの形（--app=URL）も読み取れる', () => {
    const groups = getConversionGroups(CHROME.exePath, `--app=${URL}`, CHROME);
    expect(flatten(groups)).toEqual([
      `${URL}|`,
      `${CHROME.exePath}|--new-window ${URL}`,
      `${CHROME.exePath}|--incognito ${URL}`,
    ]);
  });

  it('ほかの引数（プロファイルなど）は別の形にしても残し、URL に戻すときは外す', () => {
    const groups = getConversionGroups(
      CHROME.exePath,
      `--profile-directory="Profile 1" --new-window ${URL}`,
      CHROME
    );
    expect(flatten(groups)).toEqual([
      `${URL}|`,
      `${CHROME.exePath}|--profile-directory="Profile 1" --app=${URL}`,
      `${CHROME.exePath}|--profile-directory="Profile 1" --incognito ${URL}`,
    ]);
  });

  it('既定と違うブラウザの形なら、そのブラウザの別の形と既定のブラウザの形を両方出す', () => {
    const groups = getConversionGroups(EDGE.exePath, `--new-window ${URL}`, CHROME);
    expect(groups.map((g) => [g.kind, g.title])).toEqual([
      ['url', undefined],
      ['browser', 'msedge.exe'],
      ['browser', 'Google Chrome'],
    ]);
    expect(groups[2].candidates).toHaveLength(3);
  });

  it('Office の形からは URL に戻すと Office の別の形、ブラウザの形を出す', () => {
    const groups = getConversionGroups(`ms-excel:ofe|u|${SP_EXCEL}`, '', CHROME);
    expect(groups.map((g) => g.kind)).toEqual(['url', 'browser', 'office']);
    expect(groups[0].candidates[0].path).toBe(SP_EXCEL);
    expect(groups[2].candidates.map((c) => c.path)).toEqual([
      `ms-excel:ofe|ofc|u|${SP_EXCEL}`,
      `ms-excel:ofv|u|${SP_EXCEL}`,
    ]);
  });

  it('変換した結果をもう一度読むと、URL に戻せる（行き来しても元に戻る）', () => {
    const toWindow = getConversionGroups(URL, '', CHROME)[0].candidates[0];
    const back = getConversionGroups(toWindow.path, toWindow.args, CHROME)[0].candidates[0];
    expect(back).toMatchObject({ kind: 'toUrl', path: URL, args: '' });
  });

  it('ファイル・フォルダ・引数に URL の無いブラウザ・空には候補が無い', () => {
    expect(getConversionGroups('C:\\Users\\me\\memo.txt', '', CHROME)).toEqual([]);
    expect(getConversionGroups('C:\\Users\\me', '', CHROME)).toEqual([]);
    expect(getConversionGroups(CHROME.exePath, '--new-window', CHROME)).toEqual([]);
    expect(getConversionGroups(CHROME.exePath, '', CHROME)).toEqual([]);
    expect(getConversionGroups('', '', CHROME)).toEqual([]);
  });
});

describe('ファイル（関連付けがブラウザ）の変換', () => {
  const MD = String.raw`C:\Users\me\tasks\全体ビュー.md`;
  const MD_URL = 'file:///C:/Users/me/tasks/全体ビュー.md';

  it('関連付けを調べる拡張子を返す（実行ファイル・URL・フォルダは返さない）', () => {
    expect(getConversionFileExtension(MD)).toBe('.md');
    expect(getConversionFileExtension(String.raw`\\server\share\a.HTML`)).toBe('.html');
    expect(getConversionFileExtension(CHROME.exePath)).toBeUndefined();
    expect(getConversionFileExtension(URL)).toBeUndefined();
    expect(getConversionFileExtension(String.raw`C:\Users\me`)).toBeUndefined();
    // ブラウザでファイルを開く形からも、元のファイルの拡張子を返す
    expect(getConversionFileExtension(CHROME.exePath, `--new-window ${MD_URL}`)).toBe('.md');
  });

  it('関連付けのブラウザで新しいウィンドウ・アプリのウィンドウの形を出す（シークレットは出さない）', () => {
    const groups = getConversionGroups(MD, '', EDGE, CHROME);
    expect(groups.map((g) => [g.kind, g.title])).toEqual([['browser', 'Google Chrome']]);
    expect(flatten(groups)).toEqual([
      `${CHROME.exePath}|--new-window ${MD_URL}`,
      `${CHROME.exePath}|--app=${MD_URL}`,
    ]);
  });

  it('関連付けがブラウザでない・分からないファイルには候補が無い', () => {
    expect(getConversionGroups(MD, '', CHROME, null)).toEqual([]);
  });

  it('ブラウザでファイルを開く形からは、ファイルに戻すと別の形を出す', () => {
    const groups = getConversionGroups(CHROME.exePath, `--new-window ${MD_URL}`, EDGE, CHROME);
    expect(groups.map((g) => g.kind)).toEqual(['file', 'browser']);
    expect(flatten(groups)).toEqual([`${MD}|`, `${CHROME.exePath}|--app=${MD_URL}`]);
  });

  it('空白・# を含むパスは符号化し、戻すと元のパスになる', () => {
    const path = String.raw`C:\My Docs\a#1 b.md`;
    const toWindow = getConversionGroups(path, '', null, CHROME)[0].candidates[0];
    expect(toWindow.args).toBe('--new-window file:///C:/My%20Docs/a%231%20b.md');
    const back = getConversionGroups(toWindow.path, toWindow.args, null, CHROME)[0].candidates[0];
    expect(back).toMatchObject({ kind: 'toFile', path, args: '' });
  });

  it('UNC のパスは file://server/… にし、戻せる', () => {
    const path = String.raw`\\server\share\memo.md`;
    const toApp = getConversionGroups(path, '', null, CHROME)[0].candidates[1];
    expect(toApp.args).toBe('--app=file://server/share/memo.md');
    const back = getConversionGroups(toApp.path, toApp.args, null, CHROME)[0].candidates[0];
    expect(back).toMatchObject({ kind: 'toFile', path });
  });
});
