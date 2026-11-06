import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const created = vi.hoisted(() => ({ workers: [] as Array<{ terminate: () => void }> }));

vi.mock('@common/logger', () => ({ iconLogger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('worker_threads', async () => {
  const { EventEmitter: Emitter } = await import('events');
  class FakeWorker extends Emitter {
    terminate = vi.fn(async () => {
      this.emit('exit', 1);
      return 1;
    });
    constructor() {
      super();
      created.workers.push(this);
    }
    unref() {}
    /** 届いた要求にすぐ空でない PNG で答える */
    postMessage({ id }: { id: number }) {
      queueMicrotask(() => this.emit('message', { id, buffer: new Uint8Array([1, 2, 3]) }));
    }
  }
  return { Worker: FakeWorker };
});

let mod: typeof import('./fileIconWorker');

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  created.workers.length = 0;
  mod = await import('./fileIconWorker');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fileIconWorker', () => {
  it('続けて来る要求ではワーカーを使い回し、来なくなってしばらくしたら止める（A3-254）', async () => {
    await mod.extractFileIconInWorker('C:\\a.exe', 32);
    await mod.extractFileIconInWorker('C:\\b.exe', 32);
    expect(created.workers).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(mod.WORKER_IDLE_MS - 1);
    expect(created.workers[0].terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(created.workers[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('止めた後の要求ではワーカーを作り直し、止めたことを失敗として扱わない', async () => {
    await mod.extractFileIconInWorker('C:\\a.exe', 32);
    await vi.advanceTimersByTimeAsync(mod.WORKER_IDLE_MS);

    const buffer = await mod.extractFileIconInWorker('C:\\b.exe', 32);
    expect(buffer).toEqual(Buffer.from([1, 2, 3]));
    expect(created.workers).toHaveLength(2);
  });

  it('止める前に次の要求が来たら止めない', async () => {
    await mod.extractFileIconInWorker('C:\\a.exe', 32);
    await vi.advanceTimersByTimeAsync(mod.WORKER_IDLE_MS / 2);
    await mod.extractFileIconInWorker('C:\\b.exe', 32);
    await vi.advanceTimersByTimeAsync(mod.WORKER_IDLE_MS / 2 + 1);
    expect(created.workers[0].terminate).not.toHaveBeenCalled();
    expect(created.workers).toHaveLength(1);
  });
});
