import { describe, it, expect, vi, beforeEach } from 'vitest';

type ExecFileCallback = (err: Error | null, out?: { stdout: string; stderr: string }) => void;

// where の結果を返す（promisify されるので、コールバックの第 2 引数が resolve される）
const execFileMock = vi.hoisted(() =>
  vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: ExecFileCallback) =>
    cb(null, {
      stdout: 'C:\\Windows\\System32\\notepad.exe\r\nC:\\Windows\\notepad.exe\r\n',
      stderr: '',
    })
  )
);

// 組み込みモジュールの名前付き import は default 経由で解決されるので、default 側も差し替える
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, default: { ...actual, execFile: execFileMock }, execFile: execFileMock };
});

import { isBareFileName, resolveFromPath } from './pathResolver';

describe('isBareFileName', () => {
  it.each(['calc.exe', 'run.bat', 'notepad'])('%s はファイル名だけ', (p) => {
    expect(isBareFileName(p)).toBe(true);
  });

  it.each([
    'C:\\Tools\\tool.exe',
    'tools\\run.exe',
    'C:/Tools/run.bat',
    '\\\\server\\share\\a.exe',
  ])('%s は区切りを含む', (p) => {
    expect(isBareFileName(p)).toBe(false);
  });
});

describe('resolveFromPath', () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  it('$PATH: を付けて where で探し、最初に見つかったフルパスを返す', async () => {
    await expect(resolveFromPath('notepad.exe')).resolves.toBe(
      'C:\\Windows\\System32\\notepad.exe'
    );
    expect(execFileMock).toHaveBeenCalledWith(
      'where',
      ['$PATH:notepad.exe'],
      expect.anything(),
      expect.any(Function)
    );
  });

  it('見つからないときは null を返す', async () => {
    execFileMock.mockImplementationOnce((_cmd, _args, _opts, cb: ExecFileCallback) =>
      cb(new Error('not found'))
    );

    await expect(resolveFromPath('missing.exe')).resolves.toBeNull();
  });

  it('ワイルドカード入りの名前は探さない', async () => {
    await expect(resolveFromPath('*.exe')).resolves.toBeNull();
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
