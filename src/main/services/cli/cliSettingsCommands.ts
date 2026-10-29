import type { AppSettings } from '@common/types';
import { MAIN_WINDOW_DISPLAY_INDEX } from '@common/types';
import { LANGUAGE_SETTINGS } from '@common/i18n/languages';
import { SETTING_NUMBER_RANGES } from '@common/settingRanges';

import { mainI18n } from '../mainI18n.js';

import { CliError, expectPositionals, optionFlag, parseArgs } from './cliArgs.js';
import { normalizeDataFileName } from './cliTabCommands.js';

/**
 * qdl settings get・set — settings.json の設定
 *
 * 読むのは全項目。変えられるのは WRITABLE に挙げた項目だけで、値は設定画面と同じ範囲で確かめる。
 * 自動起動（OS のスタートアップ）・ブックマーク自動取込・CLI 自身の有効化・タブ構成（launcher tab が扱う）・
 * アプリが書く版は読むだけにする。ホットキーは画面と同じく、登録できるか確かめてから変える。
 */

export type HotkeyKey = 'hotkey' | 'itemSearchHotkey';

/** 設定の読み書き（本体の既存の処理を包む。テストでは差し替える） */
export interface SettingsStore {
  load(): Promise<AppSettings>;
  /** 接続しているディスプレイの数（workspaceTargetDisplayIndex の範囲） */
  displayCount(): number;
  /** 弾いた理由は今の表示言語の文言で返す */
  validateHotkey(hotkey: string): Promise<{ isValid: boolean; reason?: string }>;
  /** 今の登録を外さずに、そのキーを登録できるか（他のアプリ・もう一方のホットキーと重ならないか） */
  isHotkeyAvailable(hotkey: string, key: HotkeyKey): boolean;
  /** 画面と同じ処理でホットキーを変えて登録する。登録できなければ false */
  changeHotkey(key: HotkeyKey, hotkey: string): Promise<boolean>;
  /** 保存し、副作用（言語・ウィンドウ）を適用して各ウィンドウに知らせる */
  save(settings: Partial<AppSettings>): Promise<void>;
}

export interface SettingsCommandContext {
  store: SettingsStore;
  changed(message: string): void;
}

type Rule =
  | { kind: 'boolean' }
  | { kind: 'integer'; range?: { min: number; max: number } }
  | { kind: 'choice'; values: readonly string[] }
  | { kind: 'displayIndex' }
  | { kind: 'dataFile' }
  | { kind: 'hotkey' }
  | { kind: 'fixedPosition' };

const BOOLEAN: Rule = { kind: 'boolean' };
const FIXED_POSITION: Rule = { kind: 'fixedPosition' };

/** CLI から変えられる項目と値の決まり（範囲は設定画面と同じ） */
const WRITABLE: Partial<Record<keyof AppSettings, Rule>> = {
  language: { kind: 'choice', values: LANGUAGE_SETTINGS },
  hotkey: { kind: 'hotkey' },
  itemSearchHotkey: { kind: 'hotkey' },
  showKeyboardHints: BOOLEAN,
  searchMemo: BOOLEAN,
  searchIgnoreWidth: BOOLEAN,
  searchIgnoreKana: BOOLEAN,
  recordLaunchUsage: BOOLEAN,
  showDataFileTabs: BOOLEAN,
  defaultFileTab: { kind: 'dataFile' },
  windowWidth: { kind: 'integer', range: SETTING_NUMBER_RANGES.windowWidth },
  windowHeight: { kind: 'integer', range: SETTING_NUMBER_RANGES.windowHeight },
  windowPositionMode: {
    kind: 'choice',
    values: ['center', 'cursor', 'cursorMonitorCenter', 'fixed'],
  },
  windowFixedPosition: FIXED_POSITION,
  windowSnapEnabled: BOOLEAN,
  editModeWidth: { kind: 'integer', range: SETTING_NUMBER_RANGES.editModeWidth },
  editModeHeight: { kind: 'integer', range: SETTING_NUMBER_RANGES.editModeHeight },
  workspaceOpacity: { kind: 'integer', range: SETTING_NUMBER_RANGES.workspaceOpacity },
  workspaceBackgroundTransparent: BOOLEAN,
  // primaryLeft・primaryRight は古い値なので、新しくは選ばせない
  workspacePositionMode: { kind: 'choice', values: ['displayLeft', 'displayRight', 'fixed'] },
  workspaceTargetDisplayIndex: { kind: 'displayIndex' },
  workspaceFixedPosition: FIXED_POSITION,
  workspaceVisibleOnAllDesktops: BOOLEAN,
  detachedVisibleOnAllDesktops: BOOLEAN,
  detachedPositionMode: { kind: 'choice', values: ['saved', 'mainDisplay'] },
  backupEnabled: BOOLEAN,
  backupRetention: { kind: 'integer', range: SETTING_NUMBER_RANGES.backupRetention },
  backupIncludeClipboard: BOOLEAN,
};

