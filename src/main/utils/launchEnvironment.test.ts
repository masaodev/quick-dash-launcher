import type { Logger } from 'pino';
import { describe, it, expect, vi } from 'vitest';

// 本物の設定と koffi を読み込まない（getLaunchEnvironment には差し替えを引数で渡す）
vi.mock('../services/settingsService.js', () => ({ SettingsService: { getInstance: vi.fn() } }));
vi.mock('./standardEnvironment.js', () => ({ createStandardEnvironmentEntries: vi.fn() }));

import {
  buildLaunchEnvironment,
  getLaunchEnvironment,
  parseEnvironmentEntries,
  type LaunchEnvironmentDeps,
} from './launchEnvironment';

const logger = { warn: vi.fn() } as unknown as Logger;

const STANDARD_ENTRIES = [
  'ALLUSERSPROFILE=C:\\ProgramData',
  'Path=C:\\Windows\\system32;C:\\Windows;C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps',
  'SystemRoot=C:\\Windows',
  'USERNAME=me',
  'SESSIONNAME=Console',
];

function deps(overrides: Partial<LaunchEnvironmentDeps> = {}): LaunchEnvironmentDeps {
  return {
    readInherit: async () => false,
    createEntries: () => STANDARD_ENTRIES,
    current: {
      CLAUDECODE: '1',
      CLAUDE_CODE_CHILD_SESSION: '1',
      APP_INSTANCE: 'dev3',
      PORTABLE_EXECUTABLE_FILE: 'C:\\tools\\QuickDashLauncher.exe',
      Path: 'C:\\Program Files\\Git\\usr\\bin;C:\\Windows\\system32',
      SESSIONNAME: 'RDP-Tcp#1',
      CLIENTNAME: 'LAPTOP',
    },
    ...overrides,
  };
}

describe('parseEnvironmentEntries', () => {
  it('「名前=値」を名前 → 値にし、値の中の = はそのまま残す', () => {
    expect(parseEnvironmentEntries(['A=1', 'B=x=y', 'EMPTY='])).toEqual({
      A: '1',
      B: 'x=y',
      EMPTY: '',
    });
  });

  it('ドライブごとの作業フォルダ（先頭が =）と、= の無いものは飛ばす', () => {
    expect(
      parseEnvironmentEntries(['=C:=C:\\work', '=ExitCode=00000000', 'BROKEN', 'A=1'])
    ).toEqual({ A: '1' });
  });
});

describe('buildLaunchEnvironment', () => {
  it('標準の環境に無いセッションごとの値（CLIENTNAME）だけを、今の環境から足す', () => {
    const env = buildLaunchEnvironment(
      { Path: 'C:\\Windows', SESSIONNAME: 'Console' },
      { CLIENTNAME: 'LAPTOP', SESSIONNAME: 'RDP-Tcp#1', CLAUDECODE: '1' }
    );
    expect(env).toEqual({ Path: 'C:\\Windows', SESSIONNAME: 'Console', CLIENTNAME: 'LAPTOP' });
  });

  it('名前の大文字・小文字が違っても、同じ変数は二重に足さない', () => {
    const env = buildLaunchEnvironment({ SessionName: 'Console' }, { SESSIONNAME: 'RDP-Tcp#1' });
    expect(env).toEqual({ SessionName: 'Console' });
  });
});

describe('getLaunchEnvironment', () => {
  it('ユーザーの標準の環境を返し、QuickDashLauncher の環境から漏れた変数を含めない', async () => {
    const env = await getLaunchEnvironment(logger, deps());

    expect(env).toMatchObject({
      Path: 'C:\\Windows\\system32;C:\\Windows;C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps',
      SESSIONNAME: 'Console',
      CLIENTNAME: 'LAPTOP',
    });
    for (const leaked of [
      'CLAUDECODE',
      'CLAUDE_CODE_CHILD_SESSION',
      'APP_INSTANCE',
      'PORTABLE_EXECUTABLE_FILE',
    ]) {
      expect(env).not.toHaveProperty(leaked);
    }
  });

  it('QuickDashLauncher 自身の環境（process.env）は書き換えない', async () => {
    const before = { ...process.env };

    await getLaunchEnvironment(logger, { ...deps(), current: process.env });

    expect(process.env).toEqual(before);
  });

  it('引き継ぐ設定がオンなら undefined（QuickDashLauncher の環境を引き継ぐ）を返し、標準の環境は作らない', async () => {
    const createEntries = vi.fn(() => STANDARD_ENTRIES);

    const env = await getLaunchEnvironment(
      logger,
      deps({ readInherit: async () => true, createEntries })
    );

    expect(env).toBeUndefined();
    expect(createEntries).not.toHaveBeenCalled();
  });

  it('標準の環境を作れなければ、ログに残して undefined を返す', async () => {
    const env = await getLaunchEnvironment(
      logger,
      deps({
        createEntries: () => {
          throw new Error('CreateEnvironmentBlock に失敗しました');
        },
      })
    );

    expect(env).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      { error: 'CreateEnvironmentBlock に失敗しました' },
      expect.stringContaining('標準の環境変数を作れなかった')
    );
  });

  it('標準の環境が空なら、作れなかったときと同じく undefined を返す', async () => {
    expect(await getLaunchEnvironment(logger, deps({ createEntries: () => [] }))).toBeUndefined();
  });
});
