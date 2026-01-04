/**
 * ウィンドウタイトルに基づいてウィンドウを検索するユーティリティ
 * 既存のウィンドウ検索機能を再利用し、アイテム起動時のウィンドウアクティブ化機能を提供する
 */
import { getAllWindows } from './nativeWindowControl.js';

/**
 * ウィンドウタイトルとプロセス名に基づいてウィンドウを検索
 *
 * @param windowTitle 検索するウィンドウタイトル（部分一致または完全一致）
 * @param exactMatch ウィンドウタイトルの完全一致フラグ（デフォルト: false = 部分一致）
 * @param processName 検索するプロセス名（部分一致、省略時は検索なし）
 * @returns 見つかったウィンドウのhwnd、見つからない場合またはエラー時はnull
 *
 * @remarks
 * - getAllWindows()はシステムコールのため、頻繁な呼び出しはパフォーマンスに影響する可能性があります
 * - エラー発生時はnullを返し、呼び出し元で通常起動にフォールバックします
 * - 複数のウィンドウがマッチした場合は最初の1つを返します
 * - ウィンドウタイトルとプロセス名の両方が指定されている場合は、両方の条件を満たすウィンドウを検索します（AND条件）
 *
 * @example
 * // 部分一致検索（複数キーワードでAND検索）
 * const hwnd = findWindowByTitle('Visual Studio Code');
 * // → "Visual" と "Studio" と "Code" をすべて含むウィンドウに一致
 *
 * @example
 * // 完全一致検索
 * const hwnd = findWindowByTitle('Google Chrome', true);
 * // → "Google Chrome" と完全に一致するウィンドウに一致
 *
 * @example
 * // プロセス名検索
 * const hwnd = findWindowByTitle('', false, 'chrome');
 * // → プロセス名に "chrome" を含むウィンドウに一致（例: chrome.exe）
 *
 * @example
 * // 複合条件（ウィンドウタイトル + プロセス名）
 * const hwnd = findWindowByTitle('Google Chrome', false, 'chrome');
 * // → ウィンドウタイトルに "Google Chrome" を含み、かつプロセス名に "chrome" を含むウィンドウに一致
 */
export function findWindowByTitle(
  windowTitle: string,
  exactMatch: boolean = false,
  processName?: string
): bigint | null {
  try {
    // ウィンドウ操作アイテムでは、全仮想デスクトップのウィンドウを検索対象にする
    const windows = getAllWindows({ includeAllVirtualDesktops: true });

    // 検索条件を適用してウィンドウを検索
    const matchedWindow = windows.find((win) => {
      // ウィンドウタイトルの条件チェック
      let titleMatches = false;
      if (exactMatch) {
        // 完全一致（大文字小文字を区別しない）
        titleMatches = win.title.toLowerCase() === windowTitle.toLowerCase();
      } else {
        // 部分一致（スペース区切りでAND検索）
        const keywords = windowTitle
          .toLowerCase()
          .split(/\s+/)
          .filter((k) => k.length > 0);

        const titleLower = win.title.toLowerCase();
        titleMatches = keywords.every((keyword) => titleLower.includes(keyword));
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
      `[findWindowByTitle] ウィンドウ一覧の取得に失敗しました: windowTitle="${windowTitle}", exactMatch=${exactMatch}, processName="${processName}", error=${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
