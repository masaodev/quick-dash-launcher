/**
 * CLI の引数の読み取りと、失敗の表し方
 *
 * コマンドは「画面 → もの → 操作」の語（例: workspace item add）と、その後ろの位置引数・オプションからなる。
 * オプションは `--name 値` か `--name=値`。値を取らないものはフラグ（`--dry-run`）。
 * `--set key=value` と `--unset key` は何度でも書ける。
 */

/** 失敗の種類。文言を変えても変えない約束（AI・スクリプトが分岐に使う） */
export type CliErrorCode =
  'usage' | 'not_found' | 'ambiguous' | 'invalid' | 'conflict' | 'unavailable' | 'internal';

export interface CliCandidate {
  id: string;
  displayName: string;
  location: string[];
}

export class CliError extends Error {
  constructor(
    readonly code: CliErrorCode,
    message: string,
    readonly candidates?: CliCandidate[]
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export interface ParsedArgs {
  /** 位置引数（コマンドの語を除いたもの） */
  positionals: string[];
  /** 1 回だけ書けるオプション（フラグは '' ではなく true） */
  options: Map<string, string | true>;
  /** --set key=value（書いた順） */
  sets: Array<[string, string]>;
  /** --unset key */
  unsets: string[];
}

export interface OptionSpec {
  /** 値を取るオプション */
  values?: readonly string[];
  /** 値を取らないオプション */
  flags?: readonly string[];
  /** --set / --unset を受け付けるか */
  allowSet?: boolean;
}

export function parseArgs(args: readonly string[], spec: OptionSpec): ParsedArgs {
  const values = new Set(spec.values ?? []);
  const flags = new Set(spec.flags ?? []);
  const result: ParsedArgs = { positionals: [], options: new Map(), sets: [], unsets: [] };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--') || arg === '--') {
      result.positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const name = arg.slice(2, eq < 0 ? undefined : eq);
    const inline = eq < 0 ? undefined : arg.slice(eq + 1);
    const takeValue = (): string => {
      if (inline !== undefined) return inline;
      const next = args[i + 1];
      if (next === undefined) throw new CliError('usage', `--${name} に値がありません`);
      i++;
      return next;
    };

    if ((name === 'set' || name === 'unset') && spec.allowSet) {
      const value = takeValue();
      if (name === 'unset') {
        result.unsets.push(value);
        continue;
      }
      const sep = value.indexOf('=');
      if (sep <= 0)
        throw new CliError('usage', `--set は key=value の形で書いてください: ${value}`);
      result.sets.push([value.slice(0, sep), value.slice(sep + 1)]);
      continue;
    }
    if (flags.has(name)) {
      if (inline !== undefined) throw new CliError('usage', `--${name} は値を取りません`);
      result.options.set(name, true);
      continue;
    }
    if (values.has(name)) {
      if (result.options.has(name))
        throw new CliError('usage', `--${name} が 2 回指定されています`);
      result.options.set(name, takeValue());
      continue;
    }
    throw new CliError('usage', `知らないオプションです: --${name}`);
  }
  return result;
}

export function optionString(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.options.get(name);
  return typeof value === 'string' ? value : undefined;
}

export function optionFlag(parsed: ParsedArgs, name: string): boolean {
  return parsed.options.get(name) === true;
}

export function optionInt(parsed: ParsedArgs, name: string): number | undefined {
  const value = optionString(parsed, name);
  if (value === undefined) return undefined;
  if (!/^-?\d+$/.test(value))
    throw new CliError('usage', `--${name} は整数で指定してください: ${value}`);
  return Number(value);
}

/** 位置引数がちょうど n 個か確かめる */
export function expectPositionals(parsed: ParsedArgs, names: readonly string[]): string[] {
  if (parsed.positionals.length < names.length) {
    throw new CliError('usage', `${names[parsed.positionals.length]} を指定してください`);
  }
  if (parsed.positionals.length > names.length) {
    throw new CliError(
      'usage',
      `余分な引数があります: ${parsed.positionals.slice(names.length).join(' ')}`
    );
  }
  return parsed.positionals;
}
