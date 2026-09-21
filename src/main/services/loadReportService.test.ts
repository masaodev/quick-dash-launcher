import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

vi.mock('../config/pathManager.js', () => ({
  PathManager: { getConfigFolder: () => tempRoot.dir },
  default: { getConfigFolder: () => tempRoot.dir },
}));

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  dataLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  LOAD_REPORT_FILE_NAME,
  buildLoadReport,
  formatLoadReportToast,
  writeLoadReport,
} from './loadReportService';
import type { LoadReportFile } from './loadReportService';

function okFile(overrides: Partial<LoadReportFile> = {}): LoadReportFile {
  return {
    file: 'datafiles/data.json',
    status: 'ok',
    accepted: 3,
    issues: [],
    externallyChanged: false,
    rewritten: false,
    ...overrides,
  };
}

describe('loadReportService', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-report-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  it('buildLoadReport はファイル別の結果を集計すること', () => {
    const report = buildLoadReport(
      [
        okFile({ accepted: 3, externallyChanged: true }),
        okFile({
          file: 'datafiles/data2.json',
          accepted: 1,
          issues: [
            { index: 0, kind: 'invalid', reason: 'path is required' },
            { index: 1, kind: 'idAssigned', id: 'abcdefgh', reason: 'id が無いため採番しました' },
            { index: -1, kind: 'normalized', reason: 'version を補いました' },
          ],
        }),
        okFile({ file: 'datafiles/data3.json', status: 'corrupted', accepted: 0, error: 'boom' }),
      ],
      '2026-09-21T00-00-00_pre-external',
      new Date('2026-09-21T12:34:56Z')
    );

    expect(report.reportVersion).toBe(1);
    expect(report.loadedAt).toBe('2026-09-21T12:34:56.000Z');
    expect(report.summary).toEqual({
      accepted: 4,
      skipped: 1,
      idAssigned: 1,
      corruptedFiles: ['datafiles/data3.json'],
      externallyChangedFiles: ['datafiles/data.json'],
    });
    expect(report.preChangeSnapshot).toBe('2026-09-21T00-00-00_pre-external');
  });

  it('writeLoadReport は設定フォルダ直下に JSON を書き出すこと', () => {
    const report = buildLoadReport([okFile()], null);
    writeLoadReport(report);

    const written = JSON.parse(
      fs.readFileSync(path.join(tempRoot.dir, LOAD_REPORT_FILE_NAME), 'utf8')
    );
    expect(written.summary.accepted).toBe(3);
    expect(written.files[0].file).toBe('datafiles/data.json');
  });

  it('formatLoadReportToast は問題がなければ null を返すこと', () => {
    expect(formatLoadReportToast(buildLoadReport([okFile()], null))).toBeNull();
  });

  it('formatLoadReportToast はスキップ・採番の件数とレポート名を含めること', () => {
    const report = buildLoadReport(
      [
        okFile({
          accepted: 5,
          externallyChanged: true,
          issues: [
            { index: 0, kind: 'invalid', reason: 'x' },
            { index: 1, kind: 'invalid', reason: 'y' },
            { index: 2, kind: 'idAssigned', id: 'abcdefgh', reason: 'z' },
          ],
        }),
      ],
      null
    );

    const toast = formatLoadReportToast(report);
    expect(toast).toContain('外部編集された');
    expect(toast).toContain('5 件読込');
    expect(toast).toContain('2 件スキップ');
    expect(toast).toContain('1 件に ID を採番');
    expect(toast).toContain(LOAD_REPORT_FILE_NAME);
  });
});
