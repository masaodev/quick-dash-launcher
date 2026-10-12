import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false } }));
vi.mock('@common/logger', () => ({
  createChildLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import {
  CLI_EXE_NAME,
  addPathEntry,
  getCliInstallDir,
  installCli,
  removePathEntry,
  uninstallCli,
} from './cliInstallService';
import type { CliInstallTarget, UserPathStore } from './cliInstallService';

describe('addPathEntry / removePathEntry', () => {
  const dir = 'C:\\Users\\taro\\AppData\\Local\\quick-dash-launcher\\bin';

  it('無ければ末尾に足し、%VAR% の書き方はそのまま残す', () => {
    expect(addPathEntry('%USERPROFILE%\\bin;C:\\tools', dir)).toBe(
      `%USERPROFILE%\\bin;C:\\tools;${dir}`
    );
  });

  it('大文字小文字・末尾の \\ が違っても、既にあれば変えない', () => {
    expect(addPathEntry(`C:\\tools;${dir.toUpperCase()}\\`, dir)).toBeNull();
  });

  it('空の PATH や空の要素があっても壊さない', () => {
    expect(addPathEntry('', dir)).toBe(dir);
    expect(addPathEntry('C:\\a;;C:\\b;', dir)).toBe(`C:\\a;C:\\b;${dir}`);
  });

  it('外すときは該当の要素だけを除き、無ければ変えない', () => {
    expect(removePathEntry(`C:\\a;${dir}\\;%LOCALAPPDATA%\\x`, dir)).toBe(
      'C:\\a;%LOCALAPPDATA%\\x'
    );
    expect(removePathEntry('C:\\a', dir)).toBeNull();
  });
});

describe('installCli / uninstallCli', () => {
  let root: string;
  let target: CliInstallTarget;
  let pathValue: string;
  let store: UserPathStore & { write: ReturnType<typeof vi.fn>; read: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-cli-install-'));
    fs.mkdirSync(path.join(root, 'resources', 'bin'), { recursive: true });
    fs.writeFileSync(path.join(root, 'resources', 'bin', CLI_EXE_NAME), 'v1');
    pathValue = 'C:\\tools';
    store = {
      read: vi.fn(async () => pathValue),
      write: vi.fn(async (v: string) => {
        pathValue = v;
      }),
    };
    target = {
      sourceExe: path.join(root, 'resources', 'bin', CLI_EXE_NAME),
      installDir: getCliInstallDir(path.join(root, 'Local')),
      pathStore: store,
    };
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('初回はコピーして PATH に足す', async () => {
    const result = await installCli(target, { checkPath: true });
    expect(result).toMatchObject({ copied: true, pathChanged: true });
    expect(fs.readFileSync(result.installedExe, 'utf8')).toBe('v1');
    expect(pathValue).toBe(`C:\\tools;${target.installDir}`);
  });

  it('同じ中身ならコピーせず、PATH にあれば書き換えない', async () => {
    await installCli(target, { checkPath: true });
    store.write.mockClear();
    const result = await installCli(target, { checkPath: true });
    expect(result).toMatchObject({ copied: false, pathChanged: false });
    expect(store.write).not.toHaveBeenCalled();
  });

  it('同梱の qdl.exe が変わっていれば入れ替える（本体の更新に追従）', async () => {
    await installCli(target, { checkPath: true });
    fs.writeFileSync(target.sourceExe, 'v2');
    const result = await installCli(target, { checkPath: false });
    expect(result.copied).toBe(true);
    expect(fs.readFileSync(result.installedExe, 'utf8')).toBe('v2');
    expect(store.read).toHaveBeenCalledTimes(1);
  });

  it('同梱の qdl.exe が無ければ失敗する', async () => {
    fs.rmSync(target.sourceExe);
    await expect(installCli(target, { checkPath: true })).rejects.toThrow('見つかりません');
  });

  it('外すと PATH から除き、コピーした qdl.exe を消す', async () => {
    const { installedExe } = await installCli(target, { checkPath: true });
    const result = await uninstallCli(target);
    expect(result).toEqual({ removed: true, pathChanged: true });
    expect(fs.existsSync(installedExe)).toBe(false);
    expect(pathValue).toBe('C:\\tools');
  });

  it('置いていなければ、PATH を読まずに何もしない', async () => {
    const result = await uninstallCli(target);
    expect(result).toEqual({ removed: false, pathChanged: false });
    expect(store.read).not.toHaveBeenCalled();
  });
});
