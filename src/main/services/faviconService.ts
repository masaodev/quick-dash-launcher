import * as path from 'path';
import * as fs from 'fs';
import { net } from 'electron';

interface FaviconSource {
  url: string;
  size?: number;
  type?: string;
}

export class FaviconService {
  private faviconsFolder: string;
  private defaultSize: number = 64; // デフォルトサイズを64pxに

  constructor(faviconsFolder: string) {
    this.faviconsFolder = faviconsFolder;
  }

  async fetchFavicon(url: string): Promise<string | null> {
    try {
      const domain = new URL(url).hostname;
      const faviconPath = path.join(this.faviconsFolder, `${domain}_favicon_${this.defaultSize}.png`);
      
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
      console.error('ファビコンの取得に失敗しました:', error);
      return null;
    }
  }

  private async tryMultipleSources(url: string): Promise<Buffer | null> {
    const sources = await this.getFaviconSources(url);
    
    // 各ソースを順番に試す
    for (const source of sources) {
      try {
        const data = await this.downloadFavicon(source.url);
        if (data && data.length > 0) {
          return data;
        }
      } catch (error) {
        console.log(`ファビコンソース ${source.url} の取得に失敗:`, error);
      }
    }
    
    return null;
  }

  private async getFaviconSources(url: string): Promise<FaviconSource[]> {
    const sources: FaviconSource[] = [];
    const origin = new URL(url).origin;
    
    // 1. HTMLを解析してメタタグからファビコンを探す
    try {
      const htmlSources = await this.parseHtmlForFavicons(url);
      sources.push(...htmlSources);
    } catch (error) {
      console.log('HTML解析をスキップ:', error);
    }
    
    // 2. 標準的な場所を確認
    sources.push(
      { url: `${origin}/favicon.ico`, size: 32 },
      { url: `${origin}/favicon.png`, size: 32 },
      { url: `${origin}/apple-touch-icon.png`, size: 180 },
      { url: `${origin}/apple-touch-icon-precomposed.png`, size: 180 },
      { url: `${origin}/icon.png`, size: 32 },
      { url: `${origin}/logo.png`, size: 64 }
    );
    
    return sources;
  }

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
        
        // OGP画像
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
        
        // マニフェストファイル
        /<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/gi
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
                sources.push({ url: iconUrl, size });
              } else {
                sources.push({ url: iconUrl });
              }
            }
          } else if (pattern.source.includes('manifest')) {
            // マニフェストファイルの処理（今後の拡張用）
            const manifestUrl = this.resolveUrl(match[1], origin);
            if (manifestUrl) {
              // 今はマニフェストの解析はスキップ
              console.log('マニフェストファイル検出:', manifestUrl);
            }
          } else {
            const iconUrl = this.resolveUrl(match[1], origin);
            if (iconUrl && !foundUrls.has(iconUrl)) {
              foundUrls.add(iconUrl);
              sources.push({ url: iconUrl });
            }
          }
        }
      }
      
      // 優先度の高い順にソート（apple-touch-iconを優先）
      sources.sort((a, b) => {
        if (a.url.includes('apple-touch-icon')) return -1;
        if (b.url.includes('apple-touch-icon')) return 1;
        if (a.size && b.size) return b.size - a.size;
        return 0;
      });
      
    } catch (error) {
      console.error('HTML解析エラー:', error);
    }
    
    return sources;
  }

  private async fetchHtml(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      let data = '';
      
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          data += chunk.toString();
          // 最初の5KBだけ読み込む（ファビコンタグは通常ヘッダー部分にある）
          if (data.length > 5000) {
            request.abort();
            resolve(data);
          }
        });
        
        response.on('end', () => {
          resolve(data);
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.end();
    });
  }

  private async downloadFavicon(url: string): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      const chunks: Buffer[] = [];
      
      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.end();
    });
  }

  private resolveUrl(url: string, base: string): string | null {
    try {
      if (url.startsWith('//')) {
        return `https:${url}`;
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      } else if (url.startsWith('/')) {
        return new URL(url, base).href;
      } else {
        return new URL(url, base).href;
      }
    } catch (error) {
      console.error('URL解決エラー:', error);
      return null;
    }
  }
}