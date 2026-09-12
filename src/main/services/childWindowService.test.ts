import { EventEmitter } from 'events';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPC_CHANNELS } from '@common/ipcChannels';

const ipcHandlers = new Map<string, (event: unknown, ...args: unknown[]) => void>();

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: (event: unknown, ...args: unknown[]) => void) => {
      ipcHandlers.set(channel, handler);
    },
  },
  net: {
    fetch: vi.fn(async () => ({ ok: true, text: async () => '<html>test</html>' })),
  },
}));

vi.mock('@common/logger', () => ({
  windowLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../config/envConfig.js', () => ({
  EnvConfig: { isDevelopment: true, devServerUrl: 'http://localhost:9999' },
}));

type Service = typeof import('./childWindowService');

/** 開き元レンダラーの webContents を模したスタブ */
class FakeWebContents extends EventEmitter {
  windowOpenHandler: ((details: { url: string; frameName: string }) => unknown) | null = null;
  send = vi.fn();
  loading = false;
  destroyed = false;

  setWindowOpenHandler(handler: (details: { url: string; frameName: string }) => unknown) {
    this.windowOpenHandler = handler;
  }
  isLoading() {
    return this.loading;
  }
  isDestroyed() {
    return this.destroyed;
  }

  /** レンダラー側の window.open → did-create-window → 書き込み完了通知 を再現する */
  simulateOpen(name: string, win: FakeWindow, url = 'about:blank') {
    const result = this.windowOpenHandler?.({ url, frameName: name }) as { action: string };
    if (result.action !== 'allow') return result;
    this.emit('did-create-window', win, { frameName: name });
    ipcHandlers.get(IPC_CHANNELS.WINDOW_CHILD_WRITTEN)?.({ sender: this }, name);
    return result;
  }
}

class FakeWindow {
  destroy = vi.fn();
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('childWindowService', () => {
  let opener: FakeWebContents;
  let openChildWindow: Service['openChildWindow'];
  let registerChildWindowOpener: Service['registerChildWindowOpener'];
  let cancelAllChildWindowCreations: Service['cancelAllChildWindowCreations'];

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    opener = new FakeWebContents();
    // モジュール内の開き元・生成待ちの状態をテストごとに初期化する
    vi.resetModules();
    ipcHandlers.clear();
    ({ openChildWindow, registerChildWindowOpener, cancelAllChildWindowCreations } =
      await import('./childWindowService'));
  });

  afterEach(() => {
    cancelAllChildWindowCreations();
    vi.useRealTimers();
  });

