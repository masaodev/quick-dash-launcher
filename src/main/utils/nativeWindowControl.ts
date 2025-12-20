/**
 * koffiを使用したWindows Win32 API呼び出しによるウィンドウ制御
 * ウィンドウ検索機能で使用
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { WindowInfo } from '@common/types';
import koffi from 'koffi';

// user32.dllとkernel32.dll、gdiplus.dllをロード
const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');
const gdiplus = koffi.load('gdiplus.dll');

// RECT構造体の定義
const RECT = koffi.struct('RECT', {
  left: 'long',
  top: 'long',
  right: 'long',
  bottom: 'long',
});

// Win32 API関数の定義（user32.dll）
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
const SendMessageW = user32.func('SendMessageW', 'intptr', ['void*', 'uint32', 'intptr', 'intptr']);
const GetClassLongPtrW = user32.func('GetClassLongPtrW', 'intptr', ['void*', 'int']);

// Win32 API関数の定義（kernel32.dll）
const OpenProcess = kernel32.func('OpenProcess', 'void*', ['uint32', 'bool', 'uint32']);
const CloseHandle = kernel32.func('CloseHandle', 'bool', ['void*']);
const QueryFullProcessImageNameW = kernel32.func('QueryFullProcessImageNameW', 'bool', [
  'void*',
  'uint32',
  'str16',
  koffi.out(koffi.pointer('uint32', 1)),
]);

// GDI+ API関数の定義
const GdiplusStartup = gdiplus.func('GdiplusStartup', 'int', [
  koffi.out(koffi.pointer('uintptr', 1)),
  koffi.pointer(
    koffi.struct('GdiplusStartupInput', {
      GdiplusVersion: 'uint32',
      DebugEventCallback: 'void*',
      SuppressBackgroundThread: 'int',
      SuppressExternalCodecs: 'int',
    })
  ),
  'void*',
]);
const GdiplusShutdown = gdiplus.func('GdiplusShutdown', 'void', ['uintptr']);
const GdipCreateBitmapFromHICON = gdiplus.func('GdipCreateBitmapFromHICON', 'int', [
  'void*',
  koffi.out(koffi.pointer('void*', 1)),
]);
const GdipSaveImageToFile = gdiplus.func('GdipSaveImageToFile', 'int', [
  'void*',
  'str16',
  'void*', // GUIDへのポインタ（Bufferを直接渡す）
  'void*',
]);
const GdipDisposeImage = gdiplus.func('GdipDisposeImage', 'int', ['void*']);

// PNG encoder GUID: {557CF406-1A04-11D3-9A73-0000F81EF32E}
const PNG_ENCODER_GUID = Buffer.from([
  0x06, 0xf4, 0x7c, 0x55, 0x04, 0x1a, 0xd3, 0x11, 0x9a, 0x73, 0x00, 0x00, 0xf8, 0x1e, 0xf3, 0x2e,
]);

// GDI+ ステータスコードの説明
const GDI_STATUS_MESSAGES: Record<number, string> = {
  0: 'Ok',
  1: 'GenericError',
  2: 'InvalidParameter',
  3: 'OutOfMemory',
  4: 'ObjectBusy',
  5: 'InsufficientBuffer',
  6: 'NotImplemented',
  7: 'Win32Error',
  8: 'WrongState',
  9: 'Aborted',
  10: 'FileNotFound',
  11: 'ValueOverflow',
  12: 'AccessDenied',
  13: 'UnknownImageFormat',
  14: 'FontFamilyNotFound',
  15: 'FontStyleNotFound',
  16: 'NotTrueTypeFont',
  17: 'UnsupportedGdiplusVersion',
  18: 'GdiplusNotInitialized',
  19: 'PropertyNotFound',
  20: 'PropertyNotSupported',
};

// 定数
const SW_RESTORE = 9;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

// アイコン関連の定数
const WM_GETICON = 0x007f;
const ICON_SMALL = 0;
const ICON_BIG = 1;
const ICON_SMALL2 = 2;
const GCLP_HICON = -14;

/**
 * ウィンドウからアイコンハンドル（HICON）を取得
 * @param hwnd ウィンドウハンドル
 * @returns アイコンハンドル（HICON）。取得できない場合は0
 */
export function getWindowIcon(hwnd: unknown): bigint {
  try {
    // まず WM_GETICON で大きいアイコンを取得
    let hIcon = SendMessageW(hwnd, WM_GETICON, ICON_BIG, 0);
    if (hIcon !== 0n && hIcon !== 0) {
      return typeof hIcon === 'bigint' ? hIcon : BigInt(hIcon);
    }

    // 次に小さいアイコンを試す
    hIcon = SendMessageW(hwnd, WM_GETICON, ICON_SMALL2, 0);
    if (hIcon !== 0n && hIcon !== 0) {
      return typeof hIcon === 'bigint' ? hIcon : BigInt(hIcon);
    }

    hIcon = SendMessageW(hwnd, WM_GETICON, ICON_SMALL, 0);
    if (hIcon !== 0n && hIcon !== 0) {
      return typeof hIcon === 'bigint' ? hIcon : BigInt(hIcon);
    }

    // 最後にクラスアイコンを試す
    hIcon = GetClassLongPtrW(hwnd, GCLP_HICON);
    if (hIcon !== 0n && hIcon !== 0) {
      return typeof hIcon === 'bigint' ? hIcon : BigInt(hIcon);
    }

    return 0n;
  } catch (error) {
    console.error('[getWindowIcon] Error:', error);
    return 0n;
  }
}

