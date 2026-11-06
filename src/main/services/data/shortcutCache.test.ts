import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearShortcutCache, readShortcutCached, type ShortcutInfo } from './shortcutCache';

let dir: string;
const info: ShortcutInfo = {
  target: 'C:\\Tools\\app.exe',
  targetExists: true,
  targetIsDirectory: false,
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-lnk-cache-'));
  clearShortcutCache();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('readShortcutCached', () => {
  it('.lnk が変わっていなければ、2 回目からは読まずに前の結果を返す', () => {
    const lnk = path.join(dir, 'a.lnk');
    fs.writeFileSync(lnk, 'x');
    const read = vi.fn(() => info);

    expect(readShortcutCached(lnk, read)).toEqual(info);
    expect(readShortcutCached(lnk, read)).toEqual(info);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('.lnk を書き換えたら（大きさ・更新時刻が変わったら）読み直す', () => {
    const lnk = path.join(dir, 'b.lnk');
    fs.writeFileSync(lnk, 'x');
    const read = vi.fn(() => info);
    readShortcutCached(lnk, read);

    fs.writeFileSync(lnk, 'xyz');
    readShortcutCached(lnk, read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('リンク先の無い .lnk（null）も覚え、全部捨てたら読み直す', () => {
    const lnk = path.join(dir, 'c.lnk');
    fs.writeFileSync(lnk, 'x');
    const read = vi.fn(() => null);
    expect(readShortcutCached(lnk, read)).toBeNull();
    expect(readShortcutCached(lnk, read)).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);

    clearShortcutCache();
    readShortcutCached(lnk, read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('.lnk を見られないときは覚えずに毎回読む', () => {
    const missing = path.join(dir, 'missing.lnk');
    const read = vi.fn(() => info);
    readShortcutCached(missing, read);
    readShortcutCached(missing, read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('読むのに失敗したら（例外）覚えずにそのまま投げる', () => {
    const lnk = path.join(dir, 'd.lnk');
    fs.writeFileSync(lnk, 'x');
    const read = vi.fn((): ShortcutInfo | null => {
      throw new Error('broken');
    });
    expect(() => readShortcutCached(lnk, read)).toThrow('broken');
    expect(() => readShortcutCached(lnk, read)).toThrow('broken');
    expect(read).toHaveBeenCalledTimes(2);
  });
});
