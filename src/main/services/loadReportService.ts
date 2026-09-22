import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import type { JsonItemIssue } from '@common/utils/jsonParser';

import { PathManager } from '../config/pathManager.js';

/**
 * データファイル読み込みレポート（config/last-load-report.json）
 *
 * データファイルを直接編集した人や AI が「自分の編集が受け入れられたか」を
 * 確認するための出力。トーストは AI から見えないので、ファイルに残す。
 * 明示的な読み込み（起動時・F5）のたびに上書きする。アプリ内部の都合による再読込
 * （変更通知・画面内の一覧取得）では、報告することがあるときだけ更新する
 * （起動直後の移行・採番・外部変更の記録が、直後のブックマーク自動取込などで消えないように）。
 */

export const LOAD_REPORT_FILE_NAME = 'last-load-report.json';

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

/** 読み込みのきっかけ。explicit = 起動時・F5、internal = 変更通知・画面内の一覧取得 */
export type LoadTrigger = 'explicit' | 'internal';

/** 人・AI に報告すべきこと（補正・書き戻し・外部変更・破損）があるか */
export function hasReportableIssues(files: LoadReportFile[]): boolean {
  return files.some(
    (f) => f.issues.length > 0 || f.rewritten || f.externallyChanged || f.status !== 'ok'
  );
}

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
 * レポートを config/last-load-report.json に書き出す
 */
export function writeLoadReport(report: LoadReport): void {
  const reportPath = path.join(PathManager.getConfigFolder(), LOAD_REPORT_FILE_NAME);
  if (!FileUtils.safeWriteTextFile(reportPath, JSON.stringify(report, null, 2))) {
    dataLogger.warn({ reportPath }, '読み込みレポートの書き出しに失敗しました');
  }
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

  return `${source}: ${parts.join('・')}（詳細: ${LOAD_REPORT_FILE_NAME}）`;
}
