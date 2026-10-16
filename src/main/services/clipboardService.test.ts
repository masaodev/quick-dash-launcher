import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({ clipboard: {}, nativeImage: {} }));
vi.mock('clipboard-files', () => ({ default: { readFiles: () => [] } }));
vi.mock('@common/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { clipboardDir } = vi.hoisted(() => {
  const os = require('os') as typeof import('os');
  const path = require('path') as typeof import('path');
  const fs = require('fs') as typeof import('fs');
  return { clipboardDir: fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-clipboard-test-')) };
});
vi.mock('../config/pathManager.js', () => ({
  default: {
    getClipboardDataFilePath: (id: string) =>
      (require('path') as typeof import('path')).join(clipboardDir, `${id}.json`),
  },
}));

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

describe('ClipboardService のデータファイル参照', () => {
  const extractId = (ref: string) =>
    (service as unknown as { extractIdFromRef(r: string): string | null }).extractIdFromRef(ref);

  it('clipboard-data/<ID>.json から ID を取り出す', () => {
    expect(extractId('clipboard-data/Ab3dEf9h.json')).toBe('Ab3dEf9h');
  });

  it('フォルダの外を指す参照・形の違う参照は受け付けない', () => {
    expect(extractId('clipboard-data/../settings.json')).toBeNull();
    expect(extractId('clipboard-data/sub/x.json')).toBeNull();
    expect(extractId('other/clipboard-data/x.json')).toBeNull();
    expect(extractId('clipboard-data/x.txt')).toBeNull();
  });
});

describe('ClipboardService の実データの複製', () => {
  const data = { formats: ['text'], text: 'こんにちは', dataSize: 15, savedAt: 1 };

  it('新しい ID のファイルに同じ内容を書き、その参照を返す', () => {
    fs.writeFileSync(path.join(clipboardDir, 'source1.json'), JSON.stringify(data));
    const newRef = service.duplicateClipboardData('clipboard-data/source1.json');
    expect(newRef).toMatch(/^clipboard-data\/[A-Za-z0-9_-]+\.json$/);
    expect(newRef).not.toBe('clipboard-data/source1.json');
    const newId = newRef!.replace(/^clipboard-data\//, '').replace(/\.json$/, '');
    const copied = JSON.parse(fs.readFileSync(path.join(clipboardDir, `${newId}.json`), 'utf8'));
    expect(copied).toEqual(data);
    // 元のファイルは残る
    expect(fs.existsSync(path.join(clipboardDir, 'source1.json'))).toBe(true);
  });

  it('元のファイルが無い・参照の形が違うときは null', () => {
    expect(service.duplicateClipboardData('clipboard-data/missing.json')).toBeNull();
    expect(service.duplicateClipboardData('clipboard-data/../settings.json')).toBeNull();
  });
});

describe('ClipboardService の書いたテキストの保存', () => {
  it('テキストだけの実データとして保存し、その参照とプレビューを返す', () => {
    const result = service.saveText('いつもお世話になっております。\n2 行目');
    expect(result.success).toBe(true);
    expect(result.formats).toEqual(['text']);
    expect(result.preview).toBe('いつもお世話になっております。\n2 行目');
    const id = result.dataFileRef!.replace(/^clipboard-data\//, '').replace(/\.json$/, '');
    const saved = JSON.parse(fs.readFileSync(path.join(clipboardDir, `${id}.json`), 'utf8'));
    expect(saved.text).toBe('いつもお世話になっております。\n2 行目');
    expect(saved.formats).toEqual(['text']);
  });

  it('空白だけのテキストは保存しない', () => {
    const result = service.saveText('  \n ');
    expect(result.success).toBe(false);
    expect(result.dataFileRef).toBeUndefined();
  });
});

describe('ClipboardService の中身の読み出し', () => {
  it('保存済みの実データからテキストの全文を読む', () => {
    const long = 'あ'.repeat(500);
    fs.writeFileSync(
      path.join(clipboardDir, 'read1.json'),
      JSON.stringify({ formats: ['text'], text: long, dataSize: 1500, savedAt: 1 })
    );
    expect(service.readContent({ dataFileRef: 'clipboard-data/read1.json' })).toEqual({
      text: long,
      imageThumbnail: undefined,
    });
  });

  it('未確定のキャプチャから読む', async () => {
    vi.spyOn(
      service as unknown as { collectClipboardData: () => Promise<unknown> },
      'collectClipboardData'
    ).mockResolvedValue({
      success: true,
      data: {
        clipboardData: { formats: ['text'], text: '取り込んだ文', dataSize: 1, savedAt: 1 },
        preview: '取り込んだ文',
      },
    });
    const sessionId = await capture();
    expect(service.readContent({ sessionId })?.text).toBe('取り込んだ文');
  });

  it('無いもの・参照の形が違うものは null', () => {
    expect(service.readContent({ sessionId: 'missing' })).toBeNull();
    expect(service.readContent({ dataFileRef: 'clipboard-data/missing.json' })).toBeNull();
    expect(service.readContent({ dataFileRef: 'clipboard-data/../settings.json' })).toBeNull();
    expect(service.readContent({})).toBeNull();
  });
});
