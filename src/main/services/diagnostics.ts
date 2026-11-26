/**
 * 診断情報（ヘルプタブの「診断情報をコピー」）
 *
 * 不具合の報告に貼ってもらうための、版・配布形式・OS・設定フォルダ・直近の警告とエラーをまとめた文。
 * 読む側（報告を受ける側）にとって形がいつも同じになるよう、見出しは画面の言語によらず英語で固定する。
 * ログの本文は書かれたまま（日本語）出す。
 *
 * 個人の情報は伏せる: ユーザーのフォルダを %USERPROFILE% に置き換え、ほかに出てくるユーザー名も
 * <user> に置き換える。ログの 1 行は 200 字で切る。アイテムのパスや URL は残るので、
 * 貼る前に確かめてもらう（トーストで知らせる）。
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { AppDistribution } from '@common/types';

/** ログから拾う件数 */
export const DIAGNOSTICS_LOG_LIMIT = 10;
/** ログの 1 行の長さの上限（字） */
export const DIAGNOSTICS_LOG_MAX_CHARS = 200;
/** 読むログのファイル（新しい順）。main.log が回った直後でも拾えるよう 1 世代前まで読む */
const LOG_FILES = ['main.log', 'main.1.log'];
/** pino の数値のレベル */
const LEVEL_NAMES: Record<number, string> = { 40: 'WARN', 50: 'ERROR', 60: 'FATAL' };
const WARN_LEVEL = 40;

const DISTRIBUTION_NAMES: Record<AppDistribution, string> = {
  store: 'Microsoft Store',
  portable: 'ZIP',
  installer: 'Installer',
  dev: 'Development',
};

export interface PersonalInfo {
  /** ユーザーのフォルダ（os.homedir()） */
  homeDir: string;
  /** ユーザー名（os.userInfo().username） */
  userName: string;
}

export interface DiagnosticsInput {
  version: string;
  distribution: AppDistribution;
  /** ZIP 版でポータブルモードが働いているか（ZIP 版のときだけ出す） */
  portableData: boolean;
  /** os.release()（例 10.0.26100） */
  osRelease: string;
  /** process.arch */
  arch: string;
  electronVersion: string;
  language: string;
  /** 設定フォルダ（Store 版はエクスプローラーから見える実際の場所） */
  settingsFolder: string;
  /** 新しい順の警告とエラー（伏せる前） */
  logEntries: string[];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ユーザーのフォルダとユーザー名を伏せる（大文字・小文字と区切りの / \ の違いは問わない） */
export function maskPersonalInfo(text: string, personal: PersonalInfo): string {
  let result = text;
  const home = personal.homeDir.replace(/[\\/]+$/, '');
  if (home) {
    const pattern = home
      .split(/[\\/]+/)
      .map(escapeRegExp)
      .join('[\\\\/]+');
    result = result.replace(new RegExp(pattern, 'gi'), '%USERPROFILE%');
  }
  // 短すぎる名前は普通の語と見分けられないので伏せない
  if (personal.userName.length >= 2) {
    result = result.replace(new RegExp(escapeRegExp(personal.userName), 'gi'), '<user>');
  }
  return result;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** ローカルの時刻で 2026-11-26 10:12:03 の形にする */
function formatTime(time: Date): string {
  return (
    `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} ` +
    `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`
  );
}

function errorMessage(value: unknown): string | null {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message: unknown }).message;
    return typeof message === 'string' && message ? message : null;
  }
  return null;
}

/** ログの 1 行（pino の JSON）を「時刻 レベル 本文」にする。警告より軽い行・読めない行は null */
export function formatLogLine(line: string): string | null {
  let entry: Record<string, unknown>;
  try {
    entry = JSON.parse(line);
  } catch {
    return null;
  }
  const level = typeof entry.level === 'number' ? entry.level : 0;
  if (level < WARN_LEVEL) return null;
  const time =
    typeof entry.time === 'string' || typeof entry.time === 'number' ? new Date(entry.time) : null;
  const when = time && !Number.isNaN(time.getTime()) ? formatTime(time) : '-';
  const name = LEVEL_NAMES[level] ?? LEVEL_NAMES[50];
  const msg = typeof entry.msg === 'string' ? entry.msg : '';
  const detail = errorMessage(entry.err) ?? errorMessage(entry.error);
  const text = [msg, detail].filter(Boolean).join(': ').replace(/\s+/g, ' ').trim();
  const clipped =
    text.length > DIAGNOSTICS_LOG_MAX_CHARS ? `${text.slice(0, DIAGNOSTICS_LOG_MAX_CHARS)}…` : text;
  return `${when} ${name.padEnd(5)} ${clipped}`;
}

/** ログのフォルダから、新しい順に警告とエラーを limit 件まで拾う。ファイルが無ければ空 */
export async function readRecentLogEntries(
  logsFolder: string,
  limit = DIAGNOSTICS_LOG_LIMIT
): Promise<string[]> {
  const entries: string[] = [];
  for (const file of LOG_FILES) {
    const content = await fs.readFile(path.join(logsFolder, file), 'utf-8').catch(() => null);
    if (content === null) continue;
    const lines = content.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
      const formatted = formatLogLine(lines[i]);
      if (formatted) entries.push(formatted);
    }
    if (entries.length >= limit) break;
  }
  return entries;
}

/** コピーする文を組み立てる */
export function buildDiagnosticsText(input: DiagnosticsInput, personal: PersonalInfo): string {
  const lines = [
    'Quick Dash Launcher diagnostics',
    `- Version: ${input.version}`,
    `- Distribution: ${DISTRIBUTION_NAMES[input.distribution]}`,
  ];
  if (input.distribution === 'portable') {
    lines.push(
      `- Data location: ${input.portableData ? 'QuickDashLauncher-data next to the exe (portable mode)' : '%APPDATA%'}`
    );
  }
  lines.push(
    `- Windows: ${input.osRelease} (${input.arch})`,
    `- Electron: ${input.electronVersion}`,
    `- Language: ${input.language}`,
    `- Settings folder: ${input.settingsFolder}`,
    ''
  );
  if (input.logEntries.length === 0) {
    lines.push('Recent warnings and errors: none');
  } else {
    lines.push(
      `Recent warnings and errors (latest ${input.logEntries.length}, newest first):`,
      ...input.logEntries
    );
  }
  return maskPersonalInfo(lines.join('\n'), personal) + '\n';
}
