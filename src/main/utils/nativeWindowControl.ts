/**
 * koffiを使用したWindows Win32 API呼び出しによるウィンドウ制御
 * ウィンドウ検索機能で使用
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { WindowInfo } from '@common/types';
import koffi from 'koffi';

import { getWindowDesktopNumber, isPinnedWindow } from './virtualDesktop/index.js';

// user32.dll、kernel32.dll、gdiplus.dll、dwmapi.dllをロード
const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');
const gdiplus = koffi.load('gdiplus.dll');
const dwmapi = koffi.load('dwmapi.dll');

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
const IsIconic = user32.func('IsIconic', 'bool', ['void*']);
const IsZoomed = user32.func('IsZoomed', 'bool', ['void*']);
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
const GetWindowLongW = user32.func('GetWindowLongW', 'long', ['void*', 'int']);
const GetWindow = user32.func('GetWindow', 'void*', ['void*', 'uint32']);
const SetWindowPos = user32.func('SetWindowPos', 'bool', [
  'void*', // hWnd
  'void*', // hWndInsertAfter
  'int', // X
  'int', // Y
  'int', // cx (width)
  'int', // cy (height)
  'uint32', // uFlags
]);

// Win32 API関数の定義（kernel32.dll）
const OpenProcess = kernel32.func('OpenProcess', 'void*', ['uint32', 'bool', 'uint32']);
const CloseHandle = kernel32.func('CloseHandle', 'bool', ['void*']);
const QueryFullProcessImageNameW = kernel32.func('QueryFullProcessImageNameW', 'bool', [
  'void*', // hProcess
  'uint32', // dwFlags
  'void*', // lpExeName (バッファポインタ)
  koffi.inout(koffi.pointer('uint32', 1)), // lpdwSize (入出力)
]);

// Win32 API関数の定義（dwmapi.dll）
const DwmGetWindowAttribute = dwmapi.func('DwmGetWindowAttribute', 'long', [
  'void*', // hwnd
  'uint32', // dwAttribute
  koffi.out(koffi.pointer('int', 1)), // pvAttribute
  'uint32', // cbAttribute
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

// Alt+Tabフィルタリング用の定数
const GWL_EXSTYLE = -20; // 拡張ウィンドウスタイル取得用
const WS_EX_TOOLWINDOW = 0x00000080; // ツールウィンドウ（タスクバーに表示しない）
const WS_EX_APPWINDOW = 0x00040000; // アプリウィンドウ（強制的に表示）
const GW_OWNER = 4; // オーナーウィンドウ取得用
const DWMWA_CLOAKED = 14; // DWM クローキング状態取得用
const DWM_CLOAKED_SHELL = 0x2; // システムによる非表示（他の仮想デスクトップ等）

// SetWindowPos用フラグ
const SWP_NOSIZE = 0x0001; // サイズ変更をスキップ
const SWP_NOMOVE = 0x0002; // 位置変更をスキップ
const SWP_NOZORDER = 0x0004; // Zオーダー変更をスキップ
const SWP_NOACTIVATE = 0x0010; // アクティブ化しない

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
    console.error(`[getExecutablePathFromProcessId] Error for process ${processId}:`, error);
    return undefined;
  } finally {
    // プロセスハンドルを必ず閉じる
    if (hProcess && koffi.address(hProcess) !== 0n) {
      CloseHandle(hProcess);
    }
  }
}

/**
 * ウィンドウの状態を取得
 * @param hwnd ウィンドウハンドル
 * @returns ウィンドウの状態（'normal' | 'minimized' | 'maximized'）
 */
function getWindowState(hwnd: unknown): 'normal' | 'minimized' | 'maximized' {
  try {
    // 最小化チェック
    if (IsIconic(hwnd)) {
      return 'minimized';
    }
    // 最大化チェック
    if (IsZoomed(hwnd)) {
      return 'maximized';
    }
    // 通常状態
    return 'normal';
  } catch (error) {
    console.error('[getWindowState] Error:', error);
    return 'normal';
  }
}

