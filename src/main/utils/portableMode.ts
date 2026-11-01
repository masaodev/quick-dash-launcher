import * as fs from 'fs';
import * as path from 'path';

/**
 * ZIP 版の判定と、ポータブルモードのデータの置き場所。
 * ZIP には展開済みのアプリと、印のファイル portable.txt が入っている（scripts/make-portable-zip.mjs）。
 * データフォルダ QuickDashLauncher-data は入れないので、既定ではインストーラー版と同じ %APPDATA% を使う。
 * 印のある exe の横にデータフォルダがあれば（ポータブルモード）、Electron のデータ（userData）を
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

export interface PortableModeAvailabilityInput extends PortableDataInput {
  /** 設定フォルダを差し替えて起動している（E2E・dev:test） */
  hasCustomConfigDir: boolean;
  /** 以前の 1 ファイルの exe のポータブル版（一時フォルダに展開して動くので、exe の横に置けない） */
  isLegacyPortableExe: boolean;
  state: PortableDataState;
}

/**
 * 初回設定画面で「ポータブルモードにする」を出してよいか。
 * ZIP 版で、まだデータフォルダが無く、%APPDATA% の設定フォルダを使っているときだけ
 */
export function isPortableModeAvailable(
  input: PortableModeAvailabilityInput,
  fsImpl: FsLike = fs
): boolean {
  if (!input.isPackaged || input.isStore || input.hasAppInstance) return false;
  if (input.hasCustomConfigDir || input.isLegacyPortableExe) return false;
  if (input.state.kind !== 'off') return false;
  return isPortableEdition(input.execPath, fsImpl);
}

let portableModeAvailable = false;

/** main.ts が起動の最初に決めた結果を残す（初回設定画面が読む） */
export function setPortableModeAvailable(available: boolean): void {
  portableModeAvailable = available;
}

export function getPortableModeAvailable(): boolean {
  return portableModeAvailable;
}

/** 設定フォルダのうち、データフォルダへ写さないもの（動いている QDL が書き続けるログ） */
const SKIP_ON_COPY = new Set(['logs']);

/**
 * 初回設定の途中でポータブルモードにする。exe の横にデータフォルダを作り、今の設定フォルダ
 * （初回起動で作ったお試しのアイテム・タブなど）を写してから、初回設定画面で選んだ設定を settings.json に書き足す。
 * %APPDATA% の設定フォルダには書かない（ホットキーが空のままなので、%APPDATA% は初回設定の前の状態に残る）。
 * 失敗したら作りかけのデータフォルダを消して例外を投げる。成功したら作ったデータフォルダを返す
 */
export function switchToPortableMode(params: {
  execPath: string;
  configFolder: string;
  settings: Record<string, unknown>;
}): string {
  const dataDir = path.join(path.dirname(params.execPath), PORTABLE_DATA_DIR);
  // 既にあるもの（同じ名前のファイルなど）は消さないよう、作れなければそこでやめる
  fs.mkdirSync(dataDir);
  try {
    const targetConfig = path.join(dataDir, 'config');
    fs.cpSync(params.configFolder, targetConfig, {
      recursive: true,
      filter: (src) => {
        const relative = path.relative(params.configFolder, src);
        return !SKIP_ON_COPY.has(relative.split(path.sep)[0]);
      },
    });
    const settingsPath = path.join(targetConfig, 'settings.json');
    const current = fs.existsSync(settingsPath)
      ? (JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>)
      : {};
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ ...current, ...params.settings }, null, '\t'),
      'utf8'
    );
  } catch (error) {
    fs.rmSync(dataDir, { recursive: true, force: true });
    throw error;
  }
  return dataDir;
}
