import { describe, it, expect, vi, beforeEach } from 'vitest';

type Listener = (event: { preventDefault: () => void }) => void;

const windows = vi.hoisted(
  () => [] as Array<{ on: ReturnType<typeof vi.fn>; listeners: Listener[] }>
);
const serviceMock = vi.hoisted(() => ({ suspendHotkeys: vi.fn(), resumeHotkeys: vi.fn() }));

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => windows } }));
vi.mock('@common/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./hotkeyService.js', () => ({ HotkeyService: { getInstance: () => serviceMock } }));

import { isHotkeyRecording, setHotkeyRecording } from './hotkeyRecording';

function createWindow() {
  const listeners: Listener[] = [];
  const win = {
    listeners,
    on: vi.fn((name: string, listener: Listener) => {
      if (name === 'system-context-menu') listeners.push(listener);
    }),
  };
  windows.push(win);
  return win;
}

function createSender(id: number) {
  const destroyed: Array<() => void> = [];
  return {
    id,
    destroy: () => destroyed.forEach((fn) => fn()),
    once: vi.fn((name: string, fn: () => void) => {
      if (name === 'destroyed') destroyed.push(fn);
    }),
  };
}

type Sender = Parameters<typeof setHotkeyRecording>[0];

describe('setHotkeyRecording', () => {
  beforeEach(() => {
    windows.length = 0;
    vi.clearAllMocks();
  });

  it('録画の開始でホットキーを外し、終了で登録し直す', () => {
    const sender = createSender(1);

    setHotkeyRecording(sender as unknown as Sender, true);
    expect(isHotkeyRecording()).toBe(true);
    expect(serviceMock.suspendHotkeys).toHaveBeenCalledTimes(1);

    setHotkeyRecording(sender as unknown as Sender, false);
    expect(isHotkeyRecording()).toBe(false);
    expect(serviceMock.resumeHotkeys).toHaveBeenCalledTimes(1);
  });

  it('録画中だけ、ウィンドウメニュー（system-context-menu）を止める', () => {
    const win = createWindow();
    const sender = createSender(2);

    setHotkeyRecording(sender as unknown as Sender, true);
    const duringRecording = { preventDefault: vi.fn() };
    win.listeners.forEach((listener) => listener(duringRecording));
    expect(duringRecording.preventDefault).toHaveBeenCalled();

    setHotkeyRecording(sender as unknown as Sender, false);
    const afterRecording = { preventDefault: vi.fn() };
    win.listeners.forEach((listener) => listener(afterRecording));
    expect(afterRecording.preventDefault).not.toHaveBeenCalled();
  });

  it('同じウィンドウに止める処理を何度も付けない', () => {
    const win = createWindow();
    const sender = createSender(3);

    setHotkeyRecording(sender as unknown as Sender, true);
    setHotkeyRecording(sender as unknown as Sender, false);
    setHotkeyRecording(sender as unknown as Sender, true);
    setHotkeyRecording(sender as unknown as Sender, false);

    expect(win.on).toHaveBeenCalledTimes(1);
  });

  it('2 か所で録画していると、両方が終わるまで登録し直さない', () => {
    const a = createSender(4);
    const b = createSender(5);

    setHotkeyRecording(a as unknown as Sender, true);
    setHotkeyRecording(b as unknown as Sender, true);
    setHotkeyRecording(a as unknown as Sender, false);
    expect(serviceMock.resumeHotkeys).not.toHaveBeenCalled();

    setHotkeyRecording(b as unknown as Sender, false);
    expect(serviceMock.suspendHotkeys).toHaveBeenCalledTimes(1);
    expect(serviceMock.resumeHotkeys).toHaveBeenCalledTimes(1);
  });

  it('録画中にレンダラーが終了したら、ホットキーを登録し直す', () => {
    const sender = createSender(6);

    setHotkeyRecording(sender as unknown as Sender, true);
    sender.destroy();

    expect(isHotkeyRecording()).toBe(false);
    expect(serviceMock.resumeHotkeys).toHaveBeenCalledTimes(1);
  });
});