/**
 * 実行ファイルパスからプロセス名（ファイル名）を抽出
 * @param executablePath 実行ファイルのフルパス
 * @returns プロセス名（ファイル名部分）。パスがない場合はundefined
 */
function extractProcessName(executablePath: string | undefined): string | undefined {
  if (!executablePath) {
    return undefined;
  }
  try {
    // Windowsパスの区切り文字で分割して最後の要素（ファイル名）を取得
    const parts = executablePath.split('\\');
    const fileName = parts[parts.length - 1];
    // 空文字列の場合はundefinedを返す
    return fileName && fileName.trim() !== '' ? fileName : undefined;
  } catch (error) {
    console.error('[extractProcessName] Error:', error);
    return undefined;
  }
}

/**
 * Alt+Tabに表示されるウィンドウかどうかを判定
 *
 * @param hwnd ウィンドウハンドル
 * @param includeAllVirtualDesktops true: 他の仮想デスクトップのウィンドウも含める
 * @returns Alt+Tabに表示される場合true
 */
function isAltTabWindow(hwnd: unknown, includeAllVirtualDesktops = false): boolean {
  try {
    // クローキング状態をチェック
    if (isWindowCloaked(hwnd, includeAllVirtualDesktops)) {
      return false;
    }

    // 拡張ウィンドウスタイルを取得
    const exStyle = GetWindowLongW(hwnd, GWL_EXSTYLE);
    const hasToolWindowStyle = !!(exStyle & WS_EX_TOOLWINDOW);
    const hasAppWindowStyle = !!(exStyle & WS_EX_APPWINDOW);

    // オーナーウィンドウの有無をチェック
    const owner = GetWindow(hwnd, GW_OWNER);
    const hasOwner = owner !== null && koffi.address(owner) !== 0n;

    // 通常のアプリウィンドウ または 強制表示フラグを持つウィンドウ
    return (!hasToolWindowStyle && !hasOwner) || hasAppWindowStyle;
  } catch (error) {
    console.error('[isAltTabWindow] Error:', error);
    return false;
  }
}

/**
 * ウィンドウがクローキング（非表示）されているかチェック
 *
 * @param hwnd ウィンドウハンドル
 * @param includeAllVirtualDesktops true: 仮想デスクトップによるクローキングは許可
 * @returns クローキングされている場合true
 */
function isWindowCloaked(hwnd: unknown, includeAllVirtualDesktops: boolean): boolean {
  try {
    const cloakedArr = [0];
    const hr = DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloakedArr, 4);

    if (hr !== 0 || cloakedArr[0] === 0) {
      return false; // クローキングされていない
    }

    // includeAllVirtualDesktops=true: システムクローキング（DWM_CLOAKED_SHELL）のみ除外
    // includeAllVirtualDesktops=false: すべてのクローキングを除外
    return !includeAllVirtualDesktops || (cloakedArr[0] & DWM_CLOAKED_SHELL) !== 0;
  } catch {
    // DWM APIが利用できない場合はクローキングされていないとみなす
    return false;
  }
}

/**
 * すべてのウィンドウ情報を取得
 * @param options オプション
 * @param options.includeAllVirtualDesktops trueの場合、全仮想デスクトップのウィンドウを含める（デフォルト: false）
 * @returns ウィンドウ情報の配列
 */
