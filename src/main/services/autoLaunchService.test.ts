import fs from 'fs';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const electronMock = vi.hoisted(() => ({
  app: { isPackaged: true },
  shell: {
    writeShortcutLink: vi.fn(() => true),
    readShortcutLink: vi.fn<(p: string) => { target: string }>(() => ({ target: '' })),
  },
}));

/** Store 版の StartupTask の代わり（state は WinRT の StartupTaskState と同じ数値） */
const task = vi.hoisted(() => ({
  state: 0,
  requestEnableAsync: vi.fn(),
  disable: vi.fn(),
}));

vi.mock('electron', () => electronMock);

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const startupTaskMock = vi.hoisted(() => ({
  getAsync: vi.fn<() => Promise<unknown>>(),
}));

vi.mock('../winrt/generated/windows/application-model/StartupTask.js', () => ({
  StartupTask: startupTaskMock,
}));

import { isSameExePath } from '../utils/exePath';

import { AutoLaunchService } from './autoLaunchService';

const original = {
  platform: Object.getOwnPropertyDescriptor(process, 'platform'),
  windowsStore: Object.getOwnPropertyDescriptor(process, 'windowsStore'),
};

function setStoreBuild(isStore: boolean): void {
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  Object.defineProperty(process, 'windowsStore', { value: isStore, configurable: true });
}

describe('AutoLaunchService（Store 版）', () => {
  const service = AutoLaunchService.getInstance();

  beforeEach(() => {
    setStoreBuild(true);
    electronMock.app.isPackaged = true;
    task.state = 0;
    // 最後に反映した値はシングルトンに残るので、テストごとに戻す
    (service as unknown as { storeAppliedValue?: boolean }).storeAppliedValue = undefined;
    startupTaskMock.getAsync.mockReset().mockImplementation(async () => task);
    task.requestEnableAsync.mockReset().mockImplementation(async () => {
      task.state = 2;
      return 2;
    });
    task.disable.mockReset().mockImplementation(() => {
      task.state = 0;
    });
    electronMock.shell.writeShortcutLink.mockClear();
  });

  afterEach(() => {
    if (original.platform) Object.defineProperty(process, 'platform', original.platform);
    if (original.windowsStore) {
      Object.defineProperty(process, 'windowsStore', original.windowsStore);
    } else {
      delete (process as { windowsStore?: boolean }).windowsStore;
    }
  });

  it('オンにすると StartupTask を有効にし、ショートカットは作らない', async () => {
    await service.setAutoLaunch(true);
    expect(task.requestEnableAsync).toHaveBeenCalledTimes(1);
    expect(electronMock.shell.writeShortcutLink).not.toHaveBeenCalled();
  });

  it('オフにすると StartupTask を無効にする', async () => {
    task.state = 2;
    await service.setAutoLaunch(false);
    expect(task.disable).toHaveBeenCalledTimes(1);
  });

  it('起動時は、設定がオンで Windows 側が無効のときだけ有効にする', async () => {
    await service.applyOnStartup(true);
    expect(task.requestEnableAsync).toHaveBeenCalledTimes(1);
  });

  it('起動時に、利用者が Windows 側で無効にしたものは有効にしようとしない', async () => {
    task.state = 1;
    await service.applyOnStartup(true);
    expect(task.requestEnableAsync).not.toHaveBeenCalled();
  });

  it('起動時に、設定がオフでも Windows 側で有効にしたものは無効に戻さない', async () => {
    task.state = 2;
    await service.applyOnStartup(false);
    expect(task.disable).not.toHaveBeenCalled();
  });

  it('状態を Store 版の state として返す', async () => {
    task.state = 1;
    await expect(service.getAutoLaunchStatus()).resolves.toEqual({
      mode: 'store',
      state: 'disabledByUser',
    });
  });

  it('パッケージ化されていなければ unsupported を返し、StartupTask に触れない', async () => {
    electronMock.app.isPackaged = false;
    await expect(service.getAutoLaunchStatus()).resolves.toEqual({ mode: 'unsupported' });
    await service.setAutoLaunch(true);
    expect(task.requestEnableAsync).not.toHaveBeenCalled();
  });

  it('自動起動以外の設定の保存で同じ値が届いても、Windows 側でオンにしたものを無効に戻さない', async () => {
    await service.applyOnStartup(false);
    task.state = 2; // 利用者が Windows の設定でオンにした
    await service.setAutoLaunch(false);
    expect(task.disable).not.toHaveBeenCalled();
  });

  it('StartupTask の取得に失敗しても例外にしない（設定の保存を止めない）', async () => {
    startupTaskMock.getAsync.mockRejectedValue(new Error('load failed'));
    await expect(service.setAutoLaunch(true)).resolves.toBeUndefined();
  });

  it('TaskId がマニフェストに無く null が返ったときは状態の取得をエラーにする', async () => {
    startupTaskMock.getAsync.mockResolvedValue(null);
    await expect(service.getAutoLaunchStatus()).rejects.toThrow('not declared');
  });
});

