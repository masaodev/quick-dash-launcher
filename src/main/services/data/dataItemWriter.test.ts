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
import {
  moveItemToFile,
  registerItems,
  updateSetItemById,
  updateWindowItemById,
} from './dataItemWriter';

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
          { id: 'bbbbbbbb', type: 'set', displayName: 'G', entries: [{ itemId: 'aaaaaaaa' }] },
          { id: 'cccccccc', type: 'item', displayName: 'C', path: 'C:\\c.exe' },
        ],
      })
    );

    updateSetItemById(
      tempRoot.dir,
      'bbbbbbbb',
      { displayName: 'G2', entries: [{ itemId: 'aaaaaaaa' }, { itemId: 'cccccccc' }] },
      ''
    );

    const items = readItems('datafiles/data2.json');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'bbbbbbbb',
      type: 'set',
      displayName: 'G2',
      entries: [{ itemId: 'aaaaaaaa' }, { itemId: 'cccccccc' }],
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

    expect(() =>
      updateSetItemById(tempRoot.dir, 'zzzzzzzz', { displayName: 'G', entries: [] })
    ).toThrow('ID zzzzzzzz のアイテムが見つかりません');
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

  it('keepId があれば、その id で登録すること（保存先を変えた編集でセットの行を切らない）', () => {
    writeFile('datafiles/data2.json', JSON.stringify({ version: '1.0', items: [] }));
    registerItems(tempRoot.dir, [
      {
        displayName: 'X',
        path: 'C:/x.exe',
        type: 'app',
        targetTab: 'datafiles/data2.json',
        itemCategory: 'item',
        keepId: 'Keep0001',
      },
    ]);
    expect(readItems('datafiles/data2.json').map((i) => i.id)).toEqual(['Keep0001']);
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

  it('datafiles 直下の .json 以外が登録先に混ざっていたら、どのファイルにも書かないこと', () => {
    writeFile('datafiles/data.json', JSON.stringify({ version: '1.0', items: [] }));

    expect(() =>
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
          targetTab: 'datafiles/data.json',
          targetFile: '../outside.json',
          itemCategory: 'item',
        },
      ])
    ).toThrow('登録先のデータファイル名が正しくありません: ../outside.json');

    expect(readItems('datafiles/data.json')).toEqual([]);
    expect(fs.existsSync(path.join(tempRoot.dir, 'outside.json'))).toBe(false);
  });

  describe('moveItemToFile', () => {
    beforeEach(() => {
      writeFile(
        'datafiles/data.json',
        JSON.stringify({
          version: '1.0',
          items: [
            { id: 'aaaaaaaa', type: 'item', displayName: 'A', path: 'C:\\a.exe' },
            { id: 'bbbbbbbb', type: 'item', displayName: 'B', path: 'C:\\b.exe' },
          ],
        })
      );
      writeFile(
        'datafiles/data2.json',
        JSON.stringify({
          version: '1.0',
          items: [{ id: 'cccccccc', type: 'item', displayName: 'C', path: 'C:\\c.exe' }],
        })
      );
    });

    it('id を保ったまま移す先の末尾に足し、元のファイルからだけ消すこと（内容も差し替える）', () => {
      moveItemToFile(
        tempRoot.dir,
        { id: 'aaaaaaaa', type: 'item', displayName: 'A2', path: 'C:\\a.exe' },
        'datafiles/data.json',
        'datafiles/data2.json'
      );
      expect(readItems('datafiles/data.json').map((i) => i.id)).toEqual(['bbbbbbbb']);
      expect(readItems('datafiles/data2.json')).toMatchObject([
        { id: 'cccccccc' },
        { id: 'aaaaaaaa', displayName: 'A2' },
      ]);
    });

    it('移す先が壊れていたら、どちらのファイルも変えないこと', () => {
      writeFile('datafiles/data2.json', '{ broken');
      expect(() =>
        moveItemToFile(
          tempRoot.dir,
          { id: 'aaaaaaaa', type: 'item', displayName: 'A', path: 'C:\\a.exe' },
          'datafiles/data.json',
          'datafiles/data2.json'
        )
      ).toThrow();
      expect(readItems('datafiles/data.json')).toHaveLength(2);
      expect(fs.readFileSync(path.join(tempRoot.dir, 'datafiles/data2.json'), 'utf8')).toBe(
        '{ broken'
      );
      expect(getCorruptedDataFiles()).toContain('datafiles/data2.json');
    });

    it('元のファイルに無ければエラーにし、何も書かないこと', () => {
      expect(() =>
        moveItemToFile(
          tempRoot.dir,
          { id: 'cccccccc', type: 'item', displayName: 'C', path: 'C:\\c.exe' },
          'datafiles/data.json',
          'datafiles/data2.json'
        )
      ).toThrow();
      expect(readItems('datafiles/data2.json')).toHaveLength(1);
    });
  });
});
