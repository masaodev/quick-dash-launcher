/**
 * ウィンドウタイトルに基づいてウィンドウを検索するユーティリティ
 * 既存のウィンドウ検索機能を再利用し、アイテム起動時のウィンドウアクティブ化機能を提供する
 */
import { getAllWindows } from './nativeWindowControl.js';

/**
 * ウィンドウタイトルに基づいてウィンドウを検索
 * スペース区切りでAND検索、大文字小文字を区別しない
 *
 * @param windowTitle 検索するウィンドウタイトル（部分一致、スペース区切りで複数キーワード指定可能）
 * @returns 見つかったウィンドウのhwnd、見つからない場合またはエラー時はnull
 *
 * @remarks
 * - getAllWindows()はシステムコールのため、頻繁な呼び出しはパフォーマンスに影響する可能性があります
 * - エラー発生時はnullを返し、呼び出し元で通常起動にフォールバックします
 * - 複数のウィンドウがマッチした場合は最初の1つを返します
 *
 * @example
 * // 単一キーワード検索
 * const hwnd = findWindowByTitle('Google Chrome');
 * // → "Google Chrome - タブ名" のようなウィンドウに一致
 *
 * @example
 * // 複数キーワードでAND検索
 * const hwnd = findWindowByTitle('Visual Studio Code');
 * // → "Visual" と "Studio" と "Code" をすべて含むウィンドウに一致
 */
export function findWindowByTitle(windowTitle: string): bigint | null {
  try {
    // ウィンドウ操作アイテムでは、全仮想デスクトップのウィンドウを検索対象にする
    const windows = getAllWindows({ includeAllVirtualDesktops: true });

    // スペース区切りでキーワードを分割
    const keywords = windowTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 0);

    // すべてのキーワードを含むウィンドウを検索（最初の1つを返す）
    const matchedWindow = windows.find((win) => {
      const titleLower = win.title.toLowerCase();
      return keywords.every((keyword) => titleLower.includes(keyword));
    });

    if (!matchedWindow) {
      return null;
    }

    // hwndをbigintに変換（numberの場合）
    return typeof matchedWindow.hwnd === 'bigint' ? matchedWindow.hwnd : BigInt(matchedWindow.hwnd);
  } catch (error) {
    console.error(
      `[findWindowByTitle] ウィンドウ一覧の取得に失敗しました: windowTitle="${windowTitle}", error=${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
