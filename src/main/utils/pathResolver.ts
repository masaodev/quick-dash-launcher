/**
 * ファイル名だけのパス（calc.exe など）を PATH から解決するユーティリティ
 * アイテムの起動・親フォルダを開く・アイコン取得で、同じ探し方をするために共有する
 */

import { promises as fs } from 'fs';
import path from 'path';

/** PATHEXT が無いときの既定（Windows の既定と同じ） */
const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC';

/** フォルダの区切りを含まない、ファイル名だけのパスか（calc.exe など） */
export function isBareFileName(itemPath: string): boolean {
  return !/[\\/]/.test(itemPath);
}

async function isFile(fullPath: string): Promise<boolean> {
  try {
    return (await fs.stat(fullPath)).isFile();
  } catch (error) {
    return isAppExecutionAlias(fullPath, error);
  }
}

/**
 * ストアアプリの実行エイリアス（WindowsApps\mspaint.exe など）か
 *
 * エイリアスはリンクに見え、リンク先（C:\Program Files\WindowsApps）は読む権限が無いので
 * fs.stat が EACCES・EPERM で失敗する。リンク自体があり、リンク先が権限で読めないだけのときは
 * あるものとみなす（shell.openPath で起動できる）
 */
async function isAppExecutionAlias(fullPath: string, statError: unknown): Promise<boolean> {
  const code = (statError as { code?: string } | undefined)?.code;
  if (code !== 'EACCES' && code !== 'EPERM') return false;
  try {
    return (await fs.lstat(fullPath)).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * ファイル名だけのパスを PATH から探してフルパスにする（見つからなければ null）
 *
 * where.exe と同じく、PATH のフォルダを順に、名前そのものと PATHEXT の拡張子を付けた名前で探す。
 * カレントフォルダは探さない。ワイルドカード入りの名前は探さない。
 * where.exe を使わないのは、出力がコンソールのコードページ（日本語環境では cp932）で、
 * 日本語のフォルダ名が化けるため
 */
export async function resolveFromPath(
  fileName: string,
  env: Record<string, string | undefined> = process.env
): Promise<string | null> {
  if (/[*?]/.test(fileName)) return null;

  const dirs = (env.PATH ?? env.Path ?? '')
    .split(';')
    .map((dir) => dir.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
  const extensions = (env.PATHEXT ?? DEFAULT_PATHEXT).split(';').filter(Boolean);
  const candidates = [fileName, ...extensions.map((ext) => fileName + ext)];

  for (const dir of dirs) {
    for (const name of candidates) {
      const fullPath = path.join(dir, name);
      if (await isFile(fullPath)) return fullPath;
    }
  }
  return null;
}
