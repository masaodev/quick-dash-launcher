import type { Logger } from 'pino';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spawnMock = vi.hoisted(() => vi.fn(() => ({ unref: vi.fn(), on: vi.fn() })));
// where の結果を返す（promisify されるので、コールバックの第 2 引数が resolve される）
const execFileMock = vi.hoisted(() =>
  vi.fn(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, out?: { stdout: string; stderr: string }) => void
    ) => cb(null, { stdout: 'C:\\Windows\\System32\\calc.exe\r\n', stderr: '' })
  )
);
const shellMock = vi.hoisted(() => ({
  openExternal: vi.fn(async () => {}),
  openPath: vi.fn(async () => ''),
}));

// 組み込みモジュールの名前付き import は default 経由で解決されるので、default 側も差し替える
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const mocks = { spawn: spawnMock, execFile: execFileMock };
  return { ...actual, default: { ...actual, ...mocks }, ...mocks };
});
vi.mock('electron', () => ({ shell: shellMock }));
vi.mock('../services/clipboardService.js', () => ({ ClipboardService: { getInstance: vi.fn() } }));

import { getWorkingDirectory, launchItem } from './itemLauncher';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger;

describe('getWorkingDirectory', () => {
  it.each([
    ['C:\\Tools\\myahk\\AutoHotkey.exe', 'C:\\Tools\\myahk'],
    ['C:/Tools/run.bat', 'C:/Tools'],
    ['\\\\server\\share\\tool.exe', '\\\\server\\share\\'],
  ])('%s は %s', (executablePath, expected) => {
    expect(getWorkingDirectory(executablePath)).toBe(expected);
  });

  it.each(['notepad.exe', 'tools\\run.exe', 'C:run.exe'])(
    '絶対パスでない %s は指定しない',
    (executablePath) => {
      expect(getWorkingDirectory(executablePath)).toBeUndefined();
    }
  );
});

describe('launchItem（app）', () => {
  beforeEach(() => {
    spawnMock.mockClear();
    execFileMock.mockClear();
    shellMock.openPath.mockClear();
    vi.mocked(logger.error).mockClear();
  });

  it('引数ありの exe は、exe のフォルダを作業フォルダにして起動する', async () => {
    await launchItem(
      { type: 'app', path: 'C:\\Tools\\myahk\\AutoHotkey.exe', args: 'main.ahk' },
      logger
    );

    expect(spawnMock).toHaveBeenCalledWith(
      'C:\\Tools\\myahk\\AutoHotkey.exe',
      ['main.ahk'],
      expect.objectContaining({ cwd: 'C:\\Tools\\myahk', shell: false })
    );
  });

  it('ショートカットは拡張子の大文字・小文字を問わず、引数があっても shell.openPath で開く', async () => {
    await launchItem({ type: 'app', path: 'C:\\Tools\\Tool.LNK', args: '--x' }, logger);

    expect(shellMock.openPath).toHaveBeenCalledWith('C:\\Tools\\Tool.LNK');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('引数なしは shell.openPath で開く（spawn しない）', async () => {
    await launchItem({ type: 'app', path: 'C:\\Tools\\tool.exe' }, logger);

    expect(shellMock.openPath).toHaveBeenCalledWith('C:\\Tools\\tool.exe');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('引数なしでファイル名だけ（calc.exe）は、PATH から探したフルパスを shell.openPath で開く', async () => {
    await launchItem({ type: 'app', path: 'calc.exe' }, logger);

    expect(execFileMock).toHaveBeenCalledWith(
      'where',
      ['$PATH:calc.exe'],
      expect.anything(),
      expect.any(Function)
    );
    expect(shellMock.openPath).toHaveBeenCalledWith('C:\\Windows\\System32\\calc.exe');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('PATH に見つからないファイル名は開かず、ログに残す', async () => {
    execFileMock.mockImplementationOnce((_cmd, _args, _opts, cb) => cb(new Error('not found')));

    await launchItem({ type: 'app', path: 'missing.exe' }, logger);

    expect(shellMock.openPath).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'missing.exe' }),
      'PATH にアプリが見つからないため起動できません'
    );
  });

  it('フルパスは PATH を探さない', async () => {
    await launchItem({ type: 'app', path: 'C:\\Tools\\tool.exe' }, logger);

    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('shell.openPath が返したエラーをログに残す', async () => {
    shellMock.openPath.mockResolvedValueOnce('Failed to open path');

    await launchItem({ type: 'app', path: 'C:\\Tools\\missing.exe' }, logger);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Failed to open path' }),
      'アイテムの起動に失敗しました'
    );
  });
});

describe('launchItem（file・folder）', () => {
  beforeEach(() => {
    shellMock.openPath.mockClear();
    vi.mocked(logger.error).mockClear();
  });

  it.each(['file', 'folder'] as const)(
    '%s を開けなかったときは、shell.openPath が返したエラーをログに残す',
    async (type) => {
      shellMock.openPath.mockResolvedValueOnce('Failed to open path');

      await launchItem({ type, path: 'C:\\Docs\\missing.xlsx' }, logger);

      expect(shellMock.openPath).toHaveBeenCalledWith('C:\\Docs\\missing.xlsx');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'C:\\Docs\\missing.xlsx', error: 'Failed to open path' }),
        'アイテムの起動に失敗しました'
      );
    }
  );
});
