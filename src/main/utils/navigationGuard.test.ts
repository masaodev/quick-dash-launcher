import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({ app: { on: vi.fn() } }));

import { isAllowedNavigation } from './navigationGuard';

const prod = {
  appRootUrl: 'file:///C:/Users/me/AppData/Local/Programs/qdl/resources/app.asar/dist/',
};
const dev = { ...prod, devServerUrl: 'http://localhost:9001' };

describe('isAllowedNavigation', () => {
  it('本番の HTML のフォルダの中は許す（大文字・小文字は区別しない）', () => {
    expect(isAllowedNavigation(`${prod.appRootUrl}index.html`, prod)).toBe(true);
    expect(
      isAllowedNavigation(
        'file:///c:/users/me/appdata/local/programs/qdl/resources/app.asar/dist/workspace.html?groupId=a',
        prod
      )
    ).toBe(true);
  });

  it('about:blank は許す（子ウィンドウは about:blank で開いて HTML を書き込む）', () => {
    expect(isAllowedNavigation('about:blank', prod)).toBe(true);
  });

  it('外部のページ・フォルダの外のファイル・壊れた URL は止める', () => {
    expect(isAllowedNavigation('https://example.com/', prod)).toBe(false);
    expect(isAllowedNavigation('file:///C:/Windows/win.ini', prod)).toBe(false);
    expect(isAllowedNavigation('javascript:alert(1)', prod)).toBe(false);
    expect(isAllowedNavigation('not a url', prod)).toBe(false);
  });

  it('開発時は Vite の URL（同じポート）だけを許す', () => {
    expect(isAllowedNavigation('http://localhost:9001/admin.html', dev)).toBe(true);
    expect(isAllowedNavigation('http://localhost:9002/admin.html', dev)).toBe(false);
    expect(isAllowedNavigation('http://localhost:9001/admin.html', prod)).toBe(false);
  });
});
