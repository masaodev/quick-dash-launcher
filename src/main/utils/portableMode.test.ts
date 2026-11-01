import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  PORTABLE_DATA_DIR,
  PORTABLE_MARKER_FILE,
  isPortableEdition,
  isPortableModeAvailable,
  resolvePortableData,
  switchToPortableMode,
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

describe('isPortableModeAvailable', () => {
  const availability = (
    overrides: Partial<Parameters<typeof isPortableModeAvailable>[0]> = {}
  ) => ({
    ...input(),
    hasCustomConfigDir: false,
    isLegacyPortableExe: false,
    state: { kind: 'off' } as const,
    ...overrides,
  });

  it('ZIP 版で、データフォルダを使っていなければ選べる', () => {
    makePortable({ dataDir: false });
    expect(isPortableModeAvailable(availability())).toBe(true);
  });

  it('印が無い（インストーラー版）・既にデータフォルダを使っている・書けなかったときは選べない', () => {
    expect(isPortableModeAvailable(availability())).toBe(false);
    makePortable({ dataDir: false });
    const dataDir = path.join(dir, PORTABLE_DATA_DIR);
    expect(isPortableModeAvailable(availability({ state: { kind: 'active', dataDir } }))).toBe(
      false
    );
    expect(isPortableModeAvailable(availability({ state: { kind: 'unwritable', dataDir } }))).toBe(
      false
    );
  });

  it('開発版・Store 版・APP_INSTANCE 付き・設定フォルダの差し替え・以前の 1 ファイルの exe では選べない', () => {
    makePortable({ dataDir: false });
    expect(isPortableModeAvailable(availability({ isPackaged: false }))).toBe(false);
    expect(isPortableModeAvailable(availability({ isStore: true }))).toBe(false);
    expect(isPortableModeAvailable(availability({ hasAppInstance: true }))).toBe(false);
    expect(isPortableModeAvailable(availability({ hasCustomConfigDir: true }))).toBe(false);
    expect(isPortableModeAvailable(availability({ isLegacyPortableExe: true }))).toBe(false);
  });
});

describe('switchToPortableMode', () => {
  let configFolder: string;

  beforeEach(() => {
    configFolder = path.join(dir, 'appdata-config');
    fs.mkdirSync(path.join(configFolder, 'datafiles'), { recursive: true });
    fs.mkdirSync(path.join(configFolder, 'logs'));
    fs.writeFileSync(path.join(configFolder, 'datafiles', 'data.json'), '{"items":[]}');
    fs.writeFileSync(path.join(configFolder, 'logs', 'main.log'), 'log');
    fs.writeFileSync(
      path.join(configFolder, 'settings.json'),
      JSON.stringify({ hotkey: '', tabs: ['メイン', 'Web'] })
    );
  });

  it('データフォルダを作って設定フォルダを写し、選んだ設定を書き足す（ログは写さない）', () => {
    const dataDir = switchToPortableMode({
      execPath,
      configFolder,
      settings: { hotkey: 'Alt+Space', autoLaunch: false },
    });
    expect(dataDir).toBe(path.join(dir, PORTABLE_DATA_DIR));
    const copied = path.join(dataDir, 'config');
    expect(fs.readFileSync(path.join(copied, 'datafiles', 'data.json'), 'utf8')).toBe(
      '{"items":[]}'
    );
    expect(fs.existsSync(path.join(copied, 'logs'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(copied, 'settings.json'), 'utf8'))).toEqual({
      hotkey: 'Alt+Space',
      autoLaunch: false,
      tabs: ['メイン', 'Web'],
    });
  });

  it('%APPDATA% 側の設定は書き換えない', () => {
    switchToPortableMode({ execPath, configFolder, settings: { hotkey: 'Alt+Space' } });
    expect(JSON.parse(fs.readFileSync(path.join(configFolder, 'settings.json'), 'utf8'))).toEqual({
      hotkey: '',
      tabs: ['メイン', 'Web'],
    });
  });

  it('同じ名前のものが既にあれば消さずに失敗する', () => {
    fs.writeFileSync(path.join(dir, PORTABLE_DATA_DIR), 'not a folder');
    expect(() =>
      switchToPortableMode({ execPath, configFolder, settings: { hotkey: 'Alt+Space' } })
    ).toThrow();
    expect(fs.readFileSync(path.join(dir, PORTABLE_DATA_DIR), 'utf8')).toBe('not a folder');
  });

  it('写す途中で失敗したら、作りかけのデータフォルダを消す', () => {
    fs.writeFileSync(path.join(configFolder, 'settings.json'), '{broken');
    expect(() =>
      switchToPortableMode({ execPath, configFolder, settings: { hotkey: 'Alt+Space' } })
    ).toThrow();
    expect(fs.existsSync(path.join(dir, PORTABLE_DATA_DIR))).toBe(false);
  });
});
