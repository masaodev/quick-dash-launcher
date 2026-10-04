import type { Logger } from 'pino';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spawnMock = vi.hoisted(() => vi.fn(() => ({ unref: vi.fn(), on: vi.fn() })));
const shellMock = vi.hoisted(() => ({
  openExternal: vi.fn(async () => {}),
  openPath: vi.fn(async () => ''),
}));

// 組み込みモジュールの名前付き import は default 経由で解決されるので、default 側も差し替える
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, default: { ...actual, spawn: spawnMock }, spawn: spawnMock };
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
    shellMock.openPath.mockClear();
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

  it('引数なしは shell.openPath で開く（spawn しない）', async () => {
    await launchItem({ type: 'app', path: 'C:\\Tools\\tool.exe' }, logger);

    expect(shellMock.openPath).toHaveBeenCalledWith('C:\\Tools\\tool.exe');
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
