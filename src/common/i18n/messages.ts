import type { ja } from './locales/ja';

/** 辞書の値を string に広げた形（ja.ts のリテラル型を外し、訳の辞書がこの形に合わせる） */
type Widen<T> = { readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** 辞書の形（ja.ts が正本） */
export type LocaleMessages = Widen<typeof ja>;

/**
 * 辞書の文言を「キーのパス → 文言」の一覧にする（用語のチェックなどテスト用）
 *
 * @example flattenMessages({ a: { b: 'x' } }) // => { 'a.b': 'x' }
 */
export function flattenMessages(messages: object, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[path] = value;
    } else if (value && typeof value === 'object') {
      Object.assign(result, flattenMessages(value, path));
    }
  }
  return result;
}
