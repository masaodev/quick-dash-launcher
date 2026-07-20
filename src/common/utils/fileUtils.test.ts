import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { FileUtils } from './fileUtils';

describe('FileUtils アトミック書き込み', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileutils-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('safeWriteTextFileで書き込み後、一時ファイルが残らない', () => {
    const filePath = path.join(tempDir, 'test.json');
    const result = FileUtils.safeWriteTextFile(filePath, '{"a":1}');

    expect(result).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('{"a":1}');
    expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);
  });

  it('既存ファイルを上書きできる', () => {
    const filePath = path.join(tempDir, 'test.json');
    FileUtils.safeWriteTextFile(filePath, 'old');
    const result = FileUtils.safeWriteTextFile(filePath, 'new');

    expect(result).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('new');
  });

  it('存在しないディレクトリ配下でも自動作成して書き込める', () => {
    const filePath = path.join(tempDir, 'sub', 'dir', 'test.txt');
    const result = FileUtils.safeWriteTextFile(filePath, 'content');

    expect(result).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('content');
  });

  it('書き込み失敗時は既存ファイルが無傷で残る', () => {
    const filePath = path.join(tempDir, 'test.json');
    FileUtils.safeWriteTextFile(filePath, 'original');

    // ファイルパス自体をディレクトリで塞いで一時ファイル書き込みを失敗させる
    fs.mkdirSync(`${filePath}.tmp`);
    const result = FileUtils.safeWriteTextFile(filePath, 'broken');

    expect(result).toBe(false);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('original');
    fs.rmdirSync(`${filePath}.tmp`);
  });

  it('writeBinaryFileもアトミックに書き込める', () => {
    const filePath = path.join(tempDir, 'test.bin');
    const data = Buffer.from([1, 2, 3, 4]);
    const result = FileUtils.writeBinaryFile(filePath, data);

    expect(result).toBe(true);
    expect(fs.readFileSync(filePath)).toEqual(data);
    expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);
  });

  it('safeCopyFileもアトミックにコピーできる', () => {
    const src = path.join(tempDir, 'src.txt');
    const dst = path.join(tempDir, 'dst.txt');
    fs.writeFileSync(src, 'copy-me');

    expect(FileUtils.safeCopyFile(src, dst)).toBe(true);
    expect(fs.readFileSync(dst, 'utf8')).toBe('copy-me');
    expect(fs.existsSync(`${dst}.tmp`)).toBe(false);
  });

  it('コピー元が存在しない場合はfalseを返す', () => {
    expect(
      FileUtils.safeCopyFile(path.join(tempDir, 'nope.txt'), path.join(tempDir, 'dst.txt'))
    ).toBe(false);
  });
});
