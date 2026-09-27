import { describe, it, expect, vi } from 'vitest';

import { checkPathsExist } from './pathExistenceChecker';

describe('checkPathsExist', () => {
  it('存在するパスは exists、無いパスは missing になること', async () => {
    const access = vi.fn(async (p: string) => {
      if (p.includes('missing')) throw new Error('ENOENT');
    });
    const result = await checkPathsExist(['C:\\ok\\a.exe', 'C:\\missing\\b.exe'], { access });
    expect(result).toEqual({ 'C:\\ok\\a.exe': 'exists', 'C:\\missing\\b.exe': 'missing' });
  });

  it('応答しないパスは時間切れで unknown になり、他のパスの確認を止めないこと', async () => {
    const access = vi.fn((p: string) => {
      if (p.startsWith('\\\\slow')) return new Promise<void>(() => {}); // 永遠に応答しない
      return Promise.resolve();
    });
    const started = Date.now();
    const result = await checkPathsExist(['\\\\slow\\share\\x', 'C:\\ok\\a.exe'], {
      access,
      timeoutMs: 50,
      concurrency: 1,
    });
    expect(result['\\\\slow\\share\\x']).toBe('unknown');
    expect(result['C:\\ok\\a.exe']).toBe('exists');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('環境変数を展開して確認し、重複したパスは 1 回だけ確認すること', async () => {
    process.env.QDL_TEST_DIR = 'C:\\expanded';
    const access = vi.fn(async () => {});
    const result = await checkPathsExist(['%QDL_TEST_DIR%\\a.exe', '%QDL_TEST_DIR%\\a.exe'], {
      access,
    });
    expect(access).toHaveBeenCalledTimes(1);
    expect(access).toHaveBeenCalledWith('C:\\expanded\\a.exe');
    expect(Object.keys(result)).toEqual(['%QDL_TEST_DIR%\\a.exe']);
    delete process.env.QDL_TEST_DIR;
  });

  it('空の入力では何もしないこと', async () => {
    const access = vi.fn(async () => {});
    expect(await checkPathsExist([], { access })).toEqual({});
    expect(access).not.toHaveBeenCalled();
  });
});
