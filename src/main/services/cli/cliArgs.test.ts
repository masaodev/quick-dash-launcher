import { describe, it, expect } from 'vitest';

import {
  CliError,
  escapeNonAscii,
  expectPositionals,
  optionFlag,
  optionInt,
  optionString,
  parseArgs,
  takeAsciiFlag,
  wantsHelp,
} from './cliArgs';

const spec = { values: ['name', 'position'], flags: ['dry-run'], allowSet: true } as const;

describe('wantsHelp', () => {
  it.each([
    [['item', '--help'], true],
    [['-h'], true],
    [['item', 'add', '--dry-run', '--help'], true],
    [['item', 'add', '--name=x', '-h'], true],
    [['item', 'add', '--args', '-h'], false],
    [['item', 'add', '--memo', '--help'], false],
    [['item', 'add', '--set', '-h'], false],
    [['item', 'add', '--name', 'x'], false],
  ])('%j は %s', (args, expected) => {
    expect(wantsHelp(args)).toBe(expected);
  });
});

describe('takeAsciiFlag', () => {
  it.each([
    [['--ascii', 'launcher', 'item', 'list'], true, ['launcher', 'item', 'list']],
    [['launcher', 'item', 'list', '--ascii'], true, ['launcher', 'item', 'list']],
    [['item', 'add', '--dry-run', '--ascii'], true, ['item', 'add', '--dry-run']],
    // 値を取るオプションの直後は、その値として残す
    [['item', 'add', '--memo', '--ascii'], false, ['item', 'add', '--memo', '--ascii']],
    [['status'], false, ['status']],
  ])('%j', (argv, ascii, rest) => {
    expect(takeAsciiFlag(argv)).toEqual({ ascii, argv: rest });
  });
});

describe('escapeNonAscii', () => {
  it('ASCII 以外を \\uXXXX にし、絵文字はサロゲートの 2 つで書く。読み戻すと元に戻る', () => {
    const text = JSON.stringify({ name: 'メモ帳', icon: '📁', plain: 'a"b' });
    const escaped = escapeNonAscii(text);
    expect([...escaped].every((c) => c.charCodeAt(0) < 0x7f)).toBe(true);
    // 絵文字は上位・下位サロゲートを別々に書く（JSON の決まり）
    expect(escaped).toContain(['', 'ud83d', 'udcc1'].join('\\'));
    expect(JSON.parse(escaped)).toEqual(JSON.parse(text));
  });
});

function errorOf(fn: () => unknown): CliError {
  try {
    fn();
  } catch (error) {
    if (error instanceof CliError) return error;
    throw error;
  }
  throw new Error('例外が出なかった');
}

describe('parseArgs', () => {
  it('位置引数・値・フラグ・--set・--unset を読み分ける', () => {
    const p = parseArgs(
      [
        '議事録',
        '--name',
        '新しい名前',
        '--dry-run',
        '--set',
        'windowTitle=a=b',
        '--unset=memo',
        '--position=2',
      ],
      spec
    );
    expect(p.positionals).toEqual(['議事録']);
    expect(optionString(p, 'name')).toBe('新しい名前');
    expect(optionFlag(p, 'dry-run')).toBe(true);
    expect(optionInt(p, 'position')).toBe(2);
    expect(p.sets).toEqual([['windowTitle', 'a=b']]);
    expect(p.unsets).toEqual(['memo']);
  });

  it('- で始まる値も、値として受け取る', () => {
    const p = parseArgs(['--name', '-x'], spec);
    expect(optionString(p, 'name')).toBe('-x');
  });

  it('知らないオプション・値の欠け・重複・値付きのフラグは usage', () => {
    expect(errorOf(() => parseArgs(['--color', 'red'], spec)).code).toBe('usage');
    expect(errorOf(() => parseArgs(['--name'], spec)).message).toContain('--name に値がありません');
    expect(errorOf(() => parseArgs(['--name', 'a', '--name', 'b'], spec)).message).toContain(
      '2 回'
    );
    expect(errorOf(() => parseArgs(['--dry-run=yes'], spec)).code).toBe('usage');
    expect(errorOf(() => parseArgs(['--set', 'novalue'], spec)).message).toContain('key=value');
  });

  it('--set を受け付けないコマンドでは知らないオプションになる', () => {
    expect(errorOf(() => parseArgs(['--set', 'a=b'], { values: [] })).code).toBe('usage');
  });

  it('整数でない --position は usage', () => {
    const p = parseArgs(['--position', '1.5'], spec);
    expect(errorOf(() => optionInt(p, 'position')).code).toBe('usage');
  });
});

describe('expectPositionals', () => {
  it('足りない・多すぎるときは usage', () => {
    expect(
      errorOf(() => expectPositionals(parseArgs([], spec), ['<id か表示名>'])).message
    ).toContain('<id か表示名> を指定してください');
    expect(
      errorOf(() => expectPositionals(parseArgs(['a', 'b'], spec), ['<id>'])).message
    ).toContain('余分な引数');
  });
});
