import * as fs from 'fs';
import * as path from 'path';

/**
 * qdl.exe が本体を起動するときに使う「本体の exe の場所」を書き出す
 *
 * ポータブル版は起動のたびに %TEMP% の下へ展開されて動くので、process.execPath ではなく
 * 展開前の exe（PORTABLE_EXECUTABLE_FILE）を記録する。ただしこの環境変数は QDL から起動した
 * プロセスにも引き継がれるので、自分が実際に展開先で動いているときだけ使う。
 */

export const CLI_LAUNCHER_INFO_FILE_NAME = 'cli-launcher.json';

export function resolveAppExePath(
  execPath: string,
  env: Record<string, string | undefined>,
  tempDir: string
): string {
  const portableFile = env.PORTABLE_EXECUTABLE_FILE;
  const runningFromTemp = path
    .resolve(execPath)
    .toLowerCase()
    .startsWith(path.resolve(tempDir).toLowerCase() + path.sep);
  return portableFile && runningFromTemp ? portableFile : execPath;
}

export function writeCliLauncherInfo(userDataDir: string, exePath: string, version: string): void {
  const content = JSON.stringify(
    { exePath, version, updatedAt: new Date().toISOString() },
    null,
    2
  );
  fs.writeFileSync(path.join(userDataDir, CLI_LAUNCHER_INFO_FILE_NAME), content + '\n', 'utf8');
}
