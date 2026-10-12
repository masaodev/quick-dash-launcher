import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { isBareFileName, resolveFromPath } from './pathResolver';

describe('isBareFileName', () => {
  it.each(['calc.exe', 'run.bat', 'notepad'])('%s はファイル名だけ', (p) => {
    expect(isBareFileName(p)).toBe(true);
  });

  it.each([
    'C:\\Tools\\tool.exe',
    'tools\\run.exe',
    'C:/Tools/run.bat',
    '\\\\server\\share\\a.exe',
  ])('%s は区切りを含む', (p) => {
    expect(isBareFileName(p)).toBe(false);
  });
});

describe('resolveFromPath', () => {
  // PATH に見立てたフォルダ（日本語の名前も含める）
  let root: string;
  let first: string;
  let second: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-path-'));
    first = path.join(root, 'ツール');
    second = path.join(root, 'bin');
    fs.mkdirSync(first);
    fs.mkdirSync(second);
    fs.writeFileSync(path.join(first, 'tool.exe'), '');
    fs.writeFileSync(path.join(second, 'tool.exe'), '');
    fs.writeFileSync(path.join(second, 'run.cmd'), '');
    fs.mkdirSync(path.join(second, 'dir.exe'));
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const env = () => ({ PATH: `${first};"${second}"`, PATHEXT: '.EXE;.CMD' });

  it('PATH のフォルダを順に探し、最初に見つかったフルパスを返す（日本語のフォルダ名も化けない）', async () => {
    await expect(resolveFromPath('tool.exe', env())).resolves.toBe(path.join(first, 'tool.exe'));
  });

  it('拡張子が無ければ PATHEXT の拡張子を付けて探す', async () => {
    // Windows のファイル名は大文字・小文字を区別しないので、PATHEXT の表記（.CMD）のまま返る
    expect((await resolveFromPath('run', env()))?.toLowerCase()).toBe(
      path.join(second, 'run.cmd').toLowerCase()
    );
  });

  it('見つからないとき・フォルダしか無いときは null を返す', async () => {
    await expect(resolveFromPath('missing.exe', env())).resolves.toBeNull();
    await expect(resolveFromPath('dir.exe', env())).resolves.toBeNull();
  });

  it('ワイルドカード入りの名前は探さない', async () => {
    await expect(resolveFromPath('*.exe', env())).resolves.toBeNull();
  });
});
