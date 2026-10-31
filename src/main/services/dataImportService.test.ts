import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { zipSync, strToU8, strFromU8, type Zippable } from 'fflate';

import { buildDataExport } from './dataExportService';
import {
  applyDataImport,
  countCurrentItems,
  countImportItems,
  isImportablePath,
  readDataImport,
} from './dataImportService';

const manifest = (extra: Record<string, unknown> = {}) =>
  strToU8(
    JSON.stringify({
      format: 'quick-dash-launcher-export',
      formatVersion: 1,
      appVersion: '0.8.0',
      distribution: 'store',
      exportedAt: '2026-10-31T12:34:56.000Z',
      files: [],
      ...extra,
    })
  );

const json = (value: unknown) => strToU8(JSON.stringify(value));

describe('dataImportService', () => {
  let tempDir: string;
  let configFolder: string;

  const write = (folder: string, relPath: string, content: string) => {
    const filePath = path.join(folder, ...relPath.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-import-test-'));
    configFolder = path.join(tempDir, 'config');
    fs.mkdirSync(configFolder);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('isImportablePath', () => {
    it.each([
      'settings.json',
      'workspace.json',
      'workspace-archive.json',
      'workspace-ui-state.json',
      'item-usage.json',
      'search-history.json',
      'datafiles/data.json',
      'datafiles/data2.json',
      'clipboard-data/abc_123.json',
      'icon-cache/custom/my icon.png',
    ])('%s は読み込む', (name) => {
      expect(isImportablePath(name)).toBe(true);
    });

    it.each([
      '../settings.json',
      'datafiles/../../evil.json',
      'datafiles\\data.json',
      'C:/Windows/evil.json',
      '/etc/passwd',
      'datafiles/memo.txt',
      'datafiles/data.broken-20261031T120000.json',
      'datafiles/sub/data.json',
      'clipboard-data/../x.json',
      'icon-cache/custom/..',
      'icon-cache/custom/a:b.png',
      'icon-cache/apps/app.png',
      'backup/x/settings.json',
      'path-type-cache.json',
      'logs/main.log',
    ])('%s は拒む', (name) => {
      expect(isImportablePath(name)).toBe(false);
    });
  });

  describe('readDataImport', () => {
    it('書き出した zip をそのまま読み戻せる', () => {
      write(configFolder, 'settings.json', '{"settingsVersion":1,"hotkey":"Alt+Space"}');
      write(configFolder, 'datafiles/data.json', '{"version":"1.0","items":[{},{}]}');
      write(configFolder, 'icon-cache/custom/icon.png', 'png');
      const { zip } = buildDataExport(configFolder, {
        appVersion: '0.8.0',
        distribution: 'store',
        exportedAt: new Date('2026-10-31T12:34:56.000Z'),
      });

      const result = readDataImport(zip);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.content.manifest).toMatchObject({
        appVersion: '0.8.0',
        distribution: 'store',
        exportedAt: '2026-10-31T12:34:56.000Z',
      });
      expect([...result.content.files.keys()]).toEqual([
        'settings.json',
        'datafiles/data.json',
        'icon-cache/custom/icon.png',
      ]);
      expect(countImportItems(result.content)).toEqual({ items: 2, workspaceItems: 0 });
    });

    it('zip でない・manifest が無い・format が違うものは、QDL が書き出したものでないとする', () => {
      expect(readDataImport(strToU8('not a zip'))).toEqual({
        ok: false,
        problem: { kind: 'notExport' },
      });
      expect(readDataImport(zipSync({ 'settings.json': json({}) }))).toEqual({
        ok: false,
        problem: { kind: 'notExport' },
      });
      expect(
        readDataImport(zipSync({ 'manifest.json': manifest({ format: 'something-else' }) }))
      ).toEqual({ ok: false, problem: { kind: 'notExport' } });
    });

    it('新しい版で書き出したもの（zip の形式の版・中のファイルの版）は読まない', () => {
      expect(readDataImport(zipSync({ 'manifest.json': manifest({ formatVersion: 2 }) }))).toEqual({
        ok: false,
        problem: { kind: 'newerVersion' },
      });
      const newer: Array<[string, unknown]> = [
        ['settings.json', { settingsVersion: 99 }],
        ['datafiles/data.json', { version: '9.0', items: [] }],
        ['workspace.json', { version: '9.0', groups: [], items: [] }],
        ['item-usage.json', { version: 9 }],
        ['search-history.json', { version: '9.0', entries: [] }],
      ];
      for (const [name, content] of newer) {
        expect(
          readDataImport(zipSync({ 'manifest.json': manifest(), [name]: json(content) }))
        ).toEqual({ ok: false, problem: { kind: 'newerVersion' } });
      }
    });

    it('決まった名前以外のファイル・JSON として読めないファイルがあれば、何も読まない', () => {
      const withEntry = (entries: Zippable) =>
        readDataImport(zipSync({ 'manifest.json': manifest(), ...entries }));

      expect(withEntry({ 'settings.json': json({}), '../evil.json': json({}) })).toEqual({
        ok: false,
        problem: { kind: 'invalidFile', file: '../evil.json' },
      });
      expect(withEntry({ 'datafiles/data.json': strToU8('{壊れた') })).toEqual({
        ok: false,
        problem: { kind: 'invalidFile', file: 'datafiles/data.json' },
      });
    });

    it('BOM 付きの JSON も読める', () => {
      const result = readDataImport(
        zipSync({ 'manifest.json': manifest(), 'settings.json': strToU8('\uFEFF{"hotkey":"x"}') })
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('applyDataImport', () => {
    it('まるごと置き換え、読み込むファイルに無いもの（data3.json など）は消し、対象外のものは残す', () => {
      write(configFolder, 'settings.json', '{"hotkey":"old"}');
      write(configFolder, 'datafiles/data.json', '{"version":"1.0","items":[{}]}');
      write(configFolder, 'datafiles/data3.json', '{"version":"1.0","items":[{},{},{}]}');
      write(configFolder, 'clipboard-data/old.json', '{}');
      write(configFolder, 'icon-cache/favicons/site.png', 'favicon');
      write(configFolder, 'backup/2026-10-01T00-00-00/settings.json', '{}');
      expect(countCurrentItems(configFolder)).toEqual({ items: 4, workspaceItems: 0 });

      const result = readDataImport(
        zipSync({
          'manifest.json': manifest(),
          'settings.json': strToU8('{"hotkey":"new"}'),
          'datafiles/data.json': strToU8('{"version":"1.0","items":[]}'),
          'datafiles/data2.json': strToU8('{"version":"1.0","items":[{}]}'),
          'workspace.json': strToU8('{"version":"2.0","groups":[],"items":[{}]}'),
        })
      );
      if (!result.ok) throw new Error('読めなかった');
      applyDataImport(configFolder, result.content);

      const read = (relPath: string) =>
        fs.readFileSync(path.join(configFolder, ...relPath.split('/')), 'utf8');
      const exists = (relPath: string) =>
        fs.existsSync(path.join(configFolder, ...relPath.split('/')));
      expect(read('settings.json')).toBe('{"hotkey":"new"}');
      expect(read('datafiles/data2.json')).toBe('{"version":"1.0","items":[{}]}');
      expect(exists('datafiles/data3.json')).toBe(false);
      expect(exists('clipboard-data/old.json')).toBe(false);
      expect(exists('icon-cache/favicons/site.png')).toBe(true);
      expect(exists('backup/2026-10-01T00-00-00/settings.json')).toBe(true);
      expect(countCurrentItems(configFolder)).toEqual({ items: 1, workspaceItems: 1 });
      expect(strFromU8(result.content.files.get('settings.json')!)).toBe('{"hotkey":"new"}');
    });
  });
});
