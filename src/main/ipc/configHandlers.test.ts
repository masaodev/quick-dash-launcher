import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPC_CHANNELS } from '@common/ipcChannels';

const handlers = vi.hoisted(
  () => new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
);
const shellMock = vi.hoisted(() => ({
  openExternal: vi.fn(async () => {}),
  openPath: vi.fn(async () => ''),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    },
  },
  shell: shellMock,
}));

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { setupConfigHandlers } from './configHandlers';

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`ハンドラーが登録されていません: ${channel}`);
  return Promise.resolve(handler({}, ...args));
}

describe('configHandlers', () => {
  let tempDir: string;

  beforeEach(() => {
    handlers.clear();
    shellMock.openExternal.mockClear();
    shellMock.openPath.mockClear();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-config-handlers-'));
    setupConfigHandlers(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('OPEN_EXTERNAL_URL', () => {
    it.each(['https://github.com/masaodev/quick-dash-launcher', 'http://localhost:9003/'])(
      '%s は開く',
      async (url) => {
        await invoke(IPC_CHANNELS.OPEN_EXTERNAL_URL, url);
        expect(shellMock.openExternal).toHaveBeenCalledWith(url);
      }
    );

    it.each([
      'file:///C:/Windows/System32/calc.exe',
      'ms-settings:display',
      'vscode://file/C:/x',
      'javascript:alert(1)',
      'not a url',
      undefined,
    ])('%s は開かない', async (url) => {
      await invoke(IPC_CHANNELS.OPEN_EXTERNAL_URL, url);
      expect(shellMock.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('SHELL_OPEN_FOLDER', () => {
    it('存在するフォルダは開く', async () => {
      await invoke(IPC_CHANNELS.SHELL_OPEN_FOLDER, tempDir);
      expect(shellMock.openPath).toHaveBeenCalledWith(tempDir);
    });

    it('ドライブ直下のアイテムの親（C: の形）はドライブのルートとして開く', async () => {
      const drive = path.parse(tempDir).root.slice(0, 2);
      await invoke(IPC_CHANNELS.SHELL_OPEN_FOLDER, drive);
      expect(shellMock.openPath).toHaveBeenCalledWith(`${drive}\\`);
    });

    it('ファイル・存在しないパス・相対パスは開かない', async () => {
      const filePath = path.join(tempDir, 'app.exe');
      fs.writeFileSync(filePath, '');

      await invoke(IPC_CHANNELS.SHELL_OPEN_FOLDER, filePath);
      await invoke(IPC_CHANNELS.SHELL_OPEN_FOLDER, path.join(tempDir, 'missing'));
      await invoke(IPC_CHANNELS.SHELL_OPEN_FOLDER, 'relative/folder');
      await invoke(IPC_CHANNELS.SHELL_OPEN_FOLDER, undefined);

      expect(shellMock.openPath).not.toHaveBeenCalled();
    });
  });
});
