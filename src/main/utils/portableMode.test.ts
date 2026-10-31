import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  PORTABLE_DATA_DIR,
  PORTABLE_MARKER_FILE,
  isPortableEdition,
  resolvePortableData,
} from './portableMode';

let dir: string;
let execPath: string;

const input = (overrides: Partial<Parameters<typeof resolvePortableData>[0]> = {}) => ({
  isPackaged: true,
  isStore: false,
  hasAppInstance: false,
  execPath,
  ...overrides,
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-portable-'));
  execPath = path.join(dir, 'QuickDashLauncher.exe');
  fs.writeFileSync(execPath, '');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function makePortable({ dataDir = true } = {}) {
  fs.writeFileSync(path.join(dir, PORTABLE_MARKER_FILE), 'portable');
  if (dataDir) fs.mkdirSync(path.join(dir, PORTABLE_DATA_DIR));
}

describe('resolvePortableData', () => {
  it('印とデータフォルダがあれば、データフォルダを使う（確かめたファイルは残さない）', () => {
    makePortable();
    expect(resolvePortableData(input())).toEqual({
      kind: 'active',
      dataDir: path.join(dir, PORTABLE_DATA_DIR),
    });
    expect(fs.readdirSync(path.join(dir, PORTABLE_DATA_DIR))).toEqual([]);
    expect(isPortableEdition(execPath)).toBe(true);
  });

  it('データフォルダを消していれば、今までどおり %APPDATA%（off）', () => {
    makePortable({ dataDir: false });
    expect(resolvePortableData(input())).toEqual({ kind: 'off' });
    // 配布形式はポータブル版のまま
    expect(isPortableEdition(execPath)).toBe(true);
  });

  it('印が無い（インストーラー版）なら、同じ名前のフォルダがあっても使わない', () => {
    fs.mkdirSync(path.join(dir, PORTABLE_DATA_DIR));
    expect(resolvePortableData(input())).toEqual({ kind: 'off' });
    expect(isPortableEdition(execPath)).toBe(false);
  });

  it('開発版・Store 版・APP_INSTANCE 付きでは使わない', () => {
    makePortable();
    expect(resolvePortableData(input({ isPackaged: false }))).toEqual({ kind: 'off' });
    expect(resolvePortableData(input({ isStore: true }))).toEqual({ kind: 'off' });
    expect(resolvePortableData(input({ hasAppInstance: true }))).toEqual({ kind: 'off' });
  });

  it('同じ名前のファイル（フォルダでない）なら使わない', () => {
    fs.writeFileSync(path.join(dir, PORTABLE_MARKER_FILE), 'portable');
    fs.writeFileSync(path.join(dir, PORTABLE_DATA_DIR), 'not a folder');
    expect(resolvePortableData(input())).toEqual({ kind: 'off' });
  });

  it('書き込めなければ unwritable（%APPDATA% を使い、起動時に知らせる）', () => {
    makePortable();
    const readOnlyFs = {
      existsSync: fs.existsSync,
      statSync: fs.statSync,
      writeFileSync: () => {
        throw new Error('EACCES');
      },
      rmSync: fs.rmSync,
    };
    expect(resolvePortableData(input(), readOnlyFs)).toEqual({
      kind: 'unwritable',
      dataDir: path.join(dir, PORTABLE_DATA_DIR),
    });
  });
});
