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

  it('同じ秒に何回作っても上書きせず、連番を付けた別のフォルダにする', async () => {
    const service = await BackupService.getInstance();
    const create = (content: string) =>
      service.createPreExternalChangeSnapshot([{ relativePath: 'workspace.json', content }]);

    const first = await create('壊れる前');
    const second = await create('壊れた内容');
    const third = await create('3 回目');

    expect(first).toBe('2026-10-13T01-30-00_pre-external');
    expect(second).toBe('2026-10-13T01-30-00-2_pre-external');
    expect(third).toBe('2026-10-13T01-30-00-3_pre-external');
    const read = (name: string) =>
      fs.readFileSync(path.join(paths.backupFolder, name, 'workspace.json'), 'utf8');
    expect(read(first!)).toBe('壊れる前');
    expect(read(second!)).toBe('壊れた内容');
    expect(read(third!)).toBe('3 回目');

    // 一覧は新しい順（同じ秒なら後から作った方が先）
    const listed = (await service.listSnapshots()).map((s) => s.timestamp);
    expect(listed).toEqual([third, second, first]);
  });

  it('連番の付いたフォルダも、サフィックスの無いものは通常のスナップショットとして数える', async () => {
    const service = await BackupService.getInstance();
    const isRegular = (name: string) =>
      (service as unknown as { isRegularSnapshot(n: string): boolean }).isRegularSnapshot(name);

    expect(isRegular('2026-10-13T01-30-00')).toBe(true);
    expect(isRegular('2026-10-13T01-30-00-2')).toBe(true);
    expect(isRegular('2026-10-13T01-30-00-2_pre-restore')).toBe(false);
    expect(isRegular('2026-10-13T01-30-00_pre-external')).toBe(false);
  });
  it('フォルダ名の日時を UTC として読む（作るときと同じ）', async () => {
    const service = await BackupService.getInstance();
    const name = await service.createPreExternalChangeSnapshot([
      { relativePath: 'workspace.json', content: '{}' },
    ]);
    const [snapshot] = await service.listSnapshots();

    expect(snapshot.timestamp).toBe(name);
    expect(snapshot.createdAt.toISOString()).toBe('2026-10-13T01:30:00.000Z');
  });

  it('規則に合わない名前・フォルダの外を指す名前では、復元も削除もしない', async () => {
    const service = await BackupService.getInstance();
    const outside = path.join(tempDir, 'outside');
    fs.mkdirSync(outside, { recursive: true });

    for (const name of ['..', '../outside', '2026-10-13T01-30-00_/../../outside', 'outside']) {
      expect((await service.deleteSnapshot(name)).success).toBe(false);
      expect((await service.restoreSnapshot(name)).success).toBe(false);
    }
    expect(fs.existsSync(outside)).toBe(true);
  });
});
