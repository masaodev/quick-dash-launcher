/**
 * CSV行パーサーユーティリティ
 * ダブルクォートで囲まれたフィールドや、エスケープされたクォートを正しく処理する
 */

/**
 * CSVフィールドをエスケープする
 *
 * ダブルクォートまたはカンマを含む場合、内部のダブルクォートを倍増し、
 * 全体をダブルクォートで囲む。それ以外はそのまま返す。
 *
 * @param value - エスケープ対象の値
 * @returns エスケープされた値
 *
 * @example
 * ```typescript
 * escapeCSV('hello')
 * // => 'hello'
 *
 * escapeCSV('a,b')
 * // => '"a,b"'
 *
 * escapeCSV('a "test" b')
 * // => '"a ""test"" b"'  (ダブルクォートを含むのでエスケープ)
 *
 * escapeCSV('a "test", b')
 * // => '"a ""test"", b"'  (カンマとダブルクォートを含むのでエスケープ)
 *
 * escapeCSV('"test"')
 * // => '"""test"""'  (外側のダブルクォートも保持される)
 * ```
 */
export function escapeCSV(value: string): string {
  // ダブルクォートまたはカンマを含む場合のみエスケープ
  if (value.includes('"') || value.includes(',')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * CSV行を解析してフィールドの配列に分割する
 *
 * 以下のCSV仕様をサポート:
 * - カンマ区切りのフィールド
 * - ダブルクォートで囲まれたフィールド（カンマを含む場合など）
 * - エスケープされたダブルクォート（"" として表現）
 * - フィールドが先頭からダブルクォートで囲まれていない場合、内部のダブルクォートはそのまま保持される
 *
 * @param line - 解析対象のCSV行（カンマ区切りの文字列）
 * @returns 解析されたフィールドの配列（各フィールドはトリムされる）
 *
 * @example
 * ```typescript
 * parseCSVLine('name,path,type')
 * // => ['name', 'path', 'type']
 *
 * parseCSVLine('"Google","https://google.com",url')
 * // => ['Google', 'https://google.com', 'url']
 *
 * parseCSVLine('"Company ""X""","path",exe')
 * // => ['Company "X"', 'path', 'exe']
 * ```
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let fieldStartsWithQuote = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    // フィールドの開始位置を判定（ダブルクォート内部では再設定しない）
    if (current === '' && !inQuotes && char !== ' ' && char !== '\t') {
      fieldStartsWithQuote = char === '"';
    }

    if (char === '"' && fieldStartsWithQuote) {
      // フィールドがダブルクォートで開始している場合のみCSVルールを適用
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      fieldStartsWithQuote = false;
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  if (current || inQuotes) {
    result.push(current.trim());
  }

  return result;
}
