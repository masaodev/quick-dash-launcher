import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 名前の変更だけ失敗させられるようにする（Windows でファイルを掴まれたときの再現）
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const renameSync = vi.fn(actual.renameSync);
  return { ...actual, renameSync, default: { ...actual, renameSync } };
});

import { RotatingLogFile } from './rotatingLogFile';

describe('RotatingLogFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-log-')), 'logs');
    vi.mocked(fs.renameSync).mockClear();
  });

  afterEach(() => {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  });

  const read = (name: string) => fs.readFileSync(path.join(dir, name), 'utf8');
  const exists = (name: string) => fs.existsSync(path.join(dir, name));

  it('フォルダが無ければ作って main.log に追記する', () => {
    const log = new RotatingLogFile(dir);
    log.write('a\n');
    log.write('b\n');
    log.close();
    expect(read('main.log')).toBe('a\nb\n');
  });

  it('上限を超えそうなら書く前に回し、残す世代より古いものは消す（1 ファイルは上限まで）', () => {
    const log = new RotatingLogFile(dir, { maxBytes: 10, generations: 2 });
    for (const n of [1, 2, 3, 4]) log.write(`line-${n}-xx\n`); // 1 行 10 バイト
    log.write('now\n');
    log.close();

    expect(read('main.log')).toBe('now\n');
    expect(read('main.1.log')).toBe('line-4-xx\n');
    expect(read('main.2.log')).toBe('line-3-xx\n');
    expect(exists('main.3.log')).toBe(false);
  });

  it('前回の起動で上限を超えたまま終わっていたら、書き始める前に回す', () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'main.log'), 'x'.repeat(20));

    const log = new RotatingLogFile(dir, { maxBytes: 10 });
    log.write('new\n');
    log.close();

    expect(read('main.log')).toBe('new\n');
    expect(read('main.1.log')).toBe('x'.repeat(20));
  });

  it('回すのに失敗しても今のファイルに書き続け、時間をおいてもう一度回す', () => {
    let now = 0;
    const log = new RotatingLogFile(dir, { maxBytes: 10, retryAfterMs: 1000, now: () => now });
    log.write('line-1-xx\n');

    vi.mocked(fs.renameSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
    });
    log.write('line-2-xx\n'); // 回すのに失敗 → main.log に書き足す
    log.write('line-3-xx\n'); // 待っている間は回さない
    expect(read('main.log')).toBe('line-1-xx\nline-2-xx\nline-3-xx\n');

    now = 1000;
    log.write('line-4-xx\n'); // 時間が経ったので回す
    log.close();
    expect(read('main.log')).toBe('line-4-xx\n');
    expect(read('main.1.log')).toBe('line-1-xx\nline-2-xx\nline-3-xx\n');
  });

  it('書けないときは例外を投げず、時間をおいてから開き直す', () => {
    let now = 0;
    // フォルダを作れない場所（同じ名前のファイルがある）
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.writeFileSync(dir, '');
    const log = new RotatingLogFile(dir, { retryAfterMs: 1000, now: () => now });
    expect(() => log.write('a\n')).not.toThrow();

    // 書けるようになっても、待っている間は開き直さない
    fs.rmSync(dir);
    log.write('b\n');
    expect(exists('main.log')).toBe(false);

    now = 1000;
    log.write('c\n');
    log.close();
    expect(read('main.log')).toBe('c\n');
  });
});