  it('開き元に window.open を依頼し、生成されたウィンドウを返す', async () => {
    registerChildWindowOpener('main', opener as never);
    const win = new FakeWindow();
    const promise = openChildWindow('main', {
      name: 'overlay',
      html: 'overlay.html',
      options: { width: 100 },
    });
    await flush();

    expect(opener.send).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW_OPEN_CHILD, {
      html: '<html>test</html>',
      name: 'overlay',
    });
    const result = opener.simulateOpen('overlay', win);
    expect(result).toEqual({ action: 'allow', overrideBrowserWindowOptions: { width: 100 } });
    await expect(promise).resolves.toBe(win);
  });

  it('開き元が後から登録されても生成できる', async () => {
    const win = new FakeWindow();
    const promise = openChildWindow('main', {
      name: 'workspace',
      html: 'workspace.html',
      options: {},
    });
    await flush();
    expect(opener.send).not.toHaveBeenCalled();

    registerChildWindowOpener('main', opener as never);
    await flush();
    expect(opener.send).toHaveBeenCalledTimes(1);
    opener.simulateOpen('workspace', win);
    await expect(promise).resolves.toBe(win);
  });

  it('開き元が読み込み中なら読み込み完了後に依頼する', async () => {
    opener.loading = true;
    registerChildWindowOpener('main', opener as never);
    const win = new FakeWindow();
    const promise = openChildWindow('main', { name: 'overlay', html: 'overlay.html', options: {} });
    await flush();
    expect(opener.send).not.toHaveBeenCalled();

    opener.emit('did-finish-load');
    expect(opener.send).toHaveBeenCalledTimes(1);
    opener.simulateOpen('overlay', win);
    await expect(promise).resolves.toBe(win);
  });

  it('生成待ちに対応しない window.open や about:blank 以外は拒否する', async () => {
    registerChildWindowOpener('main', opener as never);
    expect(opener.windowOpenHandler?.({ url: 'https://example.com', frameName: '' })).toEqual({
      action: 'deny',
    });

    const promise = openChildWindow('main', { name: 'overlay', html: 'overlay.html', options: {} });
    await flush();
    expect(
      opener.windowOpenHandler?.({ url: 'https://example.com', frameName: 'overlay' })
    ).toEqual({ action: 'deny' });

    cancelAllChildWindowCreations();
    await expect(promise).resolves.toBeNull();
  });

  it('タイムアウトすると null を返し、遅れて生成されたウィンドウは破棄する', async () => {
    registerChildWindowOpener('main', opener as never);
    const promise = openChildWindow('main', {
      name: 'overlay',
      html: 'overlay.html',
      options: {},
      timeoutMs: 1000,
    });
    await flush();
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeNull();

    const late = new FakeWindow();
    opener.emit('did-create-window', late, { frameName: 'overlay' });
    expect(late.destroy).toHaveBeenCalled();
  });

  it('同名の生成が進行中なら null を返す（呼び出し側で二重要求を抑止する）', async () => {
    registerChildWindowOpener('main', opener as never);
    const first = openChildWindow('main', { name: 'overlay', html: 'overlay.html', options: {} });
    const second = openChildWindow('main', { name: 'overlay', html: 'overlay.html', options: {} });
    await expect(second).resolves.toBeNull();

    await flush();
    const win = new FakeWindow();
    opener.simulateOpen('overlay', win);
    await expect(first).resolves.toBe(win);
  });

  it('タイムアウト後に同名で再要求すると新しい生成として扱う', async () => {
    registerChildWindowOpener('main', opener as never);
    const first = openChildWindow('main', {
      name: 'overlay',
      html: 'overlay.html',
      options: {},
      timeoutMs: 500,
    });
    await flush();
    vi.advanceTimersByTime(500);
    await expect(first).resolves.toBeNull();

    const second = openChildWindow('main', { name: 'overlay', html: 'overlay.html', options: {} });
    await flush();
    const win = new FakeWindow();
    opener.simulateOpen('overlay', win);
    await expect(second).resolves.toBe(win);
    expect(win.destroy).not.toHaveBeenCalled();
  });

  it('登録外の送信元からの書き込み完了通知は無視する', async () => {
    registerChildWindowOpener('main', opener as never);
    const promise = openChildWindow('main', { name: 'overlay', html: 'overlay.html', options: {} });
    await flush();
    const win = new FakeWindow();
    opener.emit('did-create-window', win, { frameName: 'overlay' });

    const stranger = new FakeWebContents();
    ipcHandlers.get(IPC_CHANNELS.WINDOW_CHILD_WRITTEN)?.({ sender: stranger }, 'overlay');
    await flush();

    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    await flush();
    expect(resolved).toBe(false);

    ipcHandlers.get(IPC_CHANNELS.WINDOW_CHILD_WRITTEN)?.({ sender: opener }, 'overlay');
    await expect(promise).resolves.toBe(win);
  });

  it('cancelAllChildWindowCreations で生成待ちを全て null にする', async () => {
    registerChildWindowOpener('main', opener as never);
    const a = openChildWindow('main', { name: 'a', html: 'overlay.html', options: {} });
    const b = openChildWindow('main', { name: 'b', html: 'overlay.html', options: {} });
    cancelAllChildWindowCreations();
    await expect(a).resolves.toBeNull();
    await expect(b).resolves.toBeNull();
  });
});
