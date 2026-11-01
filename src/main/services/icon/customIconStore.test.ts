import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

vi.mock('electron', () => ({ dialog: {} }));
vi.mock('../../config/pathManager.js', () => ({
  default: { getCustomIconsFolder: () => path.join(tempRoot.dir, 'icon-cache', 'custom') },
}));
vi.mock('@common/logger', () => ({
  iconLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../mainI18n.js', () => ({ mainI18n: { t: (key: string) => key } }));

import { deleteCustomIcon, getCustomIcon, resolveCustomIconPath } from './customIconStore';

describe('カスタムアイコンの名前（A3-238）', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-custom-icon-'));
    fs.mkdirSync(path.join(tempRoot.dir, 'icon-cache', 'custom'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot.dir, 'datafiles'));
    fs.writeFileSync(path.join(tempRoot.dir, 'datafiles', 'data.json'), '{}');
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  it('ファイル名だけを受け付け、フォルダの外を指す名前は使わない', () => {
    expect(resolveCustomIconPath('a1b2c3d4.png')).toBe(
      path.join(tempRoot.dir, 'icon-cache', 'custom', 'a1b2c3d4.png')
    );
    for (const name of ['', '.', '..', '..\\..\\datafiles\\data.json', '../x.png', 'C:x.png']) {
      expect(resolveCustomIconPath(name)).toBeNull();
    }
  });

  it('データファイルの値がフォルダの外を指していても、設定フォルダのほかのファイルを消さない・読まない', async () => {
    const name = '..\\..\\datafiles\\data.json';
    await deleteCustomIcon(name);
    expect(fs.existsSync(path.join(tempRoot.dir, 'datafiles', 'data.json'))).toBe(true);
    expect(getCustomIcon(name)).toBeNull();
  });
});