export const WRITABLE_SETTING_KEYS = Object.keys(WRITABLE) as Array<keyof AppSettings>;

function isWritable(key: string): key is keyof AppSettings {
  return Object.prototype.hasOwnProperty.call(WRITABLE, key);
}

export async function runSettingsCommand(
  verb: string | undefined,
  args: readonly string[],
  ctx: SettingsCommandContext
): Promise<unknown> {
  switch (verb) {
    case 'get':
      return get(args, ctx);
    case 'set':
      return set(args, ctx);
  }
  throw new CliError(
    'usage',
    verb
      ? mainI18n.t('cli.errors.unknownVerb', { command: `settings ${verb}` })
      : mainI18n.t('cli.errors.missingSettingsVerb')
  );
}

/** 設定にあるキーか確かめる（大文字・小文字は区別する） */
function expectKnownKey(key: string, settings: AppSettings): keyof AppSettings {
  if (Object.prototype.hasOwnProperty.call(settings, key)) return key as keyof AppSettings;
  throw new CliError(
    'not_found',
    mainI18n.t('cli.errors.unknownSettingKey', {
      key,
      keys: WRITABLE_SETTING_KEYS.join(', '),
    })
  );
}

async function get(args: readonly string[], ctx: SettingsCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {});
  if (parsed.positionals.length > 1) expectPositionals(parsed, [mainI18n.t('cli.args.settingKey')]);
  const settings = await ctx.store.load();
  const [key] = parsed.positionals;
  if (key === undefined) return { settings, writable: WRITABLE_SETTING_KEYS };
  const known = expectKnownKey(key, settings);
  return { key: known, value: settings[known], writable: isWritable(known) };
}

async function set(args: readonly string[], ctx: SettingsCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { flags: ['dry-run'] });
  const [key, raw] = expectPositionals(parsed, [
    mainI18n.t('cli.args.settingKey'),
    mainI18n.t('cli.args.settingValue'),
  ]);
  const dryRun = optionFlag(parsed, 'dry-run');
  const settings = await ctx.store.load();
  const known = expectKnownKey(key, settings);
  if (!isWritable(known)) {
    throw new CliError('usage', mainI18n.t('cli.errors.settingReadOnly', { key: known }));
  }
  const rule = WRITABLE[known] as Rule;
  const value = await parseValue(known, raw, rule, settings, ctx.store);
  const before = settings[known];
  const result = { key: known, before, after: value };
  // 固定位置の座標は { x, y } なので、中身で比べる
  if (JSON.stringify(value) === JSON.stringify(before)) return { ...result, unchanged: true };
  if (rule.kind === 'hotkey') checkHotkeyAvailable(known as HotkeyKey, value as string, ctx.store);
  if (dryRun) return { dryRun: true, ...result };

  if (rule.kind === 'hotkey') {
    await changeHotkey(known as HotkeyKey, value as string, before as string, ctx.store);
  } else {
    await ctx.store.save({ [known]: value });
  }
  ctx.changed(
    mainI18n.t('cli.changed.settingUpdated', { key: known, value: formatSettingValue(value) })
  );
  return result;
}

/** トーストに出す値（固定位置の座標は「x,y」、まだ置いていないなら null） */
function formatSettingValue(value: unknown): string {
  if (value && typeof value === 'object' && 'x' in value && 'y' in value) {
    return `${value.x},${value.y}`;
  }
  return String(value);
}

