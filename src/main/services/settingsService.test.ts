import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

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
      this.file = path.join(options.cwd, `${options.name}.json`);
      const fromFile = fs.existsSync(this.file)
        ? (options.deserialize(fs.readFileSync(this.file, 'utf8')) as Record<string, unknown>)
        : {};
      const merged = { ...(options.defaults ?? {}), ...fromFile };
      if (JSON.stringify(merged) !== JSON.stringify(fromFile)) this.write(merged);
    }
    get store(): Record<string, unknown> {
      return fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {};
    }
    get(key: string) {
      return this.store[key];
    }
    set(key: string, value: unknown) {
      this.write({ ...this.store, [key]: value });
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
