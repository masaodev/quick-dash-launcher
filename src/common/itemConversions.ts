/**
 * アイテムのパス・引数の「変換」（登録・編集画面の「変換」ボタンの候補）
 *
 * いまの入力（パスと引数）から元の URL を読み取り、別の開き方の書き方に変換する候補を作る。
 * 開き方は 3 系統: URL のまま（既定のブラウザのタブ）・ブラウザの exe に引数で URL を渡す形・Office の URI。
 * アイテムは開き方を状態として持たない。変換は入力の書き換えだけで、いまの書き方は候補から外す。
 */

import { applyConversionPrefix, findMatchingRule } from './urlConversionRules';
import type { ConversionOption, ConversionRule } from './urlConversionRules';

/** 既定のブラウザ（https を開くプログラム） */
export interface DefaultBrowser {
  /** exe のフルパス */
  exePath: string;
  /** 表示名（例 Google Chrome） */
  name: string;
}

/** ブラウザに URL を渡す開き方 */
export type BrowserOpenMode = 'newWindow' | 'appWindow' | 'private';

/** シークレットの呼び名（画面の文言を変える） */
export type PrivateModeName = 'incognito' | 'inPrivate' | 'privateWindow';

/** ブラウザごとの引数の書き方 */
interface BrowserFlags {
  newWindow: string;
  /** URL の前に直接付ける（--app=URL）。無いブラウザは undefined */
  appWindow?: string;
  private: string;
  privateName: PrivateModeName;
}

const CHROMIUM_FLAGS: BrowserFlags = {
  newWindow: '--new-window',
  appWindow: '--app=',
  private: '--incognito',
  privateName: 'incognito',
};

/** exe のファイル名（小文字）→ 引数の書き方 */
const BROWSER_FLAGS: Record<string, BrowserFlags> = {
  'chrome.exe': CHROMIUM_FLAGS,
  'brave.exe': CHROMIUM_FLAGS,
  'vivaldi.exe': CHROMIUM_FLAGS,
  'chromium.exe': CHROMIUM_FLAGS,
  'msedge.exe': { ...CHROMIUM_FLAGS, private: '--inprivate', privateName: 'inPrivate' },
  'firefox.exe': {
    newWindow: '-new-window',
    private: '-private-window',
    privateName: 'privateWindow',
  },
};

/** 変換の候補 1 つ */
export type ConversionCandidate =
  | { kind: 'toUrl'; path: string; args: string }
  | {
      kind: 'browser';
      mode: BrowserOpenMode;
      privateName: PrivateModeName;
      /** 見出しに出すブラウザの名前 */
      browserName: string;
      path: string;
      args: string;
    }
  | {
      kind: 'office';
      rule: ConversionRule;
      option: ConversionOption;
      path: string;
      args: string;
    };

/** 候補の見出しごとのまとまり */
export interface ConversionGroup {
  /** url＝URL に戻す・browser＝ブラウザ・office＝Office アプリ */
  kind: 'url' | 'browser' | 'office';
  /** browser のときのブラウザ名、office のときのルール名 */
  title?: string;
  candidates: ConversionCandidate[];
}

/** いまの入力を読み取った結果 */
interface ParsedInput {
  /** 元の URL */
  url: string;
  /** いまの書き方（候補から外す） */
  current:
    | { kind: 'url' }
    | { kind: 'browser'; exePath: string; mode: BrowserOpenMode; otherArgs: string[] }
    | { kind: 'office'; prefix: string };
}

const HTTP_URL = /^https?:\/\//i;
const OFFICE_URI = /^ms-(excel|word|powerpoint):/i;

function exeFileName(exePath: string): string {
  return (exePath.split(/[\\/]/).pop() ?? '').toLowerCase();
}

/** exe がブラウザなら引数の書き方を返す */
function getBrowserFlags(exePath: string): BrowserFlags | undefined {
  return BROWSER_FLAGS[exeFileName(exePath)];
}

/** 既定のブラウザが変換に対応しているか（新しいウィンドウなどの引数を知っているか） */
export function isSupportedBrowser(browser: DefaultBrowser | null | undefined): boolean {
  return !!browser && !!getBrowserFlags(browser.exePath);
}

/**
 * 引数の文字列を空白で区切る（引用符の中の空白では区切らない）。
 * ほかの引数を利用者が書いたとおりに残すため、引用符を付けたままの元の文字列（raw）も返す
 */
