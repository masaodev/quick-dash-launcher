import type { JsonItemIssue } from '@common/utils/jsonParser';

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

  for (const file of files) {
    accepted += file.accepted;
    for (const issue of file.issues) {
      if (issue.kind === 'invalid') skipped++;
      if (issue.kind === 'idAssigned') idAssigned++;
    }
  }

  return {
    reportVersion: 1,
    loadedAt: now.toISOString(),
    summary: {
      accepted,
      skipped,
      idAssigned,
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
  const { skipped, idAssigned, externallyChangedFiles } = report.summary;
  if (skipped === 0 && idAssigned === 0) {
    return null;
  }

  const parts: string[] = [`${report.summary.accepted} 件読込`];
  if (skipped > 0) parts.push(`${skipped} 件スキップ`);
  if (idAssigned > 0) parts.push(`${idAssigned} 件に ID を採番`);
  const source = externallyChangedFiles.length > 0 ? '外部編集されたデータ' : 'データ';

  return `${source}: ${parts.join('・')}`;
}
