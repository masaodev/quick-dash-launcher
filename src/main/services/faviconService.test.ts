import { EventEmitter } from 'events';

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** net.request の代わり。応答のヘッダーと本文のチャンクをテストごとに決める */
const responsePlan = vi.hoisted(() => ({
  headers: {} as Record<string, string>,
  chunks: [] as Buffer[],
  aborted: false,
  requests: 0,
}));

vi.mock('electron', async () => {
  const { EventEmitter: Emitter } = await import('events');
  return {
    nativeImage: {},
    net: {
      request: () => {
        responsePlan.requests++;
        responsePlan.aborted = false;
        const request = new Emitter() as EventEmitter & Record<string, unknown>;
        request.setHeader = () => undefined;
        request.abort = () => {
          responsePlan.aborted = true;
        };
        request.end = () => {
          setImmediate(() => {
            const response = new Emitter() as EventEmitter & Record<string, unknown>;
            response.statusCode = 200;
            response.headers = responsePlan.headers;
            request.emit('response', response);
            for (const chunk of responsePlan.chunks) {
              if (responsePlan.aborted) return;
              response.emit('data', chunk);
            }
            response.emit('end');
          });
        };
        return request;
      },
    },
  };
});
vi.mock('@common/logger', () => ({
  faviconLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { FaviconService, type FaviconDownloadShare } from './faviconService';

type Downloader = {
  downloadFavicon: (url: string) => Promise<Buffer | null>;
  downloadFaviconShared: (url: string, shared?: FaviconDownloadShare) => Promise<Buffer | null>;
};
const service = new FaviconService('unused') as unknown as Downloader & {
  faviconMaxBytes: number;
};

describe('FaviconService のダウンロードの上限', () => {
  beforeEach(() => {
    service.faviconMaxBytes = 10;
    responsePlan.headers = {};
    responsePlan.chunks = [];
    responsePlan.aborted = false;
  });

  it('上限以内なら全部を返す', async () => {
    responsePlan.chunks = [Buffer.from('12345'), Buffer.from('67890')];
    const data = await service.downloadFavicon('https://example.com/favicon.ico');
    expect(data?.toString()).toBe('1234567890');
  });

  it('受け取った量が上限を超えたら、打ち切ってエラーにする', async () => {
    responsePlan.chunks = [Buffer.from('123456'), Buffer.from('789012'), Buffer.from('x')];
    await expect(service.downloadFavicon('https://example.com/big.png')).rejects.toThrow(
      '大きすぎます'
    );
    expect(responsePlan.aborted).toBe(true);
  });

  it('Content-Length が上限を超えていたら、本文を読まずにエラーにする', async () => {
    responsePlan.headers = { 'content-length': '11' };
    responsePlan.chunks = [Buffer.from('1')];
    await expect(service.downloadFavicon('https://example.com/big.png')).rejects.toThrow(
      '大きすぎます'
    );
  });
});

describe('FaviconService の一括取得の回のうちのダウンロードの共有', () => {
  let shared: FaviconDownloadShare;
  beforeEach(() => {
    service.faviconMaxBytes = 10;
    shared = new Map();
    responsePlan.headers = {};
    responsePlan.chunks = [Buffer.from('icon')];
    responsePlan.aborted = false;
    responsePlan.requests = 0;
  });

  it('同じ回で同じ URL を同時に取りに行くと、通信は 1 回で結果を分け合う', async () => {
    const results = await Promise.all([
      service.downloadFaviconShared('https://example.com/favicon.ico', shared),
      service.downloadFaviconShared('https://example.com/favicon.ico', shared),
      service.downloadFaviconShared('https://example.com/favicon.ico', shared),
    ]);
    expect(results.map((r) => r?.toString())).toEqual(['icon', 'icon', 'icon']);
    expect(responsePlan.requests).toBe(1);
  });

  it('同じ回なら、先の取得が終わったあとでも結果を使う', async () => {
    await service.downloadFaviconShared('https://example.com/favicon.ico', shared);
    await service.downloadFaviconShared('https://example.com/favicon.ico', shared);
    expect(responsePlan.requests).toBe(1);
  });

  it('失敗も分け合う（同じサイトの 404 を何度も試さない）', async () => {
    responsePlan.chunks = [Buffer.from('12345678901')];
    const first = service.downloadFaviconShared('https://example.com/big.png', shared);
    const second = service.downloadFaviconShared('https://example.com/big.png', shared);
    await expect(first).rejects.toThrow('大きすぎます');
    await expect(second).rejects.toThrow('大きすぎます');
    expect(responsePlan.requests).toBe(1);
  });

  it('URL が違えば別に取りに行く', async () => {
    await service.downloadFaviconShared('https://example.com/favicon.ico', shared);
    await service.downloadFaviconShared('https://example.org/favicon.ico', shared);
    expect(responsePlan.requests).toBe(2);
  });

  it('回が違えば（共有を渡さない・別の回の共有）すぐ取り直す', async () => {
    await service.downloadFaviconShared('https://example.com/favicon.ico', shared);
    await service.downloadFaviconShared('https://example.com/favicon.ico', new Map());
    await service.downloadFaviconShared('https://example.com/favicon.ico');
    expect(responsePlan.requests).toBe(3);
  });
});
