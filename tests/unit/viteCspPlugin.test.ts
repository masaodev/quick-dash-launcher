import { describe, expect, it } from 'vitest';

import {
  buildCsp,
  extractInlineScripts,
  hashScript,
  injectCspMeta,
} from '../../scripts/viteCspPlugin';

describe('extractInlineScripts', () => {
  it('src の無い <script> の中身だけを取り出す', () => {
    const html = `
      <script type="module" crossorigin src="./assets/main.js"></script>
      <script>
        console.log('a');
      </script>
      <script></script>
      <script type="text/javascript">b()</script>`;
    expect(extractInlineScripts(html)).toEqual(["\n        console.log('a');\n      ", 'b()']);
  });

  it('インラインスクリプトが無ければ空', () => {
    expect(extractInlineScripts('<script src="x.js"></script>')).toEqual([]);
  });

  it('data-src などは src とみなさない', () => {
    expect(extractInlineScripts('<script data-src="x.js">init()</script>')).toEqual(['init()']);
  });

  it('空白だけの中身も含める（ブラウザーは CSP で確かめる）', () => {
    expect(extractInlineScripts('<script>\n</script>')).toEqual(['\n']);
  });
});

describe('hashScript', () => {
  it('CSP の仕様の例と同じハッシュになる', () => {
    expect(hashScript("alert('Hello, world.');")).toBe(
      "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='"
    );
  });

  it('改行は LF にそろえてからハッシュを取る（CRLF の HTML でも合う）', () => {
    expect(hashScript('a();\r\nb();\rc();')).toBe(hashScript('a();\nb();\nc();'));
  });
});

describe('buildCsp', () => {
  it('ハッシュを重複なく script-src に並べる', () => {
    const csp = buildCsp(["'sha256-a'", "'sha256-b'", "'sha256-a'"]);
    expect(csp).toContain("script-src 'self' 'sha256-a' 'sha256-b';");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-eval');
  });
});

describe('injectCspMeta', () => {
  it('charset の meta の後ろに入れる', () => {
    const html = '<html><head>\n  <meta charset="UTF-8">\n  <title>t</title></head></html>';
    const result = injectCspMeta(html, "default-src 'self'");
    expect(result).toBe(
      '<html><head>\n  <meta charset="UTF-8">\n    <meta http-equiv="Content-Security-Policy" content="default-src \'self\'" />\n  <title>t</title></head></html>'
    );
  });

  it('charset の meta が無ければ <head> の直後に入れる', () => {
    const result = injectCspMeta('<head lang="ja"><script src="a.js"></script></head>', 'x');
    expect(result.indexOf('Content-Security-Policy')).toBeLessThan(result.indexOf('<script'));
  });

  it('<head> が無ければ例外にする（CSP 無しで出荷しない）', () => {
    expect(() => injectCspMeta('<body></body>', 'x')).toThrow();
  });
});
