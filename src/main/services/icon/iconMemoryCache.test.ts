import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearIconMemoryCache,
  forgetIconFile,
  readFirstExistingIconCached,
  rememberIconFile,
} from './iconMemoryCache';

let dir: string;
const png = (byte: number) => Buffer.from([0x89, 0x50, 0x4e, 0x47, byte]);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-icon-mem-'));
  clearIconMemoryCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('iconMemoryCache', () => {
  it('一度読んだファイルは、2 回目からディスクを読まずに返す', async () => {
    const file = path.join(dir, 'a.png');
    fs.writeFileSync(file, png(1));
    const readSpy = vi.spyOn(fs.promises, 'readFile');

    const first = await readFirstExistingIconCached([file]);
    const second = await readFirstExistingIconCached([file]);

    expect(first).toMatch(/^data:image\/png;base64,/);
    expect(second).toBe(first);
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it('無かった候補も覚え、次の候補を返す', async () => {
    const missing = path.join(dir, 'missing.png');
    const file = path.join(dir, 'b.png');
    fs.writeFileSync(file, png(2));
    const readSpy = vi.spyOn(fs.promises, 'readFile');

    await readFirstExistingIconCached([missing, file]);
    const again = await readFirstExistingIconCached([missing, file]);

    expect(again).toMatch(/^data:/);
    expect(readSpy).toHaveBeenCalledTimes(2); // 1 回目の 2 候補だけ
  });

  it('書いたファイルは覚え直し、消した・忘れたファイルは読み直す', async () => {
    const file = path.join(dir, 'c.png');
    await readFirstExistingIconCached([file]); // 無いと覚える

    rememberIconFile(file, 'data:image/png;base64,AAA');
    expect(await readFirstExistingIconCached([file])).toBe('data:image/png;base64,AAA');

    fs.writeFileSync(file, png(3));
    forgetIconFile(file);
    expect(await readFirstExistingIconCached([file])).not.toBe('data:image/png;base64,AAA');
  });

  it('全部捨てると、QDL の外で足したファイルも読める（F5 と同じ）', async () => {
    const file = path.join(dir, 'd.png');
    expect(await readFirstExistingIconCached([file])).toBeNull();
    fs.writeFileSync(file, png(4));
    expect(await readFirstExistingIconCached([file])).toBeNull();

    clearIconMemoryCache();
    expect(await readFirstExistingIconCached([file])).toMatch(/^data:/);
  });

  it('Windows では大文字小文字の違うパスを同じファイルとして扱う', async () => {
    if (process.platform !== 'win32') return;
    const file = path.join(dir, 'e.png');
    fs.writeFileSync(file, png(5));
    const first = await readFirstExistingIconCached([file]);
    forgetIconFile(file.toUpperCase());
    const readSpy = vi.spyOn(fs.promises, 'readFile');
    expect(await readFirstExistingIconCached([file])).toBe(first);
    expect(readSpy).toHaveBeenCalledTimes(1);
  });
});
