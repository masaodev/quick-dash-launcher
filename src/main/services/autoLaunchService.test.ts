import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const electronMock = vi.hoisted(() => ({
  app: { isPackaged: true },
  shell: { writeShortcutLink: vi.fn(() => true) },
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

vi.mock('../winrt/generated/windows/application-model/StartupTask.js', () => ({
  StartupTask: { getAsync: vi.fn(async () => task) },
}));

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
});
