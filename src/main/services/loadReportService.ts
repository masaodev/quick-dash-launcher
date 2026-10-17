import type { JsonItemIssue } from '@common/utils/jsonParser';

import { mainI18n } from './mainI18n.js';

/**
 * 設定ファイルの読み込みレポート
 *
 * 読み込みのたびにデータファイルとワークスペースの結果（受理数・スキップ・採番・外部変更・破損）を
 * まとめる。メモリにだけ持ち、CLI の `reload`・`check` が返す。問題があるときは人向けにトーストも出す。
 */

export type LoadReportFileStatus = 'ok' | 'corrupted' | 'unreadable';

export interface LoadReportFile {
  /** 設定フォルダからの相対パス（例: 'datafiles/data.json'） */
  file: string;
  status: LoadReportFileStatus;
  /** 受理したアイテム数（dir の展開前。JSON 上の要素数） */
  accepted: number;
  /** スキップ・採番・補正の一覧 */
  issues: JsonItemIssue[];
  /** status が ok 以外のときのエラー内容 */
  error?: string;
  /** QDL 外で変更されていたか（前回読み込み時の内容と異なる） */
  externallyChanged: boolean;
  /** 採番・補正のためファイルを書き戻したか */
  rewritten: boolean;
}

export interface LoadReport {
  /** レポートの形式バージョン */
  reportVersion: 1;
  /** 読み込み日時（ISO 8601） */
  loadedAt: string;
  summary: {
    accepted: number;
    skipped: number;
    idAssigned: number;
    /** 深すぎる・循環するため最上位へ移したワークスペースのグループの数 */
    groupsFlattened: number;
    corruptedFiles: string[];
    externallyChangedFiles: string[];
  };
  files: LoadReportFile[];
  /** 外部変更の検知時に作った変更前スナップショットのフォルダ名（なければ null） */
  preChangeSnapshot: string | null;
}

/**
 * 読み込みのきっかけ。explicit = 起動時・F5、full = 完全リフレッシュ、
 * internal = 変更通知・画面内の一覧取得
 */
export type LoadTrigger = 'explicit' | 'full' | 'internal';

/**
 * ファイル別の結果からレポートを組み立てる
 */
export function buildLoadReport(
  files: LoadReportFile[],
  preChangeSnapshot: string | null,
  now: Date = new Date()
): LoadReport {
  let accepted = 0;
  let skipped = 0;
  let idAssigned = 0;
  let groupsFlattened = 0;

  for (const file of files) {
    accepted += file.accepted;
    for (const issue of file.issues) {
      if (issue.kind === 'invalid') skipped++;
      if (issue.kind === 'idAssigned') idAssigned++;
      if (issue.code === 'groupFlattened') groupsFlattened++;
    }
  }

  return {
    reportVersion: 1,
    loadedAt: now.toISOString(),
    summary: {
      accepted,
      skipped,
      idAssigned,
      groupsFlattened,
      corruptedFiles: files.filter((f) => f.status !== 'ok').map((f) => f.file),
      externallyChangedFiles: files.filter((f) => f.externallyChanged).map((f) => f.file),
    },
    files,
    preChangeSnapshot,
  };
}

/**
 * 人向けのトースト文言（問題があるときだけ返す）
 */
export function formatLoadReportToast(report: LoadReport): string | null {
  const { skipped, idAssigned, groupsFlattened, externallyChangedFiles } = report.summary;
  if (skipped === 0 && idAssigned === 0 && groupsFlattened === 0) {
    return null;
  }

  const t = mainI18n.t;
  const parts: string[] = [t('loadReport.accepted', { count: report.summary.accepted })];
  if (skipped > 0) parts.push(t('loadReport.skipped', { count: skipped }));
  if (idAssigned > 0) parts.push(t('loadReport.idAssigned', { count: idAssigned }));
  if (groupsFlattened > 0) {
    parts.push(t('loadReport.groupsFlattened', { count: groupsFlattened }));
  }
  const key =
    externallyChangedFiles.length > 0 ? 'loadReport.externalSummary' : 'loadReport.summary';
  return t(key, { parts: parts.join(t('loadReport.separator')) });
}
