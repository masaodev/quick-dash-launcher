import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

vi.mock('../config/pathManager.js', () => ({
  PathManager: { getConfigFolder: () => tempRoot.dir },
  default: { getConfigFolder: () => tempRoot.dir },
}));

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  dataLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  detectExternalChange,
  forgetDataFile,
  hashContent,
  prepareDataFileContent,
  rememberDataFileContent,
  resetDataFileTrackerForTesting,
  toDataFileKey,
  writeDataFile,
} from './dataFileTracker';
import { getNewerFormatFiles, resetNewerFormatFilesForTesting } from './data/newerFormatFiles';

describe('dataFileTracker', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-tracker-'));
    resetDataFileTrackerForTesting();
    resetNewerFormatFilesForTesting();
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  it('toDataFileKey は設定フォルダからの相対パスを / 区切りで返すこと', () => {
    const key = toDataFileKey(path.join(tempRoot.dir, 'datafiles', 'data.json'));
    expect(key).toBe('datafiles/data.json');
  });

  it('hashContent は同じ内容で同じ値、違う内容で違う値を返すこと', () => {
    expect(hashContent('a')).toBe(hashContent('a'));
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  it('記憶がない初回は外部変更として扱わないこと', () => {
    expect(detectExternalChange('datafiles/data.json', '{}')).toBeNull();
  });

  it('記憶した内容と同じなら外部変更なし、違えば変更前の内容を返すこと', () => {
    rememberDataFileContent('datafiles/data.json', 'v1');

    expect(detectExternalChange('datafiles/data.json', 'v1')).toBeNull();
    expect(detectExternalChange('datafiles/data.json', 'v2')).toBe('v1');
  });

  it('writeDataFile は書き込んだ内容を記憶し、自分の書き込みを外部変更と誤検知しないこと', () => {
    const filePath = path.join(tempRoot.dir, 'datafiles', 'data.json');

    expect(writeDataFile(filePath, 'written')).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('written');
    expect(detectExternalChange('datafiles/data.json', 'written')).toBeNull();
    expect(detectExternalChange('datafiles/data.json', 'edited outside')).toBe('written');
  });

  it('forgetDataFile で記憶を消せること', () => {
    rememberDataFileContent('datafiles/data2.json', 'v1');
    forgetDataFile('datafiles/data2.json');

    expect(detectExternalChange('datafiles/data2.json', 'v2')).toBeNull();
  });

  describe('知らない項目の付け直し（新しい版の QDL が足した項目を消さない）', () => {
    const writeJson = (relative: string, value: unknown) => {
      const filePath = path.join(tempRoot.dir, ...relative.split('/'));
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
      return filePath;
    };
    const readJson = (filePath: string) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

    it('同じ id のアイテムが持っていた知らない項目を付け直して書き、その内容を記憶すること', () => {
      const filePath = writeJson('datafiles/data.json', {
        version: '1.0',
        items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'A', path: 'p', future: 1 }],
      });
      const next = JSON.stringify(
        { version: '1.0', items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'B', path: 'p' }] },
        null,
        2
      );

      expect(writeDataFile(filePath, next)).toBe(true);
      const written = fs.readFileSync(filePath, 'utf8');
      expect(JSON.parse(written).items[0]).toEqual({
        id: 'Aaaaaaa1',
        type: 'item',
        displayName: 'B',
        path: 'p',
        future: 1,
      });
      expect(detectExternalChange('datafiles/data.json', written)).toBeNull();
    });

    it('ほかのデータファイルから移ってきたアイテムの項目も付け直すこと', () => {
      writeJson('datafiles/data2.json', {
        version: '1.0',
        items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'A', path: 'p', future: 'x' }],
      });
      const target = writeJson('datafiles/data.json', { version: '1.0', items: [] });
      const next = JSON.stringify({
        version: '1.0',
        items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'A', path: 'p' }],
      });

      expect(writeDataFile(target, next)).toBe(true);
      expect(readJson(target).items[0]).toHaveProperty('future', 'x');
    });

    it('付け直すものが無ければ渡した内容をそのまま書くこと', () => {
      const filePath = writeJson('datafiles/data.json', { version: '1.0', items: [] });
      const next = '{\n"version": "1.0",\n"items": []\n}';

      expect(prepareDataFileContent(filePath, next)).toBe(next);
    });

    it('ワークスペースはアーカイブとの間で移った要素の項目を付け直すこと', () => {
      writeJson('workspace-archive.json', {
        version: '2.0',
        groups: [],
        items: [{ id: 'Iiiiiii1', type: 'item', displayName: 'A', path: 'p', future: true }],
      });
      const main = writeJson('workspace.json', {
        version: '2.0',
        workspaces: [],
        groups: [],
        items: [],
      });
      const next = JSON.stringify({
        version: '2.0',
        workspaces: [],
        groups: [],
        items: [{ id: 'Iiiiiii1', type: 'item', displayName: 'A', path: 'p' }],
      });

      expect(writeDataFile(main, next)).toBe(true);
      expect(readJson(main).items[0]).toHaveProperty('future', true);
    });

    it('データファイル・ワークスペースファイル以外はそのまま書くこと', () => {
      const filePath = writeJson('other.json', { a: 1, extra: 2 });

      expect(prepareDataFileContent(filePath, '{"a":1}')).toBe('{"a":1}');
    });

    it('新しい版の QDL が保存したファイルには書かず、その印を残すこと', () => {
      const original = { version: '1.1', items: [{ id: 'Aaaaaaa1', type: 'future' }] };
      const filePath = writeJson('datafiles/data.json', original);
      const workspace = writeJson('workspace.json', { version: '3.0', workspaces: [] });

      expect(writeDataFile(filePath, '{"version":"1.0","items":[]}')).toBe(false);
      expect(writeDataFile(workspace, '{"version":"2.0","workspaces":[]}')).toBe(false);
      expect(readJson(filePath)).toEqual(original);
      expect(readJson(workspace).version).toBe('3.0');
      expect(getNewerFormatFiles()).toEqual(['datafiles/data.json', 'workspace.json']);
    });

    it('渡した付け直しの元を使うこと（書き始める前に読んだ内容）', () => {
      const filePath = writeJson('datafiles/data.json', { version: '1.0', items: [] });
      const next = JSON.stringify({ version: '1.0', items: [{ id: 'Aaaaaaa1', type: 'item' }] });

      const output = prepareDataFileContent(filePath, next, {
        unknownKeySources: {
          target: { version: '1.0', items: [] },
          others: [{ items: [{ id: 'Aaaaaaa1', kept: 1 }] }],
        },
      });
      expect(JSON.parse(output).items[0]).toHaveProperty('kept', 1);
    });
  });
});
