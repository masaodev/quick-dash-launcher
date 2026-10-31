import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  UpdateCheckService,
  fetchGitHubReleases,
  type UpdateCheckDeps,
} from './updateCheckService';

const REPO_URL = 'https://github.com/masaodev/quick-dash-launcher/releases/tag/';
const release = (tag: string, prerelease = tag.includes('-')) => ({
  tag_name: tag,
  html_url: `${REPO_URL}${tag}`,
  draft: false,
  prerelease,
});

const DAY = 24 * 60 * 60 * 1000;

let dir: string;
let filePath: string;
let now: number;

function makeService(overrides: Partial<UpdateCheckDeps> = {}) {
  const deps: UpdateCheckDeps = {
    currentVersion: '0.8.0',
    distribution: 'portable',
    filePath,
    getSettings: vi.fn(async () => ({ enabled: true, includeBeta: false })),
    fetchReleases: vi.fn(async () => [release('v0.8.1'), release('v0.8.0')]),
    notify: vi.fn(),
    onChange: vi.fn(),
    now: () => now,
    ...overrides,
  };
  return { service: new UpdateCheckService(deps), deps };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-update-'));
  filePath = path.join(dir, 'update-check.json');
  now = Date.UTC(2026, 9, 31);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('UpdateCheckService', () => {
  it('新しい版を見つけたら 1 回だけ知らせ、状態を保存する', async () => {
    const { service, deps } = makeService();

    const status = await service.checkNow();
    expect(status.available).toEqual({ version: '0.8.1', url: `${REPO_URL}v0.8.1` });
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(deps.onChange).toHaveBeenCalledTimes(1);

    await service.checkNow();
    expect(deps.notify).toHaveBeenCalledTimes(1);

    const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(saved).toMatchObject({
      version: 1,
      lastCheckedAt: now,
      latest: { version: '0.8.1' },
      notifiedVersion: '0.8.1',
    });
  });

  it('再起動しても、知らせ済みの版はもう一度知らせない', async () => {
    await makeService().service.checkNow();
    const { service, deps } = makeService();
    now += 2 * DAY;
    await service.checkIfDue();
    expect(deps.fetchReleases).toHaveBeenCalledTimes(1);
    expect(deps.notify).not.toHaveBeenCalled();
    expect(await service.getAvailableRelease()).toMatchObject({ version: '0.8.1' });
  });

  it('前回から 24 時間たつまでは確かめない', async () => {
    const { service, deps } = makeService();
    await service.checkIfDue();
    now += DAY - 1;
    await service.checkIfDue();
    expect(deps.fetchReleases).toHaveBeenCalledTimes(1);
    now += 1;
    await service.checkIfDue();
    expect(deps.fetchReleases).toHaveBeenCalledTimes(2);
  });

  it('今の版が追いついたら（更新した後）知らせない', async () => {
    await makeService().service.checkNow();
    const { service } = makeService({ currentVersion: '0.8.1' });
    expect(await service.getAvailableRelease()).toBeNull();
    expect((await service.getStatus()).available).toBeNull();
  });

  it('設定を切っていれば確かめず、トレイにも出さない', async () => {
    await makeService().service.checkNow();
    const { service, deps } = makeService({
      getSettings: vi.fn(async () => ({ enabled: false, includeBeta: false })),
    });
    now += 2 * DAY;
    await service.checkIfDue();
    expect(deps.fetchReleases).not.toHaveBeenCalled();
    expect(await service.getAvailableRelease()).toBeNull();
  });

  it('Store 版・開発版では確かめない（開発版は手で試すときだけ動かせる）', async () => {
    for (const distribution of ['store', 'dev'] as const) {
      const { service, deps } = makeService({ distribution });
      expect(service.isSupported()).toBe(false);
      await service.checkIfDue();
      expect(deps.fetchReleases).not.toHaveBeenCalled();
      expect((await service.getStatus()).supported).toBe(false);
    }
    expect(makeService({ distribution: 'dev', allowInDev: true }).service.isSupported()).toBe(true);
  });

  it('つながらないときは知らせず、失敗したことだけ残して次の回にまた確かめる', async () => {
    const { service, deps } = makeService({
      fetchReleases: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    const status = await service.checkNow();
    expect(status).toMatchObject({ failed: true, available: null, lastCheckedAt: null });
    expect(deps.notify).not.toHaveBeenCalled();
    // 「最後に確かめた日時」は進めない（24 時間待たずに確かめ直すため）
    expect(
      fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath, 'utf-8')).lastCheckedAt
        : undefined
    ).toBeUndefined();

    // 1 時間たつまでは確かめ直さない（設定を変えるたびに問い合わせない）
    now += 30 * 60 * 1000;
    await service.checkIfDue();
    expect(deps.fetchReleases).toHaveBeenCalledTimes(1);

    // 1 時間たてば、つながったところで確かめ直す
    now += 31 * 60 * 1000;
    vi.mocked(deps.fetchReleases).mockResolvedValue([release('v0.8.1')]);
    await service.checkIfDue();
    expect(deps.fetchReleases).toHaveBeenCalledTimes(2);
    expect(await service.getStatus()).toMatchObject({ failed: false, lastCheckedAt: now });
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });

  it('「ベータ版も知らせる」を切ったら、前に見つけたベータ版を出さずに確かめ直す', async () => {
    let includeBeta = true;
    const { service, deps } = makeService({
      getSettings: vi.fn(async () => ({ enabled: true, includeBeta })),
      fetchReleases: vi.fn(async () => [release('v0.9.0-beta.1'), release('v0.8.0')]),
    });
    expect((await service.checkNow()).available).toMatchObject({ version: '0.9.0-beta.1' });

    includeBeta = false;
    expect(await service.getAvailableRelease()).toBeNull();
    await service.onSettingsChanged();
    expect(deps.fetchReleases).toHaveBeenCalledTimes(2);
    expect(await service.getAvailableRelease()).toBeNull();
  });

  it('ベータ版から正式版に上げた後は、前に見つけたベータ版を出さない', async () => {
    await makeService({
      currentVersion: '0.8.0-beta.30',
      fetchReleases: vi.fn(async () => [release('v0.9.0-beta.1')]),
    }).service.checkNow();
    const { service } = makeService({ currentVersion: '0.8.0' });
    expect(await service.getAvailableRelease()).toBeNull();
  });

  it('同時に押されても、問い合わせは 1 回だけ', async () => {
    const { service, deps } = makeService();
    await Promise.all([service.checkNow(), service.checkNow()]);
    expect(deps.fetchReleases).toHaveBeenCalledTimes(1);
  });

  it('新しい版の QDL が書いたファイルは上書きしない', async () => {
    const content = JSON.stringify({ version: 2, lastCheckedAt: 1, future: true });
    fs.writeFileSync(filePath, content);
    await makeService().service.checkNow();
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
  });

  it('壊れたファイルは無視して初めからやり直す', async () => {
    fs.writeFileSync(filePath, '{ broken');
    const { service, deps } = makeService();
    await service.checkIfDue();
    expect(deps.fetchReleases).toHaveBeenCalledTimes(1);
  });

  it('保存されたページがリポジトリの外なら使わない（手で書き換えられた場合）', async () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({ version: 1, latest: { version: '9.0.0', url: 'https://example.com/' } })
    );
    const { service } = makeService();
    expect(await service.getAvailableRelease()).toBeNull();
  });
});

describe('fetchGitHubReleases', () => {
  it('GitHub の API を User-Agent 付きで読み、失敗の応答は例外にする', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    await expect(fetchGitHubReleases(fetchImpl, 'QuickDashLauncher/0.8.0')).resolves.toEqual([]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('api.github.com/repos/masaodev/quick-dash-launcher/releases');
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('QuickDashLauncher/0.8.0');

    const failing = vi.fn(async () => new Response('rate limited', { status: 403 }));
    await expect(fetchGitHubReleases(failing, 'x')).rejects.toThrow('403');
  });
});
