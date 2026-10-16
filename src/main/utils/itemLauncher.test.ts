import type { Logger } from 'pino';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 起動できたら spawn、起動できなければ error が来る。spawnError を入れると error にする
const spawnState = vi.hoisted(() => ({ spawnError: undefined as Error | undefined }));
const spawnMock = vi.hoisted(() =>
  vi.fn(() => ({
    unref: vi.fn(),
    once: vi.fn((event: string, handler: (error?: Error) => void) => {
      if (event === 'error' && spawnState.spawnError) handler(spawnState.spawnError);
      if (event === 'spawn' && !spawnState.spawnError) handler();
    }),
  }))
);
// PATH から探した結果を返す
const resolveFromPathMock = vi.hoisted(() =>
  vi.fn(async (_name: string): Promise<string | null> => 'C:\\Windows\\System32\\calc.exe')
);
const shellMock = vi.hoisted(() => ({
  openExternal: vi.fn(async () => {}),
  openPath: vi.fn(async () => ''),
}));

// 組み込みモジュールの名前付き import は default 経由で解決されるので、default 側も差し替える
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const mocks = { spawn: spawnMock };
  return { ...actual, default: { ...actual, ...mocks }, ...mocks };
});
vi.mock('electron', () => ({ shell: shellMock }));
vi.mock('./pathResolver.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./pathResolver.js')>()),
  resolveFromPath: resolveFromPathMock,
}));
vi.mock('../services/clipboardService.js', () => ({ ClipboardService: { getInstance: vi.fn() } }));
vi.mock('./folderPathProbe.js', () => ({ noteLaunchedPath: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/mainI18n.js', () => ({ mainI18n: { t: (key: string) => key } }));

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
    spawnState.spawnError = undefined;
    resolveFromPathMock.mockClear();
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

    expect(resolveFromPathMock).toHaveBeenCalledWith('calc.exe');
    expect(shellMock.openPath).toHaveBeenCalledWith('C:\\Windows\\System32\\calc.exe');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('PATH に見つからないファイル名は開かず、ログに残す', async () => {
    resolveFromPathMock.mockResolvedValueOnce(null);

    await launchItem({ type: 'app', path: 'missing.exe' }, logger);

    expect(shellMock.openPath).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'missing.exe' }),
      'PATH にアプリが見つからないため起動できません'
    );
  });

  it('フルパスは PATH を探さない', async () => {
    await launchItem({ type: 'app', path: 'C:\\Tools\\tool.exe' }, logger);

    expect(resolveFromPathMock).not.toHaveBeenCalled();
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

describe('launchItem の結果', () => {
  beforeEach(() => {
    spawnState.spawnError = undefined;
    shellMock.openPath.mockReset();
    shellMock.openPath.mockResolvedValue('');
    resolveFromPathMock.mockReset();
    resolveFromPathMock.mockResolvedValue('C:/Windows/System32/calc.exe');
  });

  it('開けたら success: true', async () => {
    await expect(launchItem({ type: 'file', path: 'C:/a.txt' }, logger)).resolves.toEqual({
      success: true,
    });
    await expect(
      launchItem({ type: 'app', path: 'C:/Tools/t.exe', args: '-x' }, logger)
    ).resolves.toEqual({ success: true });
  });

  it('shell.openPath が理由を返したら、その理由で失敗にする', async () => {
    shellMock.openPath.mockResolvedValue('Failed to open path');
    await expect(launchItem({ type: 'folder', path: 'C:/gone' }, logger)).resolves.toEqual({
      success: false,
      error: 'Failed to open path',
    });
  });

  it('spawn が error を出したら、その理由で失敗にする', async () => {
    spawnState.spawnError = new Error('spawn C:/Tools/t.exe ENOENT');
    await expect(
      launchItem({ type: 'app', path: 'C:/Tools/t.exe', args: '-x' }, logger)
    ).resolves.toEqual({ success: false, error: 'spawn C:/Tools/t.exe ENOENT' });
  });

  it('ファイル名だけのアプリが PATH に無ければ失敗にする', async () => {
    resolveFromPathMock.mockResolvedValue(null);
    await expect(launchItem({ type: 'app', path: 'nothing.exe' }, logger)).resolves.toEqual({
      success: false,
      error: 'launcher.messages.appNotFoundInPath',
    });
  });
});
