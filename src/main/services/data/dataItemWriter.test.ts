import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

vi.mock('../../config/pathManager.js', () => ({
  PathManager: {
    getConfigFolder: () => tempRoot.dir,
    getDataFiles: () => ['datafiles/data.json', 'datafiles/data2.json'],
  },
}));

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  dataLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { getCorruptedDataFiles, clearDataFileCorrupted } from './corruptedDataFiles';
import { registerItems, updateGroupItemById, updateWindowItemById } from './dataItemWriter';

function writeFile(fileName: string, content: string): void {
  fs.writeFileSync(path.join(tempRoot.dir, fileName), content, 'utf8');
}

function readItems(fileName: string): Array<Record<string, unknown>> {
  return JSON.parse(fs.readFileSync(path.join(tempRoot.dir, fileName), 'utf8')).items;
}

describe('dataItemWriter', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-writer-'));
    fs.mkdirSync(path.join(tempRoot.dir, 'datafiles'));
    for (const f of getCorruptedDataFiles()) clearDataFileCorrupted(f);
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  it('ID で見つかったファイルのアイテムだけを差し替え、他のアイテムは残すこと', () => {
    writeFile(
      'datafiles/data.json',
      JSON.stringify({
        version: '1.0',
        items: [{ id: 'aaaaaaaa', type: 'item', displayName: 'A', path: 'C:\\a.exe' }],
      })
    );
    writeFile(
      'datafiles/data2.json',
      JSON.stringify({
        version: '1.0',
        items: [
          { id: 'bbbbbbbb', type: 'group', displayName: 'G', itemNames: ['A'] },
          { id: 'cccccccc', type: 'item', displayName: 'C', path: 'C:\\c.exe' },
        ],
      })
    );

    updateGroupItemById(tempRoot.dir, 'bbbbbbbb', 'G2', ['A', 'C'], '');

    const items = readItems('datafiles/data2.json');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'bbbbbbbb',
      type: 'group',
      displayName: 'G2',
      itemNames: ['A', 'C'],
    });
    // 空のメモは保存しない
    expect(items[0]).not.toHaveProperty('memo');
    expect(items[1]).toMatchObject({ id: 'cccccccc', displayName: 'C' });
    expect(readItems('datafiles/data.json')[0]).toMatchObject({ id: 'aaaaaaaa' });
  });

  it('window アイテムもメモが空なら保存しないこと', () => {
    writeFile(
      'datafiles/data.json',
      JSON.stringify({
        version: '1.0',
        items: [{ id: 'wwwwwwww', type: 'window', displayName: 'W', windowTitle: 'old' }],
      })
    );

    updateWindowItemById(tempRoot.dir, 'wwwwwwww', { displayName: 'W', windowTitle: 'new' }, '');

    const [item] = readItems('datafiles/data.json');
    expect(item).toMatchObject({ id: 'wwwwwwww', type: 'window', windowTitle: 'new' });
    expect(item).not.toHaveProperty('memo');
  });

  it('ID が見つからなければエラーにすること', () => {
    writeFile('datafiles/data.json', JSON.stringify({ version: '1.0', items: [] }));

    expect(() => updateGroupItemById(tempRoot.dir, 'zzzzzzzz', 'G', [])).toThrow(
      'ID zzzzzzzz のアイテムが見つかりません'
    );
  });

  it('破損したファイルへの登録は中止し、ファイルを上書きしないこと', () => {
    writeFile('datafiles/data.json', '{ broken');

    expect(() =>
      registerItems(tempRoot.dir, [
        {
          displayName: 'X',
          path: 'C:\\x.exe',
          type: 'app',
          targetTab: 'datafiles/data.json',
          itemCategory: 'item',
        },
      ])
    ).toThrow('登録を中止しました');

    expect(fs.readFileSync(path.join(tempRoot.dir, 'datafiles/data.json'), 'utf8')).toBe(
      '{ broken'
    );
    expect(getCorruptedDataFiles()).toContain('datafiles/data.json');
  });

  it('登録先ファイルごとに追記すること', () => {
    writeFile('datafiles/data.json', JSON.stringify({ version: '1.0', items: [] }));

    registerItems(tempRoot.dir, [
      {
        displayName: 'X',
        path: 'C:\\x.exe',
        type: 'app',
        targetTab: 'datafiles/data.json',
        itemCategory: 'item',
      },
      {
        displayName: 'Y',
        path: 'C:\\y.exe',
        type: 'app',
        targetTab: 'datafiles/data2.json',
        itemCategory: 'item',
      },
    ]);

    expect(readItems('datafiles/data.json').map((i) => i.displayName)).toEqual(['X']);
    expect(readItems('datafiles/data2.json').map((i) => i.displayName)).toEqual(['Y']);
  });
});
