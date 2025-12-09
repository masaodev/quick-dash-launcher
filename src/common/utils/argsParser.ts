/**
 * コマンドライン引数のパーサー
 */

/**
 * ダブルクォートを考慮して引数文字列をパースする
 * ダブルクォートは除去して返す（spawnが自動的に処理するため）
 *
 * @param argsString - パースする引数文字列
 * @returns パースされた引数の配列
 *
 * @example
 * parseArgs('-p "Git Bash" -d "C:\\test"')
 * // => ['-p', 'Git Bash', '-d', 'C:\\test']
 *
 * @example
 * parseArgs('--flag value1 value2')
 * // => ['--flag', 'value1', 'value2']
 */
export function parseArgs(argsString: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let hadQuotes = false; // ダブルクォートで囲まれていたかを追跡

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if (char === '"') {
      if (inQuotes) {
        // クォートが閉じられた
        hadQuotes = true;
      }
      inQuotes = !inQuotes;
      // ダブルクォートは除去（spawnが自動的に処理）
    } else if (char === ' ' && !inQuotes) {
      // ダブルクォートで囲まれていた場合は空文字列でもpush
      if (current.length > 0 || hadQuotes) {
        args.push(current);
        current = '';
        hadQuotes = false;
      }
    } else {
      current += char;
    }
  }

  // 最後の引数を追加（ダブルクォートで囲まれていた場合は空文字列でもpush）
  if (current.length > 0 || hadQuotes) {
    args.push(current);
  }

  return args;
}
