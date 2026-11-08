import { EventEmitter } from 'events';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** BrowserWindow の代わり。表示・非表示・破棄だけを持つ */
const created = vi.hoisted(() => ({ windows: [] as Array<Record<string, unknown>> }));

vi.mock('electron', async () => {
  const { EventEmitter: Emitter } = await import('events');
  class FakeBrowserWindow extends Emitter {
    visible = false;
    destroyed = false;
    webContents = Object.assign(new Emitter(), {
      send: vi.fn(),
      isDestroyed: () => false,
      isLoading: () => false,
    });
    constructor() {
      super();
      created.windows.push(this as unknown as Record<string, unknown>);
    }
    setMenu() {}
    setMenuBarVisibility() {}
    loadURL() {}
    loadFile() {}
    once() {
      return this;
    }
    show() {
      this.visible = true;
      this.emit('show');
    }
    hide() {
      this.visible = false;
      this.emit('hide');
    }
    focus() {}
    isVisible() {
      return this.visible;
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.emit('closed');
    }
  }
  return { BrowserWindow: FakeBrowserWindow };
});
vi.mock('@common/logger', () => ({
  windowLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./config/envConfig.js', () => ({ EnvConfig: { isDevelopment: false } }));
vi.mock('./config/pathManager.js', () => ({ default: { getAppIconPath: () => '' } }));
vi.mock('./services/settingsService.js', () => ({
  SettingsService: { getInstance: async () => ({ get: async () => 800 }) },
}));
vi.mock('./services/mainI18n.js', () => ({ mainI18n: { t: (k: string) => k } }));
vi.mock('./services/childWindowService.js', () => ({ registerChildWindowOpener: vi.fn() }));
vi.mock('./utils/managedWindow.js', () => ({
  DEFAULT_WEB_PREFERENCES: {},
  attachCommonKeyHandlers: vi.fn(),
  isAppQuitting: () => false,
}));

import {
  createAdminWindow,
  closeAdminWindow,
  hideAdminWindow,
  setAdminHasUnsavedChanges,
} from './adminWindowManager';

const FIVE_MINUTES = 5 * 60 * 1000;

type FakeWindow = EventEmitter & { show(): void; isDestroyed(): boolean };

describe('管理ウィンドウの放置での破棄（A3-258）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    created.windows.length = 0;
  });

  afterEach(() => {
    closeAdminWindow();
    vi.useRealTimers();
  });

  async function openAndHide(): Promise<FakeWindow> {
    await createAdminWindow();
    const win = created.windows[0] as unknown as FakeWindow;
    win.show();
    hideAdminWindow();
    return win;
  }

  it('未保存の変更が無ければ、隠れたまま 5 分たつと破棄する', async () => {
    setAdminHasUnsavedChanges(false);
    const win = await openAndHide();
    vi.advanceTimersByTime(FIVE_MINUTES);
    expect(win.isDestroyed()).toBe(true);
  });

  it('未保存の変更があるあいだは、隠れたまま放置しても破棄しない', async () => {
    const win = await openAndHide();
    setAdminHasUnsavedChanges(true);
    vi.advanceTimersByTime(FIVE_MINUTES * 3);
    expect(win.isDestroyed()).toBe(false);
  });

  it('隠れている間に未保存の変更が無くなったら、そこから 5 分で破棄する', async () => {
    const win = await openAndHide();
    setAdminHasUnsavedChanges(true);
    vi.advanceTimersByTime(FIVE_MINUTES * 2);
    setAdminHasUnsavedChanges(false);
    vi.advanceTimersByTime(FIVE_MINUTES - 1);
    expect(win.isDestroyed()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(win.isDestroyed()).toBe(true);
  });
});
