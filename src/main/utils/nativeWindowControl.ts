/**
 * koffiを使用したWindows Win32 API呼び出しによるウィンドウ制御
 * ウィンドウ検索機能で使用
 */
import koffi from 'koffi';
import { WindowInfo } from '@common/types';

// user32.dllをロード
const user32 = koffi.load('user32.dll');

// RECT構造体の定義
const RECT = koffi.struct('RECT', {
  left: 'long',
  top: 'long',
  right: 'long',
  bottom: 'long',
});

// Win32 API関数の定義
const EnumWindowsProc = koffi.proto('bool __stdcall EnumWindowsProc(void* hwnd, intptr lParam)');
const EnumWindows = user32.func('EnumWindows', 'bool', [koffi.pointer(EnumWindowsProc), 'intptr']);
const GetWindowTextW = user32.func('GetWindowTextW', 'int', ['void*', 'str16', 'int']);
const GetWindowTextLengthW = user32.func('GetWindowTextLengthW', 'int', ['void*']);
const IsWindowVisible = user32.func('IsWindowVisible', 'bool', ['void*']);
const GetWindowRect = user32.func('GetWindowRect', 'bool', [
  'void*',
  koffi.out(koffi.pointer(RECT, 1)),
]);
const GetWindowThreadProcessId = user32.func('GetWindowThreadProcessId', 'uint32', [
  'void*',
  koffi.out(koffi.pointer('uint32', 1)),
]);
const SetForegroundWindow = user32.func('SetForegroundWindow', 'bool', ['void*']);
const ShowWindow = user32.func('ShowWindow', 'bool', ['void*', 'int']);

// ShowWindow用の定数
const SW_RESTORE = 9;

/**
 * すべてのウィンドウ情報を取得
 * @returns ウィンドウ情報の配列
 */
export function getAllWindows(): WindowInfo[] {
  const windows: WindowInfo[] = [];

  // EnumWindows用のコールバック関数
  const callback = koffi.register((hwnd: unknown, _lParam: number): boolean => {
    try {
      // 表示されていないウィンドウはスキップ
      const isVisible = IsWindowVisible(hwnd);
      if (!isVisible) {
        return true;
      }

      // タイトルを取得
      const length = GetWindowTextLengthW(hwnd);
      if (length === 0) {
        return true; // タイトルなしのウィンドウはスキップ
      }

      const buffer = Buffer.alloc((length + 1) * 2); // Unicode文字列用
      const titleLength = GetWindowTextW(hwnd, buffer, length + 1);
      const title = buffer.toString('utf16le').substring(0, titleLength);

      if (!title || title.trim() === '') {
        return true; // 空のタイトルはスキップ
      }

      // 位置とサイズを取得
      const rect = { left: 0, top: 0, right: 0, bottom: 0 };
      const rectSuccess = GetWindowRect(hwnd, rect);
      if (!rectSuccess) {
        return true;
      }

      // プロセスIDを取得
      const processIdArr = [0];
      GetWindowThreadProcessId(hwnd, processIdArr);
      const processId = processIdArr[0];

      windows.push({
        hwnd: koffi.address(hwnd),
        title,
        x: rect.left,
        y: rect.top,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
        processId,
        isVisible: true,
      });
    } catch (error) {
      console.error('Error processing window:', error);
    }

    return true; // 次のウィンドウへ
  }, koffi.pointer(EnumWindowsProc));

  try {
    EnumWindows(callback, 0);
  } catch (error) {
    console.error('Error enumerating windows:', error);
  } finally {
    // 必ずコールバックを登録解除（メモリリーク防止）
    koffi.unregister(callback);
  }

  return windows;
}

/**
 * ウィンドウをアクティブ化（フォーカス）
 * @param hwnd ウィンドウハンドル
 * @returns 成功したらtrue
 */
export function activateWindow(hwnd: number | bigint): boolean {
  try {
    const hwndNumber = typeof hwnd === 'bigint' ? Number(hwnd) : hwnd;
    return SetForegroundWindow(hwndNumber);
  } catch (error) {
    console.error(`Error activating window ${hwnd}:`, error);
    return false;
  }
}

/**
 * ウィンドウを復元（最小化を解除して通常の状態に戻す）
 * @param hwnd ウィンドウハンドル
 * @returns 成功したらtrue
 */
export function restoreWindow(hwnd: number | bigint): boolean {
  try {
    const hwndNumber = typeof hwnd === 'bigint' ? Number(hwnd) : hwnd;
    return ShowWindow(hwndNumber, SW_RESTORE);
  } catch (error) {
    console.error(`Error restoring window ${hwnd}:`, error);
    return false;
  }
}
