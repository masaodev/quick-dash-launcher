/**
 * アイテムのアプリを起動するときに渡す環境変数
 *
 * 子のプロセスは親の環境変数をそのまま受け継ぐので、QuickDashLauncher を Claude Code・開発用のシェル・
 * qdl コマンドの自動起動などから起動すると、そこで足された変数（CLAUDECODE・NODE_ENV・シェルが足した
 * PATH など）が QuickDashLauncher から起動するアプリにまで届く。そこで、スタートメニューから開いたのと
 * 同じ「ユーザーの標準の環境変数」を起動のたびに作って渡す（毎回作るので、QuickDashLauncher の起動後に
 * 足した変数や PATH も再起動なしで届く）。
 *
 * QuickDashLauncher 自身の環境（process.env）は書き換えない。書き換えると、自分の再起動（app.relaunch）で
 * APP_INSTANCE・QUICK_DASH_CONFIG_DIR・PORTABLE_EXECUTABLE_FILE が消え、開発用のインスタンスが
 * 本番のデータを開くおそれがあるため。
 *
 * 設定の launchInheritEnvironment が true のとき（従来の動き）と、標準の環境を作れなかったときは
 * undefined を返す（spawn に env を渡さず、QuickDashLauncher の環境を引き継ぐ）。
 */
import type { Logger } from 'pino';

import { SettingsService } from '../services/settingsService.js';

import { createStandardEnvironmentEntries } from './standardEnvironment.js';

/** 起動するアプリに渡す環境変数（名前 → 値） */
export type LaunchEnvironment = Record<string, string>;

/**
 * 標準の環境に無ければ、QuickDashLauncher の環境から足す変数
 *
 * セッションごとに Windows が付ける値（リモートデスクトップの接続元など）。漏れてきた変数ではないので残す
 */
const SESSION_VARIABLES = ['SESSIONNAME', 'CLIENTNAME'] as const;

/**
 * 「名前=値」の並びを名前 → 値にする
 *
 * 先頭が = のもの（=C:=C:\work のようなドライブごとの作業フォルダ）と、= の無いものは飛ばす
 */
export function parseEnvironmentEntries(entries: readonly string[]): LaunchEnvironment {
  const env: LaunchEnvironment = {};
  for (const entry of entries) {
    const separator = entry.indexOf('=', 1);
    if (entry.startsWith('=') || separator < 0) continue;
    env[entry.slice(0, separator)] = entry.slice(separator + 1);
  }
  return env;
}

function hasVariable(env: LaunchEnvironment, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(env).some((key) => key.toLowerCase() === lower);
}

/** 標準の環境に、セッションごとの値（無ければ）を足す */
export function buildLaunchEnvironment(
  standard: LaunchEnvironment,
  current: Record<string, string | undefined>
): LaunchEnvironment {
  const env = { ...standard };
  for (const name of SESSION_VARIABLES) {
    const value = current[name];
    if (value !== undefined && !hasVariable(env, name)) env[name] = value;
  }
  return env;
}

async function readInheritSetting(): Promise<boolean> {
  try {
    const settings = await SettingsService.getInstance();
    return (await settings.get('launchInheritEnvironment')) === true;
  } catch {
    return false;
  }
}

/** getLaunchEnvironment の差し替え口（テスト用） */
export interface LaunchEnvironmentDeps {
  readInherit: () => Promise<boolean>;
  createEntries: () => string[];
  current: Record<string, string | undefined>;
}

const defaultDeps: LaunchEnvironmentDeps = {
  readInherit: readInheritSetting,
  createEntries: createStandardEnvironmentEntries,
  current: process.env,
};

/**
 * アプリを起動するときに渡す環境変数を作る
 *
 * @returns 渡す環境変数。undefined なら QuickDashLauncher の環境を引き継ぐ（設定で選んだとき・作れなかったとき）
 */
export async function getLaunchEnvironment(
  logger: Logger,
  deps: LaunchEnvironmentDeps = defaultDeps
): Promise<LaunchEnvironment | undefined> {
  if (await deps.readInherit()) return undefined;
  try {
    const standard = parseEnvironmentEntries(deps.createEntries());
    if (Object.keys(standard).length === 0) throw new Error('standard environment is empty');
    return buildLaunchEnvironment(standard, deps.current);
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      '標準の環境変数を作れなかったので、QuickDashLauncher の環境変数のまま起動します'
    );
    return undefined;
  }
}
