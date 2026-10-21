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
    await service.recordByPath('C:\\Tools\\App\\');

    const snapshot = service.getSnapshot();
    expect(snapshot.byId.abc12345.count).toBe(2);
    expect(snapshot.byPath[launchUsagePathKey('c:\\tools\\app')].count).toBe(1);

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

  it('壊れたファイルは脇へ移して記録を始め直す。数でない記録は捨てる', async () => {
    fs.writeFileSync(path.join(dir, 'item-usage.json'), '{ broken', 'utf8');
    const service = LaunchUsageService.initialize(dir);
    await service.recordById('abc12345');
    expect(service.getSnapshot().byId.abc12345.count).toBe(1);
    expect(fs.readdirSync(dir).some((name) => name.startsWith('item-usage.json.broken-'))).toBe(
      true
    );

    fs.writeFileSync(
      path.join(dir, 'item-usage.json'),
      JSON.stringify({
        since: 1,
        byId: { bad: { count: '5' }, ok: { lastLaunchedAt: 2, count: 3 } },
      }),
      'utf8'
    );
    expect(LaunchUsageService.initialize(dir).getSnapshot().byId).toEqual({
      ok: { lastLaunchedAt: 2, count: 3 },
    });
  });

  it('初めて読んだときは始めた日時を書き、次に起動しても日時を進めない', () => {
    const first = LaunchUsageService.initialize(dir);
    const since = first.getSnapshot().since;
    first.flush();
    const file = path.join(dir, 'item-usage.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).since).toBe(since);

    // 読んだだけ（記録していない）なら書き直さない
    const mtime = fs.statSync(file).mtimeMs;
    const second = LaunchUsageService.initialize(dir);
    expect(second.getSnapshot().since).toBe(since);
    second.flush();
    expect(fs.statSync(file).mtimeMs).toBe(mtime);
  });

  it('ロックなどで一時的に読めないときは、始め直さず上書きもしない', async () => {
    const file = path.join(dir, 'item-usage.json');
    const saved = JSON.stringify({
      version: 1,
      since: 1,
      byId: { a: { lastLaunchedAt: 2, count: 9 } },
    });
    // 読めない状態の代わりに、同じ名前のフォルダを置く（読むと ENOENT 以外のエラーになる）
    fs.mkdirSync(file);
    const service = LaunchUsageService.initialize(dir);
    await service.recordById('b');
    service.flush();
    expect(fs.statSync(file).isDirectory()).toBe(true);
    expect(fs.readdirSync(dir)).toEqual(['item-usage.json']);

    // 読めるようになったら続きから数える
    fs.rmdirSync(file);
    fs.writeFileSync(file, saved, 'utf8');
    await service.recordById('a');
    expect(service.getSnapshot().byId.a.count).toBe(10);
  });

  it('設定を切って入れ直したら、記録を始めた日時をその日に進める（記録は残す）', async () => {
    const service = LaunchUsageService.initialize(dir);
    await service.recordById('a');
    const since = service.getSnapshot().since;
    service.setRecording(false);
    await new Promise((resolve) => setTimeout(resolve, 5));
    service.setRecording(true);
    expect(service.getSnapshot().since).toBeGreaterThan(since);
    expect(service.getSnapshot().byId.a.count).toBe(1);

    // 切っていないのに入れたとき（設定の読み直し）は進めない
    const after = service.getSnapshot().since;
    service.setRecording(true);
    expect(service.getSnapshot().since).toBe(after);
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
