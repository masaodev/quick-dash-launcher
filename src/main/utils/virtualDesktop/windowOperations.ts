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
} from './dllLoader.js';
import { isVirtualDesktopSupported, getVirtualDesktopGUIDs } from './registryAccess.js';

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

  // VirtualDesktopAccessorは0ベースのインデックスを使用
  const desktopIndex = desktopNumber - 1;

  // HWNDの型変換
  const hwndValue = typeof hwnd === 'bigint' ? hwnd : hwnd;

  debugLog('[WindowOps] moveWindowToVirtualDesktop デバッグ情報:', {
    hwnd: String(hwnd),
    hwndValue: String(hwndValue),
    hwndType: typeof hwndValue,
    desktopNumber,
    desktopIndex,
  });

  try {
    debugLog('[WindowOps] 関数呼び出し前チェック:', {
      MoveWindowToDesktopNumber: typeof MoveWindowToDesktopNumber,
      isFunction: typeof MoveWindowToDesktopNumber === 'function',
    });

    // MoveWindowToDesktopNumber呼び出し
    const result = MoveWindowToDesktopNumber(hwndValue, desktopIndex);

    debugLog('[WindowOps] 実行結果:', result, '型:', typeof result);

    // 戻り値の型に応じて処理
    const success = typeof result === 'boolean' ? result : result !== 0;

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

  // HWNDの型変換
  const hwndValue = typeof hwnd === 'bigint' ? hwnd : hwnd;

  try {
    const result = isWindowOnDesktopNumberFn(hwndValue, desktopIndex);

    // 戻り値の型に応じて処理
    const isOnDesktop = typeof result === 'boolean' ? result : result !== 0;

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

  // HWNDの型変換
  const hwndValue = typeof hwnd === 'bigint' ? hwnd : hwnd;

  try {
    // GetWindowDesktopNumber呼び出し（0ベースのインデックスを返す）
    const desktopIndex = getWindowDesktopNumberFn(hwndValue);

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
