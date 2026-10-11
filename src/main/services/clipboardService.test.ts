import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({ clipboard: {}, nativeImage: {} }));
vi.mock('clipboard-files', () => ({ default: { readFiles: () => [] } }));
vi.mock('@common/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { ClipboardService } from './clipboardService';

const service = ClipboardService.getInstance();

/** クリップボードの読み出しを差し替え、キャプチャだけを試す */
function stubCollect(): void {
  vi.spyOn(
    service as unknown as { collectClipboardData: () => Promise<unknown> },
    'collectClipboardData'
  ).mockResolvedValue({
    success: true,
    data: {
      clipboardData: { formats: ['text'], dataSize: 1, savedAt: Date.now() },
      preview: 'x',
    },
  });
}

function pendingCount(): number {
  return (service as unknown as { pendingSessions: Map<string, unknown> }).pendingSessions.size;
}

async function capture(): Promise<string> {
  const result = await service.captureToSession();
  if (!result.success || !result.sessionId) throw new Error('capture failed');
  return result.sessionId;
}

describe('ClipboardService の未確定のキャプチャ', () => {
  beforeEach(() => {
    (service as unknown as { pendingSessions: Map<string, unknown> }).pendingSessions.clear();
    stubCollect();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('件数が上限（20 件）に達したら、古いものから捨てる', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) {
      ids.push(await capture());
    }
    expect(pendingCount()).toBe(20);
    // 最初の 1 件だけが捨てられ、2 件目以降は残る
    expect(service.discardSession(ids[0])).toBe(false);
    expect(service.discardSession(ids[1])).toBe(true);
  });

  it('24 時間より古いものは、次のキャプチャのときに捨てる', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    const oldId = await capture();
    vi.setSystemTime(new Date('2026-10-02T00:00:01Z'));
    const newId = await capture();
    expect(pendingCount()).toBe(1);
    expect(service.discardSession(oldId)).toBe(false);
    expect(service.discardSession(newId)).toBe(true);
  });

  it('期限内のものは残る', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    await capture();
    vi.setSystemTime(new Date('2026-10-01T23:00:00Z'));
    await capture();
    expect(pendingCount()).toBe(2);
  });
});
