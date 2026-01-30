/**
 * ウィンドウ操作機能
 * 仮想デスクトップ間でのウィンドウ移動、デスクトップ番号の取得など
 *
 * Note: koffiライブラリを使用したネイティブDLL呼び出しのため、any型を使用しています
 */

import { debugLog } from './types.js';
import {
  getMoveWindowToDesktopNumber,
  getGetCurrentDesktopNumber,
  getIsWindowOnDesktopNumber,
  getGetWindowDesktopNumber,
  getGetDesktopCount,
  getPinWindow,
  getUnPinWindow,
  getIsPinnedWindow,
  getGetDesktopName,
} from './dllLoader.js';
import { isVirtualDesktopSupported, getVirtualDesktopGUIDs } from './registryAccess.js';

/**
 * DLL関数の戻り値をbooleanに変換
 * boolean型の場合はそのまま、数値の場合は0以外をtrueとして扱う
 */
function toBooleanResult(result: boolean | number): boolean {
  return typeof result === 'boolean' ? result : result !== 0;
}

/**
 * 現在の仮想デスクトップ番号を取得
 * @returns デスクトップ番号（1から開始）。失敗時は-1
 */
export function getCurrentDesktopNumber(): number {
  if (!isVirtualDesktopSupported()) {
    console.warn('[WindowOps] 仮想デスクトップはサポートされていません');
    return -1;
  }

  const getCurrentDesktopNumberFn = getGetCurrentDesktopNumber();
  if (!getCurrentDesktopNumberFn) {
    console.error('[WindowOps] VirtualDesktopAccessor.dllがロードされていません');
    return -1;
  }

  try {
    // GetCurrentDesktopNumber呼び出し（0ベースのインデックスを返す）
    const desktopIndex = getCurrentDesktopNumberFn();

    debugLog('[WindowOps] 現在のデスクトップインデックス:', desktopIndex);

    // 1ベースの番号に変換して返す
    return desktopIndex + 1;
  } catch (error) {
    console.error('[WindowOps] getCurrentDesktopNumber例外発生:', error);
    return -1;
  }
}

/**
 * ウィンドウを指定された仮想デスクトップに移動
 * VirtualDesktopAccessor.dllを使用
 * 現在のデスクトップは変更されません（移動前のデスクトップに自動的に戻ります）
 * @param hwnd ウィンドウハンドル
 * @param desktopNumber デスクトップ番号（1から開始、0ベースに変換される）
 * @returns 成功したらtrue
 */
export function moveWindowToVirtualDesktop(hwnd: number | bigint, desktopNumber: number): boolean {
  if (!isVirtualDesktopSupported()) {
    console.warn('[WindowOps] 仮想デスクトップはサポートされていません');
    return false;
  }

  const MoveWindowToDesktopNumber = getMoveWindowToDesktopNumber();
  if (!MoveWindowToDesktopNumber) {
    console.error('[WindowOps] VirtualDesktopAccessor.dllがロードされていません');
    return false;
  }

  // デスクトップ番号の検証（1から開始、0ベースに変換）
  if (desktopNumber < 1) {
    console.error(`[WindowOps] デスクトップ番号は1以上である必要があります: ${desktopNumber}`);
    return false;
  }

  // デスクトップ数の上限チェック
  const desktopCount = getDesktopCount();
  if (desktopCount > 0 && desktopNumber > desktopCount) {
    console.error(
      `[WindowOps] デスクトップ番号${desktopNumber}は存在しません（最大: ${desktopCount}）`
    );
    return false;
  }

  // VirtualDesktopAccessorは0ベースのインデックスを使用
  const desktopIndex = desktopNumber - 1;

  debugLog('[WindowOps] moveWindowToVirtualDesktop デバッグ情報:', {
    hwnd: String(hwnd),
    hwndType: typeof hwnd,
    desktopNumber,
    desktopIndex,
  });

  try {
    debugLog('[WindowOps] 関数呼び出し前チェック:', {
      MoveWindowToDesktopNumber: typeof MoveWindowToDesktopNumber,
      isFunction: typeof MoveWindowToDesktopNumber === 'function',
    });

    // MoveWindowToDesktopNumber呼び出し
    const result = MoveWindowToDesktopNumber(hwnd, desktopIndex);

    debugLog('[WindowOps] 実行結果:', result, '型:', typeof result);

    const success = toBooleanResult(result);

    if (success) {
      debugLog('[WindowOps] ウィンドウ移動成功');
      return true;
    } else {
      console.error(`[moveWindowToVirtualDesktop] ウィンドウ移動失敗。戻り値: ${result}`);
      return false;
    }
  } catch (error) {
    console.error('[WindowOps] moveWindowToVirtualDesktop例外発生:', error);
    console.error('[WindowOps] エラースタック:', (error as Error).stack);
    return false;
  }
}

