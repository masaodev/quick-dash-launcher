import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../settingsService.js', () => ({
  SettingsService: {
    getInstance: async () => ({
      get: async () => ({ autoRunOnStartup: false, rules: [] }),
      set: async () => {},
    }),
  },
}));
vi.mock('../../ipc/notifications.js', () => ({ notifyDataChanged: vi.fn() }));

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
