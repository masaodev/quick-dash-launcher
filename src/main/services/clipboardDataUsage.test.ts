import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

vi.mock('../config/pathManager.js', () => ({
  PathManager: {
    getDataFiles: () => ['datafiles/data.json'],
    getWorkspaceFilePath: () => path.join(tempRoot.dir, 'workspace.json'),
    getWorkspaceArchiveFilePath: () => path.join(tempRoot.dir, 'workspace-archive.json'),
    getClipboardDataFolder: () => path.join(tempRoot.dir, 'clipboard-data'),
  },
}));

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const deleteClipboardData = vi.hoisted(() => vi.fn(async () => true));
vi.mock('./clipboardService.js', () => ({
  ClipboardService: { getInstance: () => ({ deleteClipboardData }) },
}));

import {
  clipboardDataRefsInFile,
  collectClipboardDataRefsInUse,
  findUnusedClipboardData,
  releaseClipboardData,
} from './clipboardDataUsage';

function writeFile(fileName: string, content: unknown): void {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  fs.writeFileSync(path.join(tempRoot.dir, fileName), text, 'utf8');
}

/** clipboard-data に実データを置き、更新日時を ageMs だけ前にする */
function writeData(id: string, ageMs: number, now: number): void {
  const filePath = path.join(tempRoot.dir, 'clipboard-data', `${id}.json`);
  fs.writeFileSync(filePath, '{"formats":["text"],"text":"x"}', 'utf8');
  const time = new Date(now - ageMs);
  fs.utimesSync(filePath, time, time);
}

const clip = (ref: string) => ({ id: 'x', type: 'clipboard', dataFileRef: ref });
const HOUR = 60 * 60 * 1000;

describe('clipboardDataUsage', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-clip-usage-'));
    fs.mkdirSync(path.join(tempRoot.dir, 'datafiles'));
    fs.mkdirSync(path.join(tempRoot.dir, 'clipboard-data'));
    deleteClipboardData.mockClear();
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  it('データファイル・ワークスペース・アーカイブ（古い形式のキーも）の参照を集めること', () => {
    writeFile('datafiles/data.json', { items: [clip('clipboard-data/a.json')] });
    writeFile('workspace.json', { items: [clip('clipboard-data/b.json')] });
    writeFile('workspace-archive.json', {
      items: [{ id: 'y', type: 'clipboard', clipboardDataRef: 'clipboard-data/c.json' }],
    });

    expect([...collectClipboardDataRefsInUse(tempRoot.dir)!].sort()).toEqual([
      'clipboard-data/a.json',
      'clipboard-data/b.json',
      'clipboard-data/c.json',
    ]);
  });

  it('読めないファイルがあれば null を返し、何も消さないこと', () => {
    writeFile('datafiles/data.json', '{ broken');

    expect(collectClipboardDataRefsInUse(tempRoot.dir)).toBeNull();
    releaseClipboardData(tempRoot.dir, ['clipboard-data/a.json']);
    expect(deleteClipboardData).not.toHaveBeenCalled();
  });

  it('渡した実データのうち、使われていないものだけを消すこと', () => {
    writeFile('workspace.json', { items: [clip('clipboard-data/kept.json')] });

    releaseClipboardData(tempRoot.dir, ['clipboard-data/kept.json', 'clipboard-data/gone.json']);

    expect(deleteClipboardData).toHaveBeenCalledTimes(1);
    expect(deleteClipboardData).toHaveBeenCalledWith('clipboard-data/gone.json');
  });

  it('ファイルの中の参照を返し、読めなければ空にすること', () => {
    writeFile('datafiles/data.json', { items: [clip('clipboard-data/a.json')] });
    writeFile('workspace.json', '{ broken');

    expect(clipboardDataRefsInFile(path.join(tempRoot.dir, 'datafiles/data.json'))).toEqual([
      'clipboard-data/a.json',
    ]);
    expect(clipboardDataRefsInFile(path.join(tempRoot.dir, 'workspace.json'))).toEqual([]);
  });

  describe('findUnusedClipboardData', () => {
    const now = Date.now();

    it('どこからも使われていない実データを返し、保存して間もないものは含めないこと', () => {
      writeFile('datafiles/data.json', { items: [clip('clipboard-data/used.json')] });
      writeData('used', 2 * HOUR, now);
      writeData('orphan', 2 * HOUR, now);
      writeData('fresh', 60 * 1000, now);

      expect(findUnusedClipboardData(tempRoot.dir, now)).toEqual(['clipboard-data/orphan.json']);
    });

    it('読めないファイルがあれば null を返すこと', () => {
      writeFile('workspace-archive.json', '{ broken');
      writeData('orphan', 2 * HOUR, now);

      expect(findUnusedClipboardData(tempRoot.dir, now)).toBeNull();
    });
  });
});
