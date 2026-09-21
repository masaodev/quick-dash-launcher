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
  rememberDataFileContent,
  resetDataFileTrackerForTesting,
  toDataFileKey,
  writeDataFile,
} from './dataFileTracker';

describe('dataFileTracker', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-tracker-'));
    resetDataFileTrackerForTesting();
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
});
