/**
 * Store 版（MSIX）で、パッケージ専用の場所に振り替えられたパスを、実際の場所に直す
 *
 * Store 版が `%APPDATA%`・`%LOCALAPPDATA%` に新しく作ったフォルダは、
 * `%LOCALAPPDATA%\Packages\<パッケージファミリー名>\LocalCache\Roaming\`（`Local\`）に振り替えられる。
 * 本体とそこから起動したプロセスには振り替え前のパスで見えるが、エクスプローラーや外のターミナルには
 * 実際の場所でしか見えない。フォルダを開く・パスを利用者に見せるときは、ここで実際の場所に直す。
 *
 * 前からあったフォルダ（インストーラー版と共有している `%APPDATA%\quick-dash-launcher` など）は
 * 振り替えられないので、振り替え先に同じものがあるときだけ直す。
 */
import * as fs from 'fs';
import * as path from 'path';

import koffi from 'koffi';

const ERROR_SUCCESS = 0;
/** パッケージファミリー名の最大の長さ（文字数。終端を含む。PACKAGE_FAMILY_NAME_MAX_LENGTH + 1） */
const FAMILY_NAME_CHARS = 65;

export interface PackagedPathEnv {
  /** パッケージファミリー名。パッケージとして動いていなければ null */
  familyName: string | null;
  appData: string | undefined;
  localAppData: string | undefined;
  exists: (target: string) => boolean;
}

/** dir の下（dir 自身を含む）なら、dir からの相対パスを返す */
function relativeInside(dir: string, target: string): string | null {
  const relative = path.win32.relative(dir, target);
  if (relative.startsWith('..') || path.win32.isAbsolute(relative)) return null;
  return relative;
}

export function toRealPath(target: string, env: PackagedPathEnv): string {
  if (!env.familyName || !env.localAppData) return target;
  const cacheRoot = path.win32.join(env.localAppData, 'Packages', env.familyName, 'LocalCache');
  // %APPDATA% が %LOCALAPPDATA% の下にあることはないが、Packages の下は既に実際の場所なので触らない
  if (relativeInside(path.win32.join(env.localAppData, 'Packages'), target) !== null) return target;

  const roots: [string | undefined, string][] = [
    [env.appData, 'Roaming'],
    [env.localAppData, 'Local'],
  ];
  for (const [root, name] of roots) {
    if (!root) continue;
    const relative = relativeInside(root, target);
    // ルートそのもの（%APPDATA% 自体）は振り替えの対象ではない
    if (relative === null || relative === '') continue;
    const candidate = path.win32.join(cacheRoot, name, relative);
    return env.exists(candidate) ? candidate : target;
  }
  return target;
}

let cachedFamilyName: string | null | undefined;

/** 自分のパッケージファミリー名を Windows に問い合わせる。パッケージとして動いていなければ null */
function getPackageFamilyName(): string | null {
  if (cachedFamilyName !== undefined) return cachedFamilyName;
  cachedFamilyName = null;
  if (process.platform !== 'win32' || process.windowsStore !== true) return cachedFamilyName;
  try {
    const kernel32 = koffi.load('kernel32.dll');
    const GetCurrentPackageFamilyName = kernel32.func('GetCurrentPackageFamilyName', 'long', [
      koffi.inout(koffi.pointer('uint32')), // packageFamilyNameLength
      'void*', // packageFamilyName
    ]);
    const size = [FAMILY_NAME_CHARS];
    const buffer = Buffer.alloc(FAMILY_NAME_CHARS * 2);
    if (GetCurrentPackageFamilyName(size, buffer) === ERROR_SUCCESS) {
      const name = buffer.toString('utf16le').split('\0')[0];
      cachedFamilyName = name || null;
    }
  } catch {
    // 問い合わせられなければ、振り替え前のパスのまま使う
  }
  return cachedFamilyName;
}

/** 利用者に見せる・エクスプローラーで開くパスを、実際の場所に直す（Store 版以外ではそのまま返す） */
export function resolveRealPath(target: string): string {
  return toRealPath(target, {
    familyName: getPackageFamilyName(),
    appData: process.env.APPDATA,
    localAppData: process.env.LOCALAPPDATA,
    exists: fs.existsSync,
  });
}