function splitArgs(args: string): { raw: string; value: string }[] {
  return (args.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []).map((raw) => ({
    raw,
    value: raw.replace(/"/g, ''),
  }));
}

/** ブラウザの exe ＋引数から、URL と開き方とそれ以外の引数を読み取る */
function parseBrowserArgs(exePath: string, args: string): ParsedInput | undefined {
  const flags = getBrowserFlags(exePath);
  if (!flags) return undefined;
  let url: string | undefined;
  let mode: BrowserOpenMode | undefined;
  const otherArgs: string[] = [];
  for (const { raw, value: arg } of splitArgs(args)) {
    if (!url && flags.appWindow && arg.startsWith(flags.appWindow)) {
      const value = arg.slice(flags.appWindow.length);
      if (HTTP_URL.test(value)) {
        url = value;
        mode = 'appWindow';
        continue;
      }
    }
    if (!url && HTTP_URL.test(arg)) {
      url = arg;
      continue;
    }
    if (!mode && arg === flags.newWindow) {
      mode = 'newWindow';
      continue;
    }
    if (!mode && arg === flags.private) {
      mode = 'private';
      continue;
    }
    otherArgs.push(raw);
  }
  if (!url) return undefined;
  // 開き方の引数が無い（chrome.exe URL）ときは新しいタブ・ウィンドウのどちらにもなりうるが、
  // 候補から外す形を決めるだけなので新しいウィンドウとみなす
  return {
    url,
    current: { kind: 'browser', exePath, mode: mode ?? 'newWindow', otherArgs },
  };
}

/** パスと引数から元の URL といまの書き方を読み取る。変換できない入力なら undefined */
function parseInput(path: string, args: string): ParsedInput | undefined {
  const trimmed = path.trim();
  if (HTTP_URL.test(trimmed)) {
    return { url: trimmed, current: { kind: 'url' } };
  }
  if (OFFICE_URI.test(trimmed)) {
    const match = trimmed.match(/^ms-[a-z]+:.*?(?=https?:\/\/)/i);
    if (!match) return undefined;
    return { url: trimmed.slice(match[0].length), current: { kind: 'office', prefix: match[0] } };
  }
  return parseBrowserArgs(trimmed, args);
}

/** ブラウザの形の候補（新しいウィンドウ・アプリのウィンドウ・シークレット） */
function browserCandidates(
  exePath: string,
  browserName: string,
  url: string,
  otherArgs: string[],
  skipMode?: BrowserOpenMode
): ConversionCandidate[] {
  const flags = getBrowserFlags(exePath);
  if (!flags) return [];
  const modeArgs: Record<BrowserOpenMode, string[] | undefined> = {
    newWindow: [flags.newWindow, url],
    appWindow: flags.appWindow ? [flags.appWindow + url] : undefined,
    private: [flags.private, url],
  };
  const modes: BrowserOpenMode[] = ['newWindow', 'appWindow', 'private'];
  return modes.flatMap((mode) => {
    const tail = modeArgs[mode];
    if (!tail || mode === skipMode) return [];
    return [
      {
        kind: 'browser' as const,
        mode,
        privateName: flags.privateName,
        browserName,
        path: exePath,
        args: [...otherArgs, ...tail].join(' '),
      },
    ];
  });
}

/** exe のフルパスから表示名を作る（既定のブラウザ以外の exe を指しているとき） */
function browserNameFromExe(exePath: string): string {
  return exePath.split(/[\\/]/).pop() ?? exePath;
}

/**
 * いまの入力から変換の候補を作る（見出しごと）。候補が無ければ空配列
 *
 * @param defaultBrowser 既定のブラウザ。分からない・対応していないときは null（ブラウザの形を出さない）
 */
export function getConversionGroups(
  path: string,
  args: string | undefined,
  defaultBrowser: DefaultBrowser | null
): ConversionGroup[] {
  const parsed = parseInput(path ?? '', args ?? '');
  if (!parsed) return [];
  const { url, current } = parsed;
  const groups: ConversionGroup[] = [];

  if (current.kind !== 'url') {
    groups.push({ kind: 'url', candidates: [{ kind: 'toUrl', path: url, args: '' }] });
  }

  // いまブラウザの形なら、同じブラウザの別の形（ほかの引数は残す）
  const sameBrowser =
    current.kind === 'browser' &&
    !!defaultBrowser &&
    current.exePath.toLowerCase() === defaultBrowser.exePath.toLowerCase();
  if (current.kind === 'browser') {
    const name =
      sameBrowser && defaultBrowser ? defaultBrowser.name : browserNameFromExe(current.exePath);
    const candidates = browserCandidates(
      current.exePath,
      name,
      url,
      current.otherArgs,
      current.mode
    );
    if (candidates.length > 0) groups.push({ kind: 'browser', title: name, candidates });
  }

  // 既定のブラウザの形（いまが同じブラウザなら上で出した）
  if (defaultBrowser && !sameBrowser) {
    const candidates = browserCandidates(defaultBrowser.exePath, defaultBrowser.name, url, []);
    if (candidates.length > 0) {
      groups.push({ kind: 'browser', title: defaultBrowser.name, candidates });
    }
  }

  const rule = findMatchingRule(url);
  if (rule) {
    const currentPrefix = current.kind === 'office' ? current.prefix : undefined;
    const candidates: ConversionCandidate[] = rule.options
      .filter((option) => option.prefix !== currentPrefix)
      .map((option) => ({
        kind: 'office' as const,
        rule,
        option,
        path: applyConversionPrefix(url, option.prefix),
        args: '',
      }));
    if (candidates.length > 0) groups.push({ kind: 'office', title: rule.name, candidates });
  }

  return groups;
}