/**
 * ウィンドウが指定された仮想デスクトップにあるかチェック
 * @param hwnd ウィンドウハンドル
 * @param desktopNumber デスクトップ番号（1から開始、0ベースに変換される）
 * @returns 指定されたデスクトップにある場合true、それ以外false
 */
export function isWindowOnDesktopNumber(hwnd: number | bigint, desktopNumber: number): boolean {
  if (!isVirtualDesktopSupported()) {
    console.warn('[WindowOps] 仮想デスクトップはサポートされていません');
    return false;
  }

  const isWindowOnDesktopNumberFn = getIsWindowOnDesktopNumber();
  if (!isWindowOnDesktopNumberFn) {
    console.error('[WindowOps] VirtualDesktopAccessor.dllがロードされていません');
    return false;
  }

  // デスクトップ番号の検証
  if (desktopNumber < 1) {
    console.error(`[WindowOps] デスクトップ番号は1以上である必要があります: ${desktopNumber}`);
    return false;
  }

  // VirtualDesktopAccessorは0ベースのインデックスを使用
  const desktopIndex = desktopNumber - 1;

  try {
    const result = isWindowOnDesktopNumberFn(hwnd, desktopIndex);
    const isOnDesktop = toBooleanResult(result);

    debugLog(
      '[WindowOps] isWindowOnDesktopNumber チェック結果:',
      isOnDesktop,
      'デスクトップ:',
      desktopNumber
    );

    return isOnDesktop;
  } catch (error) {
    console.error('[WindowOps] isWindowOnDesktopNumber例外発生:', error);
    return false;
  }
}

/**
 * ウィンドウが所属する仮想デスクトップ番号を取得
 * @param hwnd ウィンドウハンドル
 * @returns デスクトップ番号（1から開始）。失敗時は-1
 */
export function getWindowDesktopNumber(hwnd: number | bigint): number {
  if (!isVirtualDesktopSupported()) {
    return -1;
  }

  const getWindowDesktopNumberFn = getGetWindowDesktopNumber();
  if (!getWindowDesktopNumberFn) {
    return -1;
  }

  try {
    // GetWindowDesktopNumber呼び出し（0ベースのインデックスを返す）
    const desktopIndex = getWindowDesktopNumberFn(hwnd);

    if (desktopIndex < 0) {
      return -1;
    }

    // 1ベースの番号に変換して返す
    return desktopIndex + 1;
  } catch (error) {
    console.error('[WindowOps] getWindowDesktopNumber例外発生:', error);
    return -1;
  }
}

/**
 * 仮想デスクトップの数を取得
 * @returns デスクトップ数。失敗時は-1
 */
export function getDesktopCount(): number {
  if (!isVirtualDesktopSupported()) {
    return -1;
  }

  const getDesktopCountFn = getGetDesktopCount();
  if (!getDesktopCountFn) {
    // DLLが利用できない場合はレジストリから取得
    const guids = getVirtualDesktopGUIDs();
    return guids.length > 0 ? guids.length : -1;
  }

  try {
    const count = getDesktopCountFn();
    return count > 0 ? count : -1;
  } catch (error) {
    console.error('[WindowOps] getDesktopCount例外発生:', error);
    // フォールバック: レジストリから取得
    const guids = getVirtualDesktopGUIDs();
    return guids.length > 0 ? guids.length : -1;
  }
}