export function getAllWindows(options?: { includeAllVirtualDesktops?: boolean }): WindowInfo[] {
  const windows: WindowInfo[] = [];
  const includeAllVirtualDesktops = options?.includeAllVirtualDesktops ?? false;

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

      // Alt+Tabに表示されないウィンドウはスキップ
      if (!isAltTabWindow(hwnd, includeAllVirtualDesktops)) {
        return true;
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

      // プロセス名を抽出
      const processName = extractProcessName(executablePath);

      // ウィンドウの状態を取得
      const windowState = getWindowState(hwnd);

      // ウィンドウからアイコンを取得してbase64に変換
      let icon: string | undefined;
      const hIcon = getWindowIcon(hwnd);
      if (hIcon !== 0n) {
        icon = convertIconToBase64(hIcon);
      }

      // 仮想デスクトップ番号を取得
      const hwndAddress = koffi.address(hwnd);
      const desktopNumber = getWindowDesktopNumber(hwndAddress);

      // ピン止め状態を取得
      const isPinned = isPinnedWindow(hwndAddress);

      windows.push({
        hwnd: hwndAddress,
        title,
        x: rect.left,
        y: rect.top,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
        processId,
        isVisible: true,
        executablePath,
        processName,
        windowState,
        icon,
        desktopNumber,
        isPinned,
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

/**
 * ウィンドウの位置とサイズを変更
 * 省略されたフィールドは現在の値を維持
 *
 * @param hwnd ウィンドウハンドル
 * @param config 位置・サイズの設定（省略可能なフィールドは変更しない）
 * @returns 成功したらtrue
 *
 * @example
 * // 位置のみ変更
 * setWindowBounds(hwnd, { x: 100, y: 100 })
 *
 * @example
 * // サイズのみ変更
 * setWindowBounds(hwnd, { width: 1920, height: 1080 })
 *
 * @example
 * // 位置とサイズを両方変更
 * setWindowBounds(hwnd, { x: 100, y: 100, width: 1920, height: 1080 })
 */
export function setWindowBounds(
  hwnd: number | bigint,
  config: { x?: number; y?: number; width?: number; height?: number }
): boolean {
  try {
    const hwndNumber = typeof hwnd === 'bigint' ? Number(hwnd) : hwnd;

    // フラグの決定
    let flags = SWP_NOZORDER | SWP_NOACTIVATE;

    // 位置が省略されている場合
    if (config.x === undefined && config.y === undefined) {
      flags |= SWP_NOMOVE;
    }

    // サイズが省略されている場合
    if (config.width === undefined && config.height === undefined) {
      flags |= SWP_NOSIZE;
    }

    // 現在のウィンドウ情報を取得（省略されたフィールドに使用）
    const rect = { left: 0, top: 0, right: 0, bottom: 0 };
    const rectSuccess = GetWindowRect(hwndNumber, rect);

    if (!rectSuccess) {
      console.error(`[setWindowBounds] Failed to get window rect for hwnd=${hwnd}`);
      return false;
    }

    // 位置とサイズを決定（省略されている場合は現在の値を使用）
    const x = config.x ?? rect.left;
    const y = config.y ?? rect.top;
    const width = config.width ?? rect.right - rect.left;
    const height = config.height ?? rect.bottom - rect.top;

    // SetWindowPos を呼び出し（hWndInsertAfter = 0 はZオーダー変更なし）
    const success = SetWindowPos(hwndNumber, 0, x, y, width, height, flags);

    if (!success) {
      console.error(
        `[setWindowBounds] SetWindowPos failed: hwnd=${hwnd}, x=${x}, y=${y}, width=${width}, height=${height}`
      );
    }

    return success;
  } catch (error) {
    console.error(
      `[setWindowBounds] Error: hwnd=${hwnd}, config=${JSON.stringify(config)}, error=${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * ウィンドウの現在の位置とサイズを取得
 *
 * @param hwnd ウィンドウハンドル
 * @returns 位置・サイズ情報。失敗時はnull
 */
export function getWindowBounds(
  hwnd: number | bigint
): { x: number; y: number; width: number; height: number } | null {
  try {
    const hwndNumber = typeof hwnd === 'bigint' ? Number(hwnd) : hwnd;

    const rect = { left: 0, top: 0, right: 0, bottom: 0 };
    const rectSuccess = GetWindowRect(hwndNumber, rect);

    if (!rectSuccess) {
      console.error(`[getWindowBounds] Failed to get window rect for hwnd=${hwnd}`);
      return null;
    }

    return {
      x: rect.left,
      y: rect.top,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
    };
  } catch (error) {
    console.error(
      `[getWindowBounds] Error: hwnd=${hwnd}, error=${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
