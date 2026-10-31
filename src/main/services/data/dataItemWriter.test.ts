import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { JsonClipboardItem } from '@common/types';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

vi.mock('../../config/pathManager.js', () => ({
  PathManager: {
    getConfigFolder: () => tempRoot.dir,
    getDataFiles: () => ['datafiles/data.json', 'datafiles/data2.json'],
    getWorkspaceFilePath: () => path.join(tempRoot.dir, 'workspace.json'),
    getWorkspaceArchiveFilePath: () => path.join(tempRoot.dir, 'workspace-archive.json'),
  },
}));

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  dataLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const deleteClipboardData = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../clipboardService.js', () => ({
  ClipboardService: { getInstance: () => ({ deleteClipboardData }) },
}));

import { getCorruptedDataFiles, clearDataFileCorrupted } from './corruptedDataFiles';
import { resetNewerFormatFilesForTesting } from './newerFormatFiles';
import {
  deleteItemsById,
  moveItemToFile,
  registerItems,
  replaceItemById,
  updateSetItemById,
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
    resetNewerFormatFilesForTesting();
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

  it('新しい版の QDL が足した知らない項目を、編集したアイテムでもほかのアイテムでも消さないこと', () => {
    writeFile(
      'datafiles/data.json',
      JSON.stringify({
        version: '1.0',
        futureTop: 'keep',
        items: [
          { id: 'aaaaaaaa', type: 'item', displayName: 'A', path: 'C:\\a.exe', future: 1 },
          { id: 'cccccccc', type: 'item', displayName: 'C', path: 'C:\\c.exe', future: 2 },
        ],
      })
    );

    replaceItemById(tempRoot.dir, {
      id: 'aaaaaaaa',
      type: 'item',
      displayName: 'A2',
      path: 'C:\\a.exe',
    });

    const file = JSON.parse(
      fs.readFileSync(path.join(tempRoot.dir, 'datafiles/data.json'), 'utf8')
    );
    expect(file.futureTop).toBe('keep');
    expect(file.items[0]).toMatchObject({ displayName: 'A2', future: 1 });
    expect(file.items[1]).toMatchObject({ displayName: 'C', future: 2 });
  });

  it('新しい版の QDL が保存したファイルは書き換えず、更新を促すエラーにすること', () => {
    const original = JSON.stringify({
      version: '1.1',
      items: [{ id: 'aaaaaaaa', type: 'item', displayName: 'A', path: 'C:\\a.exe' }],
    });
    writeFile('datafiles/data.json', original);

    expect(() =>
      replaceItemById(tempRoot.dir, {
        id: 'aaaaaaaa',
        type: 'item',
        displayName: 'A2',
        path: 'C:\\a.exe',
      })
    ).toThrow(/新しい版の QDL|newer version/);
    expect(() =>
      registerItems(tempRoot.dir, [
        {
          displayName: 'B',
          path: 'C:\\b.exe',
          type: 'app',
          targetTab: 'datafiles/data.json',
          itemCategory: 'item',
        },
      ])
    ).toThrow(/新しい版の QDL|newer version/);
    expect(fs.readFileSync(path.join(tempRoot.dir, 'datafiles/data.json'), 'utf8')).toBe(original);
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
  describe('破損したデータファイルがあるとき', () => {
    const CORRUPTED = '{ "version": "1.0", "items": [';

    beforeEach(() => {
      writeFile('datafiles/data.json', CORRUPTED);
      writeFile(
        'datafiles/data2.json',
        JSON.stringify({
          version: '1.0',
          items: [
            { id: 'aaaaaaaa', type: 'item', displayName: 'A', path: 'C:\\a.exe' },
            {
              id: 'cccccccc',
              type: 'clipboard',
              displayName: 'C',
              dataFileRef: 'clipboard-data/cccccccc.json',
              savedAt: 1,
              formats: ['text'],
            },
          ],
        })
      );
      deleteClipboardData.mockClear();
    });

    function readRaw(fileName: string): string {
      return fs.readFileSync(path.join(tempRoot.dir, fileName), 'utf8');
    }

    it('差し替えは、壊れたファイルを飛ばして他のファイルで行い、壊れたファイルは書き換えないこと', () => {
      replaceItemById(tempRoot.dir, {
        id: 'aaaaaaaa',
        type: 'item',
        displayName: 'A2',
        path: 'C:\\a.exe',
      });

      expect(readItems('datafiles/data2.json')[0].displayName).toBe('A2');
      expect(readRaw('datafiles/data.json')).toBe(CORRUPTED);
      expect(getCorruptedDataFiles()).toContain('datafiles/data.json');
    });

    it('差し替える id が見つからなければ、壊れたファイルの名前を挙げてエラーにすること', () => {
      expect(() =>
        replaceItemById(tempRoot.dir, {
          id: 'zzzzzzzz',
          type: 'item',
          displayName: 'Z',
          path: 'C:\\z.exe',
        })
      ).toThrow(/datafiles\/data\.json/);
    });

    it('削除は、id がすべて見つかれば壊れたファイルを飛ばして行い、実データは消さないこと（壊れたファイルが使っているかもしれない）', async () => {
      await deleteItemsById(tempRoot.dir, ['aaaaaaaa', 'cccccccc']);

      expect(readItems('datafiles/data2.json')).toHaveLength(0);
      expect(readRaw('datafiles/data.json')).toBe(CORRUPTED);
      expect(deleteClipboardData).not.toHaveBeenCalled();
    });

    it('残す実データの参照を渡すと、その実データは消さないこと（保存先を変える編集）', async () => {
      await deleteItemsById(tempRoot.dir, ['cccccccc'], {
        keepClipboardDataRefs: ['clipboard-data/cccccccc.json'],
      });

      expect(readItems('datafiles/data2.json').map((i) => i.id)).toEqual(['aaaaaaaa']);
      expect(deleteClipboardData).not.toHaveBeenCalled();
    });

    it('消す id が壊れたファイルにあるかもしれないときは、何も消さずにエラーにすること', async () => {
      await expect(deleteItemsById(tempRoot.dir, ['aaaaaaaa', 'zzzzzzzz'])).rejects.toThrow(
        /datafiles\/data\.json/
      );

      expect(readItems('datafiles/data2.json')).toHaveLength(2);
      expect(deleteClipboardData).not.toHaveBeenCalled();
    });
  });

  describe('クリップボードの実データの後始末（A3-67）', () => {
    const clipboardItem = (id: string, ref: string): JsonClipboardItem => ({
      id,
      type: 'clipboard',
      displayName: id,
      dataFileRef: ref,
      savedAt: 1,
      formats: ['text'],
    });

    beforeEach(() => {
      writeFile(
        'datafiles/data.json',
        JSON.stringify({
          version: '1.0',
          items: [
            clipboardItem('aaaaaaaa', 'clipboard-data/shared.json'),
            clipboardItem('bbbbbbbb', 'clipboard-data/own.json'),
          ],
        })
      );
      deleteClipboardData.mockClear();
    });

    it('どこからも使われなくなった実データは消すこと', async () => {
      await deleteItemsById(tempRoot.dir, ['bbbbbbbb']);

      expect(deleteClipboardData).toHaveBeenCalledWith('clipboard-data/own.json');
    });

    it('ワークスペースのアイテムが同じ実データを使っていれば消さないこと（#464 より前に写したアイテム）', async () => {
      writeFile(
        'workspace.json',
        JSON.stringify({ items: [clipboardItem('wwwwwwww', 'clipboard-data/shared.json')] })
      );

      await deleteItemsById(tempRoot.dir, ['aaaaaaaa']);

      expect(deleteClipboardData).not.toHaveBeenCalled();
    });

    it('アーカイブのアイテムが同じ実データを使っていれば消さないこと', async () => {
      writeFile(
        'workspace-archive.json',
        JSON.stringify({ items: [clipboardItem('wwwwwwww', 'clipboard-data/shared.json')] })
      );

      await deleteItemsById(tempRoot.dir, ['aaaaaaaa']);

      expect(deleteClipboardData).not.toHaveBeenCalled();
    });

    it('ワークスペースが読めなければ消さないこと', async () => {
      writeFile('workspace.json', '{ broken');

      await deleteItemsById(tempRoot.dir, ['bbbbbbbb']);

      expect(deleteClipboardData).not.toHaveBeenCalled();
    });

    it('本文を書き換えて実データが変わったら、古い実データを消すこと', () => {
      replaceItemById(tempRoot.dir, clipboardItem('bbbbbbbb', 'clipboard-data/new.json'));

      expect(deleteClipboardData).toHaveBeenCalledWith('clipboard-data/own.json');
    });

    it('実データが変わらない書き換えでは消さないこと', () => {
      const renamed = clipboardItem('bbbbbbbb', 'clipboard-data/own.json');
      renamed.displayName = 'renamed';
      replaceItemById(tempRoot.dir, renamed);

      expect(deleteClipboardData).not.toHaveBeenCalled();
    });
  });
});