function invalid(key: string, expected: string): CliError {
  return new CliError('invalid', mainI18n.t('cli.errors.fieldInvalid', { key, expected }));
}

/** 文字で渡された値を、項目の型に直して確かめる */
async function parseValue(
  key: keyof AppSettings,
  raw: string,
  rule: Rule,
  settings: AppSettings,
  store: SettingsStore
): Promise<unknown> {
  const text = raw.trim();
  switch (rule.kind) {
    case 'boolean':
      if (text === 'true') return true;
      if (text === 'false') return false;
      throw invalid(key, 'true / false');
    case 'integer': {
      const n = /^-?\d+$/.test(text) ? Number(text) : NaN;
      const { range } = rule;
      const inRange = Number.isSafeInteger(n) && (!range || (n >= range.min && n <= range.max));
      if (inRange) return n;
      throw invalid(
        key,
        range
          ? mainI18n.t('cli.errors.expectedRange', range)
          : mainI18n.t('cli.errors.expectedInteger')
      );
    }
    case 'choice':
      if (rule.values.includes(text)) return text;
      throw invalid(key, rule.values.join(' / '));
    case 'displayIndex': {
      // -1 はメインウィンドウと同じディスプレイ（設定画面の「メインウィンドウと同じディスプレイ」と同じ）
      if (text === String(MAIN_WINDOW_DISPLAY_INDEX)) return MAIN_WINDOW_DISPLAY_INDEX;
      const count = store.displayCount();
      const n = /^\d+$/.test(text) ? Number(text) : NaN;
      if (n < count) return n;
      throw invalid(key, mainI18n.t('cli.errors.expectedDisplayIndex', { max: count - 1 }));
    }
    case 'fixedPosition': {
      // null は「まだ置いていない」（次に出すときに中央・右端へ置き直す）
      if (text === 'null') return null;
      const match = /^(-?\d+)\s*,\s*(-?\d+)$/.exec(text);
      const x = match ? Number(match[1]) : NaN;
      const y = match ? Number(match[2]) : NaN;
      if (Number.isSafeInteger(x) && Number.isSafeInteger(y)) return { x, y };
      throw invalid(key, mainI18n.t('cli.errors.expectedFixedPosition'));
    }
    case 'dataFile': {
      // 起動したときに開くタブは、そのタブに入っているデータファイルで指す（画面と同じ）
      const file = normalizeDataFileName(text);
      const files = settings.dataFileTabs.flatMap((t) => t.files);
      if (files.includes(file)) return file;
      throw new CliError('not_found', mainI18n.t('cli.errors.fileNotInTabs', { file }));
    }
    case 'hotkey': {
      // ウィンドウ検索は空にすると無効になる。ランチャーを開くキーは空にできない
      if (text === '' && key === 'itemSearchHotkey') return '';
      const validation = await store.validateHotkey(text);
      if (!validation.isValid) {
        throw new CliError(
          'invalid',
          mainI18n.t('cli.errors.hotkeyInvalid', {
            hotkey: text,
            reason: validation.reason ?? '',
          })
        );
      }
      return text;
    }
  }
}

/** 他のアプリ・もう一方のホットキーと重なっていたら断る（dry-run でも確かめる） */
function checkHotkeyAvailable(key: HotkeyKey, hotkey: string, store: SettingsStore): void {
  if (hotkey === '' || store.isHotkeyAvailable(hotkey, key)) return;
  throw new CliError('conflict', mainI18n.t('cli.errors.hotkeyInUse', { hotkey }));
}

async function changeHotkey(
  key: HotkeyKey,
  hotkey: string,
  before: string,
  store: SettingsStore
): Promise<void> {
  if (await store.changeHotkey(key, hotkey)) return;
  // 確かめた後に登録できなくなったとき。設定だけ書き換わって効かないままにしないよう、元のキーに戻す
  const now = (await store.load())[key];
  if (now !== before) await store.changeHotkey(key, before);
  throw new CliError('conflict', mainI18n.t('cli.errors.hotkeyInUse', { hotkey }));
}
