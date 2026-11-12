import { describe, it, expect, vi } from 'vitest';

vi.mock('koffi', () => ({ default: { load: vi.fn() } }));

import { toRealPath } from './packagedPath';
import type { PackagedPathEnv } from './packagedPath';

const APPDATA = 'C:\\Users\\u\\AppData\\Roaming';
const LOCAL = 'C:\\Users\\u\\AppData\\Local';
const CACHE = `${LOCAL}\\Packages\\QuickDashLauncher_abc123\\LocalCache`;

function env(existing: string[], overrides: Partial<PackagedPathEnv> = {}): PackagedPathEnv {
  return {
    familyName: 'QuickDashLauncher_abc123',
    appData: APPDATA,
    localAppData: LOCAL,
    exists: (target) => existing.includes(target),
    ...overrides,
  };
}

describe('toRealPath', () => {
  const config = `${APPDATA}\\quick-dash-launcher\\config`;
  const realConfig = `${CACHE}\\Roaming\\quick-dash-launcher\\config`;

  it('振り替え先にあれば、%APPDATA% の下のパスを実際の場所に直す', () => {
    expect(toRealPath(config, env([realConfig]))).toBe(realConfig);
  });

  it('%LOCALAPPDATA% の下のパスは Local の振り替え先に直す', () => {
    const real = `${CACHE}\\Local\\quick-dash-launcher\\bin`;
    expect(toRealPath(`${LOCAL}\\quick-dash-launcher\\bin`, env([real]))).toBe(real);
  });

  it('振り替え先に無ければそのまま返す（前からあるフォルダを共有しているとき）', () => {
    expect(toRealPath(config, env([]))).toBe(config);
  });

  it('パッケージとして動いていなければそのまま返す', () => {
    expect(toRealPath(config, env([realConfig], { familyName: null }))).toBe(config);
  });

  it('既に実際の場所のパス・%APPDATA% の外のパス・%APPDATA% 自体はそのまま返す', () => {
    expect(toRealPath(realConfig, env([realConfig]))).toBe(realConfig);
    expect(toRealPath('D:\\data\\config', env([realConfig]))).toBe('D:\\data\\config');
    expect(toRealPath(APPDATA, env([`${CACHE}\\Roaming`]))).toBe(APPDATA);
  });

  it('大文字小文字が違っても %APPDATA% の下とみなす', () => {
    expect(
      toRealPath(config.toLowerCase(), env([`${CACHE}\\Roaming\\quick-dash-launcher\\config`]))
    ).toBe(realConfig);
  });
});