describe('AutoLaunchService（ショートカット）', () => {
  const service = AutoLaunchService.getInstance();
  const ownExe = 'C:\\Program Files\\QuickDashLauncher\\QuickDashLauncher.exe';
  const savedEnv = {
    APPDATA: process.env.APPDATA,
    APP_INSTANCE: process.env.APP_INSTANCE,
    // QDL から開いたシェルでテストを流すと、QDL のこの値を受け継いでいることがある
    PORTABLE_EXECUTABLE_FILE: process.env.PORTABLE_EXECUTABLE_FILE,
  };
  const execPath = Object.getOwnPropertyDescriptor(process, 'execPath');
  let unlink: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setStoreBuild(false);
    electronMock.app.isPackaged = true;
    process.env.APPDATA = 'C:\\Users\\u\\AppData\\Roaming';
    delete process.env.APP_INSTANCE;
    delete process.env.PORTABLE_EXECUTABLE_FILE;
    Object.defineProperty(process, 'execPath', { value: ownExe, configurable: true });
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    unlink = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);
    electronMock.shell.readShortcutLink.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (execPath) Object.defineProperty(process, 'execPath', execPath);
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (original.platform) Object.defineProperty(process, 'platform', original.platform);
    if (original.windowsStore) {
      Object.defineProperty(process, 'windowsStore', original.windowsStore);
    } else {
      delete (process as { windowsStore?: boolean }).windowsStore;
    }
  });

  it('オフにすると、自分の exe を指すショートカットを消す（大文字・小文字の違いは同じとみなす）', async () => {
    electronMock.shell.readShortcutLink.mockReturnValue({ target: ownExe.toLowerCase() });
    await service.setAutoLaunch(false);
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it('オフにしても、別の QDL の exe を指すショートカットは消さない', async () => {
    electronMock.shell.readShortcutLink.mockReturnValue({
      target: 'D:\\tools\\QuickDashLauncher\\QuickDashLauncher.exe',
    });
    await service.setAutoLaunch(false);
    expect(unlink).not.toHaveBeenCalled();
  });

  it('行き先が読めないショートカットは自分のものとして消す', async () => {
    electronMock.shell.readShortcutLink.mockImplementation(() => {
      throw new Error('broken');
    });
    await service.setAutoLaunch(false);
    expect(unlink).toHaveBeenCalledTimes(1);
  });
});

describe('isSameExePath', () => {
  it('大文字・小文字と区切り文字の違いは同じとみなす', () => {
    expect(
      isSameExePath('C:/Apps/QDL/QuickDashLauncher.exe', 'c:\\apps\\qdl\\quickdashlauncher.exe')
    ).toBe(true);
  });

  it('別のフォルダの exe は違うとみなす', () => {
    expect(
      isSameExePath('C:\\Apps\\QDL\\QuickDashLauncher.exe', 'D:\\QDL\\QuickDashLauncher.exe')
    ).toBe(false);
  });
});
