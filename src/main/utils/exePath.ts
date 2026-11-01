import * as path from 'path';

/** 2 つの exe のパスが同じか（Windows なので大文字・小文字と区切り文字の違いは同じとみなす） */
export function isSameExePath(a: string, b: string): boolean {
  return path.win32.resolve(a).toLowerCase() === path.win32.resolve(b).toLowerCase();
}