/**
 * HICONをPNG base64文字列に変換
 * @param hIcon アイコンハンドル
 * @returns base64エンコードされたPNG画像。失敗時はundefined
 */
export function convertIconToBase64(hIcon: bigint | number): string | undefined {
  let gdiplusToken: bigint[] = [0n];
  let bitmap: unknown[] = [null];
  let tempFilePath: string | undefined;

  try {
    // GDI+を初期化
    const startupInput = {
      GdiplusVersion: 1,
      DebugEventCallback: null,
      SuppressBackgroundThread: 0,
      SuppressExternalCodecs: 0,
    };

    const status = GdiplusStartup(gdiplusToken, startupInput, null);
    if (status !== 0) {
      const statusMsg = GDI_STATUS_MESSAGES[status] || `Unknown(${status})`;
      console.error(
        `[convertIconToBase64] GdiplusStartup failed: status=${status} (${statusMsg}), hIcon=${hIcon}`
      );
      return undefined;
    }

    // HICONからビットマップを作成
    const hIconPtr = typeof hIcon === 'bigint' ? Number(hIcon) : hIcon;
    const createStatus = GdipCreateBitmapFromHICON(hIconPtr, bitmap);
    if (createStatus !== 0 || !bitmap[0]) {
      const statusMsg = GDI_STATUS_MESSAGES[createStatus] || `Unknown(${createStatus})`;
      console.error(
        `[convertIconToBase64] GdipCreateBitmapFromHICON failed: status=${createStatus} (${statusMsg}), hIcon=${hIcon}, bitmap=${bitmap[0] ? 'created' : 'null'}`
      );
      return undefined;
    }

    // 一時ファイルに保存
    tempFilePath = path.join(
      os.tmpdir(),
      `icon_${Date.now()}_${Math.random().toString(36).substring(7)}.png`
    );
    const saveStatus = GdipSaveImageToFile(bitmap[0], tempFilePath, PNG_ENCODER_GUID, null);
    if (saveStatus !== 0) {
      const statusMsg = GDI_STATUS_MESSAGES[saveStatus] || `Unknown(${saveStatus})`;
      console.error(
        `[convertIconToBase64] GdipSaveImageToFile failed: status=${saveStatus} (${statusMsg}), path=${tempFilePath}`
      );
      return undefined;
    }

    // ファイルを読み込んでbase64エンコード
    const imageBuffer = fs.readFileSync(tempFilePath);
    const base64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    return base64;
  } catch (error) {
    console.error(
      `[convertIconToBase64] Unexpected error: hIcon=${hIcon}, error=${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  } finally {
    // クリーンアップ
    if (bitmap[0]) {
      GdipDisposeImage(bitmap[0]);
    }
    if (gdiplusToken[0] !== 0n) {
      GdiplusShutdown(gdiplusToken[0]);
    }
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.error(
          `[convertIconToBase64] Failed to delete temp file: path=${tempFilePath}, error=${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }
}

/**
 * プロセスIDから実行ファイルのパスを取得
 * @param processId プロセスID
 * @returns 実行ファイルのフルパス。取得できない場合はundefined
 */
export function getExecutablePathFromProcessId(processId: number): string | undefined {
  let hProcess = null;

  try {
    // プロセスハンドルを取得
    hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, processId);

    if (!hProcess || koffi.address(hProcess) === 0n) {
      return undefined;
    }

    // パスを取得するためのバッファを準備
    const buffer = Buffer.alloc(32768); // MAX_PATH * 2 (Unicode)
    const sizeArr = [16384]; // バッファサイズ（文字数）

    const success = QueryFullProcessImageNameW(hProcess, 0, buffer, sizeArr);

    if (!success || sizeArr[0] === 0) {
      return undefined;
    }

    // UTF-16LEでデコード
    const path = buffer.toString('utf16le').substring(0, sizeArr[0]);
    return path;
  } catch (error) {
    console.error(`[getExecutablePath] Error for process ${processId}:`, error);
    return undefined;
  } finally {
    // プロセスハンドルを必ず閉じる
    if (hProcess && koffi.address(hProcess) !== 0n) {
      CloseHandle(hProcess);
    }
  }
}

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

      // 実行ファイルのパスを取得
      const executablePath = getExecutablePathFromProcessId(processId);

      // ウィンドウからアイコンを取得してbase64に変換
      let icon: string | undefined;
      const hIcon = getWindowIcon(hwnd);
      if (hIcon !== 0n) {
        icon = convertIconToBase64(hIcon);
      }

      windows.push({
        hwnd: koffi.address(hwnd),
        title,
        x: rect.left,
        y: rect.top,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
        processId,
        isVisible: true,
        executablePath,
        icon,
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