/**
 * ウィンドウを全ての仮想デスクトップに固定
 * @param hwnd ウィンドウハンドル
 * @returns 成功したらtrue
 */
export function pinWindow(hwnd: number | bigint): boolean {
  if (!isVirtualDesktopSupported()) {
    console.warn('[WindowOps] 仮想デスクトップはサポートされていません');
    return false;
  }

  const pinWindowFn = getPinWindow();
  if (!pinWindowFn) {
    console.error('[WindowOps] VirtualDesktopAccessor.dllがロードされていません');
    return false;
  }

  try {
    const result = pinWindowFn(hwnd);
    const success = toBooleanResult(result);

    if (success) {
      debugLog('[WindowOps] ウィンドウ固定成功');
    } else {
      console.error(`[WindowOps] ウィンドウ固定失敗。戻り値: ${result}`);
    }
    return success;
  } catch (error) {
    console.error('[WindowOps] pinWindow例外発生:', error);
    return false;
  }
}

/**
 * ウィンドウの固定を解除
 * @param hwnd ウィンドウハンドル
 * @returns 成功したらtrue
 */
export function unPinWindow(hwnd: number | bigint): boolean {
  if (!isVirtualDesktopSupported()) {
    console.warn('[WindowOps] 仮想デスクトップはサポートされていません');
    return false;
  }

  const unPinWindowFn = getUnPinWindow();
  if (!unPinWindowFn) {
    console.error('[WindowOps] VirtualDesktopAccessor.dllがロードされていません');
    return false;
  }

  try {
    const result = unPinWindowFn(hwnd);
    const success = toBooleanResult(result);

    if (success) {
      debugLog('[WindowOps] ウィンドウ固定解除成功');
    } else {
      console.error(`[WindowOps] ウィンドウ固定解除失敗。戻り値: ${result}`);
    }
    return success;
  } catch (error) {
    console.error('[WindowOps] unPinWindow例外発生:', error);
    return false;
  }
}

/**
 * ウィンドウが全ての仮想デスクトップに固定されているか確認
 * @param hwnd ウィンドウハンドル
 * @returns 固定されている場合true
 */
export function isPinnedWindow(hwnd: number | bigint): boolean {
  if (!isVirtualDesktopSupported()) {
    return false;
  }

  const isPinnedWindowFn = getIsPinnedWindow();
  if (!isPinnedWindowFn) {
    return false;
  }

  try {
    const result = isPinnedWindowFn(hwnd);
    const isPinned = toBooleanResult(result);

    debugLog('[WindowOps] isPinnedWindow チェック結果:', isPinned);
    return isPinned;
  } catch (error) {
    console.error('[WindowOps] isPinnedWindow例外発生:', error);
    return false;
  }
}

/**
 * 指定デスクトップの名前を取得（Win11専用）
 * @param desktopNumber デスクトップ番号（1から開始）
 * @returns 名前（未設定または取得失敗時はundefined）
 */
export function getDesktopName(desktopNumber: number): string | undefined {
  const getDesktopNameFn = getGetDesktopName();
  if (!getDesktopNameFn) {
    return undefined; // Win10などDLL未対応
  }

  const desktopIndex = desktopNumber - 1; // 0ベースに変換
  const bufferSize = 512;
  const buffer = Buffer.alloc(bufferSize);

  try {
    const result = getDesktopNameFn(desktopIndex, buffer, bufferSize);
    if (result < 0) {
      return undefined;
    }

    // UTF-8文字列として読み取り、null終端で切り詰め
    const name = buffer.toString('utf8').replace(/\0+$/, '').trim();
    return name.length > 0 ? name : undefined;
  } catch (error) {
    debugLog('[WindowOps] getDesktopName例外:', error);
    return undefined;
  }
}

/**
 * 全デスクトップの名前を取得
 * @returns デスクトップ番号（1-N）と名前のマップ
 */
export function getAllDesktopNames(): Record<number, string | undefined> {
  const count = getDesktopCount();
  if (count <= 0) {
    return {};
  }

  const names: Record<number, string | undefined> = {};
  for (let i = 1; i <= count; i++) {
    names[i] = getDesktopName(i);
  }
  return names;
}
