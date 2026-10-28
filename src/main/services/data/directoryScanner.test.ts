import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ shell: { readShortcutLink: vi.fn() } }));

import { applyPrefixSuffix, previewDirectoryItems } from './directoryScanner';

describe('applyPrefixSuffix', () => {
  it('入力したとおりの文字を前後に付け、区切りや括弧は足さない', () => {
    expect(applyPrefixSuffix('img0.jpg', '【壁紙】', '（Windows 標準）')).toBe(
      '【壁紙】img0.jpg（Windows 標準）'
    );
  });

  it('区切りを付けたいときは、入力に含める', () => {
    expect(applyPrefixSuffix('memo.txt', '仕事: ', ' (Dev)')).toBe('仕事: memo.txt (Dev)');
  });

  it('指定が無ければ名前のまま', () => {
    expect(applyPrefixSuffix('memo.txt')).toBe('memo.txt');
    expect(applyPrefixSuffix('memo.txt', '', '')).toBe('memo.txt');
  });
});

describe('previewDirectoryItems', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-dir-preview-'));
    fs.writeFileSync(path.join(root, 'a.txt'), '');
    fs.writeFileSync(path.join(root, 'b.pdf'), '');
    fs.mkdirSync(path.join(root, 'sub'));
    fs.writeFileSync(path.join(root, 'sub', 'c.txt'), '');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('登録したときと同じく、オプションに合うものを表示名つきで返す', async () => {
    const result = await previewDirectoryItems(root, {
      depth: 1,
      types: 'file',
      filter: '*.txt',
      prefix: '【仕事】',
    });
    expect(result.status).toBe('ok');
    expect(result.truncated).toBe(false);
    expect(result.items).toEqual([
      { displayName: '【仕事】a.txt', baseName: 'a.txt', isFolder: false, location: '' },
      { displayName: '【仕事】c.txt', baseName: 'c.txt', isFolder: false, location: 'sub' },
    ]);
  });

  it('既定（現在のフォルダのみ・ファイルとフォルダ）では直下のフォルダも並ぶ', async () => {
    const result = await previewDirectoryItems(root, {});
    expect(result.items.map((i) => [i.baseName, i.isFolder])).toEqual([
      ['a.txt', false],
      ['b.pdf', false],
      ['sub', true],
    ]);
  });

  it('ファイル名の条件・除外する条件は大文字・小文字を区別しない（Windows のファイル名と同じ）', async () => {
    fs.writeFileSync(path.join(root, 'SCAN.PDF'), '');
    fs.writeFileSync(path.join(root, 'Old.PDF'), '');
    const result = await previewDirectoryItems(root, {
      types: 'file',
      filter: '*.pdf',
      exclude: 'old*',
    });
    expect(result.items.map((i) => i.baseName).sort()).toEqual(['SCAN.PDF', 'b.pdf']);
  });

  it('上限を超えたら走査をやめ、まだあると返す', async () => {
    const result = await previewDirectoryItems(root, {}, undefined, { maxItems: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it('無いパス・ファイルのパスはそれと分かる結果を返す', async () => {
    expect((await previewDirectoryItems(path.join(root, 'none'), {})).status).toBe('notFound');
    expect((await previewDirectoryItems(path.join(root, 'a.txt'), {})).status).toBe('notFolder');
    expect((await previewDirectoryItems('  ', {})).status).toBe('notFound');
  });

  it('中止したら cancelled を返す', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await previewDirectoryItems(root, {}, controller.signal);
    expect(result).toEqual({ status: 'cancelled', items: [], truncated: false });
  });
});
