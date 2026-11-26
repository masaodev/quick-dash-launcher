import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildDiagnosticsText,
  formatLogLine,
  maskPersonalInfo,
  readRecentLogEntries,
  type DiagnosticsInput,
} from './diagnostics';

const personal = { homeDir: 'C:\\Users\\Taro', userName: 'Taro' };

function logLine(level: number, msg: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ level, time: '2026-11-26T01:12:03.000Z', msg, ...extra });
}

describe('maskPersonalInfo', () => {
  it('ユーザーのフォルダを %USERPROFILE% にする（大文字・小文字と / の違いは問わない）', () => {
    expect(maskPersonalInfo('C:\\Users\\Taro\\Desktop\\a.lnk', personal)).toBe(
      '%USERPROFILE%\\Desktop\\a.lnk'
    );
    expect(maskPersonalInfo('c:/users/taro/AppData', personal)).toBe('%USERPROFILE%/AppData');
  });

  it('フォルダの外に出てくるユーザー名も伏せる', () => {
    expect(maskPersonalInfo('D:\\work\\taro-notes', personal)).toBe('D:\\work\\<user>-notes');
  });

  it('1 字のユーザー名は伏せない', () => {
    expect(maskPersonalInfo('a b c', { homeDir: 'C:\\Users\\a', userName: 'a' })).toBe('a b c');
  });
});

describe('formatLogLine', () => {
  it('警告とエラーを「時刻 レベル 本文」にする。エラーのメッセージを足す', () => {
    const line = formatLogLine(logLine(50, '保存に失敗しました', { error: { message: 'EBUSY' } }));
    expect(line).toMatch(/^2026-11-26 \d\d:12:03 ERROR 保存に失敗しました: EBUSY$/);
    expect(formatLogLine(logLine(40, '注意'))).toMatch(/ WARN {2}注意$/);
  });

  it('info 以下の行と読めない行は拾わない', () => {
    expect(formatLogLine(logLine(30, '起動しました'))).toBeNull();
    expect(formatLogLine('not json')).toBeNull();
    expect(formatLogLine('')).toBeNull();
  });

  it('200 字で切る', () => {
    const line = formatLogLine(logLine(40, 'あ'.repeat(300)));
    expect(line?.endsWith('あ'.repeat(200) + '…')).toBe(true);
  });
});

describe('readRecentLogEntries', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-diagnostics-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('新しい順に拾い、足りなければ 1 世代前のファイルも読む', async () => {
    fs.writeFileSync(
      path.join(dir, 'main.1.log'),
      [logLine(40, 'old1'), logLine(50, 'old2')].join('\n')
    );
    fs.writeFileSync(
      path.join(dir, 'main.log'),
      [logLine(30, 'info'), logLine(40, 'new1'), logLine(50, 'new2'), ''].join('\n')
    );
    const entries = await readRecentLogEntries(dir, 3);
    expect(entries.map((e) => e.split(' ').pop())).toEqual(['new2', 'new1', 'old2']);
  });

  it('ログが無ければ空', async () => {
    expect(await readRecentLogEntries(dir)).toEqual([]);
  });
});

describe('buildDiagnosticsText', () => {
  const base: DiagnosticsInput = {
    version: '1.0.1',
    distribution: 'store',
    portableData: false,
    osRelease: '10.0.26100',
    arch: 'x64',
    electronVersion: '45.2.1',
    language: 'ja',
    settingsFolder: 'C:\\Users\\Taro\\AppData\\Roaming\\quick-dash-launcher\\config',
    logEntries: ['2026-11-26 10:12:03 WARN  C:\\Users\\Taro\\x.lnk が見つかりません'],
  };

  it('見出しは英語で、個人のパスを伏せる', () => {
    const text = buildDiagnosticsText(base, personal);
    expect(text).toContain('- Version: 1.0.1');
    expect(text).toContain('- Distribution: Microsoft Store');
    expect(text).toContain('- Windows: 10.0.26100 (x64)');
    expect(text).toContain(
      '- Settings folder: %USERPROFILE%\\AppData\\Roaming\\quick-dash-launcher\\config'
    );
    expect(text).toContain('%USERPROFILE%\\x.lnk');
    expect(text).not.toMatch(/taro/i);
    expect(text).not.toContain('Data location');
  });

  it('ZIP 版だけデータの保存先を出す。ログが無ければ none', () => {
    const text = buildDiagnosticsText(
      { ...base, distribution: 'portable', portableData: true, logEntries: [] },
      personal
    );
    expect(text).toContain(
      '- Data location: QuickDashLauncher-data next to the exe (portable mode)'
    );
    expect(text).toContain('Recent warnings and errors: none');
  });
});
