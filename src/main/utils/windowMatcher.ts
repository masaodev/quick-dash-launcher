/**
 * ウィンドウタイトルに基づいてウィンドウを検索するユーティリティ
 * 既存のウィンドウ検索機能を再利用し、アイテム起動時のウィンドウアクティブ化機能を提供する
 */
import { getAllWindows } from './nativeWindowControl.js';

/**
 * ワイルドカードパターンを正規表現に変換
 * @param pattern ワイルドカードパターン（* = 任意の文字列、? = 任意の1文字）
 * @returns 正規表現
 */
function wildcardToRegex(pattern: string): RegExp {
  // 正規表現の特殊文字をエスケープ（*と?以外）
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // *を.*に、?を.に変換
  const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  // 完全一致として扱う（^と$で囲む）
  return new RegExp(`^${regexPattern}$`, 'i');
}

/**
 * ワイルドカード文字が含まれているかチェック
 * @param text チェックする文字列
 * @returns ワイルドカード文字が含まれている場合true
 */
function hasWildcard(text: string): boolean {
  return text.includes('*') || text.includes('?');
}

/**
 * ウィンドウタイトルとプロセス名に基づいてウィンドウを検索
 *
 * @param windowTitle 検索するウィンドウタイトル
 * @param processName 検索するプロセス名（部分一致、省略時は検索なし）
 * @returns 見つかったウィンドウのhwnd、見つからない場合またはエラー時はnull
 *
 * @remarks
 * - getAllWindows()はシステムコールのため、頻繁な呼び出しはパフォーマンスに影響する可能性があります
 * - エラー発生時はnullを返し、呼び出し元で通常起動にフォールバックします
 * - 複数のウィンドウがマッチした場合は最初の1つを返します
 * - ウィンドウタイトルとプロセス名の両方が指定されている場合は、両方の条件を満たすウィンドウを検索します（AND条件）
 *
 * ワイルドカード検索:
 * - ワイルドカード文字（*または?）が含まれている場合、ワイルドカードマッチングを実行
 *   - `*`: 任意の0文字以上の文字列
 *   - `?`: 任意の1文字
 * - ワイルドカード文字が含まれていない場合、完全一致検索を実行
 * - 大文字小文字は区別しない
 *
 * @example
 * // 完全一致検索（ワイルドカードなし）
 * const hwnd = findWindowByTitle('Google Chrome');
 * // → "Google Chrome" と完全に一致するウィンドウに一致
 *
 * @example
 * // ワイルドカード検索（部分一致）
 * const hwnd = findWindowByTitle('*Google Chrome*');
 * // → "xxx Google Chrome xxx" や "Google Chrome - New Tab" に一致
 *
 * @example
 * // ワイルドカード検索（前方一致）
 * const hwnd = findWindowByTitle('Google*');
 * // → "Google Chrome", "Google Drive" などに一致
 *
 * @example
 * // プロセス名検索
 * const hwnd = findWindowByTitle('', 'chrome');
 * // → プロセス名に "chrome" を含むウィンドウに一致（例: chrome.exe）
 *
 * @example
 * // 複合条件（ウィンドウタイトル + プロセス名）
 * const hwnd = findWindowByTitle('*Chrome*', 'chrome');
 * // → ウィンドウタイトルに "Chrome" を含み、かつプロセス名に "chrome" を含むウィンドウに一致
 */
export function findWindowByTitle(windowTitle: string, processName?: string): bigint | null {
  try {
    // ウィンドウ操作アイテムでは、全仮想デスクトップのウィンドウを検索対象にする
    const windows = getAllWindows({ includeAllVirtualDesktops: true });

    // ワイルドカードの有無をチェック
    const useWildcard = hasWildcard(windowTitle);
    const regex = useWildcard ? wildcardToRegex(windowTitle) : null;

    // 検索条件を適用してウィンドウを検索
    const matchedWindow = windows.find((win) => {
      // ウィンドウタイトルの条件チェック
      let titleMatches = false;
      if (useWildcard && regex) {
        // ワイルドカードマッチング
        titleMatches = regex.test(win.title);
      } else {
        // 完全一致（大文字小文字を区別しない）
        titleMatches = win.title.toLowerCase() === windowTitle.toLowerCase();
      }

      // プロセス名の条件チェック（指定されている場合のみ）
      let processMatches = true;
      if (processName && processName.trim() !== '') {
        if (win.processName) {
          const processNameLower = win.processName.toLowerCase();
          const searchProcessNameLower = processName.toLowerCase();
          processMatches = processNameLower.includes(searchProcessNameLower);
        } else {
          // プロセス名が取得できない場合は条件を満たさない
          processMatches = false;
        }
      }

      // ウィンドウタイトルとプロセス名の両方の条件を満たす必要がある
      return titleMatches && processMatches;
    });

    if (!matchedWindow) {
      return null;
    }

    // hwndをbigintに変換（numberの場合）
    return typeof matchedWindow.hwnd === 'bigint' ? matchedWindow.hwnd : BigInt(matchedWindow.hwnd);
  } catch (error) {
    console.error(
      `[findWindowByTitle] ウィンドウ一覧の取得に失敗しました: windowTitle="${windowTitle}", processName="${processName}", error=${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
