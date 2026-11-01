import * as fs from 'fs';
import * as path from 'path';

import { CLI_LAUNCHER_INFO_FILE_NAME } from '../services/cli/cliLauncherInfo.js';

import { isSameExePath } from './exePath.js';

/**
 * 二重起動の防止で終わるとき、同じ userData で動いている QDL が「別の exe」かを調べる（A3-230 U12）。
 *
 * 動いている QDL（パッケージ版）は、起動のたびに userData の cli-launcher.json に自分の exe の場所を書く。
 * そこに書かれた exe が自分と違えば、インストーラー版と ZIP 版のように別の QDL が同じデータで動いている。
 * 同じ exe をもう一度起動しただけなら null（今までどおり黙って、動いている側がランチャーを出す）。
 */
export function findOtherRunningExe(
  userDataDir: string,
  ownExePath: string,
  readFile: (p: string) => string = (p) => fs.readFileSync(p, 'utf8')
): string | null {
  let exePath: unknown;
  try {
    const text = readFile(path.join(userDataDir, CLI_LAUNCHER_INFO_FILE_NAME)).replace(
      /^\uFEFF/,
      ''
    );
    exePath = (JSON.parse(text) as { exePath?: unknown }).exePath;
  } catch {
    return null;
  }
  if (typeof exePath !== 'string' || exePath === '') return null;
  return isSameExePath(exePath, ownExePath) ? null : exePath;
}

/** OS の表示言語が日本語か（設定を読む前に出す文の言語を決める。設定の「表示言語」はまだ読めない） */
export function isJapaneseSystemLocale(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('ja');
  } catch {
    return true;
  }
}
