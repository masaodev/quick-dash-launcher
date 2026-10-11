import { describe, it, expect, vi, beforeEach } from 'vitest';

const registered = vi.hoisted(() => new Map<string, () => void>());
const globalShortcutMock = vi.hoisted(() => ({
  register: vi.fn((key: string, handler: () => void) => {
    if (registered.has(key)) return false;
    registered.set(key, handler);
    return true;
  }),
  unregister: vi.fn((key: string) => {
    registered.delete(key);
  }),
  unregisterAll: vi.fn(() => registered.clear()),
}));

vi.mock('electron', () => ({ globalShortcut: globalShortcutMock, BrowserWindow: {} }));
vi.mock('@common/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./settingsService.js', () => ({ SettingsService: { getInstance: vi.fn() } }));

import { HotkeyService } from './hotkeyService';

const service = HotkeyService.getInstance(
  () => null,
  async () => {},
  async () => {}
);

describe('HotkeyService の一時解除（ホットキー入力欄の録画中）', () => {
  beforeEach(() => {
    service.unregisterAllHotkeys();
    service.resumeHotkeys(); // 前のテストで外したままの状態を残さない
    service.unregisterAllHotkeys();
    vi.clearAllMocks();
  });

  it('suspendHotkeys で外し、resumeHotkeys で同じホットキーを登録し直す', () => {
    service.setHotkey('Alt+Space');
    service.setItemSearchHotkey('Ctrl+Alt+W');

    service.suspendHotkeys();
    expect(registered.has('Alt+Space')).toBe(false);
    expect(registered.has('Ctrl+Alt+W')).toBe(false);
    expect(service.getCurrentHotkey()).toBeNull();

    service.resumeHotkeys();
    expect(registered.has('Alt+Space')).toBe(true);
    expect(registered.has('Ctrl+Alt+W')).toBe(true);
    expect(service.getCurrentHotkey()).toBe('Alt+Space');
    expect(service.getCurrentItemSearchHotkey()).toBe('Ctrl+Alt+W');
  });

  it('未設定のホットキーは登録し直さない', () => {
    service.setHotkey('Alt+Space');

    service.suspendHotkeys();
    service.resumeHotkeys();

    expect(service.getCurrentItemSearchHotkey()).toBeNull();
    expect([...registered.keys()]).toEqual(['Alt+Space']);
  });

  it('外している間に登録し直されたホットキーは、resumeHotkeys で元に戻さない', () => {
    service.setHotkey('Alt+Space');

    service.suspendHotkeys();
    service.setHotkey('Ctrl+Alt+Q');
    service.resumeHotkeys();

    expect(service.getCurrentHotkey()).toBe('Ctrl+Alt+Q');
    expect(registered.has('Alt+Space')).toBe(false);
  });

  it('suspendHotkeys を続けて呼んでも、最初に外したホットキーを覚えている', () => {
    service.setHotkey('Alt+Space');

    service.suspendHotkeys();
    service.suspendHotkeys();
    service.resumeHotkeys();

    expect(service.getCurrentHotkey()).toBe('Alt+Space');
  });

  it('外していないときの resumeHotkeys は何もしない', () => {
    service.resumeHotkeys();

    expect(globalShortcutMock.register).not.toHaveBeenCalled();
  });
});
