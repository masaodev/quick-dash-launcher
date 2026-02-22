import * as path from 'path';
import * as fs from 'fs';

import { net } from 'electron';
import { faviconLogger } from '@common/logger';

interface FaviconSource {
  url: string;
  size?: number;
  isOgImage?: boolean;
}

export class FaviconService {
  private faviconsFolder: string;
  private defaultSize = 64;
  private htmlDownloadTimeout = 5000;
  private faviconDownloadTimeout = 3000;

  constructor(faviconsFolder: string) {
    this.faviconsFolder = faviconsFolder;
  }

  async fetchFavicon(url: string): Promise<string | null> {
    try {
      const domain = new URL(url).hostname;
      const faviconPath = path.join(
        this.faviconsFolder,
        `${domain}_favicon_${this.defaultSize}.png`
      );

      // キャッシュをチェック
      if (fs.existsSync(faviconPath)) {
        const cachedFavicon = fs.readFileSync(faviconPath);
        return `data:image/png;base64,${cachedFavicon.toString('base64')}`;
      }

      // 複数の方法でファビコンを取得
      const faviconData = await this.tryMultipleSources(url);

      if (faviconData) {
        // キャッシュに保存
        fs.writeFileSync(faviconPath, faviconData);
        return `data:image/png;base64,${faviconData.toString('base64')}`;
      }

      return null;
    } catch (error) {
      faviconLogger.error({ error }, 'ファビコンの取得に失敗しました');
      return null;
    }
  }

