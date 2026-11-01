import * as fs from 'fs';
import * as path from 'path';

/**
 * ポータブル版（ZIP）の判定と、データの置き場所。
 * ZIP には展開済みのアプリと、印のファイル portable.txt・空のデータフォルダ QuickDashLauncher-data が入っている
 * （scripts/make-portable-zip.mjs）。印のある exe で、データフォルダがあれば、Electron のデータ（userData）を
 * まるごとそこに置く。設定フォルダは userData の下の config なので、一緒にデータフォルダへ移る
 */

/** ポータブル版の印（exe の横） */
export const PORTABLE_MARKER_FILE = 'portable.txt';
/** ポータブル版のデータフォルダ（exe の横） */
export const PORTABLE_DATA_DIR = 'QuickDashLauncher-data';

export type PortableDataState =
  /** データフォルダを使わない（ポータブル版でない・フォルダが無い・APP_INSTANCE 付き） */
  | { kind: 'off' }
  /** データフォルダを使う */
  | { kind: 'active'; dataDir: string }
  /** データフォルダはあるが書き込めないので、%APPDATA% を使う */
  | { kind: 'unwritable'; dataDir: string };

export interface PortableDataInput {
  isPackaged: boolean;
  isStore: boolean;
  /** 多重起動用の APP_INSTANCE が付いている（試用の環境など。userData はそちらで決める） */
  hasAppInstance: boolean;
  execPath: string;
}

interface FsLike {
  existsSync: (p: string) => boolean;
  statSync: (p: string) => { isDirectory: () => boolean };
  writeFileSync: (p: string, data: string) => void;
  rmSync: (p: string, options?: { force?: boolean }) => void;
}

/** 印のある exe か（ZIP のポータブル版） */
export function isPortableEdition(execPath: string, fsImpl: FsLike = fs): boolean {
  return fsImpl.existsSync(path.join(path.dirname(execPath), PORTABLE_MARKER_FILE));
}

/** データフォルダを使うかを決める。起動の最初（userData を使う前）に 1 回だけ呼ぶ */
export function resolvePortableData(
  input: PortableDataInput,
  fsImpl: FsLike = fs
): PortableDataState {
  if (!input.isPackaged || input.isStore || input.hasAppInstance) return { kind: 'off' };
  if (!isPortableEdition(input.execPath, fsImpl)) return { kind: 'off' };
  const dataDir = path.join(path.dirname(input.execPath), PORTABLE_DATA_DIR);
  try {
    if (!fsImpl.statSync(dataDir).isDirectory()) return { kind: 'off' };
  } catch {
    // データフォルダを消した人は、今までどおり %APPDATA% を使う
    return { kind: 'off' };
  }
  // 書き込めない場所（読み取り専用のメディア・権限の無いフォルダ）なら使わない
  const probe = path.join(dataDir, `.write-test-${process.pid}`);
  try {
    fsImpl.writeFileSync(probe, '');
    fsImpl.rmSync(probe, { force: true });
  } catch {
    return { kind: 'unwritable', dataDir };
  }
  return { kind: 'active', dataDir };
}

let currentState: PortableDataState = { kind: 'off' };

/** main.ts が起動の最初に決めた結果を残す（ヘルプタブ・起動時のトーストが読む） */
export function setPortableDataState(state: PortableDataState): void {
  currentState = state;
}

export function getPortableDataState(): PortableDataState {
  return currentState;
}
