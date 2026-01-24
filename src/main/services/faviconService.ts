import * as path from 'path';
import * as fs from 'fs';

import { net } from 'electron';
import { faviconLogger } from '@common/logger';

interface FaviconSource {
  url: string;
  size?: number;
  type?: string;
  isOgImage?: boolean;
}

export class FaviconService {
  private faviconsFolder: string;
  private defaultSize: number = 64; // デフォルトサイズを64pxに
  private htmlDownloadTimeout: number = 5000; // HTMLダウンロードのタイムアウト（5秒）
  private faviconDownloadTimeout: number = 3000; // ファビコンダウンロードのタイムアウト（3秒）

  constructor(faviconsFolder: string) {
    this.faviconsFolder = faviconsFolder;
  }

  /**
   * 指定されたURLのファビコンを取得し、Base64エンコードされたデータURLとして返す
   * キャッシュが存在する場合はキャッシュから読み込み、なければ複数のソースから取得を試みる
   *
   * @param url - ファビコンを取得するWebサイトのURL
   * @returns ファビコンのBase64データURL。取得に失敗した場合はnull
   * @throws Error ファビコンの取得処理中にエラーが発生した場合（ログに記録され、nullを返す）
   *
   * @example
   * ```typescript
   * const faviconService = new FaviconService();
   * const favicon = await faviconService.fetchFavicon('https://example.com');
   * if (favicon) {
   *   console.log('ファビコンを取得しました:', favicon);
   * }
   * ```
   */
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

