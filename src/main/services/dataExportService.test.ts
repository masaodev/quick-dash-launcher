import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';

import { buildDataExport, collectExportFiles, defaultExportFileName } from './dataExportService';

describe('dataExportService', () => {
  let configFolder: string;

  const write = (relPath: string, content: string | Buffer = '{}') => {
    const filePath = path.join(configFolder, ...relPath.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  };

  beforeEach(() => {
    configFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-export-test-'));
  });

  afterEach(() => {
    fs.rmSync(configFolder, { recursive: true, force: true });
  });

  it('決めたファイルだけを集め、取り直せるもの・その PC だけのもの・壊れて退避したものは入れない', () => {
    for (const relPath of [
      'settings.json',
      'workspace.json',
      'workspace-archive.json',
      'workspace-ui-state.json',
      'item-usage.json',
      'search-history.json',
      'datafiles/data.json',
      'datafiles/data2.json',
      'clipboard-data/abc_123.json',
      'icon-cache/custom/my-icon.png',
      // 以下は入れない
      'datafiles/data.broken-20261031T120000.json',
      'datafiles/memo.txt',
      'clipboard-data/notes.txt',
      'icon-cache/apps/app.png',
      'icon-cache/favicons/site.png',
      'icon-cache/extensions/txt.png',
      'backup/2026-10-31T00-00-00/settings.json',
      'logs/main.log',
      'path-type-cache.json',
      'update-check.json',
      'item-usage.json.broken-1730000000000',
    ]) {
      write(relPath);
    }

    expect(collectExportFiles(configFolder)).toEqual([
      'settings.json',
      'workspace.json',
      'workspace-archive.json',
      'workspace-ui-state.json',
      'item-usage.json',
      'search-history.json',
      'datafiles/data.json',
      'datafiles/data2.json',
      'clipboard-data/abc_123.json',
      'icon-cache/custom/my-icon.png',
    ]);
  });

  it('無いファイル・フォルダは飛ばす', () => {
    write('settings.json');
    expect(collectExportFiles(configFolder)).toEqual(['settings.json']);
  });

  it('zip の中は設定フォルダと同じ並びで、manifest.json に中身の説明を書く', () => {
    write('settings.json', '{"hotkey":"Alt+Space"}');
    write('datafiles/data.json', '[{"id":"a"}]');
    const icon = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]);
    write('icon-cache/custom/icon.png', icon);
    const exportedAt = new Date('2026-10-31T12:34:56.000Z');

    const { zip, manifest } = buildDataExport(configFolder, {
      appVersion: '0.8.0',
      distribution: 'portable',
      exportedAt,
    });

    expect(manifest).toEqual({
      format: 'quick-dash-launcher-export',
      formatVersion: 1,
      appVersion: '0.8.0',
      distribution: 'portable',
      exportedAt: '2026-10-31T12:34:56.000Z',
      files: ['settings.json', 'datafiles/data.json', 'icon-cache/custom/icon.png'],
    });

    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toEqual([
      'manifest.json',
      'settings.json',
      'datafiles/data.json',
      'icon-cache/custom/icon.png',
    ]);
    expect(JSON.parse(strFromU8(entries['manifest.json']))).toEqual(manifest);
    expect(strFromU8(entries['settings.json'])).toBe('{"hotkey":"Alt+Space"}');
    expect(strFromU8(entries['datafiles/data.json'])).toBe('[{"id":"a"}]');
    expect(Buffer.from(entries['icon-cache/custom/icon.png'])).toEqual(icon);
  });

  it('既定のファイル名はローカル時刻の日付にする', () => {
    expect(defaultExportFileName(new Date(2026, 9, 31, 23, 59))).toBe(
      'QuickDashLauncher-export-2026-10-31.zip'
    );
    expect(defaultExportFileName(new Date(2026, 0, 5, 0, 0))).toBe(
      'QuickDashLauncher-export-2026-01-05.zip'
    );
  });
});
