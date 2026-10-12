import * as path from 'path';

import { validateJsonItem } from '@common/utils/jsonParser';
import { validateEditableItem } from '@common/types/editableItem';
import type { JsonItem } from '@common/types';

import { CliError } from './cliArgs.js';
import type { CliCandidate, ParsedArgs } from './cliArgs.js';

/** URL・カスタム URI・shell: など（ドライブレター 1 文字の「C:」は除く） */
const URI_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]+:/;

/**
 * --path の値を保存する形にする
 *
 * 相対パス（. で始まる、または \ / を含む）だけを qdl を実行したフォルダ基準の絶対パスにする。
 * notepad.exe や code のように PATH から探すコマンド、URL、%USERPROFILE% で始まるパスはそのまま。
 */
export function resolveCliPath(value: string, cwd: string): string {
  const trimmed = value.trim();
  if (URI_SCHEME.test(trimmed)) return trimmed;
  if (/^%[^%]+%/.test(trimmed)) return trimmed;
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')) return trimmed;
  if (trimmed.startsWith('.') || trimmed.includes('\\') || trimmed.includes('/')) {
    if (!cwd)
      throw new CliError(
        'usage',
        `相対パスを解決できません（実行したフォルダが分かりません）: ${value}`
      );
    return path.win32.resolve(cwd, trimmed);
  }
  return trimmed;
}

/**
 * --set key=value の値。JSON の配列・オブジェクト・数値・true/false・null はその型にし、それ以外は文字列。
 * 数字を文字列として入れたいときは "123" のように JSON の文字列で書く
 */
export function parseSetValue(raw: string): unknown {
  const text = raw.trim();
  if (/^(\[|\{|"|true$|false$|null$|-?\d+(\.\d+)?$)/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {
      throw new CliError('usage', `--set の値を JSON として読めません: ${raw}`);
    }
  }
  return raw;
}

/** --set / --unset で触らせない項目（id・種類・所属・並び順は専用のオプションで変える） */
const PROTECTED_KEYS = new Set([
  'id',
  'type',
  'updatedAt',
  'order',
  'addedAt',
  'groupId',
  'workspaceId',
]);

/**
 * 変更内容（専用オプション＋ --set ／ --unset）を今の内容に当てた結果を返す
 */
export function applyPatch(
  current: Record<string, unknown>,
  fields: Record<string, unknown>,
  parsed: ParsedArgs
): { merged: Record<string, unknown>; setKeys: string[] } {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) merged[key] = value;
  }
  const setKeys: string[] = [];
  for (const [key, raw] of parsed.sets) {
    if (PROTECTED_KEYS.has(key)) throw new CliError('usage', `--set では ${key} を変えられません`);
    merged[key] = parseSetValue(raw);
    setKeys.push(key);
  }
  for (const key of parsed.unsets) {
    if (PROTECTED_KEYS.has(key)) throw new CliError('usage', `--unset では ${key} を外せません`);
    delete merged[key];
  }
  return { merged, setKeys };
}

/**
 * データファイルのアイテムとして検証し、正規化した形を返す（読み込み時と同じ検証）。
 * --set で書いた項目のうち、その種類に無いものは「知らない項目」として断る（黙って落とさない）
 */
export function validateAsDataItem(
  candidate: Record<string, unknown>,
  setKeys: string[]
): JsonItem {
  let cleaned: JsonItem;
  try {
    cleaned = validateJsonItem(candidate, 0);
  } catch (error) {
    throw new CliError('invalid', `内容が正しくありません: ${(error as Error).message}`);
  }
  const unknown = setKeys.filter((key) => !(key in cleaned));
  if (unknown.length > 0) {
    throw new CliError(
      'invalid',
      `種類 ${cleaned.type} には無い項目です: ${unknown.join(', ')}（docs の設定ファイルの形式を確認してください）`
    );
  }
  const result = validateEditableItem(cleaned);
  if (!result.isValid) throw new CliError('invalid', `内容が正しくありません: ${result.error}`);
  return cleaned;
}

/**
 * id か表示名の完全一致で 1 件に絞る。0 件なら not_found、複数なら候補を付けて ambiguous
 */
export function resolveOne<T>(
  key: string,
  entries: readonly T[],
  what: string,
  getId: (e: T) => string,
  getName: (e: T) => string,
  toCandidate: (e: T) => CliCandidate
): T {
  const byId = entries.filter((e) => getId(e) === key);
  if (byId.length === 1) return byId[0];
  const byName = entries.filter((e) => getName(e) === key.trim());
  if (byName.length === 1) return byName[0];
  if (byName.length === 0) {
    throw new CliError(
      'not_found',
      `${what}「${key}」が見つかりません（id か表示名の完全一致で指定します）`
    );
  }
  throw new CliError(
    'ambiguous',
    `${what}「${key}」が ${byName.length} 件あります。id で指定してください`,
    byName.map(toCandidate)
  );
}

/** --grep: 大文字小文字を区別しない部分一致 */
export function matchesGrep(grep: string | undefined, values: unknown[]): boolean {
  if (!grep) return true;
  const needle = grep.toLowerCase();
  return values.some(
    (v) =>
      (typeof v === 'string' && v.toLowerCase().includes(needle)) ||
      (Array.isArray(v) && v.some((x) => typeof x === 'string' && x.toLowerCase().includes(needle)))
  );
}