    // 各ソースを順番に試す
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
        // エラーの種類を判定してメッセージを分ける
        let errorMessage = 'ファビコンソースの取得に失敗';
        if (error instanceof Error) {
          if (error.message.includes('タイムアウト')) {
            errorMessage = 'ファビコンダウンロードがタイムアウト';
          } else if (error.message.startsWith('HTTP ')) {
            errorMessage = `HTTPエラー (${error.message})`;
          }
        }
        faviconLogger.info({ url: source.url, error }, errorMessage);
      }
    }

    return null;
  }

  private async getFaviconSources(url: string): Promise<FaviconSource[]> {
    const sources: FaviconSource[] = [];
    const origin = new URL(url).origin;

    // 1. HTMLを解析してメタタグからファビコンを探す
    const { htmlSources, isNetworkError } = await this.tryParseHtmlForFavicons(url);
    sources.push(...htmlSources);

    // 2. ネットワークエラーでない場合のみ標準的な場所を確認
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

  /**
   * HTML解析を試行し、結果とネットワークエラーの有無を返す
   */
  private async tryParseHtmlForFavicons(
    url: string
  ): Promise<{ htmlSources: FaviconSource[]; isNetworkError: boolean }> {
    try {
      const htmlSources = await this.parseHtmlForFavicons(url);
      return { htmlSources, isNetworkError: false };
    } catch (error) {
      const isNetworkError = this.isNetworkError(error);
      const logMessage = isNetworkError
        ? 'ネットワークエラーのため標準ファビコンソースをスキップ'
        : 'HTML解析をスキップ（標準的なファビコンソースを試行）';
      faviconLogger.info({ error }, logMessage);
      return { htmlSources: [], isNetworkError };
    }
  }

  /**
   * 指定されたURLのHTMLを解析し、ファビコンとして使用可能な画像URLを抽出する
   * 標準的なファビコンタグ、Apple Touch Icons、OGP画像、マニフェストファイルなど
   * 複数のパターンに対応し、サイズ情報も含めて解析する
   *
   * @param url - 解析対象のWebサイトのURL
   * @returns ファビコンソースの配列（優先度の高い順でソート済み）
   * @throws Error HTMLの取得や解析中にエラーが発生した場合（ログに記録され、空の配列を返す）
   *
   * @example
   * ```typescript
   * const sources = await faviconService.parseHtmlForFavicons('https://example.com');
   * console.log(`${sources.length}個のファビコンソースが見つかりました`);
   * ```
   */
  private async parseHtmlForFavicons(url: string): Promise<FaviconSource[]> {
    const sources: FaviconSource[] = [];

    try {
      const html = await this.fetchHtml(url);
      const origin = new URL(url).origin;

      // ファビコン関連のメタタグを解析（より多くのパターンに対応）
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

        // OGP画像（最後の手段として使用）
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,

        // マニフェストファイル
        /<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/gi,
      ];

      // 見つかったアイコンURLを収集
      const foundUrls = new Set<string>();

      for (const pattern of iconPatterns) {
        let match;
        pattern.lastIndex = 0; // 正規表現のインデックスをリセット

        while ((match = pattern.exec(html)) !== null) {
          // サイズ指定のあるパターンの処理
          if (pattern.source.includes('sizes')) {
            const href = match[2] || match[1];
            const iconUrl = this.resolveUrl(href, origin);
            if (iconUrl && !foundUrls.has(iconUrl)) {
              foundUrls.add(iconUrl);
              // サイズ情報も取得可能な場合は追加
              const sizes = match[1] || match[2];
              if (sizes && sizes.includes('x')) {
                const size = parseInt(sizes.split('x')[0]);
                // 大きすぎるアイコン（300px以上）は除外
                if (size < 300) {
                  sources.push({ url: iconUrl, size });
                }
              } else {
                sources.push({ url: iconUrl });
              }
            }
          } else if (pattern.source.includes('manifest')) {
            // マニフェストファイルの処理（今後の拡張用）
            const manifestUrl = this.resolveUrl(match[1], origin);
            if (manifestUrl) {
              // 今はマニフェストの解析はスキップ
              faviconLogger.info({ manifestUrl }, 'マニフェストファイル検出');
            }
          } else {
            const iconUrl = this.resolveUrl(match[1], origin);
            if (iconUrl && !foundUrls.has(iconUrl)) {
              foundUrls.add(iconUrl);
              // OGP画像かどうかを判定
              const isOgImage = pattern.source.includes('og:image');
              sources.push({ url: iconUrl, isOgImage });
            }
          }
        }
      }

      // デバッグ用：取得したソースをログ出力
      faviconLogger.info(
        {
          url,
          sources: sources.map((s) => ({
            url: s.url,
            size: s.size,
            isOgImage: s.isOgImage,
          })),
        },
        'HTMLから取得したファビコンソース'
      );

      // 優先度の高い順にソート
      sources.sort((a, b) => {
        // OGP画像は最後の手段として最低優先度
        if (a.isOgImage && !b.isOgImage) return 1;
        if (!a.isOgImage && b.isOgImage) return -1;

        // apple-touch-iconを高優先度に
        if (a.url.includes('apple-touch-icon') && !b.url.includes('apple-touch-icon')) return -1;
        if (!a.url.includes('apple-touch-icon') && b.url.includes('apple-touch-icon')) return 1;

        // 標準的なrel="icon"を優先
        if (a.url.includes('favicon') && !b.url.includes('favicon')) return -1;
        if (!a.url.includes('favicon') && b.url.includes('favicon')) return 1;

        // サイズが指定されている場合は適度なサイズ（64px前後）を優先
        if (a.size && b.size) {
          const idealSize = 64;
          const aDiff = Math.abs(a.size - idealSize);
          const bDiff = Math.abs(b.size - idealSize);
          return aDiff - bDiff;
        }

        return 0;
      });

      // デバッグ用：ソート後のソースをログ出力
      faviconLogger.info(
        {
          url,
          sortedSources: sources.map((s) => ({
            url: s.url,
            size: s.size,
            isOgImage: s.isOgImage,
          })),
        },
        'ソート後のファビコンソース'
      );
    } catch (error) {
      faviconLogger.error({ error }, 'HTML解析エラー');
    }

    return sources;
  }

  private async fetchHtml(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      request.setHeader(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );

      let data = '';
      let isResolved = false;

      // タイムアウト設定
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          request.abort();
          reject(new Error(`HTMLダウンロードがタイムアウトしました: ${url}`));
        }
      }, this.htmlDownloadTimeout);

      request.on('response', (response) => {
        response.on('data', (chunk) => {
          data += chunk.toString();
          // 最初の5KBだけ読み込む（ファビコンタグは通常ヘッダー部分にある）
          if (data.length > 5000) {
            clearTimeout(timeoutId);
            isResolved = true;
            request.abort();
            resolve(data);
          }
        });

        response.on('end', () => {
          if (!isResolved) {
            clearTimeout(timeoutId);
            isResolved = true;
            resolve(data);
          }
        });
      });

      request.on('error', (error) => {
        if (!isResolved) {
          clearTimeout(timeoutId);
          isResolved = true;
          reject(error);
        }
      });

      request.end();
    });
  }

  private async downloadFavicon(url: string): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      request.setHeader(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );

      const chunks: Buffer[] = [];
      let isResolved = false;

      // タイムアウト設定
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          request.removeAllListeners();
          request.abort();
          reject(new Error(`ファビコンダウンロードがタイムアウトしました: ${url}`));
        }
      }, this.faviconDownloadTimeout);

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          clearTimeout(timeoutId);
          isResolved = true;
          request.removeAllListeners();
          response.removeAllListeners();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.on('data', (chunk) => {
          if (!isResolved) {
            chunks.push(chunk);
          }
        });

        response.on('end', () => {
          if (!isResolved) {
            clearTimeout(timeoutId);
            isResolved = true;
            request.removeAllListeners();
            response.removeAllListeners();
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
          }
        });

        response.on('error', (error) => {
          if (!isResolved) {
            clearTimeout(timeoutId);
            isResolved = true;
            request.removeAllListeners();
            response.removeAllListeners();
            reject(error);
          }
        });
      });

      request.on('error', (error) => {
        if (!isResolved) {
          clearTimeout(timeoutId);
          isResolved = true;
          request.removeAllListeners();
          reject(error);
        }
      });

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
    } catch (error) {
      faviconLogger.error({ error }, 'URL解決エラー');
      return null;
    }
  }

  /**
   * エラーがネットワーク関連のエラーかどうかを判定
   * ネットワークエラーの場合、同一オリジンの他のリソースも取得できない可能性が高い
   */
  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    const networkErrorPatterns = [
      'タイムアウト', // 日本語タイムアウトメッセージ
      'enotfound', // DNS解決失敗
      'getaddrinfo', // DNS解決失敗
      'econnrefused', // 接続拒否
      'etimedout', // 接続タイムアウト
      'enetunreach', // ネットワーク到達不可
      'econnreset', // 接続リセット
      'ehostunreach', // ホスト到達不可
    ];

    return networkErrorPatterns.some((pattern) => message.includes(pattern));
  }
}
