import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tempRoot = vi.hoisted(() => ({ dir: '' }));
/** 偽の electron-store がファイルを読んだ・書いた回数（メモリの写しが効いているかを見る） */
const io = vi.hoisted(() => ({ reads: 0, writes: 0, stores: 0 }));

vi.mock('electron', () => ({ app: { getVersion: () => '9.9.9' } }));
vi.mock('../config/pathManager.js', () => {
  const pm = { getConfigFolder: () => tempRoot.dir };
  return { PathManager: pm, default: pm };
});
vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/**
 * electron-store の代わり（このテストで使う振る舞いだけ）。
 * 本物と同じく、defaults に無いキーがファイルにあれば defaults を書き足し、set のたびにファイル全体を書く
 */
vi.mock('electron-store', () => {
  class FakeStore {
    private readonly file: string;
    constructor(options: {
      name: string;
      cwd: string;
      defaults?: Record<string, unknown>;
      deserialize: (text: string) => unknown;
    }) {
      io.stores++;
      this.file = path.join(options.cwd, `${options.name}.json`);
      const fromFile = fs.existsSync(this.file)
        ? (options.deserialize(fs.readFileSync(this.file, 'utf8')) as Record<string, unknown>)
        : {};
      const merged = { ...(options.defaults ?? {}), ...fromFile };
      if (JSON.stringify(merged) !== JSON.stringify(fromFile)) this.write(merged);
    }
    get store(): Record<string, unknown> {
      io.reads++;
      return fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {};
    }
    get(key: string) {
      return this.store[key];
    }
    set(key: string | Record<string, unknown>, value?: unknown) {
      const values = typeof key === 'object' ? key : { [key]: value };
      this.write({ ...this.store, ...values });
    }
    delete(key: string) {
      const next = this.store;
      delete next[key];
      this.write(next);
    }
    clear() {
      this.write({});
    }
    private write(value: Record<string, unknown>) {
      io.writes++;
      fs.writeFileSync(this.file, JSON.stringify(value, null, 2));
    }
  }
  return { default: FakeStore };
});

async function freshService() {
  vi.resetModules();
  const { SettingsService } = await import('./settingsService');
  return SettingsService.getInstance();
}

const settingsPath = () => path.join(tempRoot.dir, 'settings.json');
const readSettings = () => JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));

describe('SettingsService の形式の版（settingsVersion）', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-settings-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  it('新しく作るファイルと、版の無い今までのファイルには 1 を書くこと', async () => {
    const service = await freshService();
    expect(readSettings().settingsVersion).toBe(1);
    expect(service.isNewerFormat()).toBe(false);

    fs.writeFileSync(settingsPath(), JSON.stringify({ hotkey: 'Alt+Space' }));
    const legacy = await freshService();
    expect(readSettings()).toMatchObject({ hotkey: 'Alt+Space', settingsVersion: 1 });
    expect(await legacy.get('settingsVersion')).toBe(1);
  });

  it('新しい版の QDL が保存したファイルには書かず、変えた設定はその回だけ効かせること', async () => {
    const original = JSON.stringify({ settingsVersion: 2, hotkey: 'Alt+Space', future: { a: 1 } });
    fs.writeFileSync(settingsPath(), original);
    const service = await freshService();

    expect(service.isNewerFormat()).toBe(true);
    // ファイルに無い項目は既定値で読む
    expect(await service.get('windowWidth')).toBe(600);
    expect(await service.get('hotkey')).toBe('Alt+Space');

    await service.set('windowWidth', 800);
    await service.setMultiple({ hotkey: 'Ctrl+Space', backupRetention: 3 });
    await service.deleteRemovedKeys(['future']);
    expect(await service.get('windowWidth')).toBe(800);
    expect(await service.get('hotkey')).toBe('Ctrl+Space');
    expect(await service.getAll()).toMatchObject({
      settingsVersion: 2,
      windowWidth: 800,
      backupRetention: 3,
      showKeyboardHints: true,
    });

    await service.reset();
    expect(await service.get('hotkey')).toBe('');
    expect(await service.get('settingsVersion')).toBe(2);

    // ファイルは一切変わっていない（既定値の書き足しも、版の記録もしない）
    expect(fs.readFileSync(settingsPath(), 'utf8')).toBe(original);
  });
});

