/**
 * ビルドした画面の HTML に CSP（Content-Security-Policy）の meta を入れる Vite プラグイン（多層防御）
 *
 * 万一画面にスクリプトが注入されても、QDL の外から読み込んだスクリプトやインラインのハンドラーを
 * 実行させない。ナビゲーションの制御（src/main/utils/navigationGuard.ts）と対になる備え。
 *
 * - 対象はビルド（vite build）だけ。開発サーバーは React の再読み込みのインラインスクリプトや
 *   HMR の WebSocket を使うので入れない
 * - インラインの <script> はハッシュで許可する。子ウィンドウ（overlay.html など）は開き元の
 *   about:blank に HTML を書き込むので、開き元の CSP も引き継ぐ。どの画面がどの HTML を開いても
 *   通るよう、すべての HTML のインラインスクリプトのハッシュを 1 つの CSP にまとめ、全画面に同じものを入れる
 * - アイコン・画像はメインプロセスが data: URL にして渡すので img-src に data: を許す
 * - 見た目の style 属性・<style> を使うので style-src は 'unsafe-inline' を許す
 */

import { createHash } from 'crypto';

import type { Plugin, Rollup } from 'vite';

// src 属性の有無は空白に続く `src=` で見る（data-src などを src と取り違えない）
const INLINE_SCRIPT_PATTERN = /<script\b(?![^>]*\ssrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * HTML のインラインスクリプト（src の無い <script>）の中身を取り出す。
 * 空白だけの中身もブラウザーは CSP で確かめるので、空でなければ含める
 */
export function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  for (const match of html.matchAll(INLINE_SCRIPT_PATTERN)) {
    if (match[1] !== '') scripts.push(match[1]);
  }
  return scripts;
}

/**
 * CSP の 'sha256-…' の値を作る。ブラウザーは HTML を読むときに改行を LF にそろえてから
 * ハッシュを取るので、CRLF のまま出力された HTML でも合うよう同じようにそろえる
 */
export function hashScript(script: string): string {
  const normalized = script.replace(/\r\n?/g, '\n');
  return `'sha256-${createHash('sha256').update(normalized, 'utf8').digest('base64')}'`;
}

/** インラインスクリプトのハッシュから CSP の文字列を作る */
export function buildCsp(scriptHashes: string[]): string {
  const scriptSrc = ["'self'", ...new Set(scriptHashes)].join(' ');
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
  ].join('; ');
}

const CHARSET_META_PATTERN = /<meta\s+charset=[^>]*>/i;
const HEAD_PATTERN = /<head(\s[^>]*)?>/i;

/**
 * CSP の meta を charset の meta の後ろ（無ければ <head> の直後）に入れる。
 * meta の CSP はそれより後ろの要素にしか効かないので、スクリプトより前に置く
 */
export function injectCspMeta(html: string, csp: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
  const anchor = CHARSET_META_PATTERN.test(html) ? CHARSET_META_PATTERN : HEAD_PATTERN;
  const injected = html.replace(anchor, (tag) => `${tag}\n    ${meta}`);
  if (injected === html) throw new Error('CSP を入れる <head> が見つかりません');
  return injected;
}

export function cspPlugin(): Plugin {
  return {
    name: 'qdl-csp',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAssets = Object.values(bundle).filter(
        (output): output is Rollup.OutputAsset =>
          output.type === 'asset' && output.fileName.endsWith('.html')
      );
      if (htmlAssets.length === 0) return;

      const sources = htmlAssets.map((asset) =>
        typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source)
      );
      const csp = buildCsp(sources.flatMap(extractInlineScripts).map(hashScript));
      htmlAssets.forEach((asset, i) => {
        asset.source = injectCspMeta(sources[i], csp);
      });
    },
  };
}
