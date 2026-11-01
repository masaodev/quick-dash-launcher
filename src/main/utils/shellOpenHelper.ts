/**
 * 同梱の qdl.exe の補助コマンド（__shell-open）で、ファイル・フォルダ・URL を開く
 *
 * Electron の shell.openPath・shell.openExternal は、開いたアプリに渡す環境変数を選べない。そこで qdl.exe を
 * 起動するアプリに渡す環境変数（launchEnvironment.ts）で起動し、qdl.exe に ShellExecuteExW を呼ばせる。
 * 開いたアプリは qdl.exe の環境を受け継ぐ（cli/src/shell_open.rs）。
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';

import { app } from 'electron';
import koffi from 'koffi';

import type { LaunchEnvironment } from './launchEnvironment.js';

/** 補助コマンドの名前（cli/src/shell_open.rs の COMMAND と合わせる） */
export const SHELL_OPEN_COMMAND = '__shell-open';

/** AllowSetForegroundWindow に渡す「どのプロセスでも」（ASFW_ANY） */
const ASFW_ANY = 0xffffffff;

let allowSetForegroundWindow: ((processId: number) => boolean) | null = null;

/**
 * 次に前面に出ようとするプロセスに、前面に出ることを許す
 *
 * 開いたアプリは QuickDashLauncher → qdl.exe → アプリと 2 段目になる。Windows は前面に出せるプロセスを
 * 絞るので、許しておかないと開いたウィンドウが後ろに出ることがある
 */
export function allowNextForeground(): void {
  try {
    allowSetForegroundWindow ??= koffi
      .load('user32.dll')
      .func('bool __stdcall AllowSetForegroundWindow(uint32 processId)');
    allowSetForegroundWindow(ASFW_ANY);
  } catch {
    // 許せなくても開くことはできる（後ろに出るだけ）
  }
}

/**
 * 同梱の qdl.exe の場所（無ければ null）
 *
 * パッケージ版は resources\bin（electron-builder の extraResources）、開発版はリポジトリの cli\target\release
 *（npm run build:cli で作る）
 */
export function resolveShellOpenHelper(
  exists: (filePath: string) => boolean = existsSync
): string | null {
  const helper = app.isPackaged
    ? path.join(process.resourcesPath, 'bin', 'qdl.exe')
    : path.join(app.getAppPath(), 'cli', 'target', 'release', 'qdl.exe');
  return exists(helper) ? helper : null;
}

/**
 * qdl.exe の補助コマンドで開き、終わるのを待つ
 *
 * @param directory 作業フォルダ（URL では渡さない）
 * @returns 0 なら開いた。それ以外は ShellExecuteExW の Win32 のエラーコード（UAC で「いいえ」は 1223）
 */
export function openWithShellHelper(
  helper: string,
  target: string,
  directory: string | undefined,
  env: LaunchEnvironment
): Promise<number> {
  allowNextForeground();
  return new Promise((resolve, reject) => {
    const child = spawn(helper, [SHELL_OPEN_COMMAND, target, directory ?? ''], {
      env,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? -1));
  });
}
