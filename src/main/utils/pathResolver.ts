/**
 * ファイル名だけのパス（calc.exe など）を PATH から解決するユーティリティ
 * アイテムの起動とアイコン取得で、同じ探し方をするために共有する
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** フォルダの区切りを含まない、ファイル名だけのパスか（calc.exe など） */
export function isBareFileName(itemPath: string): boolean {
  return !/[\\/]/.test(itemPath);
}

/**
 * ファイル名だけのパスを PATH から探してフルパスにする（見つからなければ null）
 * `$PATH:` を付けてカレントフォルダは探さない。ワイルドカード入りの名前は探さない
 */
export async function resolveFromPath(fileName: string): Promise<string | null> {
  if (/[*?]/.test(fileName)) return null;
  try {
    // shell 経由の exec は " や & 入りの名前でコマンドインジェクションが起き得るため引数配列で渡す
    const { stdout } = await execFileAsync('where', [`$PATH:${fileName}`], { encoding: 'utf8' });
    return stdout.split(/\r?\n/)[0]?.trim() || null;
  } catch {
    // where は見つからないとき終了コード 1 で失敗する
    return null;
  }
}