  private async tryMultipleSources(url: string): Promise<Buffer | null> {
    const sources = await this.getFaviconSources(url);

    for (const source of sources) {
      try {
        faviconLogger.info(
          { url: source.url, size: source.size, isOgImage: source.isOgImage },
          'ファビコンダウンロードを試行'
        );
        const data = await this.downloadFavicon(source.url);
        if (data && data.length > 0) {
          faviconLogger.info(
            { url: source.url, dataSize: data.length },
            'ファビコンダウンロード成功'
          );
          return data;
        }
      } catch (error) {
        const errorMessage = this.getErrorMessage(error);
        faviconLogger.info({ url: source.url, error }, errorMessage);
      }
    }

    return null;
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'ファビコンソースの取得に失敗';
    }
    if (error.message.includes('タイムアウト')) {
      return 'ファビコンダウンロードがタイムアウト';
    }
    if (error.message.startsWith('HTTP ')) {
      return `HTTPエラー (${error.message})`;
    }
    return 'ファビコンソースの取得に失敗';
  }

  private async getFaviconSources(url: string): Promise<FaviconSource[]> {
    const sources: FaviconSource[] = [];
    const origin = new URL(url).origin;
    let isNetworkError = false;

    try {
      const htmlSources = await this.parseHtmlForFavicons(url);
      sources.push(...htmlSources);
    } catch (error) {
      isNetworkError = this.isNetworkError(error);
      const logMessage = isNetworkError
        ? 'ネットワークエラーのため標準ファビコンソースをスキップ'
        : 'HTML解析をスキップ（標準的なファビコンソースを試行）';
      faviconLogger.info({ error }, logMessage);
    }

    if (!isNetworkError) {
      sources.push(
        { url: `${origin}/favicon.ico`, size: 32 },
        { url: `${origin}/favicon.png`, size: 32 },
        { url: `${origin}/apple-touch-icon.png`, size: 180 },
        { url: `${origin}/apple-touch-icon-precomposed.png`, size: 180 },
        { url: `${origin}/icon.png`, size: 32 },
        { url: `${origin}/logo.png`, size: 64 }
      );
    }

    return sources;
  }

  private async parseHtmlForFavicons(url: string): Promise<FaviconSource[]> {
    const sources: FaviconSource[] = [];

    try {
      const html = await this.fetchHtml(url);
      const origin = new URL(url).origin;

      const iconPatterns = [
        // 標準的なfaviconタグ
        /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/gi,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon)["']/gi,
        // Apple touch icons
        /<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]+href=["']([^"']+)["']/gi,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon(?:-precomposed)?["']/gi,
        // サイズ指定のあるアイコン
        /<link[^>]+rel=["']icon["'][^>]+sizes=["']([^"']+)["'][^>]+href=["']([^"']+)["']/gi,
        /<link[^>]+href=["']([^"']+)["'][^>]+sizes=["']([^"']+)["'][^>]+rel=["']icon["']/gi,
        // OGP画像（フォールバック用）
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
      ];

      const foundUrls = new Set<string>();

      for (const pattern of iconPatterns) {
        let match;
        pattern.lastIndex = 0;

        while ((match = pattern.exec(html)) !== null) {
          if (pattern.source.includes('sizes')) {
            const href = match[2] || match[1];
            const iconUrl = this.resolveUrl(href, origin);
            if (iconUrl && !foundUrls.has(iconUrl)) {
              foundUrls.add(iconUrl);
              const sizes = match[1] || match[2];
              if (sizes && sizes.includes('x')) {
                const size = parseInt(sizes.split('x')[0]);
                if (size < 300) {
                  sources.push({ url: iconUrl, size });
                }
              } else {
                sources.push({ url: iconUrl });
              }
            }
          } else {
            const iconUrl = this.resolveUrl(match[1], origin);
            if (iconUrl && !foundUrls.has(iconUrl)) {
              foundUrls.add(iconUrl);
              const isOgImage = pattern.source.includes('og:image');
              sources.push({ url: iconUrl, isOgImage });
            }
          }
        }
      }

      this.sortFaviconSources(sources);

      faviconLogger.info(
        {
          url,
          sources: sources.map((s) => ({ url: s.url, size: s.size, isOgImage: s.isOgImage })),
        },
        'ファビコンソース取得完了'
      );
    } catch (error) {
      faviconLogger.error({ error }, 'HTML解析エラー');
    }

    return sources;
  }

  private sortFaviconSources(sources: FaviconSource[]): void {
    const idealSize = 64;
    sources.sort((a, b) => {
      // OGP画像は最低優先度
      if (a.isOgImage && !b.isOgImage) return 1;
      if (!a.isOgImage && b.isOgImage) return -1;

      // apple-touch-iconを高優先度に
      const aIsApple = a.url.includes('apple-touch-icon');
      const bIsApple = b.url.includes('apple-touch-icon');
      if (aIsApple && !bIsApple) return -1;
      if (!aIsApple && bIsApple) return 1;

      // faviconを優先
      const aIsFavicon = a.url.includes('favicon');
      const bIsFavicon = b.url.includes('favicon');
      if (aIsFavicon && !bIsFavicon) return -1;
      if (!aIsFavicon && bIsFavicon) return 1;

      // サイズが指定されている場合は64px前後を優先
      if (a.size && b.size) {
        return Math.abs(a.size - idealSize) - Math.abs(b.size - idealSize);
      }

      return 0;
    });
  }

  private async fetchHtml(url: string): Promise<string> {
    let data = '';

    await this.makeRequest({
      url,
      timeout: this.htmlDownloadTimeout,
      timeoutMessage: `HTMLダウンロードがタイムアウトしました: ${url}`,
      onData(chunk, finish) {
        data += chunk.toString();
        if (data.length > 5000) {
          finish();
        }
      },
    });

    return data;
  }

  private async downloadFavicon(url: string): Promise<Buffer | null> {
    const chunks: Buffer[] = [];

    await this.makeRequest({
      url,
      timeout: this.faviconDownloadTimeout,
      timeoutMessage: `ファビコンダウンロードがタイムアウトしました: ${url}`,
      checkStatus: true,
      onData(chunk) {
        chunks.push(chunk);
      },
    });

    return Buffer.concat(chunks);
  }

  private makeRequest(options: {
    url: string;
    timeout: number;
    timeoutMessage: string;
    checkStatus?: boolean;
    onData: (chunk: Buffer, finish: () => void) => void;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = net.request(options.url);
      request.setHeader(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );

      let isFinished = false;

      function finish(error?: Error): void {
        if (isFinished) return;
        isFinished = true;
        clearTimeout(timeoutId);
        request.abort();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }

      const timeoutId = setTimeout(() => {
        finish(new Error(options.timeoutMessage));
      }, options.timeout);

      request.on('response', (response) => {
        if (options.checkStatus && response.statusCode !== 200) {
          finish(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.on('data', (chunk) => {
          if (!isFinished) {
            options.onData(chunk, () => finish());
          }
        });

        response.on('end', () => finish());
        response.on('error', (error) => finish(error));
      });

      request.on('error', (error) => finish(error));

      request.end();
    });
  }

  private resolveUrl(url: string, base: string): string | null {
    try {
      if (url.startsWith('//')) {
        return `https:${url}`;
      }
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      return new URL(url, base).href;
    } catch {
      return null;
    }
  }

  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    const networkErrorPatterns = [
      'タイムアウト',
      'enotfound',
      'getaddrinfo',
      'econnrefused',
      'etimedout',
      'enetunreach',
      'econnreset',
      'ehostunreach',
    ];

    return networkErrorPatterns.some((pattern) => message.includes(pattern));
  }
}
