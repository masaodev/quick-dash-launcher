import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { WindowIdleDestroyer } from './windowIdleDestroyer';

describe('WindowIdleDestroyer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scheduleからidleMs経過後にdestroyFnが呼ばれる', () => {
    const destroyFn = vi.fn();
    const destroyer = new WindowIdleDestroyer(1000, destroyFn);

    destroyer.schedule();
    vi.advanceTimersByTime(999);
    expect(destroyFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(destroyFn).toHaveBeenCalledTimes(1);
  });

  it('cancelするとdestroyFnは呼ばれない', () => {
    const destroyFn = vi.fn();
    const destroyer = new WindowIdleDestroyer(1000, destroyFn);

    destroyer.schedule();
    destroyer.cancel();
    vi.advanceTimersByTime(2000);
    expect(destroyFn).not.toHaveBeenCalled();
  });

  it('再scheduleでタイマーが張り直される', () => {
    const destroyFn = vi.fn();
    const destroyer = new WindowIdleDestroyer(1000, destroyFn);

    destroyer.schedule();
    vi.advanceTimersByTime(900);
    destroyer.schedule();
    vi.advanceTimersByTime(900);
    expect(destroyFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(destroyFn).toHaveBeenCalledTimes(1);
  });

  it('未scheduleでcancelしてもエラーにならない', () => {
    const destroyer = new WindowIdleDestroyer(1000, vi.fn());
    expect(() => destroyer.cancel()).not.toThrow();
  });
});