describe('SettingsService の範囲のある数値の設定', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-settings-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  it('手で直して範囲の外・数値でない値にしても、範囲の端か既定値で読み、ファイルは書き換えないこと', async () => {
    fs.writeFileSync(
      settingsPath(),
      JSON.stringify({
        settingsVersion: 1,
        windowWidth: 99999,
        windowHeight: -5,
        editModeWidth: 'wide',
      })
    );
    const service = await freshService();

    expect(await service.get('windowWidth')).toBe(2000);
    expect(await service.get('windowHeight')).toBe(300);
    expect(await service.get('editModeWidth')).toBe(1200);
    const all = await service.getAll();
    expect(all).toMatchObject({ windowWidth: 2000, windowHeight: 300, editModeWidth: 1200 });
    expect(readSettings()).toMatchObject({ windowWidth: 99999, windowHeight: -5 });
  });
});

describe('SettingsService のメモリの写し（A3-254）', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-settings-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  it('何度読んでもファイルは 1 回しか読まず、QDL の外で書き換えたものは reloadFromDisk で読み直すこと', async () => {
    const service = await freshService();
    io.reads = 0;
    for (let i = 0; i < 5; i++) {
      await service.get('hotkey');
      await service.getAll();
    }
    expect(io.reads).toBe(1);

    fs.writeFileSync(settingsPath(), JSON.stringify({ ...readSettings(), hotkey: 'Alt+Space' }));
    expect(await service.get('hotkey')).toBe('');
    service.reloadFromDisk();
    expect(await service.get('hotkey')).toBe('Alt+Space');
  });

  it('まとめて保存すると 1 回だけ書き、版の記録も同じ書き込みに入れ、次に読むと新しい値になること', async () => {
    const service = await freshService();
    // 既に今の版が記録されているので、版を古くしておく
    fs.writeFileSync(
      settingsPath(),
      JSON.stringify({ ...readSettings(), updatedWithVersion: '1.0.0' })
    );
    service.reloadFromDisk();
    io.writes = 0;

    await service.setMultiple({ windowWidth: 800, windowHeight: 500, showKeyboardHints: false });

    expect(io.writes).toBe(1);
    expect(readSettings()).toMatchObject({
      windowWidth: 800,
      windowHeight: 500,
      showKeyboardHints: false,
      updatedWithVersion: '9.9.9',
    });
    expect(await service.get('windowWidth')).toBe(800);

    // 今の版が記録済みなら、版の記録で余計に書かない
    io.writes = 0;
    await service.set('windowWidth', 900);
    expect(io.writes).toBe(1);
    expect(await service.get('windowWidth')).toBe(900);
  });

  it('返した値を書き換えても、持っている設定は変わらないこと', async () => {
    const service = await freshService();
    const tabs = await service.get('dataFileTabs');
    tabs.push({ files: ['datafiles/data9.json'], name: 'X' });
    const all = await service.getAll();
    all.dataFileTabs.length = 0;

    expect(await service.get('dataFileTabs')).toHaveLength(1);
    expect((await service.getAll()).dataFileTabs).toHaveLength(1);
  });

  it('QDL の外で壊したファイルは、写しを捨てた後は既定値で読み、直すと読めること', async () => {
    const service = await freshService();
    await service.set('windowWidth', 800);
    fs.writeFileSync(settingsPath(), '{ broken');
    service.reloadFromDisk();
    expect(await service.get('windowWidth')).toBe(600);

    fs.writeFileSync(settingsPath(), JSON.stringify({ settingsVersion: 1, windowWidth: 700 }));
    expect(await service.get('windowWidth')).toBe(700);
  });
});

describe('SettingsService.getInstance', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-settings-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  it('同時に呼ばれても初期化は 1 回だけで、全員が初期化の終わったインスタンスを受け取ること（A3-254）', async () => {
    vi.resetModules();
    const { SettingsService } = await import('./settingsService');
    io.stores = 0;
    const [a, b] = await Promise.all([
      SettingsService.getInstance(),
      SettingsService.getInstance(),
    ]);
    expect(a).toBe(b);
    expect(io.stores).toBe(1);
    expect(await a.get('windowWidth')).toBe(600);
  });
});
