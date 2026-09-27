import { describe, it, expect } from 'vitest';

import {
  classifyPastedText,
  looksLikeWindowsPath,
  makeClipboardDisplayName,
} from './pasteClassifier';

describe('classifyPastedText', () => {
  it('空や空白だけなら null', () => {
    expect(classifyPastedText('')).toBeNull();
    expect(classifyPastedText('   \n  ')).toBeNull();
  });

  it('http(s)/ftp の URL は url', () => {
    expect(classifyPastedText('https://example.com/a?b=1')).toEqual({
      kind: 'url',
      value: 'https://example.com/a?b=1',
    });
    expect(classifyPastedText('  http://example.com \n')?.kind).toBe('url');
    expect(classifyPastedText('ftp://files.example.com')?.kind).toBe('url');
  });

  it('カスタム URI は customUri', () => {
    expect(classifyPastedText('obsidian://open?vault=x&file=y')?.kind).toBe('customUri');
    expect(classifyPastedText('ms-todo:')?.kind).toBe('customUri');
    expect(classifyPastedText('vscode://file/c:/work')?.kind).toBe('customUri');
  });

  it('Windows のパスは path（実在は問わない）', () => {
    expect(classifyPastedText('C:\\Users\\foo')).toEqual({ kind: 'path', value: 'C:\\Users\\foo' });
    expect(classifyPastedText('D:/work/memo.txt')?.kind).toBe('path');
    expect(classifyPastedText('\\\\nas\\share\\docs')?.kind).toBe('path');
    expect(classifyPastedText('shell:AppsFolder\\Microsoft.Todos_8wekyb3d8bbwe!App')?.kind).toBe(
      'path'
    );
    expect(classifyPastedText('%APPDATA%\\quick-dash-launcher')?.kind).toBe('path');
  });

  it('「パスのコピー」の引用符は外す', () => {
    expect(classifyPastedText('"C:\\Program Files\\App\\app.exe"')).toEqual({
      kind: 'path',
      value: 'C:\\Program Files\\App\\app.exe',
    });
  });

  it('拡張子のないただの文字列は text（以前は folder になっていた）', () => {
    expect(classifyPastedText('会議メモ')).toEqual({ kind: 'text', value: '会議メモ' });
    expect(classifyPastedText('hello world')?.kind).toBe('text');
  });

  it('スキーム構文に見えても空白を含む文は text', () => {
    expect(classifyPastedText('TODO: 牛乳を買う')?.kind).toBe('text');
    expect(classifyPastedText('Note: see https://example.com')?.kind).toBe('text');
  });

  it('ドットを含む文は text（以前は file になっていた）', () => {
    expect(classifyPastedText('詳細は資料.参照')?.kind).toBe('text');
  });

  it('複数行は全文を text として返す（1 行目が URL でも）', () => {
    const text = 'https://example.com\n二行目のメモ';
    expect(classifyPastedText(text)).toEqual({ kind: 'text', value: text });
    expect(classifyPastedText('一行目\r\n\r\n三行目')?.value).toBe('一行目\r\n\r\n三行目');
  });

  it('空行だけが続く 1 行は単一行として扱う', () => {
    expect(classifyPastedText('https://example.com\n\n')?.kind).toBe('url');
  });
});

describe('looksLikeWindowsPath', () => {
  it('ドライブ・UNC・shell・環境変数だけを path とみなす', () => {
    expect(looksLikeWindowsPath('C:\\')).toBe(true);
    expect(looksLikeWindowsPath('\\\\server\\share')).toBe(true);
    expect(looksLikeWindowsPath('shell:Downloads')).toBe(true);
    expect(looksLikeWindowsPath('%USERPROFILE%/Desktop')).toBe(true);
    expect(looksLikeWindowsPath('Users/foo')).toBe(false);
    expect(looksLikeWindowsPath('C:foo')).toBe(false);
    expect(looksLikeWindowsPath('\\\\')).toBe(false);
  });
});

describe('makeClipboardDisplayName', () => {
  it('最初の空でない行を使い、長ければ切る', () => {
    expect(makeClipboardDisplayName('  \n見出し\n本文')).toBe('見出し');
    expect(makeClipboardDisplayName('a'.repeat(40))).toBe(`${'a'.repeat(30)}…`);
    expect(makeClipboardDisplayName('   ')).toBe('テキスト');
  });
});
