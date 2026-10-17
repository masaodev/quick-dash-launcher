import { describe, it, expect } from 'vitest';

import { buildLoadReport, formatLoadReportToast } from './loadReportService';
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
      groupsFlattened: 0,
      corruptedFiles: ['datafiles/data3.json'],
      externallyChangedFiles: ['datafiles/data.json'],
    });
    expect(report.preChangeSnapshot).toBe('2026-09-21T00-00-00_pre-external');
  });

  it('formatLoadReportToast は問題がなければ null を返すこと', () => {
    expect(formatLoadReportToast(buildLoadReport([okFile()], null))).toBeNull();
  });

  it('formatLoadReportToast はスキップ・採番の件数を含めること', () => {
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
    expect(toast).toContain('5 件読み込み');
    expect(toast).toContain('2 件スキップ');
    expect(toast).toContain('1 件に ID を採番');
  });

  it('深すぎる・循環するグループを最上位へ移したときは、ほかの補正と違って知らせること', () => {
    const report = buildLoadReport(
      [
        okFile({
          file: 'workspace.json',
          issues: [
            { index: -1, kind: 'normalized', reason: 'version を補いました' },
            {
              index: 3,
              kind: 'normalized',
              id: 'GrDeep01',
              reason: '深すぎる',
              section: 'groups',
              code: 'groupFlattened',
            },
          ],
        }),
      ],
      null
    );

    expect(report.summary.groupsFlattened).toBe(1);
    expect(formatLoadReportToast(report)).toContain('グループ 1 件を最上位へ移動');
  });
});
