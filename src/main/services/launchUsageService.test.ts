import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { launchUsagePathKey, mergeLaunchUsage } from '@common/types/launchUsage';

const settings = { recordLaunchUsage: true };
vi.mock('./settingsService.js', () => ({
  SettingsService: {
    getInstance: async () => ({
      get: async (key: 'recordLaunchUsage') => settings[key],
    }),
  },
}));

const { LaunchUsageService } = await import('./launchUsageService');

describe('LaunchUsageService', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-usage-'));
    settings.recordLaunchUsage = true;
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('id とパスで回数と最後の日時を数え、flush でファイルに書く', async () => {
    const service = LaunchUsageService.initialize(dir);
    await service.recordById('abc12345');
    await service.recordById('abc12345');
    await service.recordByPath('C:\\Tools\\App.exe', ' -x ');

    const snapshot = service.getSnapshot();
    expect(snapshot.byId.abc12345.count).toBe(2);
    expect(snapshot.byPath[launchUsagePathKey('c:\\tools\\app.exe', '-x')].count).toBe(1);

    service.flush();
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'item-usage.json'), 'utf8'));
    expect(saved.version).toBe(1);
    expect(saved.byId.abc12345.count).toBe(2);

    // 読み直しても続きから数える
    const reloaded = LaunchUsageService.initialize(dir);
    await reloaded.recordById('abc12345');
    expect(reloaded.getSnapshot().byId.abc12345.count).toBe(3);
    expect(reloaded.getSnapshot().since).toBe(saved.since);
  });

  it('設定「起動の記録を残す」が切ってあれば数えない', async () => {
    settings.recordLaunchUsage = false;
    const service = LaunchUsageService.initialize(dir);
    await service.recordById('abc12345');
    expect(service.getSnapshot().byId).toEqual({});
  });

  it('壊れたファイルは捨てて記録を始め直す', async () => {
    fs.writeFileSync(path.join(dir, 'item-usage.json'), '{ broken', 'utf8');
    const service = LaunchUsageService.initialize(dir);
    await service.recordById('abc12345');
    expect(service.getSnapshot().byId.abc12345.count).toBe(1);
  });
});

describe('mergeLaunchUsage', () => {
  it('新しいほうの日時と、回数の合計にする', () => {
    expect(
      mergeLaunchUsage({ lastLaunchedAt: 10, count: 2 }, undefined, {
        lastLaunchedAt: 30,
        count: 1,
      })
    ).toEqual({ lastLaunchedAt: 30, count: 3 });
    expect(mergeLaunchUsage(undefined, undefined)).toBeUndefined();
  });
});
