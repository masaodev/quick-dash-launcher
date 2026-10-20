import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { app } from 'electron';
import { createChildLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';

import { EnvConfig } from '../../config/envConfig.js';

const execFileAsync = promisify(execFile);
const cliLogger = createChildLogger('cli');

/**
 * 「CLI を使えるようにする」設定（cliEnabled）の副作用
 *
 * 同梱の qdl.exe を決まった場所（%LOCALAPPDATA%\quick-dash-launcher\bin）にコピーし、
 * そのフォルダをユーザーの PATH に足す。ポータブル版は起動のたびに %TEMP% へ展開されて動くので、
 * 同梱の場所のままでは PATH に載せられない。起動のたびに同梱の qdl.exe と比べ、違えば入れ替える
 * （本体を更新したときに CLI とやり取りの版がずれないように）。
 *
 * PATH と保存先はインスタンスを区別しない 1 つだけなので、開発用の起動と APP_INSTANCE 付きの
 * 起動では何もしない（自動起動のショートカットと同じ扱い）。
 */

export const CLI_EXE_NAME = 'qdl.exe';

export function getCliInstallDir(localAppData: string): string {
  return path.join(localAppData, 'quick-dash-launcher', 'bin');
}

function normalizePathEntry(entry: string): string {
  return entry
    .trim()
    .replace(/[\\/]+$/, '')
    .toLowerCase();
}

/** PATH にフォルダを足した値を返す。既にあれば null（変更なし） */
export function addPathEntry(pathValue: string, dir: string): string | null {
  const entries = pathValue.split(';').filter((e) => e.trim() !== '');
  if (entries.some((e) => normalizePathEntry(e) === normalizePathEntry(dir))) return null;
  return [...entries, dir].join(';');
}

/** PATH からフォルダを除いた値を返す。無ければ null（変更なし） */
export function removePathEntry(pathValue: string, dir: string): string | null {
  const entries = pathValue.split(';').filter((e) => e.trim() !== '');
  const kept = entries.filter((e) => normalizePathEntry(e) !== normalizePathEntry(dir));
  return kept.length === entries.length ? null : kept.join(';');
}

/** ユーザーの PATH（HKCU\Environment の Path）の読み書き */
export interface UserPathStore {
  read(): Promise<string>;
  write(value: string): Promise<void>;
}

export interface CliInstallTarget {
  /** 同梱の qdl.exe */
  sourceExe: string;
  /** コピー先のフォルダ（PATH に足すフォルダ） */
  installDir: string;
  pathStore: UserPathStore;
}

export interface CliInstallResult {
  installedExe: string;
  /** qdl.exe を新しく置いた・入れ替えた */
  copied: boolean;
  /** PATH を書き換えた */
  pathChanged: boolean;
}

export async function installCli(
  target: CliInstallTarget,
  options: { checkPath: boolean }
): Promise<CliInstallResult> {
  const installedExe = path.join(target.installDir, CLI_EXE_NAME);
  if (!fs.existsSync(target.sourceExe)) {
    throw new Error(`同梱の ${CLI_EXE_NAME} が見つかりません: ${target.sourceExe}`);
  }

  let copied = false;
  if (!FileUtils.areFilesEqual(target.sourceExe, installedExe)) {
    fs.mkdirSync(target.installDir, { recursive: true });
    fs.copyFileSync(target.sourceExe, installedExe);
    copied = true;
  }

  let pathChanged = false;
  if (options.checkPath) {
    const next = addPathEntry(await target.pathStore.read(), target.installDir);
    if (next !== null) {
      await target.pathStore.write(next);
      pathChanged = true;
    }
  }
  return { installedExe, copied, pathChanged };
}

export async function uninstallCli(
  target: CliInstallTarget
): Promise<{ removed: boolean; pathChanged: boolean }> {
  const installedExe = path.join(target.installDir, CLI_EXE_NAME);
  // 置いていなければ PATH にも足していないので、PowerShell を起動せずに済ませる
  if (!fs.existsSync(installedExe)) return { removed: false, pathChanged: false };

  let pathChanged = false;
  const next = removePathEntry(await target.pathStore.read(), target.installDir);
  if (next !== null) {
    await target.pathStore.write(next);
    pathChanged = true;
  }
  fs.rmSync(installedExe, { force: true });
  return { removed: true, pathChanged };
}

/**
 * PowerShell で HKCU\Environment の Path を読み書きする
 *
 * %USERPROFILE% のような書き方を崩さないよう、展開せずに読み、REG_EXPAND_SZ で書く。
 * 書いた後は、開いているエクスプローラーなどに環境変数の変更を知らせる
 * （[Environment]::SetEnvironmentVariable の User 指定は WM_SETTINGCHANGE を送るので、
 * 使い捨ての変数を作って消すことでそれを起こす）。
 */
const powerShellUserPathStore: UserPathStore = {
  async read() {
    const script =
      '[Console]::OutputEncoding = [Text.Encoding]::UTF8;' +
      "$k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment');" +
      "$v = $k.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames);" +
      '[Console]::Out.Write([string]$v)';
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', windowsHide: true }
    );
    return stdout;
  },
  async write(value: string) {
    const script =
      "$k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true);" +
      "$k.SetValue('Path', $env:QDL_USER_PATH, [Microsoft.Win32.RegistryValueKind]::ExpandString);" +
      '$k.Close();' +
      "[Environment]::SetEnvironmentVariable('QDL_ENV_REFRESH', '1', 'User');" +
      "[Environment]::SetEnvironmentVariable('QDL_ENV_REFRESH', $null, 'User')";
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, QDL_USER_PATH: value },
    });
  },
};

function isSupported(): boolean {
  return app.isPackaged && process.platform === 'win32' && !EnvConfig.hasAppInstance;
}

function realTarget(): CliInstallTarget | null {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;
  return {
    sourceExe: path.join(process.resourcesPath, 'bin', CLI_EXE_NAME),
    installDir: getCliInstallDir(localAppData),
    pathStore: powerShellUserPathStore,
  };
}

/** このプロセスで PATH を確かめ済みか（F5 のたびに PowerShell を起動しないため） */
let pathVerified = false;

/**
 * cliEnabled の値を反映する。PATH を書き換えたときは true を返す（呼び出し側が利用者に知らせる）
 */
export async function applyCliSetting(enabled: boolean): Promise<boolean> {
  if (!isSupported()) return false;
  const target = realTarget();
  if (!target) return false;

  try {
    if (enabled) {
      const result = await installCli(target, { checkPath: !pathVerified });
      pathVerified = true;
      if (result.copied || result.pathChanged) {
        cliLogger.info({ ...result, installDir: target.installDir }, 'CLI を使えるようにしました');
      }
      return result.pathChanged;
    }
    pathVerified = false;
    const result = await uninstallCli(target);
    if (result.removed) {
      cliLogger.info({ ...result, installDir: target.installDir }, 'CLI を外しました');
    }
    return result.pathChanged;
  } catch (error) {
    // qdl.exe の実行中で上書きできない場合など。次の起動・設定変更で改めて試す
    cliLogger.warn({ error, enabled }, 'CLI の設定を反映できませんでした');
    return false;
  }
}
