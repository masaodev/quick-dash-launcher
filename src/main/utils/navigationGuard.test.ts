import { describe, it, expect, vi } from 'vitest';
import type { WebContents } from 'electron';

const appOn = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ app: { on: appOn } }));

import { guardNavigation, installNavigationGuard } from './navigationGuard';

type Listener = (
  event: { preventDefault: () => void; url?: string; isMainFrame?: boolean },
  url?: string
) => void;

/** on で登録されたリスナーを覚える、偽の webContents */
function fakeContents(type: string, currentUrl = 'http://localhost:9001/index.html') {
  const listeners = new Map<string, Listener>();
  const contents = {
    getType: () => type,
    getURL: () => currentUrl,
    on: vi.fn((name: string, listener: Listener) => listeners.set(name, listener)),
  };
  return { contents: contents as unknown as WebContents, listeners };
}

describe('guardNavigation', () => {
  it('画面では、メインフレームの移動（will-navigate）と iframe の移動（will-frame-navigate）を止める', () => {
    const { contents, listeners } = fakeContents('window');
    guardNavigation(contents);

    const navigate = { preventDefault: vi.fn() };
    listeners.get('will-navigate')!(navigate, 'https://example.com/');
    expect(navigate.preventDefault).toHaveBeenCalled();

    const frame = { preventDefault: vi.fn(), url: 'https://example.com/frame', isMainFrame: false };
    listeners.get('will-frame-navigate')!(frame);
    expect(frame.preventDefault).toHaveBeenCalled();

    // メインフレームは will-navigate が止めるので、will-frame-navigate では扱わない
    const main = { preventDefault: vi.fn(), url: 'https://example.com/', isMainFrame: true };
    listeners.get('will-frame-navigate')!(main);
    expect(main.preventDefault).not.toHaveBeenCalled();
  });

  it('今と同じ URL への移動は止めない（開発サーバーの Vite の移り直し）', () => {
    const { contents, listeners } = fakeContents('window', 'http://localhost:9001/index.html');
    guardNavigation(contents);

    const same = { preventDefault: vi.fn() };
    listeners.get('will-navigate')!(same, 'http://localhost:9001/index.html');
    expect(same.preventDefault).not.toHaveBeenCalled();

    const other = { preventDefault: vi.fn() };
    listeners.get('will-navigate')!(other, 'http://localhost:9001/admin.html');
    expect(other.preventDefault).toHaveBeenCalled();
  });

  it('DevTools など画面でないものには付けない', () => {
    const { contents, listeners } = fakeContents('remote');
    guardNavigation(contents);
    expect(listeners.size).toBe(0);
  });
});

describe('installNavigationGuard', () => {
  it('作られた webContents に guardNavigation を付ける', () => {
    installNavigationGuard();
    expect(appOn).toHaveBeenCalledWith('web-contents-created', expect.any(Function));

    const { contents, listeners } = fakeContents('window');
    const onCreated = appOn.mock.calls[0][1] as (event: unknown, c: WebContents) => void;
    onCreated({}, contents);
    expect([...listeners.keys()]).toEqual(['will-navigate', 'will-frame-navigate']);
  });
});
