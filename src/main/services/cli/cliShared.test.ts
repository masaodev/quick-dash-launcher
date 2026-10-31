import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CliError } from './cliArgs';
import { readTextOption } from './cliShared';

describe('readTextOption（--text-file の文字コード）', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-text-file-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, bytes: Buffer) => {
    fs.writeFileSync(path.join(dir, name), bytes);
    return name;
  };

  it('UTF-8 は BOM の有無を問わず読む', () => {
    write('a.txt', Buffer.from('メモ\n2 行目', 'utf8'));
    write('b.txt', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('メモ', 'utf8')]));
    expect(readTextOption(undefined, 'a.txt', dir)).toBe('メモ\n2 行目');
    expect(readTextOption(undefined, 'b.txt', dir)).toBe('メモ');
  });

  it('BOM 付きの UTF-16LE（PowerShell 5.1 の > の既定）を読む', () => {
    write('le.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('メモ\r\n', 'utf16le')]));
    expect(readTextOption(undefined, 'le.txt', dir)).toBe('メモ\r\n');
  });

  it('BOM 付きの UTF-16BE を読む', () => {
    const be = Buffer.from('メモ', 'utf16le');
    be.swap16();
    write('be.txt', Buffer.concat([Buffer.from([0xfe, 0xff]), be]));
    expect(readTextOption(undefined, 'be.txt', dir)).toBe('メモ');
  });

  it('UTF-8 として読めないもの（Shift_JIS の「メモ」）は化けたまま保存せずに断る', () => {
    write('sjis.txt', Buffer.from([0x83, 0x81, 0x83, 0x82]));
    let error: unknown;
    try {
      readTextOption(undefined, 'sjis.txt', dir);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe('invalid');
  });
});
