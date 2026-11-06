import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../settingsService.js', () => ({
  SettingsService: {
    isSettingsFileReadable: () => true,
    getInstance: async () => ({
      get: async () => ({ autoRunOnStartup: false, rules: [] }),
      set: async () => {},
      reloadFromDisk: () => {},
    }),
  },
}));
vi.mock('../../ipc/notifications.js', () => ({ notifyDataChanged: vi.fn() }));
// 書き込みの成否だけを差し替える（ほかは本物）
const writeDataFileResult = vi.hoisted(() => ({ value: null as boolean | null }));
vi.mock('../dataFileTracker.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../dataFileTracker.js')>();
  return {
    ...actual,
    writeDataFile: (...args: Parameters<typeof actual.writeDataFile>) =>
      writeDataFileResult.value ?? actual.writeDataFile(...args),
  };
});

const { deleteDataFile } = await import('./dataFileOps');
const { getNewerFormatFiles, markNewerFormatFile } = await import('./newerFormatFiles');
const { getCorruptedDataFiles, markDataFileCorrupted } = await import('./corruptedDataFiles');

describe('deleteDataFile', () => {
  let dir: string;
  const fileName = 'datafiles/data2.json';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-dataops-'));
    fs.mkdirSync(path.join(dir, 'datafiles'));
    fs.writeFileSync(path.join(dir, fileName), JSON.stringify({ version: '9.0', items: [] }));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('消したファイルの「新しい版」「壊れている」の印を外す（残るとほかのファイルの保存まで止まる）', async () => {
    markNewerFormatFile(fileName);
    markDataFileCorrupted(fileName);

    const result = await deleteDataFile(dir, fileName);

    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(dir, fileName))).toBe(false);
    expect(getNewerFormatFiles()).not.toContain(fileName);
    expect(getCorruptedDataFiles()).not.toContain(fileName);
  });
});

describe('createDataFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-dataops-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('書き込めなかったら失敗を返す（タブだけ増えてファイルが無い状態にしない。A3-238）', async () => {
    const { createDataFile } = await import('./dataFileOps');
    writeDataFileResult.value = false;

    const result = createDataFile(dir, 'datafiles/data2.json');
    writeDataFileResult.value = null;

    expect(result.success).toBe(false);
    expect(result.error).toContain('datafiles/data2.json');
  });
});
