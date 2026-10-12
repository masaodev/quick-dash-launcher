import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const paths = vi.hoisted(() => ({ backupFolder: '' }));

vi.mock('../config/pathManager.js', () => ({
  default: { getBackupFolder: vi.fn(() => paths.backupFolder) },
}));

vi.mock('./settingsService.js', () => ({
  SettingsService: { getInstance: vi.fn(async () => ({ get: vi.fn(async () => true) })) },
}));

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { BackupService } from './backupService';

describe('BackupService の変更前スナップショット', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-backup-test-'));
    paths.backupFolder = path.join(tempDir, 'backup');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T01:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('同じ秒に 2 回作っても上書きせず、連番を付けた別のフォルダにする', async () => {
    const service = await BackupService.getInstance();

    const first = await service.createPreExternalChangeSnapshot([
      { relativePath: 'workspace.json', content: '壊れる前' },
    ]);
    const second = await service.createPreExternalChangeSnapshot([
      { relativePath: 'workspace.json', content: '壊れた内容' },
    ]);

    expect(first).toBe('2026-10-13T01-30-00_pre-external');
    expect(second).toBe('2026-10-13T01-30-00-2_pre-external');
    const read = (name: string) =>
      fs.readFileSync(path.join(paths.backupFolder, name, 'workspace.json'), 'utf8');
    expect(read(first!)).toBe('壊れる前');
    expect(read(second!)).toBe('壊れた内容');

    // 一覧は新しい順（同じ秒なら連番の大きい方が先）
    const listed = (await service.listSnapshots()).map((s) => s.timestamp);
    expect(listed).toEqual([second, first]);
  });
});
