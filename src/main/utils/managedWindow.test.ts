import { EventEmitter } from 'events';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';

const env = vi.hoisted(() => ({ isDevelopment: true }));

vi.mock('../config/envConfig.js', () => ({
  EnvConfig: env,
}));

/** on/emit と hide・toggleDevTools だけを持つ BrowserWindow の代用品 */
function createFakeWindow() {
  const win = new EventEmitter() as EventEmitter & {
    hide: ReturnType<typeof vi.fn>;
    webContents: EventEmitter & { toggleDevTools: ReturnType<typeof vi.fn> };
  };
  win.hide = vi.fn();
  win.webContents = Object.assign(new EventEmitter(), { toggleDevTools: vi.fn() });
  return win;
}

type FakeWindow = ReturnType<typeof createFakeWindow>;

function asWindow(win: FakeWindow): BrowserWindow {
  return win as unknown as BrowserWindow;
}

function pressKey(win: FakeWindow, input: Record<string, unknown>) {
  const event = { preventDefault: vi.fn() };
  win.webContents.emit('before-input-event', event, { type: 'keyDown', ...input });
  return event;
}

describe('managedWindow', () => {
  beforeEach(() => {
    vi.resetModules();
    env.isDevelopment = true;
  });

  it('終了処理前の close は閉じずに隠し、終了処理中は閉じさせること', async () => {
    const { hideOnClose, markAppQuitting, isAppQuitting } = await import('./managedWindow');
    const win = createFakeWindow();
    const onHidden = vi.fn();
    hideOnClose(asWindow(win), onHidden);

    const closeEvent = { preventDefault: vi.fn() };
    win.emit('close', closeEvent);
    expect(closeEvent.preventDefault).toHaveBeenCalled();
    expect(win.hide).toHaveBeenCalledTimes(1);
    expect(onHidden).toHaveBeenCalledTimes(1);

    markAppQuitting();
    expect(isAppQuitting()).toBe(true);
    const quitEvent = { preventDefault: vi.fn() };
    win.emit('close', quitEvent);
    expect(quitEvent.preventDefault).not.toHaveBeenCalled();
    expect(win.hide).toHaveBeenCalledTimes(1);
  });

  it('開発時は Ctrl+Shift+I で DevTools を開閉すること', async () => {
    const { attachCommonKeyHandlers } = await import('./managedWindow');
    const win = createFakeWindow();
    attachCommonKeyHandlers(asWindow(win));

    pressKey(win, { key: 'I', control: true, shift: true });
    expect(win.webContents.toggleDevTools).toHaveBeenCalledTimes(1);
  });

  it('本番では DevTools ショートカットを無効にすること', async () => {
    env.isDevelopment = false;
    const { attachCommonKeyHandlers } = await import('./managedWindow');
    const win = createFakeWindow();
    attachCommonKeyHandlers(asWindow(win));

    pressKey(win, { key: 'i', control: true, shift: true });
    expect(win.webContents.toggleDevTools).not.toHaveBeenCalled();
  });

  it('suppressEscape を指定したときだけ Escape を止めること', async () => {
    const { attachCommonKeyHandlers } = await import('./managedWindow');
    const suppressed = createFakeWindow();
    const passed = createFakeWindow();
    attachCommonKeyHandlers(asWindow(suppressed), { suppressEscape: true });
    attachCommonKeyHandlers(asWindow(passed));

    expect(pressKey(suppressed, { key: 'Escape' }).preventDefault).toHaveBeenCalled();
    expect(pressKey(passed, { key: 'Escape' }).preventDefault).not.toHaveBeenCalled();
  });
});
